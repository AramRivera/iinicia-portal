# Políticas de Row Level Security (RLS)

- **Estado:** Aprobado como base de la migración inicial
- **Fecha:** 2026-10-20
- **Modelo de acceso:** [ADR-001](decisiones/ADR-001-acceso-supabase.md)
- **Modelo relacional:** [Modelo relacional](modelo-relacional.md)
- **Requisitos relacionados:** [ALCANCE.md](../ALCANCE.md), secciones 5, 6, 9 y 12

## Objetivo

RLS es una defensa de base de datos para las consultas ejecutadas con el JWT del usuario. No reemplaza la autenticación ni la autorización de NestJS. Las operaciones realizadas con una credencial privilegiada pueden eludir RLS y requieren controles explícitos en el backend.

La aplicación de políticas y permisos se implementará mediante migración SQL. Este documento no afirma que las políticas estén creadas ni aplicadas en el proyecto remoto.

## Reglas globales

1. Habilitar RLS en todas las tablas de aplicación, incluidas las tablas futuras antes de exponerlas.
2. Denegar por defecto y crear solo las operaciones expresamente autorizadas.
3. Tomar la identidad únicamente de `auth.uid()` asociada al JWT verificado. No usar un ID del cuerpo como identidad del actor.
4. Exigir un perfil `active` en operaciones protegidas. Un perfil `inactive` no puede leer ni modificar datos de negocio, aunque conserve temporalmente un token válido.
5. El navegador no se conecta directamente a Moodle ni recibe credenciales de Moodle. Las operaciones de negocio pasan por NestJS.
6. No habilitar escrituras de cliente en tablas de roles, asignaciones administrativas, autorizaciones, estados de sincronización o auditoría.
7. Aplicar privilegios SQL por tabla y columna además de RLS. Una política de fila no restringe qué columnas de una fila permitida puede modificar el rol SQL.
8. Definir las mismas reglas de autorización en NestJS y en RLS para operaciones con contexto de usuario; el backend no puede relajar las políticas.

## Matriz de acceso propuesta

`SELECT`/`INSERT`/`UPDATE`/`DELETE` se refieren al rol SQL autenticado con el JWT de usuario. La ruta privilegiada del servidor se especifica por separado y no queda protegida por RLS.

| Tabla | Usuario activo | Profesor | Coordinador | Admin | Superadmin | Support |
|---|---|---|---|---|---|---|
| `profiles` | Lee su propio estado mínimo; no modifica estado administrativo | Igual que usuario activo | Igual que usuario activo | Consultas administrativas por operación privilegiada autorizada | Consultas administrativas globales autorizadas | Sin lectura masiva |
| `roles` | Lectura del catálogo | Igual | Igual | Lectura | Lectura | Lectura |
| `user_roles` | Lee sus propias asignaciones | Igual | Igual | Gestión privilegiada de roles no administrativos | Gestión privilegiada de todos los roles | Sin gestión |
| `programs` | Lee programas activos y catálogo | Igual | Igual; gestión limitada a programas asignados | Gestión según permiso | Gestión global | Sin gestión |
| `user_programs` | Lee sus propias relaciones | Igual | Acceso solo a relaciones de sus programas asignados | Lectura/modificación según permisos | Gestión global autorizada | Sin lectura general |
| `course_mappings` | Lee catálogo activo; no concede acceso al curso Moodle | Lee cursos con asignación activa y sincronizada | Lee catálogo; opera en programas asignados | Gestión administrativa | Gestión global | Sin gestión |
| `moodle_user_mappings` | Sin acceso directo | Sin acceso directo | Sin acceso directo | Servicio backend protegido | Servicio backend protegido | Sin acceso directo |
| `course_assignments` | Sin escritura | Lee asignaciones activas y sincronizadas; no se autoasigna cursos | Gestiona asignaciones dentro de sus programas mediante backend | Gestiona según permisos | Gestión global autorizada | Sin gestión |
| `enrollment_requests` | Si tiene rol `student` y relación activa, crea solicitudes propias y las consulta | Igual cuando también tiene rol `student` | Revisa y decide en su ámbito | Revisa y decide según permiso | Revisa y decide globalmente | Sin acceso general |
| `audit_logs` | Sin acceso | Sin acceso | Sin acceso inicial | Lectura autorizada | Lectura autorizada | Sin acceso inicial |

