# Reproducibilidad del esquema Supabase

Se comparó el contrato expuesto por PostgREST del Supabase remoto de pruebas con una instalación limpia en PostgreSQL 16. La consulta remota fue de solo lectura y obtuvo metadatos, sin consultar filas. La base local aislada recibió los roles base de Supabase y el esquema Auth sin datos ni el trigger propio del portal.

## Diagnóstico del historial previo

Al ejecutar la secuencia histórica con `ON_ERROR_STOP=1`:

| Migración | Resultado |
| --- | --- |
| `20261020110000_initial_schema.sql` | Aplicada. Crea el modelo histórico preliminar. |
| `20261110120000_require_mfa_data_api.sql` | Aplicada. Configura el hook de PostgREST para MFA. |
| `20261113120000_admission_review.sql` | Falló porque `public.admission_applications` no existía en el esquema inicial. |
| `20261114120000_course_offerings.sql` | No alcanzada. Requiere `course_mappings.is_active`, ausente en el esquema inicial. |

| Objeto | Esquema inicial | Contrato y esquema consolidado |
| --- | --- | --- |
| `roles` | Identificado por `code` | `id` (smallint), `slug`, jerarquía y arquetipo Moodle |
| `user_roles` | Referencia `role_code` | Referencia `role_id`, vigencia y auditoría |
| `course_mappings` | Mapeo mínimo con `status` | Nombre, código, `is_active`, obligatoriedad, módulo y enlace Moodle |
| `enrollment_requests` | `student_id`, `decision_status`, `sync_status` | `user_id`, `moodle_role`, `status`, notas y cachés de avance |
| Admisiones y vistas | Ausentes en la migración inicial | `admission_applications`, vistas con `security_invoker` y RPC `iinicia_review_admission` |

## Consolidación de la Línea Base (`20261115000000_baseline_schema.sql`)

Se extrajo la definición completa de solo esquema del entorno de pruebas y se depuró para garantizar reproducibilidad en PostgreSQL 15 y 16:
- Eliminación de directivas específicas de PostgreSQL 17 (`transaction_timeout`, privilegio `MAINTAIN`).
- Condicionalidad en `CREATE SCHEMA IF NOT EXISTS public;` y en directivas de privilegios por defecto para `supabase_admin`.
- Inclusión del trigger `on_auth_user_created` en `auth.users` llamando a `public.handle_new_auth_user()`.
- Pre-request hook de PostgREST para comprobación de AAL2 (`public.iinicia_require_mfa`).
- Inclusión de las 17 tablas, 11 tipos enum, 13 funciones, 2 vistas de seguridad (`security_invoker = true`), 16 triggers y 45 políticas RLS.

## Semillas Reproducibles (`supabase/seed.sql`)

Se crearon las semillas con sentencias idempotentes (`ON CONFLICT`):
1. **7 Roles del sistema:** `superadministrador`, `administrador`, `coordinador`, `profesor`, `estudiante`, `soporte`, `aspirante`.
2. **12 Permisos del sistema:** desde configuración de plataforma y auditoría hasta acceso a campus y dictamen de admisiones.
3. **30 Asignaciones rol-permiso:** matriz de privilegios mínimos.
4. **2 Parámetros generales:** `portal.general` y `moodle.integration`.
5. **3 Programas académicos:** Tecnologías de la Información, Desarrollo Web y la certificación requerida para la demo **HTML Básico Desde Cero** (`HTML-BASICO`).
6. **3 Mapeos de cursos:** incluido el curso oficial de la demo (Moodle ID 4, `html-basico`).

## Resultados de las Pruebas en Aislamiento

Las pruebas se ejecutaron en una base de datos local limpia (`test_clean_baseline`) en Docker con PostgreSQL 16 y `ON_ERROR_STOP=1`:

1. **Alta y perfil:** La inserción de un usuario en `auth.users` disparó automáticamente `handle_new_auth_user()`, creando su registro en `public.profiles` (`status = 'pendiente'`), asignando el rol `aspirante` en `public.user_roles`, y registrando el evento `USER_REGISTERED` en `public.audit_logs`.
2. **Rechazo AAL1 y aceptación AAL2:** `iinicia_require_mfa()` arrojó la excepción `42501` con el mensaje esperado al recibir reclamo `aal1`, y permitió la ejecución al recibir `aal2`.
3. **Aislamiento de lectura en admisiones:** Un aspirante autenticado solo pudo consultar su propia postulación; las consultas sobre otros aspirantes devolvieron 0 filas.
4. **Protección contra escrituras directas:** Intentos directos de eliminación o actualización por parte de clientes autenticados fueron bloqueados inmediatamente con código `42501` (`permission denied`) mediante revocación explícita de privilegios y políticas restrictivas `USING (false)`.
5. **Ámbito de coordinación:** Un coordinador dictaminando fuera de sus programas asignados fue rechazado con `42501` (`Dictamen fuera de ámbito`); al asignarle el programa correspondiente, el dictamen se procesó exitosamente.
6. **Flujo de admisión y activación:** La RPC `iinicia_review_admission` admitió la postulación, cambió el perfil de `pendiente` a `activo`, otorgó el rol `estudiante` y registró la pertenencia en `user_programs`.

## Adopción en Entornos Existentes

Para adoptar la nueva línea base en un proyecto existente donde ya se aplicaron migraciones parciales o históricas:

1. Registrar la nueva versión como aplicada en la tabla de control de Supabase:
   ```sql
   INSERT INTO supabase_migrations.schema_migrations (version)
   VALUES ('20261115000000')
   ON CONFLICT (version) DO NOTHING;
   ```
2. Si se utiliza Supabase CLI:
   ```bash
   supabase migration repair --status applied 20261115000000
   ```
3. Las migraciones históricas se conservan archivadas en `supabase/history/` para fines de trazabilidad.
