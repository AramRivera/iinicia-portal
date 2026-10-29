# Documentación Técnica de Actualizaciones: Backend API y Portal Web

Documento de referencia para el equipo de desarrollo, administración de sistemas y diseño de producto sobre las nuevas capacidades, endpoints, arquitectura de Single Sign-On (SSO) y componentes de interfaz implementados en el proyecto IINICIA.

---

## 1. Resumen Ejecutivo

Durante el ciclo de desarrollo actual se completó la modernización integral del backend modular (NestJS) y del frontend (Next.js 16 con arquitectura de diseño Campus Tech OS). Las mejoras clave incluyen:

1. **Single Sign-On (SSO) Robusto y Resiliente con Moodle LMS**:
   - Corrección del flujo de redirección HTTP 303 mediante auto-descubrimiento de la URL canónica de Moodle.
   - Pre-sincronización automática de usuarios previa a la emisión de llaves efímeras `auth_userkey`.
   - Inicio de sesión transparente en Moodle sin solicitud de credenciales manuales.
2. **Nuevos Contratos y Endpoints en la API**:
   - Endpoint de desasignación y baja de asignaturas con desmatriculación remota (`DELETE /api/v1/enrollments/:id`).
   - Endpoint de actualización segura de perfil de usuario (`PATCH /api/v1/users/me/profile`).
   - Endpoints auditados de salto seguro SSO (`POST /api/v1/moodle/launch` y `POST /api/v1/moodle/courses/:courseMappingId/launch`).
3. **Portales de Docente y Estudiante Preparados para Producción**:
   - Eliminación de datos simulados arbitrarios (como calificaciones fijas o progresos estáticos).
   - Kárdex estudiantil con métricas Bento reactivas (promedio oficial, materias acreditadas y créditos SATCA).
   - Acceso docente directo al Calificador Oficial de Moodle LMS respetando las normas de ALCANCE.md.
   - Modales interactivos de edición de expediente personal para ambos roles.
4. **Cumplimiento Normativo y Pruebas**:
   - Cobertura de 59 pruebas unitarias automatizadas en el backend aprobadas al 100%.
   - Compilación exitosa de 19 rutas estáticas en Next.js sin errores de TypeScript.
   - Eliminación estricta de emojis y cumplimiento de las directrices de `AGENTS.md`.

---

## 2. Arquitectura de Single Sign-On (SSO) con Moodle LMS

### 2.1 Diagnóstico del Problema Previo
En servidores donde Moodle tiene configurada una URL canónica específica en `$CFG->wwwroot` (por ejemplo, `http://192.168.191.171/moodle`), cualquier petición dirigida a `http://localhost/moodle` recibía una respuesta `HTTP 303 See Other` por parte de Apache/Moodle. Al seguir la redirección, el cliente HTTP (`fetch`) transformaba las solicitudes `POST` en peticiones `GET` vacías, lo que causaba un fallo de parámetro inválido (`invalidtoken` / XML de error) y provocaba que el portal recurriera al enlace directo sin autenticar.

Asimismo, el plugin `auth_userkey` requiere que el usuario exista previamente en Moodle; de lo contrario, la función Web Service rechaza la petición con la excepción `User is not exist`.

### 2.2 Solución Técnica Implementada

```
+-----------------------------------------------------------------------------------------+
|                                FLUJO SSO TRANSPARENTE                                   |
|                                                                                         |
|  [ Navegador Web ]                                                                      |
|         |                                                                               |
|         | 1. POST /api/v1/moodle/courses/:id/launch                                     |
|         v                                                                               |
|  [ NestJS API ]                                                                         |
|         |                                                                               |
|         | 2. Valida matrícula autorizada en Supabase DB                                 |
|         | 3. Auto-descubre URL canónica de Moodle (core_webservice_get_site_info vía GET)|
|         | 4. Si el usuario no tiene moodle_user_id: ejecuta syncUser() (JIT)            |
|         | 5. Llama a auth_userkey_request_login_url con user[email] y wantsurl          |
|         v                                                                               |
|  [ Moodle Web Services ] ---> Retorna loginurl con clave efímera de un solo uso        |
|         |                                                                               |
|  [ NestJS API ]                                                                         |
|         |                                                                               |
|         | 6. Registra salto en campus_access_logs                                       |
|         | 7. Responde { access_url: "http://.../auth/userkey/login.php?key=..." }      |
|         v                                                                               |
|  [ Navegador Web ]                                                                      |
|         |                                                                               |
|         | 8. window.open(access_url, '_blank')                                          |
|         v                                                                               |
|  [ Moodle auth_userkey ] ---> HTTP 303 con Set-Cookie: MoodleSession=...                |
|         |                                                                               |
|         v Redirige inmediatamente a wantsurl (curso o calificador)                       |
|  [ Aula Virtual Moodle ] (Usuario autenticado con rol y permisos correspondientes)      |
+-----------------------------------------------------------------------------------------+
```