Las acciones administrativas que requieran acceso cruzado a filas se expondrán mediante NestJS con comprobación de actor, estado, rol efectivo, ámbito y objetivo. La tabla no se hará modificable directamente por una persona por el hecho de tener un rol visible en frontend.

## Condiciones por tabla

### `profiles`

- `SELECT`: solo la fila cuyo `id = auth.uid()` y perfil activo.
- No hay columnas de perfil editables directamente en esta migración inicial; se podrá añadir una lista permitida cuando se acuerden los datos institucionales requeridos.
- La baja y reactivación son operaciones protegidas de NestJS. Tras marcar `inactive`, RLS y la API bloquean el acceso antes de completar la deshabilitación de Auth.
- Si existe un mapeo Moodle, el estado remoto deseado también cambia; la baja no se considera sincronizada hasta confirmar la deshabilitación en Moodle mediante una función verificada para la versión objetivo.
- Sin lectura masiva de perfiles mediante el rol cliente.
- Un trigger de alta crea el perfil mínimo y asigna exclusivamente `applicant`; no toma roles del cliente ni copia correo o metadatos.

### `roles` y `user_roles`

- Un usuario activo puede leer únicamente sus asignaciones de rol y el catálogo necesario.
- No se permiten `INSERT`, `UPDATE` o `DELETE` desde cliente en `user_roles`.
- `superadmin` puede gestionar todos los roles; `admin` solo puede gestionar `coordinator`, `teacher`, `student`, `applicant` y `support`. Ningún otro rol puede gestionar asignaciones. Esta matriz se valida en NestJS en operaciones privilegiadas.
- La asignación y retirada generan auditoría.

### `programs` y `user_programs`

- Perfiles activos autenticados pueden leer programas activos y el catálogo de cursos activos. Esta visibilidad no concede matrícula ni acceso académico a Moodle.
- Un usuario puede leer sus relaciones de programa; las relaciones de otros usuarios solo son visibles al personal con permiso en ese programa.
- Un coordinador no puede operar fuera de los programas relacionados con su cuenta y rol activo.
- El usuario no puede crear, activar o modificar su propia relación con un programa.

### `course_mappings` y `course_assignments`

- El ID Moodle es una referencia externa; no habilita acceso por sí solo.
- Un profesor solo puede consultar los cursos con `assignment_status = active` y `moodle_sync_status = synced` en `course_assignments`.
- Un coordinador queda limitado a cursos de programas asignados.
- Un estudiante obtiene acceso académico únicamente cuando su solicitud correspondiente está aprobada y la matrícula fue confirmada por Moodle. La visibilidad de un elemento de catálogo no implica autorización de acceso al curso.
- Solo el flujo autorizado puede crear, revocar o reactivar asignaciones. Al revocar, se deniega de inmediato el acceso local mientras se confirma la revocación remota. La operación, intentos y resultado seguro se auditan.
- Si la respuesta Moodle es incierta, se consulta el estado remoto antes de reintentar una asignación o revocación potencialmente duplicada.

### `moodle_user_mappings`

- RLS está habilitado y no se concede acceso directo a `anon` ni `authenticated`.
- NestJS mantiene el mapeo, los intentos y los resultados seguros mediante una ruta privilegiada protegida.
- `desired_status` distingue el estado remoto solicitado (`active`/`inactive`) del resultado de sincronización.
- El usuario Moodle se busca antes de crear uno; un resultado remoto incierto se verifica antes de reintentar.

### `enrollment_requests`

