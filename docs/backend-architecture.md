# Documentación de Arquitectura del Backend — API IINICIA

**Proyecto:** Rediseño y Migración del Portal IINICIA  
**Versión:** 1.0.0 (Octubre 2026)  
**Stack Backend:** Node.js, NestJS, TypeScript, Supabase (PostgreSQL 15+ & Auth), Moodle LMS 5.3+ Web Services.

---

## 1. Visión General de la Arquitectura

El backend de IINICIA está construido como una API modular y reactiva con NestJS, estructurada bajo el prefijo `/api/v1`. Actúa como la capa central de negocio, autorización y seguridad entre el frontend (Next.js), el motor de identidad y base de datos (Supabase) y el entorno de aprendizaje virtual (Moodle LMS).

```
                      ┌──────────────────────┐
                      │ Portal Web (Next.js) │
                      └──────────┬───────────┘
                                 │ REST / Bearer JWT
                                 ▼
                      ┌──────────────────────┐
                      │    API REST NestJS   │
                      │   (apps/api - v1)    │
                      └───────┬──────┬───────┘
                              │      │
       Supabase Client / JWT  │      │ REST Web Services (wstoken)
                              ▼      ▼
┌──────────────────────────────┐   ┌──────────────────────────────┐
│       Supabase Cloud         │   │       Moodle LMS (LAMP)      │
│  - Supabase Auth (Identity)  │   │  - Core Courses & Units      │
│  - PostgreSQL con RLS        │   │  - Enrol Manual Users        │
│  - RBAC & Audit Triggers     │   │  - Grades & Activity Progress│
└──────────────────────────────┘   └──────────────────────────────┘
```

---

## 2. Base de Datos Oficial: `IINICIA_DATABASE`

La base de datos se encuentra versionada en `apps/api/db/IINICIA_DATABASE.sql` y se divide en 6 áreas principales:

1. **Identidad y Perfiles (`profiles`):**
   - Vínculo 1:1 con `auth.users(id)`.
   - Campos de integración Moodle: `moodle_user_id`, `moodle_username`, `moodle_sync_status`, `moodle_last_sync_at`, `moodle_sync_error`.
   - Estados administrativos (`user_status`): `pendiente`, `activo`, `suspendido`, `inactivo`, `baja`.

2. **Control de Acceso Basado en Roles (RBAC):**
   - Catálogo oficial de 7 roles (`roles`): `superadministrador`, `administrador`, `coordinador`, `profesor`, `estudiante`, `soporte`, `aspirante`.
   - Permisos granulares (`permissions`): `users.read`, `users.manage`, `roles.assign`, `programs.manage`, `courses.manage`, `enrollments.authorize`, `moodle.sync.execute`, `campus.access`, `cms.manage`, `admissions.review`, `audit.logs.read`, `system.settings.manage`.
   - Matriz de asignación (`role_permissions` y `user_roles`).

3. **Oferta Académica y Mapeo Moodle (`programs` y `course_mappings`):**
   - `programs`: Licenciaturas, diplomados, certificaciones y cursos formativos.
   - `course_mappings`: Enlace exacto entre materias del portal y cursos de Moodle LMS. Incluye los 2 cursos de ejemplo obligatorios:
     - `CUR-MOO-001` -> *Curso 1: Introducción a las Tecnologías de la Información* (`moodle_course_id: 2`).
     - `CUR-MOO-002` -> *Curso 2: Desarrollo Web con React* (`moodle_course_id: 3`).

4. **Inscripciones y Admisiones (`enrollment_requests` y `admission_applications`):**
   - Flujo de admisión para aspirantes con dictaminación administrativa.
   - Matrículas en cursos con trazabilidad de estados: `pendiente`, `autorizada`, `rechazada`, `sincronizada`, `error_sincronizacion`, `desmatriculada`.

5. **Salto Seguro al Campus Moodle (`campus_access_logs`):**
   - Registro inmutable de cada clic o salto al campus virtual: usuario, curso, IP, user-agent, resultado y motivo de rechazo en caso de no contar con matrícula autorizada.

6. **Auditoría, CMS y Redirecciones (`audit_logs`, `cms_contents`, `wp_migration_inventory`):**
   - Bitácora inmutable de cambios de estado, asignación de roles y sincronizaciones.
   - Páginas institucionales migradas (Misión, Visión, Quiénes Somos).
   - Mapa de redirecciones 301/302 para preservar SEO desde WordPress.

