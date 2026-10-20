# Aplicación manual de migraciones en Supabase

- **Proyecto informado por el responsable:** `proyecto-iinicia`
- **Estado de esta migración:** Pendiente de aplicación manual
- **Migración:** [`20261020110000_initial_schema.sql`](../supabase/migrations/20261020110000_initial_schema.sql)
- **Herramientas locales comprobadas:** Docker disponible; `psql` y Supabase CLI no disponibles

## Alcance

El responsable del proyecto aplica las migraciones desde el dashboard oficial de Supabase. Este documento y el archivo SQL son preparación local; no prueban conexión con Supabase ni que el SQL haya sido ejecutado.

La migración crea las tablas iniciales, roles, RLS y los permisos mínimos. También instala un trigger que, al crear una identidad en Supabase Auth, crea un perfil mínimo y asigna únicamente el rol `applicant`. No copia correo ni otros metadatos de Auth. Las identidades creadas antes de instalar el trigger no se aprovisionan automáticamente.

No contiene datos de cursos, usuarios de prueba, credenciales reales, tokens Moodle ni claves de Supabase. No modifica Moodle.

## Antes de aplicar

1. En el dashboard, confirma que seleccionaste el proyecto correcto (`proyecto-iinicia`) y el ambiente previsto.
2. Verifica allí que el esquema está vacío o compara cualquier objeto existente con la migración. El estado remoto no se verificó desde este repositorio.
3. Revisa el archivo SQL completo y confirma que corresponde a la versión aprobada del modelo.
4. No ejecutes la migración contra producción ni contra un proyecto con datos sin autorización expresa y respaldo revisado.
5. No pegues claves de Supabase, tokens o credenciales en archivos, consultas, logs ni en el chat.

## Aplicar desde el dashboard

1. Abre el **SQL Editor** del proyecto confirmado.
2. Crea una consulta nueva y pega el contenido completo de `supabase/migrations/20261020110000_initial_schema.sql`.
3. Ejecuta la consulta una sola vez. El script usa una transacción y no contiene instrucciones de borrado de tablas o datos.
4. Si el dashboard devuelve un error, detente y conserva el mensaje de error sin secretos. No elimines objetos ni vuelvas a ejecutar parcialmente el script. Revisa si la transacción fue revertida antes de decidir cómo corregirlo.
5. Si finaliza correctamente, ejecuta las verificaciones siguientes y registra la fecha y el resultado en el control de migraciones del equipo.

La ejecución manual desde SQL Editor no sincroniza automáticamente el historial de migraciones de una CLI. El repositorio seguirá siendo la fuente versionada; el equipo debe registrar qué archivo se aplicó en cada proyecto.

## Verificaciones de esquema

### Tablas y estado RLS

```sql
SELECT
  c.relname AS table_name,
  c.relrowsecurity AS rls_enabled
FROM pg_class AS c
JOIN pg_namespace AS n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relname IN (
    'profiles',
    'roles',
    'user_roles',
    'programs',
    'user_programs',
    'course_mappings',
    'moodle_user_mappings',
    'course_assignments',
    'enrollment_requests',
    'audit_logs'
  )
ORDER BY c.relname;
```

Debe devolver las diez tablas con `rls_enabled = true`.

### Políticas instaladas

```sql
SELECT tablename, policyname, roles, cmd
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;
```

Revisa que las políticas coincidan con [`politicas-rls.md`](politicas-rls.md). `moodle_user_mappings` debe quedar sin políticas para el rol cliente y sin permisos `anon`/`authenticated`; el acceso queda reservado al servicio backend.

### Catálogo de roles y trigger Auth

```sql
SELECT code FROM public.roles ORDER BY code;

SELECT tgname
FROM pg_trigger
WHERE tgrelid = 'auth.users'::regclass
  AND NOT tgisinternal
ORDER BY tgname;
```

El catálogo debe contener los siete roles definidos en `ALCANCE.md`, y `auth.users` debe tener el trigger `iinicia_on_auth_user_created`.

### Permisos entregados a cada rol

```sql
SELECT grantee, table_name, privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public'
  AND grantee IN ('anon', 'authenticated', 'service_role')
ORDER BY grantee, table_name, privilege_type;
```

Confirma que `anon` no tenga permisos de tabla, que `authenticated` solo tenga las lecturas y la inserción limitada de solicitudes definidas en la migración y que `moodle_user_mappings` no tenga permisos para `anon` ni `authenticated`.

## Aprovisionamiento inicial de `superadmin`

La migración no asigna automáticamente roles administrativos. Tras crear y verificar la identidad de la persona responsable en Supabase Auth, el primer `superadmin` debe asignarse manualmente desde SQL Editor, una sola vez, sustituyendo el UUID de ejemplo por el `id` verificado en `public.profiles`:

```sql
DO $bootstrap$
DECLARE
  target_user_id uuid := 'REEMPLAZAR_POR_UUID_VERIFICADO';
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = target_user_id
      AND status = 'active'
  ) THEN
    RAISE EXCEPTION 'El perfil objetivo no existe o no está activo';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE role_code = 'superadmin'
  ) THEN
    RAISE EXCEPTION 'Ya existe una asignación superadmin; detener el bootstrap';
  END IF;

  DELETE FROM public.user_roles
  WHERE user_id = target_user_id
    AND role_code = 'applicant';

  INSERT INTO public.user_roles (user_id, role_code, assigned_by)
  VALUES (target_user_id, 'superadmin', NULL);

  INSERT INTO public.audit_logs (
    actor_id,
    action_code,
    target_type,
    target_id,
    details
  )
  VALUES (
    NULL,
    'bootstrap.first_superadmin',
    'profile',
    target_user_id::text,
    jsonb_build_object('source', 'supabase_dashboard')
  );
END;
$bootstrap$;
```

El UUID no es una credencial, pero debe verificarse cuidadosamente para evitar asignar el privilegio a otra cuenta. Si ya existe un `superadmin`, no se usa este bloque: se detiene y se tramita la asignación con el flujo administrativo aprobado.

## Registro de la migración

La tabla de seguimiento del repositorio se actualiza solo después de confirmar el resultado en el dashboard:

| Versión | Archivo | Proyecto/ambiente | Fecha UTC | Resultado |
|---|---|---|---|---|
| `20261020110000` | `supabase/migrations/20261020110000_initial_schema.sql` | Pendiente | Pendiente | Pendiente |

No se debe modificar manualmente el historial interno de migraciones de Supabase para simular una aplicación de CLI.

## Pruebas de acceso

El SQL Editor ejecuta consultas con privilegios administrativos, por lo que una consulta exitosa allí **no demuestra** que RLS funcione para un usuario normal. La validación de políticas requiere pruebas posteriores con JWT de usuarios de prueba y casos de alumno, profesor, coordinador, administrador e identidad `inactive`, según [`politicas-rls.md`](politicas-rls.md).

La migración no crea cursos ni usuarios de demostración y no verifica Web Services Moodle. Esas tareas pertenecen a fases posteriores.