- Un usuario activo puede consultar sus propias solicitudes.
- Puede insertar una solicitud cuyo estudiante sea `auth.uid()`, con `decision_status = submitted` y `sync_status = NULL`. No existe sincronización hasta una autorización.
- Para crearla necesita rol `student` y relación activa con el programa del curso.
- El cliente no puede fijar `reviewed_by`, `reviewed_at`, `sync_status`, `attempt_count`, `last_attempt_at`, `synced_at` ni el resultado de Moodle.
- Aprobar/rechazar y sincronizar/reintentar son operaciones NestJS autorizadas. Solo una respuesta confirmada de Moodle permite `sync_status = synced`.
- Si una llamada Moodle termina en estado incierto, se verifica primero el estado remoto antes de repetirla.
- Se impide duplicar solicitudes activas mediante restricción única además de la política RLS.

### `audit_logs`

- No se permite escritura directa desde clientes.
- Las operaciones administrativas registran actor, objetivo, acción, resultado seguro y fecha desde un servicio backend.
- La lectura inicial se limita a `admin` y `superadmin`; se ampliará con una política de ámbito si existe un requisito operativo para otros roles.
- No se incluyen tokens, contraseñas, datos sensibles innecesarios ni respuestas externas sin filtrar.

## Funciones auxiliares y prevención de recursión

La migración crea helpers de propósito limitado para comprobar perfil activo, roles y ámbito de programa. Son funciones `SECURITY DEFINER` para evitar recursión RLS al consultar las tablas protegidas, y cumplen estas condiciones:

- No aceptar una identidad de actor arbitraria: derivarla de `auth.uid()`.
- Fijar un `search_path` seguro y cualificar objetos cuando corresponda.
- No usar SQL dinámico.
- Conceder `EXECUTE` solo a los roles necesarios y revocar permisos públicos innecesarios.
- Devolver únicamente la decisión mínima necesaria, no datos de otros usuarios.
- Evitar recursión de políticas al consultar `user_roles` o `profiles` desde RLS.
- Probarlas con usuario anónimo, usuario activo, usuario inactivo y varios ámbitos.

No se agrega una función `SECURITY DEFINER` genérica. Los helpers devuelven únicamente decisiones booleanas sobre el usuario del JWT actual.

## Operaciones privilegiadas y RLS

Las claves privilegiadas del servidor pueden omitir RLS. Para esas rutas NestJS debe:

1. Validar el JWT y obtener el actor autenticado.
2. Comprobar el estado activo, el permiso efectivo y el ámbito.
3. Validar todos los identificadores del recurso objetivo contra datos autorizados.
4. Ejecutar la mínima operación necesaria.
5. Registrar auditoría segura y devolver una respuesta sin secretos.

El cliente privilegiado permanecerá aislado del cliente que usa JWT. No se permitirá seleccionar la credencial mediante parámetros de solicitud ni reutilizarla como acceso general a datos.

## Casos de prueba de seguridad requeridos

Antes de considerar aplicadas las políticas, las pruebas deberán demostrar al menos:

1. Una solicitud sin JWT no lee ni escribe tablas protegidas.
2. Un estudiante no lee ni cambia el perfil de otro estudiante.
3. Un estudiante no puede asignarse roles, programas, cursos ni aprobar su solicitud.
4. Un profesor no consulta cursos sin asignación activa.
5. Un coordinador no opera en programas fuera de su ámbito.
6. Un administrador no obtiene atribuciones de `superadmin` ni puede asignárselas.
7. Un usuario `inactive` no accede a datos protegidos ni ejecuta operaciones de negocio.
8. La baja de un usuario con mapeo Moodle no se declara sincronizada antes de confirmar el estado remoto.
9. Un error de Moodle no deja una solicitud marcada como `synced`.
10. El usuario no puede fabricar el resultado Moodle, los intentos ni los datos de auditoría.
11. Las operaciones privilegiadas se prueban aparte, reconociendo que RLS no las protege.

Estas pruebas aún no se han ejecutado; se implementarán junto con migración y backend. La aplicación de una migración en el dashboard no sustituye las pruebas de autorización.
