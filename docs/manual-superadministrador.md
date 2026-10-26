# Manual de Uso del Panel de Superadministrador (IINICIA Portal)

Este manual documenta el funcionamiento y operación integral del panel de administración del portal **IINICIA**, ubicado en la ruta web `/dashboard/admin`.

---

## 1. Acceso y Autenticación

- **URL de Acceso:** `http://localhost:4000/login`
- **Ruta del Panel:** `http://localhost:4000/dashboard/admin`
- **Requisitos de Acceso:** Cuenta de usuario con rol activo de `superadmin` o `admin`.
- **Credenciales Maestras de Demostración:**
  - **Superadministrador 1:** `admin@iinicia.org` / `Admin.2026!`
  - **Superadministrador 2:** `aram@iinicia.org` / `123456789`

> Si un usuario con rol exclusivo de aspirante o estudiante intenta navegar directamente a esta URL, el sistema validará sus permisos mediante `AuthContext` y lo redirigirá a su panel correspondiente (`/dashboard/estudiante` o `/dashboard/aspirante`).

---

## 2. Visión General del Panel

El panel principal está dividido en pestañas de control y un resumen superior de métricas clave del sistema:

1. **Total de Usuarios:** Conteo consolidado de perfiles registrados en la base de datos Supabase.
2. **Cursos Vinculados:** Catálogo de cursos del portal asociados a asignaturas de Moodle.
3. **Matrículas Activas:** Inscripciones autorizadas y sincronizadas en Moodle LMS.
4. **Matrículas Pendientes:** Solicitudes de aspirantes o alumnos que esperan revisión y aprobación.
5. **Estado de Moodle:** Conexión en vivo con el motor LMS Moodle vía Web Services REST.
6. **Entrar al Campus (SSO):** Botón de acceso directo sin contraseñas al campus virtual.

---

## 3. Salto Directo al Campus Moodle LMS (SSO)

El portal implementa una integración de inicio de sesión único (**Single Sign-On**) basada en el plugin seguro `auth_userkey` de Moodle:

- **Funcionamiento:**
  1. Al presionar **`🚀 Entrar al Campus (SSO)`** en la barra superior o en las tarjetas de asignaturas, el backend genera un token criptográfico efímero de un solo uso asociado al correo del usuario autenticado.
  2. Moodle valida el token, inicia la sesión del usuario en Moodle de forma transparente y lo redirige a la portada o curso objetivo.
  3. No se requiere ingresar contraseñas en Moodle ni compartir credenciales en texto plano.
  4. Los tokens expiran a los 60 segundos y se autodestruyen tras el primer uso.

---

## 4. Gestión de Usuarios y Cuentas

### 4.1 Búsqueda y Filtrado
- **Buscador en tiempo real:** Permite filtrar instantáneamente por nombre, apellido, correo electrónico o ID de Moodle.
- **Filtro por Rol:** Muestra usuarios según su perfil (`superadmin`, `admin`, `coordinator`, `teacher`, `student`, `applicant`, `support`).
- **Filtro por Estado:** Permite aislar cuentas `activo`, `pendiente` o `suspendido`.

### 4.2 Creación de Nuevos Usuarios
1. Clic en **`+ Nuevo Usuario`**.
2. Completar:
   - Nombre(s) y Apellidos.
   - Correo electrónico institucional o personal.
   - Contraseña inicial segura (mínimo 8 caracteres).
   - Teléfono (opcional).
   - Rol Inicial: Superadmin, Administrador, Coordinador, Docente, Estudiante o Aspirante.
3. Al guardar, el usuario queda registrado en Supabase Auth y su perfil queda listo para interactuar en la plataforma.

### 4.3 Sincronización con Moodle LMS
- Si un usuario tiene la etiqueta `Sin Moodle`, puede presionarse el botón **`⚡ Sincronizar Moodle`** en su fila.
- El sistema buscará si el correo ya existe en Moodle para vincular su ID (`moodle_user_id`), o creará la cuenta en Moodle de forma automática con nombre de usuario institucional.

### 4.4 Modificación de Roles y Permisos
- Clic en **`Roles`** en la fila del usuario.
- El modal permite:
  - **Asignar Rol:** Seleccionar un nuevo rol de la jerarquía y otorgarlo.
  - **Revocar Rol:** Remover roles existentes con un solo clic.
  - *Salvaguarda:* El sistema previene que un superadministrador se despoje a sí mismo de su propio rol de superadministrador para evitar bloqueos accidentales.

### 4.5 Modificación del Estado de la Cuenta
- Clic en **`Estado`** en la fila del usuario.
- Opciones:
  - `activo`: Permite el acceso completo al portal y cursos.
  - `suspendido`: Bloquea el acceso y sesiones del usuario en el portal.
  - `pendiente`: Requiere activación o confirmación por correo.

---

## 5. Gestión de Programas Académicos