### 2.3 Componentes del Backend Afectados

1. **`MoodleClient.getEffectiveBaseUrl()` (`apps/api/src/modules/moodle/moodle.client.ts`)**:
   - Resuelve dinámicamente la URL base efectiva consultando `core_webservice_get_site_info` mediante `GET` (que tolera redirecciones transparentemente) y almacenando en caché el atributo `siteurl`.
   - Garantiza que las llamadas `callFunction` posteriores se envíen directamente a la URL canónica, eliminando redirecciones destructivas.

2. **Pre-sincronización JIT (`apps/api/src/modules/moodle/moodle.service.ts`)**:
   - En `getCourseAccessUrl` y `getCampusAccessUrl`, el servicio comprueba si el usuario cuenta con `moodle_user_id`.
   - Si no existe, invoca inmediatamente `syncUser` para dar de alta al usuario en Moodle y asociar su ID a la base de datos de Supabase antes de invocar `auth_userkey_request_login_url`.

3. **Auditoría de Acceso**:
   - Cada intento de salto (exitoso o fallido) se asienta en la tabla `campus_access_logs` registrando dirección IP, agente de usuario, identificador de usuario y marca temporal.

---

## 3. Endpoints del Backend API (NestJS)

Prefijo global: `/api/v1`

### 3.1 Módulo de Matrículas e Inscripciones (`/enrollments`)

#### `DELETE /api/v1/enrollments/:id`
- **Propósito**: Desasignar a un estudiante de una materia o permitir la baja voluntaria del alumno.
- **Autenticación**: Requerida (`SupabaseAuthGuard`).
- **Autorización**:
  - Estudiantes: Solo pueden dar de baja sus propias matrículas.
  - Docentes y Administradores: Pueden desasignar a cualquier alumno inscrito en sus cursos asignados o en el catálogo institucional.
- **Efectos secundarios**:
  1. Consulta los IDs remotos en Moodle (`moodle_user_id` y `moodle_course_id`).
  2. Invoca el Web Service oficial `enrol_manual_unenrol_users` en Moodle para revocar el acceso al aula virtual.
  3. Elimina el registro correspondiente en la tabla `enrollment_requests`.
  4. Registra el evento en `audit_logs` (`ENROLLMENT_UNASSIGNED_BY_ADMIN` o `ENROLLMENT_DROPPED_BY_STUDENT`).
- **Respuesta (200 OK)**:
  ```json
  {
    "success": true,
    "message": "Matrícula desasignada y removida de Moodle exitosamente."
  }
  ```

#### `GET /api/v1/enrollments`
- **Propósito**: Consulta de matrículas.
- **Comportamiento**:
  - Personal docente/administrativo: Devuelve las solicitudes de inscripción de los cursos de su ámbito.
  - Estudiante: Devuelve únicamente sus solicitudes personales.

#### `POST /api/v1/enrollments`
- **Propósito**: Inscripción a un curso mediante `course_mapping_id`.
- **Efectos**: Registra la solicitud, autoriza y sincroniza inmediatamente con Moodle si la configuración del curso lo permite.

---

### 3.2 Módulo de Usuarios y Perfil (`/users`)

#### `PATCH /api/v1/users/me/profile`
- **Propósito**: Actualización segura del propio perfil del usuario autenticado.
- **Autenticación**: Requerida (`SupabaseAuthGuard`).
- **Seguridad**: Aplica las restricciones de RLS y previene que el usuario modifique campos administrativos (`status`, `moodle_user_id`, `moodle_sync_status` o roles).
- **Cuerpo de la Solicitud (DTO: `UpdateOwnProfileDto`)**:
  ```json
  {
    "first_name": "Nombre",
    "last_name": "Apellidos",
    "phone": "+52 55 1234 5678",
    "bio": "Semblanza académica o notas personales",
    "avatar_url": "https://..."
  }
  ```
