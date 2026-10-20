# Modelo relacional inicial

- **Estado:** Aprobado como base de la migración inicial
- **Fecha:** 2026-10-20
- **Fuente de requisitos:** [ALCANCE.md](../ALCANCE.md), secciones 5, 6, 7, 9 y 15
- **Decisión de acceso:** [ADR-001](decisiones/ADR-001-acceso-supabase.md)
- **Políticas de acceso:** [Políticas RLS](politicas-rls.md)

## Alcance y límites

Este documento define el modelo lógico de la migración [`20261020110000_initial_schema.sql`](../supabase/migrations/20261020110000_initial_schema.sql). El archivo es local y revisable; no afirma que el esquema exista en Supabase. El responsable lo aplicará manualmente desde el dashboard.

Supabase Auth es dueño de `auth.users` y de las credenciales. Moodle es dueño de cursos, actividades, calificaciones, progreso y matrículas efectivas. La base de datos del portal guarda identidad referenciada, permisos administrativos, vínculos mínimos con Moodle, solicitudes y estado de sincronización; no duplica el contenido académico.

Se asume una instalación Moodle activa para la primera versión, con múltiples cursos. Si en el futuro el portal opera simultáneamente con varias instalaciones Moodle, se agregará una entidad de instancia y la unicidad del curso pasará a ser compuesta por instancia e ID externo.

## Diagrama lógico

```text
auth.users 1 ── 1 profiles
profiles   N ── N roles             (user_roles)
profiles   N ── N programs          (user_programs)
profiles   1 ── 0..1 moodle_user_mappings
programs   1 ── N course_mappings
profiles   N ── N course_mappings   (course_assignments; perfil docente)
profiles   1 ── N enrollment_requests
course_mappings 1 ── N enrollment_requests
profiles   1 ── N audit_logs         (actor, nullable para retención)
```

## Entidades propuestas

Los tiempos usan `timestamptz`; las claves internas son UUID salvo los códigos del catálogo de roles y los identificadores externos Moodle.

### `profiles`

Extensión administrativa mínima de una identidad Auth.

- `id uuid`: PK y FK a `auth.users.id`.
- `status`: `active` o `inactive`.
- `created_at`, `updated_at`, `deactivated_at`.
- `deactivated_by uuid`: FK a `profiles.id`; requerido cuando el perfil está `inactive`.

El perfil inicial se limita al ID de Auth, estado y fechas. No se duplica correo ni se agregan datos personales hasta que se acuerden sus requisitos. El usuario no puede cambiar `status`, `deactivated_at` ni `deactivated_by`.

### `roles`

Catálogo de roles con `code` como PK estable y `description` opcional. Códigos requeridos: `superadmin`, `admin`, `coordinator`, `teacher`, `student`, `applicant` y `support`. El cliente no crea ni edita entradas del catálogo.

### `user_roles`

Asignaciones de roles de aplicación.

- `user_id uuid` FK a `profiles.id`.
- `role_code text` FK a `roles.code`.
- `assigned_at`, `assigned_by uuid` FK a `profiles.id` (nulo solo para una asignación inicial documentada).
- PK compuesta (`user_id`, `role_code`).

Retirar un rol no elimina el historial de auditoría. Una reasignación puede reutilizar la fila; los eventos de asignación y retirada se conservan en `audit_logs`.

En el alta ordinaria de una identidad Auth se crea el perfil y se asigna únicamente `applicant`. No se crea ningún rol privilegiado automáticamente. El primer `superadmin` se aprovisiona como paso administrativo explícito y auditado.

La delegación inicial será: `superadmin` puede asignar y retirar cualquier rol; `admin` puede gestionar `coordinator`, `teacher`, `student`, `applicant` y `support`, pero no `admin` ni `superadmin`. Los demás roles no gestionan roles.

### `programs`

Catálogo de programas con UUID PK, código único, nombre, estado administrativo y fechas. Los programas se archivan mediante estado, no mediante borrado en cascada.

### `user_programs`

Relación de una persona con un programa y ámbito de coordinación.

- FK a `profiles.id` y `programs.id`.
- Estado de relación activo/inactivo, actor asignador y fechas.
- Unicidad por (`user_id`, `program_id`).

La relación no concede por sí sola un rol: el permiso efectivo combina un rol activo con la relación de ámbito correspondiente.

### `course_mappings`

Referencia mínima de un curso Moodle usado por el portal.

- UUID PK.
- `moodle_course_id`: identificador externo positivo.
- FK obligatoria a `programs.id` para el programa principal asociado.
- Estado administrativo y fechas.
- `UNIQUE (moodle_course_id)` dado que se asume una sola instalación Moodle activa.

El nombre, las actividades y el contenido del curso se obtienen de Moodle; no se mantienen copias como fuente alternativa. En la primera versión cada curso tiene un programa principal. Si un curso debe pertenecer simultáneamente a varios programas, se añadirá una relación explícita muchos-a-muchos antes de soportar ese caso.

### `moodle_user_mappings`

Vínculo entre el usuario de Auth y la cuenta de Moodle, sin copiar contraseñas ni tokens.

- `profile_id uuid`: PK y FK a `profiles.id`.
- `moodle_user_id integer`: ID externo, nulo hasta que Moodle confirme la creación o localización del usuario; único cuando existe.
- `desired_status` (`active`/`inactive`): estado solicitado para la cuenta Moodle asociada.
- `sync_status` (`pending`/`synced`/`failed`), `attempt_count`, `last_attempt_at`, `last_synced_at` y código seguro del último error.

