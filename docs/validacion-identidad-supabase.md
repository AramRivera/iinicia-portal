# Identidad y Supabase (CA-03, CA-04 y CA-06)

## Registro y recuperación

El registro público usa Supabase Auth con confirmación por correo. El backend verifica que el proveedor de correo y el registro estén habilitados, y que la confirmación automática esté desactivada. La respuesta de registro contiene un mensaje y el portal pide revisar el buzón. Tras confirmar el enlace, la persona inicia sesión desde el portal.

En el proyecto de pruebas, configurar:

1. Habilitar **Confirm email** en Supabase Auth y mantener habilitados el proveedor de correo y el registro.
2. Definir `FRONTEND_URL` en NestJS con la URL del portal de ese ambiente. Agregar las URL completas de `/confirmar-correo` y `/restablecer-password` a las redirecciones permitidas de Supabase.
3. Usar `{{ .ConfirmationURL }}` en la plantilla **Confirm signup**. Para **Reset Password**, usar el enlace descrito en [la guía del frontend](frontend.md).
4. Verificar el proveedor de correo. El servicio de correo integrado de Supabase restringe los destinatarios a miembros autorizados del equipo del proyecto. Para un destinatario externo, configurar SMTP en el ambiente de pruebas.
5. Registrar una dirección controlada. Comprobar que el acceso se rechaza antes de confirmar, que el enlace permite iniciar sesión y que `/auth/me` devuelve el perfil y el rol inicial de aspirante.
6. Solicitar recuperación para esa misma cuenta. Abrir el enlace, cambiar la contraseña, comprobar el acceso con la nueva contraseña y verificar que el enlace ya usado sea rechazado.

Referencias: [Registro en Supabase Auth](https://supabase.com/docs/reference/javascript/auth-signup), [plantillas](https://supabase.com/docs/guides/auth/auth-email-templates) y [SMTP](https://supabase.com/docs/guides/auth/auth-smtp).

## Esquema y RLS

La consulta REST al proyecto configurado verificó estas tablas y columnas del contrato, sin descargar registros: `profiles.id/email/status/moodle_user_id`, `roles.id/slug`, `user_roles.user_id/role_id/is_active/expires_at`, `role_permissions.role_id/permission_id`, `user_programs.user_id/program_id/status`, `audit_logs.actor_id/action`, `course_mappings.id/moodle_course_id` y `enrollment_requests.id/user_id/status`. La migración inicial del repositorio usa `roles.code` y `user_roles.role_code`. Para preparar una línea base reproducible, exportar y revisar el esquema activo, con funciones, triggers, grants y políticas, y validarlo en una base de pruebas vacía.

Estas consultas de solo lectura sirven para contrastar el esquema y las políticas en SQL Editor:

```sql
SELECT table_name, column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN ('profiles', 'roles', 'user_roles', 'role_permissions',
    'user_programs', 'course_mappings', 'enrollment_requests', 'audit_logs')
ORDER BY table_name, ordinal_position;

SELECT c.relname AS table_name, c.relrowsecurity AS rls_enabled
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relname IN ('profiles', 'roles', 'user_roles', 'role_permissions',
    'user_programs', 'course_mappings', 'enrollment_requests', 'audit_logs')
ORDER BY c.relname;

SELECT tablename, policyname, roles, cmd, qual, with_check
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

SELECT table_name, column_name, grantee, privilege_type
FROM information_schema.column_privileges
WHERE table_schema = 'public'
  AND table_name IN ('profiles', 'user_roles', 'role_permissions', 'audit_logs')
  AND grantee IN ('anon', 'authenticated')
  AND privilege_type IN ('INSERT', 'UPDATE')
ORDER BY table_name, column_name, grantee, privilege_type;

SELECT table_name, grantee, privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public'
  AND table_name IN ('profiles', 'user_roles', 'role_permissions', 'audit_logs')
  AND grantee IN ('anon', 'authenticated')
  AND privilege_type IN ('INSERT', 'UPDATE', 'DELETE')
ORDER BY table_name, grantee, privilege_type;
```

## Evidencia de acceso comprobada

| Cuenta | REST con el JWT de usuario | API local |
| --- | --- | --- |
| Anónima | La consulta de perfiles devolvió cero filas. | `/auth/me` respondió 401. |
| Profesor de prueba | Un perfil propio, cero para el perfil ajeno y cero en auditoría. | `/auth/me` respondió 200. El directorio y el perfil ajeno respondieron 403. La cuenta tiene roles de profesor y estudiante. |
| Estudiante de prueba | Un perfil propio, cero para el perfil ajeno y cero en auditoría. | `/auth/me` respondió 200. El directorio y el perfil ajeno respondieron 403. |

Queda verificar con una cuenta recién creada el aprovisionamiento del perfil y rol, los dos correos y el rechazo de escrituras privilegiadas. Completar los casos de coordinación y administración por ámbito antes de cerrar CA-06.

La API local reportó Supabase y Moodle disponibles. La instalación Moodle se encontró en `/var/www/html/moodle` y su directorio de datos en `/var/www/moodledata`. El archivo de versión indica Moodle 5.3+ (build 20261021).
