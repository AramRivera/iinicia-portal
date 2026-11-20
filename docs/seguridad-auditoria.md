# Seguridad Operativa, Matriz de Permisos y Auditoría — Portal IINICIA

**Fecha de consolidación:** 14 de noviembre de 2026  
**Documentos de referencia:** [Proyecto Rediseño y Migración IINICIA](../Proyecto_Rediseno_Migracion_Portal_IINICIA_React_Moodle.md) (Secciones 7, 8, 10, 11, 14 y 19), [Alcance Vigente](../ALCANCE.md), [Línea Base Supabase](../supabase/migrations/20261115000000_baseline_schema.sql), [Contrato OpenAPI](openapi.yaml).  
**Criterios de aceptación:** `CA-03`, `CA-04`, `CA-05`, `CA-06`, `CA-10`, `CA-14`, `CA-15`, `CA-19`.

---

## 1. Arquitectura de Seguridad y Roles (RBAC)

La plataforma IINICIA implementa un modelo de control de acceso basado en roles jerárquicos (RBAC) con comprobación dual:
1. **En el motor PostgreSQL (Capa de Datos):** Mediante Row Level Security (RLS), funciones `SECURITY DEFINER` con `search_path = ''` y revocación de privilegios directos de escritura en tablas críticas.
2. **En NestJS (Capa de API):** Mediante `SupabaseAuthGuard` (validación de token JWT y AAL2), `RolesGuard` y `PermissionsGuard`.

### Catálogo de Roles del Sistema

| ID | Slug | Nombre | Nivel Jerárquico | Arquetipo Moodle | Ámbito y Responsabilidades |
|:---:|---|---|:---:|---|---|
| **1** | `superadministrador` | Superadministrador | 100 | `manager` | Control total del sistema, integraciones, parámetros globales y auditoría. |
| **2** | `administrador` | Administrador | 90 | `manager` | Gestión de usuarios, programas, admisiones, cursos y matrículas. |
| **3** | `coordinador` | Coordinador | 70 | `coursecreator` | Gestión académica y admisiones restringidas a los programas bajo su ámbito. |
| **4** | `profesor` | Profesor | 50 | `editingteacher` | Acceso docente al aula virtual, participantes y calificador de cursos asignados. |
| **5** | `estudiante` | Estudiante | 30 | `student` | Consulta de oferta, seguimiento de cursos matriculados y acceso SSO al campus. |
| **6** | `soporte` | Soporte | 20 | NULL | Consulta operativa de directorios y diagnóstico de cuentas. |
| **7** | `aspirante` | Aspirante | 10 | NULL | Registro inicial, postulación y consulta de dictamen (sin acceso a cursos). |

---

## 2. Matriz de Permisos Efectivos por Rol

La plataforma cuenta con 12 permisos atómicos distribuidos en la tabla `public.role_permissions`:

| Código del Permiso | Módulo | Superadmin | Admin | Coordinador | Profesor | Estudiante | Soporte | Aspirante |
|---|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| `system.settings.manage` | `system` | **✓** | — | — | — | — | — | — |
| `audit.logs.read` | `audit` | **✓** | **✓** | — | — | — | — | — |
| `users.read` | `users` | **✓** | **✓** | **✓** | — | — | **✓** | — |
| `users.manage` | `users` | **✓** | **✓** | — | — | — | — | — |
| `roles.assign` | `roles` | **✓** | **✓** | — | — | — | — | — |
| `programs.manage` | `programs` | **✓** | **✓** | — | — | — | — | — |
| `courses.manage` | `courses` | **✓** | **✓** | — | — | **✓\*** | — | — |
| `enrollments.authorize` | `enrollments` | **✓** | **✓** | **✓\*\*** | — | — | — | — |
| `moodle.sync.execute` | `moodle` | **✓** | **✓** | — | — | — | — | — |
| `campus.access` | `campus` | **✓** | **✓** | **✓** | **✓** | **✓** | — | — |
| `cms.manage` | `cms` | **✓** | **✓** | — | — | — | — | — |
| `admissions.review` | `admissions` | **✓** | **✓** | **✓\*\*** | — | — | — | — |
| **Total Permisos** | | **12** | **11** | **4** | **1** | **1** | **1** | **0** |

- *\* Nota:* El estudiante tiene acceso de consulta a los cursos en los que está matriculado.
- *\*\* Nota:* El coordinador solo puede dictaminar admisiones y autorizar matrículas de los programas asignados formalmente en `public.user_programs` con estado admitido, inscrito o cursando. Intentos fuera de ámbito son rechazados con código `42501` (`Dictamen fuera de ámbito`).

---

## 3. Trazabilidad y Auditoría Inmutable (`public.audit_logs`)

De conformidad con el criterio `CA-19`, toda mutación administrativa sobre usuarios, roles, admisiones y matrículas genera un registro en la tabla `public.audit_logs`:

### Estructura de la Bitácora
- `id`: Identificador UUID único.
- `actor_id`: UUID del usuario que ejecuta la acción (o NULL para eventos automáticos de sistema).
- `target_user_id`: UUID del usuario afectado por la operación.
- `action`: Código estandarizado del evento (ej: `ROLE_ASSIGNED`, `USER_STATUS_UPDATED`).
- `entity_name`: Nombre de la tabla afectada (`profiles`, `user_roles`, `admission_applications`, etc.).
- `entity_id`: Identificador del registro modificado.
- `old_values`: Snapshot en formato JSONB con los valores anteriores.
- `new_values`: Snapshot en formato JSONB con los nuevos valores asignados.
- `created_at`: Marca de tiempo UTC inmutable generada por el servidor.