Se conserva como máximo un mapeo local por perfil y no se crean usuarios remotos duplicados por reintentos. La estrategia remota de búsqueda/creación y deshabilitación se implementará después de confirmar la versión y las funciones Web Services habilitadas.

La tabla no será accesible directamente desde el cliente. La sincronización la administra el backend y valida el estado remoto antes de reintentar una operación cuyo resultado sea incierto.

### `course_assignments`

Asignación de profesores a cursos autorizados.

- UUID PK, FK `teacher_id` a `profiles.id` y FK `course_mapping_id` a `course_mappings.id`.
- `assignment_status` (`active`/`revoked`), actor asignador, fechas de asignación y revocación.
- `moodle_sync_status` (`pending`/`synced`/`failed`), número de intentos, fecha del último intento y código seguro del último error.
- Unicidad por (`teacher_id`, `course_mapping_id`).

La asignación autorizada en el portal y la asignación del rol académico en Moodle son estados distintos. `moodle_sync_status = synced` significa que Moodle confirmó el estado deseado, activo o revocado. El acceso docente al curso requiere asignación local activa y sincronización confirmada. Al revocar, el acceso local se retira de inmediato y se solicita la revocación remota; un fallo remoto queda pendiente de resolución y no restaura el acceso local.

### `enrollment_requests`

Solicitud y autorización del estudiante separadas de la ejecución externa.

- UUID PK; FK `student_id` a `profiles.id`; FK `course_mapping_id` a `course_mappings.id`.
- `decision_status`: `submitted`, `approved` o `rejected`.
- `sync_status`: `pending`, `synced` o `failed` una vez aprobada; es nulo antes de que exista una operación de sincronización autorizada.
- `reviewed_by`, `reviewed_at` para registrar quién aprobó o rechazó.
- `attempt_count`, `last_attempt_at`, `synced_at` y `last_sync_error_code` seguro.

Reglas:

- Una solicitud nueva queda `submitted` con `sync_status` nulo; el cliente no puede aprobarla ni alterar el estado de sincronización.
- Al aprobar, el flujo autorizado establece `sync_status = pending` y puede iniciar la sincronización de matrícula.
- Al rechazar, se registran `reviewed_by` y `reviewed_at`, y no se inicia una sincronización.
- `synced` requiere confirmación suficiente de Moodle y una marca `synced_at`.
- El error guardado es un código o resumen seguro, nunca un token, contraseña o respuesta externa sin filtrar.
- Un índice único parcial impide más de una solicitud `submitted` o `approved` para el mismo estudiante y curso, permitiendo conservar solicitudes históricas rechazadas.
- La retirada de una matrícula ya sincronizada requiere una operación de desmatriculación y confirmación Moodle; no se simula cambiando únicamente el estado de la solicitud.

### `audit_logs`

Registro de operaciones sensibles: UUID PK, actor nullable, acción, tipo e identificador de recurso, fecha, correlación de solicitud y metadatos JSONB seguros.

No almacenará secretos, tokens, contraseñas, cargas completas de Auth ni respuestas Moodle sin filtrar. El cliente no inserta, actualiza ni elimina eventos. La retención y acceso de lectura se limitarán a personal autorizado.

## Claves, borrado y restricciones

- `profiles.id` referencia `auth.users.id`; las referencias de negocio usarán restricciones que impidan borrar accidentalmente un usuario o un recurso con historial. La baja ordinaria cambia el estado a `inactive`.
- La FK de `profiles.id` a `auth.users.id` usará `ON DELETE RESTRICT`; una eliminación excepcional requerirá un procedimiento aprobado de retención/anonimización y resolución de referencias.
- Las relaciones activas se actualizan o revocan explícitamente; no se borran en cascada para ocultar historia.
- `audit_logs.actor_id` puede usar `ON DELETE SET NULL` para conservar el evento si una eliminación excepcional fuera aprobada.
- Roles, programas y cursos con referencias se archivan; no se borran físicamente como parte de operaciones habituales.
- Se añadirán `CHECK` para estados, contadores no negativos e IDs Moodle positivos, además de `NOT NULL` donde el flujo lo requiera.

## Índices iniciales

Además de PK y restricciones únicas:

- `user_roles(user_id, role_code)` y búsqueda inversa por `role_code` cuando las consultas lo requieran.
- `user_programs(user_id, status)` y `user_programs(program_id, status)`.
- `course_mappings(program_id, status)`.
- `moodle_user_mappings(sync_status, last_attempt_at)` para sincronizaciones de usuario pendientes de resolución.
- `course_assignments(teacher_id, assignment_status)` y `course_assignments(course_mapping_id, assignment_status)`.
- `course_assignments(moodle_sync_status, last_attempt_at)` para localizar sincronizaciones fallidas pendientes de resolución.
- `enrollment_requests(student_id, created_at DESC)` y `enrollment_requests(course_mapping_id, decision_status, sync_status)`.
- `audit_logs(actor_id, created_at DESC)` y `(target_type, target_id, created_at DESC)`.

Se confirmarán con las consultas reales; no se crearán índices redundantes a los que ya generan PK/UNIQUE.

## Decisiones fuera de esta migración inicial

- Campos institucionales adicionales del perfil y reglas de retención de datos personales; quedan fuera de esta migración inicial.
- Campos institucionales adicionales del perfil y reglas de retención de datos personales.
- Reglas de visibilidad pública para visitantes sin autenticación; el catálogo inicial se limita a perfiles activos autenticados.
- Cursos compartidos por varios programas; el primer esquema exige un programa principal por curso.

Estos temas podrán ampliarse mediante migraciones posteriores, evitando inventar datos institucionales o permisos.
