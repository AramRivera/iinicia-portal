# Pruebas de coordinación con Supabase real

**Objetivo:** comprobar la identidad de una cuenta creada en el proyecto de pruebas y el aislamiento por programa en NestJS y en Supabase (CA-04 a CA-06). Los resultados de esta guía son **esperados**: la prueba con la cuenta de coordinación sigue pendiente. Los casos de correo público se documentan en [Identidad y Supabase](validacion-identidad-supabase.md).

## Preparar el entorno

1. Inicia NestJS y el portal apuntando al entorno de pruebas. Confirma `GET /api/v1/health` y registra la rama y el commit. Para el modo normal abre el origen configurado en `FRONTEND_URL`; los botones de la demo no son necesarios.
2. Con una cuenta administrativa, abre `/dashboard/admin` → **Nuevo Usuario**. Crea la cuenta con un correo de prueba disponible, una contraseña inicial y el rol **Coordinador Académico**. Si usas `POST /api/v1/users`, consulta el identificador de `coordinador` con `GET /api/v1/roles` en ese ambiente. No tomes el ID de un ejemplo como valor universal.
3. Comprueba en **Supabase → Authentication → Users** que aparece confirmada y anota su UUID para las pruebas. El alta administrativa no necesita correo de confirmación y puede intentar crear la cuenta en Moodle; para las pruebas de identidad y ámbito basta la cuenta y el perfil en Supabase. Abre la sesión de coordinación en una ventana privada y conserva la de administración en otra.
4. Prepara dos programas, A y B, con un mapeo de curso cada uno. Crea una solicitud pendiente de otro usuario en cada programa y confirma como administrador que ambas existen. Guarda los IDs de solicitud y, si usarás la prueba opcional de Moodle, los IDs numéricos de curso. No se requiere cargar actividades de un segundo curso para probar Supabase y NestJS.
5. Con el token del **administrador**, vincula al coordinador solo al programa A: `POST /api/v1/programs/<ID_A>/enroll-user` con `{"user_id":"<UUID_COORDINADOR>","status":"inscrito"}`. Confirma que `user_programs` no tiene una fila que vincule al coordinador con B. El coordinador no debe tener otro rol ni matrícula propia en B.

## API NestJS

Usa `Authorization: Bearer <JWT_COORDINADOR>` en las pruebas de coordinación. Para obtener un token real por API usa `POST /api/v1/auth/login`. En los casos de lectura por ámbito compara siempre con la sesión administrativa y revisa todas las páginas del resultado si hay paginación.

| Caso | Operación | Resultado esperado |
| --- | --- | --- |
| COORD-01 | `GET /api/v1/auth/me` sin token, luego con un token inválido y finalmente con el token de coordinación. | `401`, `401` y `200`. Con el token válido, el UUID coincide con Supabase Auth, el perfil está operativo y `roles` contiene solo `coordinador`. Anota también `permissions`. |
| COORD-02 | `GET /api/v1/enrollments` y buscar los dos IDs de solicitud preparados. | Aparece la solicitud de A. La de B está ausente. El administrador sí ve ambas. |
| COORD-03 | `PATCH /api/v1/enrollments/<ID_SOLICITUD>/status` para cada programa con `{"status":"autorizada","sync_to_moodle":false}`. | En A cambia a `autorizada` sin llamar a Moodle. En B devuelve `403` y el estado permanece pendiente. La cuenta necesita `enrollments.authorize`. |
| COORD-04 | Con un curso A real y disponible, `GET /api/v1/moodle/courses/<ID_MOODLE_A>/participants`; repetir con B si ya hay un curso real mapeado para ese programa. | A devuelve `200` con Moodle operativo; B debe devolver `403`. Si solo hay un curso Moodle, registra el caso B de Moodle como pendiente y completa el caso B de matrículas en NestJS. |
| COORD-05 | En un entorno descartable, `POST /api/v1/programs/<ID_B>/enroll-user` con `{"user_id":"<UUID_COORDINADOR>","status":"inscrito"}` usando el token del coordinador. | Debería devolver `403` y dejar B sin asignación. El código actual permite que el rol llegue a la operación y escribe con el cliente privilegiado sin comprobar ámbito ni autoasignación. Es un defecto identificado por inspección; falta observar el resultado real. |

Para una prueba adicional de sincronización, verifica `moodle.sync.execute` en `/auth/me`. Con el rol de coordinación del SQL de referencia ese permiso no se concede; el rechazo al sincronizar manualmente no demuestra un problema con el ámbito. No agregues el permiso solo para que pase el caso.

## Data API de Supabase y RLS

Repite la lectura usando la URL del mismo Supabase, su clave pública en `apikey` y el JWT del coordinador en `Authorization`. La Service Role Key y el acceso administrativo del SQL Editor no sirven para acreditar lo que permite RLS a un usuario autenticado. Las [consultas de diagnóstico](validacion-identidad-supabase.md#esquema-y-rls) sirven para inspeccionar políticas y grants sin modificar datos.

```bash
curl -sS -i \
  -H "apikey: ${SUPABASE_PUBLISHABLE_KEY}" \
  -H "Authorization: Bearer ${JWT_COORDINADOR}" \
  "${SUPABASE_URL}/rest/v1/enrollment_requests?select=id&id=eq.${ID_SOLICITUD_B}"
```

| Caso | Operación | Resultado esperado |
| --- | --- | --- |
| RLS-COORD-01 | Consultar las solicitudes A y B por separado. | B no devuelve la fila. A solo se devuelve si el contrato de la Data API permite esa lectura; si ambas se bloquean, verifica que la lectura autorizada funciona por NestJS. |
| RLS-COORD-02 | En un entorno descartable, `POST /rest/v1/user_programs` con `{"user_id":"<UUID_COORDINADOR>","program_id":"<ID_B>","status":"inscrito"}`. | Rechazo y ninguna fila nueva. El SQL histórico `user_programs_manage_staff` permite escritura amplia a coordinación; falta revisar si está activo y qué grants lo acompañan. |
| RLS-COORD-03 | En pruebas, intentar `PATCH /rest/v1/enrollment_requests?id=eq.<ID_SOLICITUD_B>` con `{"status":"autorizada"}`. | Rechazo o cero filas afectadas. Con administración comprueba que la solicitud no cambió; un `2xx` sin filas afectadas no es prueba de una escritura exitosa. |
| RLS-COORD-04 | En pruebas, intentar `POST /rest/v1/user_roles` con el UUID del coordinador, el `role_id` de administrador del entorno y `is_active: true`. | Rechazo; no se crea el rol y `/auth/me` sigue devolviendo solo `coordinador`. |

Ejecuta las escrituras de escalada al final. Antes de cada una, confirma que B sigue sin asignar y que el coordinador conserva solo su rol original; si una escritura indebida tiene éxito, registra el hallazgo y restaura los datos de prueba desde administración antes de continuar. Un rechazo por datos inválidos, por una fila duplicada o por un token expirado no prueba que el control de acceso funcione.

## Registrar el resultado

Para cada caso, registra fecha, ambiente, commit, alias de cuenta, solicitud, estado HTTP, filas visibles o afectadas y comprobación final desde administración. Evita contraseñas, JWT, enlaces de recuperación y datos de otras personas. Si la API filtra B pero Supabase entrega sus datos o permite la autoasignación, CA-06 sigue abierto. También sigue abierto si la API permite la autoasignación aunque Supabase la bloquee directamente.