### Catálogo de Eventos Auditados
1. `USER_REGISTERED`: Registro público de un nuevo aspirante vía Supabase Auth.
2. `USER_CREATED_BY_ADMIN`: Alta administrativa directa con asignación de rol definitivo.
3. `USER_STATUS_UPDATED`: Suspensión, reactivación o baja de un perfil de usuario.
4. `ROLE_ASSIGNED`: Asignación de un nuevo rol con fecha de expiración opcional.
5. `ROLE_REVOKED`: Retiro o desactivación de un rol asignado.
6. `ADMISSION_REVIEWED`: Dictamen de admisión (admitido / rechazado) emitido por coordinación o administración.
7. `ENROLLMENT_AUTHORIZED`: Aprobación y matriculación en un curso específico.
8. `MOODLE_USER_SYNCED`: Vinculación o aprovisionamiento exitoso de una identidad en Moodle.
9. `CAMPUS_LAUNCHED`: Generación de enlace temporal de acceso SSO al aula virtual.

### Garantías de Inmutabilidad (RLS)
- **Lectura:** Exclusiva para administradores (`public.is_admin() = true`). Los estudiantes y profesores reciben 0 registros.
- **Escritura:** La migración `20261120120000_limit_client_privileges.sql` reserva la inserción a la API y los disparadores internos.
- **Prohibición de Borrado y Edición:** No existe ninguna política de `UPDATE` ni `DELETE` para clientes en `public.audit_logs`. La bitácora es estrictamente de adición (*append-only*).

---

## 4. Desacoplamiento de Credenciales y Moodle (`CA-04`, `CA-10`, `CA-14`)

> [!IMPORTANT]
> Siguiendo la Sección 11 del documento de proyecto, **las contraseñas nunca se sincronizan en texto plano entre Supabase Auth y Moodle**.

### Flujo Seguro de Aprovisionamiento
1. Cuando un usuario se crea en el portal, Supabase Auth almacena el hash criptográfico (`bcrypt`/`argon2`).
2. Al sincronizar con Moodle LMS, `MoodleService.syncUser`:
   - Realiza primero una búsqueda por correo electrónico (`getUserByEmail`) para vincular cuentas existentes sin duplicados (`CA-10`).
   - Si no existe, genera una contraseña temporal interna con alta entropía mediante `generateTemporaryPassword()` (alfanumérico y símbolos) que cumple con la política de Moodle.
   - Nunca expone la contraseña elegida por el usuario en Supabase Auth a las llamadas de red hacia Moodle.
3. El ingreso de estudiantes y profesores al campus no requiere que el usuario ingrese contraseñas en Moodle: se realiza a través de enlaces firmados SSO (`auth_userkey`), garantizando una experiencia unificada sin fuga de credenciales.

---

## 5. Autenticación Multifactor (TOTP AAL2) y CAPTCHA (`CA-03`)

1. **Reto CAPTCHA en Puntos de Entrada:** Cloudflare Turnstile protege `/registro`, `/login` y `/recuperar-password` contra abusos automatizados.
2. **MFA Obligatorio (AAL2):**
   - El inicio de sesión completa el primer factor (AAL1) y requiere inmediatamente la verificación de un código TOTP de 6 dígitos con el factor registrado `IINICIA`.
   - Las consultas a la Data API de Supabase y las rutas administrativas de NestJS son filtradas por el pre-request hook `iinicia_require_mfa` de PostgREST, rechazando cualquier solicitud con nivel `aal1` con código HTTP `42501` (`Se requiere autenticación multifactor AAL2`).


## Verificación de administración, coordinación y soporte

- **Administración:** puede gestionar cuentas y roles operativos, programas, admisiones y matrículas. Las cuentas y los roles de administración quedan reservados a superadministración. La baja de una cuenta vinculada solicita también su suspensión en Moodle.
- **Coordinación:** consulta sus programas, cursos y directorio. Con los permisos correspondientes, **Solicitudes académicas** permite dictaminar postulaciones y autorizar matrículas del ámbito asignado. El servidor y RLS comprueban el alcance.
- **Soporte:** consulta el directorio, el estado de las cuentas, el vínculo y la disponibilidad de Moodle. El permiso de directorio no concede acceso académico ni permite cambiar roles o estados. El lanzamiento general de Moodle exige `campus.access`.

La migración `20261116120000_staff_scope.sql` limita la lectura del directorio, las afiliaciones y las matrículas según el rol y el ámbito. Reserva a la API privilegiada las escrituras directas de roles, estados y matrículas. La edición del perfil propio conserva sus columnas de contacto y presentación. Validar con `supabase/tests/staff_scope.sql` en un entorno local con la línea base y semillas, usando `psql -X -v ON_ERROR_STOP=1`. El archivo de prueba hace rollback de sus datos.

Aplicar la migración primero en un entorno de ensayo existente y luego repetir el recorrido con cuentas de cada rol. Docker Compose la aplica al inicializar un volumen nuevo. Un entorno con datos requiere ejecutar la migración correspondiente.

Los cambios y las verificaciones del 20 de noviembre están en la [revisión de seguridad](revision-seguridad-20261120.md).