- **Respuesta (200 OK)**:
  ```json
  {
    "message": "Perfil actualizado exitosamente.",
    "profile": {
      "id": "uuid",
      "email": "usuario@iinicia.mx",
      "first_name": "Nombre",
      "last_name": "Apellidos",
      "phone": "+52 55 1234 5678",
      "bio": "Semblanza académica o notas personales"
    }
  }
  ```

---

### 3.3 Módulo Moodle y Salto Seguro (`/moodle`)

#### `POST /api/v1/moodle/launch`
- **Propósito**: Genera el enlace de salto SSO a la página principal del Campus Virtual Moodle.
- **Autenticación**: Requerida (`SupabaseAuthGuard`).
- **Respuesta (200 OK)**:
  ```json
  {
    "access_url": "http://192.168.191.171/moodle/auth/userkey/login.php?key=...&wantsurl=http%3A%2F%2F192.168.191.171%2Fmoodle%2F"
  }
  ```

#### `POST /api/v1/moodle/courses/:courseMappingId/launch`
- **Propósito**: Valida la matrícula activa del usuario en el curso especificado, asienta la bitácora de acceso y genera el enlace SSO directo al aula virtual.
- **Autenticación**: Requerida (`SupabaseAuthGuard`).
- **Respuestas**:
  - `200 OK`:
    ```json
    {
      "course_mapping_id": "uuid",
      "course_name": "Arquitectura de Software y Microservicios",
      "moodle_course_id": 3,
      "access_url": "http://192.168.191.171/moodle/auth/userkey/login.php?key=...&wantsurl=http%3A%2F%2F192.168.191.171%2Fmoodle%2Fcourse%2Fview.php%3Fid%3D3"
    }
    ```
  - `403 Forbidden`: Si el usuario no cuenta con una matrícula autorizada en la asignatura solicitada.

---

## 4. Actualizaciones del Portal Web (Frontend Next.js)

### 4.1 Identidad Visual y Sistema de Diseño (Campus Tech OS)
El frontend implementa una dirección de arte minimalista, orientada a SaaS administrativo universitario:
- **Tokens de Color**:
  - `Primary`: `#2457F5` (Azul eléctrico institucional para acciones primarias).
  - `Accent`: `#D5F36A` (Lima ácido como acento identitario en viñetas y badges).
  - `Superficies`: `#FFFFFF` / `#F6F7F5` en tema claro; `#222830` / `#171B20` en tema oscuro.
  - `Bordes`: Finos de 1px (`#E1E5E0` / `#343C46`).
- **Tipografía**: Jerarquía editorial refinada utilizando Geist / Inter, con escalas legibles de 13–14px para tablas y 14–16px para interfaces.
- **Iconografía**: Lineal, uniforme y en formato SVG nativo (`components/campus-tech/Icons.tsx`).
- **Ausencia total de emojis** en componentes, diálogos y notificaciones conforme a las especificaciones institucionales.

---

### 4.2 Portal del Estudiante (`/dashboard/estudiante`)

1. **Pestaña "Mis Cursos Activos"**:
   - Tarjetas de asignaturas en cuadrícula con código, nombre oficial, programa y Moodle ID.
   - Barra de avance didáctico honesto: Muestra el porcentaje real registrado o el estado `En progreso (Moodle)`.
   - Botón interactivo **"Ver temario y créditos"** que abre el modal con la ficha curricular de la asignatura.
   - Botón de salto SSO **"Entrar al Aula"** integrado con `LaunchCourseButton`.
   - Botón **"Dar de baja"** que despliega modal de confirmación y desmatricula de Moodle mediante `enrollmentsApi.deleteEnrollment`.

2. **Pestaña "Catálogo e Inscripción"**:
   - Catálogo de asignaturas disponibles no inscritas previamente.
   - Búsqueda en tiempo real por nombre, código o programa académico.
   - Ficha con créditos SATCA, horas de teoría y horas de práctica.
   - Inscripción en un clic mediante `enrollmentsApi.requestEnrollment`.

