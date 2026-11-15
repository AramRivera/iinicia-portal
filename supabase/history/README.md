# Historial de Migraciones de Supabase

Este directorio conserva las migraciones iniciales e incrementales generadas durante el desarrollo:

- `20261020110000_initial_schema.sql`: Primer borrador del esquema (modelo con `roles.code` y sin `admission_applications`).
- `20261110120000_require_mfa_data_api.sql`: Pre-request hook de PostgREST para requerir AAL2 en cada solicitud autenticada.
- `20261113120000_admission_review.sql`: RPC `iinicia_review_admission`, ámbito de coordinación y protección restrictiva de admisiones.
- `20261114120000_course_offerings.sql`: Catálogo activo con restricción por `is_active` y AAL2.

## Por qué se consolidó en una línea base

Al ejecutar instalaciones limpias desde cero en PostgreSQL 15/16 o Supabase CLI, la migración inicial de octubre difería del modelo final de la API y carecía de `admission_applications` y `course_mappings.is_active`. La secuencia histórica fallaba en entornos nuevos al llegar a la migración de admisiones.

Para instalaciones nuevas, despliegues y pruebas reproducibles:
- Se utiliza la línea base unificada: `supabase/migrations/20261115000000_baseline_schema.sql`.
- Se aplican las semillas sintéticas idempotentes: `supabase/seed.sql`.
- Para bases de datos ya existentes que aplicaron parte de la historia, consultar `docs/supabase-auditoria-esquema.md`.