Pestaña **Programas**:
- Permite consultar la oferta académica de la institución (Licenciaturas, Maestrías, Diplomados y Certificaciones).
- **Crear Programa Académico:**
  - Clic en **`+ Nuevo Programa`**.
  - Especificar: Código único (ej. `LIC-PSI`), Nombre (ej. `Licenciatura en Psicología`), Tipo, Modalidad (En línea, Presencial, Híbrido), Duración y Total de Horas.
  - El programa queda disponible para asociarle asignaturas y ofertas de cursos.

---

## 6. Mapeo y Vinculación de Cursos con Moodle

Pestaña **Cursos y Materias**:
- El portal IINICIA administra el catálogo académico y lo conecta con los cursos creados en Moodle:
  - **Código del Portal:** Identificador interno (ej. `CUR-DIR-01`).
  - **Nombre del Curso:** Título visible en el portal y diplomas.
  - **ID de Moodle:** Número de identificación del curso en Moodle (ej. `3`).
  - **Shortname de Moodle:** Nombre corto configurado en Moodle (ej. `DIR-TI`).
  - **Programa Asociado:** Vinculación al plan de estudios o diplomado correspondiente.
  - **Cuatrimestre / Módulo:** Posición curricular de la materia.

- **Crear Nueva Vinculación:**
  1. Clic en **`+ Vincular Nuevo Curso con Moodle`**.
  2. Llenar los datos requeridos y guardar. La materia aparecerá inmediatamente disponible para matriculaciones.

---

## 7. Asignación Directa de Cursos (Matriculación Manual)

Permite a los administradores inscribir directamente a docentes o alumnos en asignaturas sin necesidad de esperar solicitudes:

1. Clic en **`+ Asignar Curso a Usuario`**.
2. Seleccionar:
   - **Usuario Destinatario:** Búsqueda en el listado de usuarios registrados.
   - **Curso de Destino:** Materia vinculada con Moodle.
   - **Rol en Moodle:**
     - *Estudiante (`student` / id 5):* Acceso para cursar y entregar actividades.
     - *Profesor / Docente (`editingteacher` / id 3):* Acceso con permisos para calificar y gestionar contenidos.
     - *Profesor sin permiso de edición (`teacher` / id 4).*
3. Al confirmar:
   - Si el usuario no tenía cuenta en Moodle, el sistema la crea automáticamente.
   - Registra la matrícula en la base de datos de Supabase con estado `autorizada` y `sincronizada`.
   - Llama a la API de Moodle (`enrol_manual_enrol_users`) e inscribe al usuario en el curso.

---

## 8. Gestión de Solicitudes de Matrícula

Pestaña **Matrículas**:
- Muestra las solicitudes de inscripción realizadas por alumnos y aspirantes.
- Columnas informativas:
  - Estudiante (Nombre y Correo).
  - Curso Solicitado y Programa.
  - Rol Asignado (`student` o `teacher`).
  - Estado de la Matrícula (`pendiente`, `autorizada`, `rechazada`, `cancelada`).
  - Estado de Sincronización Moodle (`pendiente`, `sincronizada`, `fallida`).
  - Último Error (si existió alguna desconexión con el LMS).
- **Acciones Disponibles:**
  - **Autorizar (`✓`):** Valida la inscripción, crea la cuenta Moodle si no existía y matricula al alumno en el curso remoto en una sola operación atómica y trazable.
  - **Rechazar (`✗`):** Deniega la solicitud de matrícula.
  - **Reintentar Moodle (`Reintentar Moodle`):** Si una solicitud autorizada quedó en estado de sincronización fallido debido a un corte temporal de red o caída del servicio Moodle, este botón reintenta la llamada sin duplicar registros.

---

## 9. Bitácora de Auditoría Inmutable

Pestaña **Auditoría**:
- Registra cada acción crítica efectuada en la plataforma para fines de seguridad y cumplimiento normativo.
- Permite filtrar por tipo de acción:
  - `auth.login` / `auth.logout`
  - `role.assigned` / `role.revoked`
  - `user.status_updated`
  - `course.created`
  - `enrollment.requested` / `enrollment.authorized` / `enrollment.moodle_synced`
  - `moodle.user_sync`
- Permite consultar la fecha exacta, el ID del actor, el recurso modificado, la dirección IP y los detalles técnicos del evento.

---

## 10. Resumen de Puertos y Servicios en Entorno Local

| Servicio | URL Local | Descripción |
|---|---|---|
| **Frontend Portal** | `http://localhost:4000` | Aplicación Next.js (Tailwind CSS, App Router) |
| **Backend REST API** | `http://localhost:3000/api/v1` | Servidor NestJS con autenticación y Moodle Web Services |
| **Documentación OpenAPI** | `http://localhost:3000/docs` | Swagger UI interactivo de la API |
| **Campus Virtual Moodle** | `http://localhost/moodle` | LMS Moodle 5.3+ con MariaDB y plugin `auth_userkey` |
| **Base de Datos & Auth** | `https://mmtuaangwbsdtddeplfv.supabase.co` | Proyecto Supabase PostgreSQL con RLS |