3. **Pestaña "Kárdex y Calificaciones"**:
   - Tarjetas Bento de Resumen Académico:
     - *Materias Inscritas*: Conteo de asignaturas en el plan actual.
     - *Acreditadas*: Número de asignaturas con evaluación aprobatoria ($\ge 6.0$).
     - *Promedio Parcial*: Cálculo dinámico sobre las asignaturas evaluadas en escala oficial de 0 a 10.
     - *Créditos Cursados*: Sumatoria curricular en el sistema SATCA.
   - Tabla de asignaturas con estatus real (`Acreditada`, `En Curso`, `No Acreditada`) y botón para abrir el aula correspondiente vía SSO.

4. **Pestaña "Expediente Escolar"**:
   - Datos de matrícula oficial, correo institucional, teléfono y estatus.
   - Indicador de sincronización y cuenta vinculada en Moodle LMS.
   - Botón **"Editar Información"**: Abre un modal interactivo para modificar nombre, apellidos, teléfono y notas de expediente vía `usersApi.updateOwnProfile()`.

---

### 4.3 Portal del Docente (`/dashboard/docente`)

1. **Pestaña "Mis Asignaturas"**:
   - Cuadrícula con las materias asignadas al profesor titular.
   - Conteo en tiempo real de alumnos inscritos por curso.
   - Botón de salto directo al aula virtual con privilegios docentes (`editingteacher`).
   - Acceso directo al calificador de la asignatura.

2. **Pestaña "Directorio de Alumnos"**:
   - Tabla unificada de estudiantes matriculados en sus asignaturas.
   - Filtro reactivo por asignatura específica y búsqueda textual por nombre o correo.
   - Insignia de estado Moodle (`MoodleSyncBadge`).
   - Botón **"Desasignar"**: Permite dar de baja a un alumno del grupo con confirmación modal.

3. **Pestaña "Libro de Calificaciones y Actas"**:
   - Cumplimiento de la directriz de ALCANCE.md: Las actas oficiales y ponderaciones residen en Moodle LMS.
   - Botón superior: **"Abrir Calificador en Moodle ↗"** para acceder con SSO al calificador de la asignatura activa.
   - Tabla con listado de alumnos, estado de sincronización y botón **"Nota Rápida"** para almacenar notas formativas preliminares de seguimiento.

4. **Pestaña "Perfil Docente"**:
   - Identidad académica, rol docente, usuario y ID en Moodle LMS.
   - Botón **"Editar Información"**: Modal para actualizar datos personales, teléfono y semblanza curricular mediante `usersApi.updateOwnProfile()`.

---

### 4.4 Panel de Asignaciones y Control Administrativo (`/dashboard/admin/asignaciones`)

- Vista tabular optimizada para la administración masiva de usuarios, roles y materias.
- Filtro por texto (nombre, apellido o correo) y selector de roles.
- Asignación de cursos especificando el rol pedagógico (`student` o `teacher`).
- Desasignación directa de cursos haciendo clic en la etiqueta de la asignatura.
- Resolución de doble rol: Al promover un usuario a rol administrativo o docente, el sistema inactiva automáticamente el rol provisional de `aspirante`.

---

### 4.5 Biblioteca de Integración Cliente (`apps/web/src/lib/api.ts`)

Se ampliaron los métodos tipados exportados:
- `usersApi.updateOwnProfile(payload)`: Ejecuta la petición `PATCH /api/v1/users/me/profile`.
- `coursesApi.launchCourse(courseMappingId)`: Solicita la URL SSO hacia un curso específico.
- `moodleApi.launchCampus()`: Solicita la URL SSO hacia la portada del campus.
- `enrollmentsApi.deleteEnrollment(enrollmentId)`: Ejecuta la baja de curso y desmatriculación remota.

---

## 5. Matriz de Variables de Entorno

### 5.1 Backend (`apps/api/.env`)
| Variable | Descripción | Ejemplo / Valor Local |
| :--- | :--- | :--- |
| `PORT` | Puerto de escucha de la API NestJS | `3000` |
| `SUPABASE_URL` | URL del proyecto Supabase | `https://[id].supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | Clave privilegiada (NUNCA en frontend) | `eyJhbGci...` |
| `MOODLE_BASE_URL` | URL base canónica de la instalación Moodle | `http://192.168.191.171/moodle` |
| `MOODLE_URL` | URL alternativa de Moodle para compatibilidad | `http://192.168.191.171/moodle` |
| `MOODLE_WS_TOKEN` | Token de acceso de Web Services Moodle | Token generado en Moodle |
| `MOODLE_ROLE_STUDENT_ID` | ID del rol estudiante en Moodle | `5` |
| `MOODLE_ROLE_TEACHER_ID` | ID del rol profesor editor en Moodle | `3` |