---

## 3. Módulos Implementados en NestJS

| Módulo | Responsabilidad | Endpoints Clave |
|---|---|---|
| `HealthModule` | Comprobación de salud de la API, Supabase y Moodle | `GET /api/v1/health` |
| `AuthModule` | Login con Supabase Auth, registro de aspirantes, obtención de identidad efectiva | `POST /auth/login`, `POST /auth/register`, `GET /auth/me` |
| `UsersModule` | Gestión de perfiles, listado con búsqueda trgm, cambio de estado y suspensión | `GET /users`, `GET /users/:id`, `PATCH /users/:id/status`, `PATCH /users/me/profile` |
| `RolesModule` | Catálogo de roles, asignación y revocación de roles a usuarios | `GET /roles`, `POST /roles/users/:userId`, `DELETE /roles/users/:userId/:roleId` |
| `PermissionsModule` | Catálogo de permisos granulares por módulo | `GET /permissions` |
| `ProgramsModule` | Catálogo de oferta académica pública y asignación de usuarios | `GET /programs`, `POST /programs`, `POST /programs/:id/enroll-user` |
| `CoursesModule` | Mapeo de cursos y aislamiento: Estudiante/Profesor solo ven cursos autorizados | `GET /courses`, `GET /courses/:id`, `POST /courses` |
| `EnrollmentsModule`| Solicitudes de inscripción y autorización administrativa con sync a Moodle | `GET /enrollments`, `POST /enrollments`, `PATCH /enrollments/:id/status`, `POST /enrollments/:id/sync` |
| `AdmissionsModule` | Solicitudes de admisión de aspirantes y dictaminación | `GET /admissions`, `POST /admissions`, `PATCH /admissions/:id/review` |
| `MoodleModule` | Integración con Web Services oficiales de Moodle y salto seguro al campus | `GET /moodle/status`, `POST /moodle/sync/user/:userId`, `POST /moodle/courses/:courseMappingId/launch` |
| `AuditModule` | Bitácora de auditoría administrativa | `GET /audit` |
| `CmsModule` | Páginas institucionales, directorio de autoridades, formulario de contacto y mapa 301 | `GET /cms/contents`, `GET /directory`, `POST /contact`, `GET /migration/redirects` |

---

## 4. Integración con Moodle LMS

### Funciones Oficiales de Web Services Utilizadas
- `core_webservice_get_site_info`: Comprobación de disponibilidad del servicio Moodle.
- `core_user_get_users_by_field`: Búsqueda de usuarios por correo electrónico o ID para prevenir duplicados.
- `core_user_create_users`: Creación segura de cuentas en Moodle con usuario institucional y contraseña generada.
- `core_user_update_users`: Suspensión o activación de cuentas en Moodle al cambiar el estado del usuario en el portal.
- `enrol_manual_enrol_users`: Matriculación de usuarios con su respectivo rol de Moodle:
  - Estudiante -> Rol `student` (ID: 5).
  - Profesor titular -> Rol `editingteacher` (ID: 3).
  - Profesor adjunto -> Rol `teacher` (ID: 4).
  - Administrador -> Rol `manager` (ID: 1).
- `enrol_manual_unenrol_users`: Desmatriculación en cursos al suspender o dar de baja.
- `core_enrol_get_users_courses`: Consulta de cursos en los que el usuario está matriculado.
- `core_course_get_courses_by_field`: Verificación de cursos existentes en Moodle.

### Variables de Entorno Requeridas
```env
MOODLE_URL=http://localhost/moodle
MOODLE_WS_TOKEN=tu_token_de_servicio_moodle
```

---

## 5. Pruebas y Verificación

El proyecto cuenta con suites de pruebas unitarias automatizadas con Vitest que cubren:
- Autenticación y obtención de perfil/roles/permisos.
- Validación de DTOs y guards RBAC (`RolesGuard` y `PermissionsGuard`).
- Sincronización de usuarios y matrículas con Moodle (evitando duplicados).
- Autorizaciones de cursos y control de acceso al campus.
- Manejo de fallos en Supabase y Moodle.

Comandos de verificación:
```bash
cd apps/api
npm run test    # Ejecuta las 13 suites de pruebas (54 tests unitarios)
npm run build   # Compila el backend de NestJS
```