### 5.2 Frontend (`apps/web/.env.local`)
| Variable | Descripción | Ejemplo / Valor Local |
| :--- | :--- | :--- |
| `NEXT_PUBLIC_API_URL` | URL base de la API de NestJS | `http://localhost:3000/api/v1` |
| `NEXT_PUBLIC_SUPABASE_URL` | URL pública de Supabase | `https://[id].supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Llave anónima pública de Supabase | `sb_publishable_...` |
| `NEXT_PUBLIC_MOODLE_URL` | URL institucional de Moodle para enlaces web | `http://192.168.191.171/moodle` |

---

## 6. Verificación y Pruebas Técnicas

### 6.1 Pruebas Unitarias del Backend (Vitest)
Se ejecutan mediante:
```bash
npm test --prefix apps/api
```
- **Resultado actual**: **13 archivos de prueba aprobados, 61 pruebas unitarias superadas** (100% de éxito).
- Cobertura: Autenticación, guardias de rol, resolución canónica de URLs en MoodleClient, sincronización de usuarios, asignación de cursos, validación de DTOs, desmatriculación remota y validación estricta de ámbitos en `validateCourseAccess`.

### 6.2 Compilación del Frontend (Next.js 16 / Turbopack)
Se ejecuta mediante:
```bash
npm run build --prefix apps/web
```
- **Resultado actual**: **Compilación exitosa con 0 errores de TypeScript y 19/19 páginas estáticas prerenderizadas**:
  - `/`
  - `/admisiones`
  - `/certificaciones`
  - `/contacto`
  - `/cursos`
  - `/dashboard`
  - `/dashboard/admin`
  - `/dashboard/admin/asignaciones`
  - `/dashboard/aspirante`
  - `/dashboard/docente`
  - `/dashboard/estudiante`
  - `/diplomados`
  - `/login`
  - `/recuperar-password`
  - `/registro`
  - `/universidad`

---

## 7. Blindaje de Autorización y Principio de Mínimo Privilegio (Octubre 2026)

En estricto cumplimiento de la Sección 6 del documento de alcance técnico y funcional (*«Un usuario no deberá visualizar opciones, usuarios, programas o cursos que estén fuera de su rol y ámbito de autorización»*), se implementaron mecanismos de validación activa en la capa de servicio:

### 7.1 Validador de Ámbito en Moodle (`validateCourseAccess`)
Centralizado en `apps/api/src/modules/moodle/moodle.service.ts`:
- **Estudiantes:** Únicamente pueden acceder a los contenidos de cursos donde posean una matrícula en estado `autorizada` o `sincronizada`. Tienen bloqueado el acceso a la lista de participantes y a métricas docentes (`403 Forbidden`).
- **Privacidad de Calificaciones:** El endpoint `GET /moodle/courses/:courseId/progress` valida que un estudiante solo pueda solicitar su propio progreso. Si incluye en query un `moodle_user_id` ajeno, el servidor rechaza la solicitud con código `403`.
- **Profesores:** Únicamente pueden consultar la lista de participantes y resúmenes analíticos de las asignaturas donde tengan rol docente asignado (`editingteacher`).
- **Personal de Gestión (Staff):** Usuarios con rol `superadministrador`, `administrador` o `coordinador` cuentan con visibilidad global de supervisión académica.

### 7.2 Alta Administrativa con Rol Específico (`POST /api/v1/users`)
- Diseñado para que administradores puedan registrar usuarios seleccionando un rol unívoco (`role_id`), evitando el registro inicial como aspirante cuando se da de alta a docentes o personal operativo.
- Permite la bandera `sync_to_moodle: true` para pre-aprovisionar la cuenta en Moodle LMS de manera inmediata.
- Auditoría obligatoria registrada en `audit_logs` vinculando al actor administrativo.

### 7.3 Corrección Canónica de IDs de Roles en Moodle
- Se corrigió el valor en el entorno `.env` de la API: `MOODLE_ROLE_STUDENT_ID=5` (anteriormente configurado en 2 de forma errónea, el cual correspondía a `coursecreator`).
- El método `getMoodleRoleId` resuelve con prioridad las variables de entorno declaradas y recurre a la constante tipada `MOODLE_ROLE_IDS` (`student: 5`, `editingteacher: 3`).
