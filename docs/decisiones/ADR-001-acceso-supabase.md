# ADR-001: Modelo de acceso entre NestJS, Supabase y RLS

- **Estado:** Aprobada para el diseño inicial
- **Fecha:** 2026-10-19
- **Ámbito:** Identidad, acceso a PostgreSQL, autorización y operaciones privilegiadas
- **Requisitos relacionados:** [ALCANCE.md](../../ALCANCE.md), secciones 4, 5, 6, 9 y 15

## Contexto

Supabase Auth será la fuente de identidad y credenciales. PostgreSQL almacenará perfiles y relaciones administrativas. NestJS centralizará la lógica de negocio y Moodle se integrará exclusivamente desde el backend.

La solución debe aplicar autorización en el servidor y en PostgreSQL, permitir operaciones administrativas controladas y evitar que las credenciales privilegiadas lleguen al navegador. El proyecto Supabase `proyecto-iinicia` fue creado por el responsable del proyecto; la configuración y aplicación de migraciones se realizarán manualmente desde el dashboard de Supabase. Este documento no confirma conectividad ni cambios aplicados en el proyecto remoto.

## Alternativas evaluadas

### A. Consultas con el JWT del usuario y RLS

NestJS verifica el token recibido y ejecuta las operaciones de datos con el contexto JWT del usuario. PostgreSQL evalúa sus políticas RLS usando la identidad autenticada.

- **Ventajas:** mantiene la autorización de filas en la base de datos y aplica el principio de mínimo privilegio.
- **Costes:** las operaciones administrativas requieren políticas y flujos específicos; las políticas deben contemplar identidad, estado de cuenta y ámbito.
- **Uso elegido:** opción predeterminada para operaciones normales.

### B. Acceso privilegiado desde NestJS

NestJS usa una credencial privilegiada del servidor. Este acceso puede eludir RLS.

- **Ventajas:** permite operaciones de administración de Auth y tareas administrativas que no pueden ejecutarse con el contexto del usuario.
- **Riesgos:** RLS no protege esas consultas. Un error en la autorización del backend puede exponer o modificar datos.
- **Uso elegido:** excepción limitada a operaciones concretas que la requieran.

### C. Modelo mixto — decisión

Combina el contexto JWT/RLS como ruta normal con operaciones privilegiadas de servidor para un conjunto pequeño y explícito de tareas administrativas.

- **Ventajas:** conserva la defensa de RLS en el acceso habitual y permite operaciones administrativas necesarias.
- **Costes:** se deben mantener separadas las rutas de acceso, probar ambas y documentar cuáles eluden RLS.

## Decisión

Se adopta el **modelo mixto**, con las siguientes reglas:

1. Supabase Auth administra la identidad y las credenciales. No se almacenan contraseñas en tablas propias.
2. El cliente envía el token de acceso a NestJS. La API valida firma, emisor, audiencia y vigencia de acuerdo con la configuración de Auth del proyecto; no confiará en roles ni en identificadores de usuario enviados por el cliente.
3. En operaciones normales, NestJS utiliza el JWT del usuario como contexto para las consultas a Supabase/PostgreSQL. Las políticas RLS se aplican a esas consultas.
4. El acceso privilegiado se limita a operaciones identificadas que lo necesiten, como deshabilitar una identidad mediante las funciones administrativas de Supabase Auth o resolver una operación administrativa autorizada. El cliente privilegiado no será la conexión de datos predeterminada de la aplicación.
5. Antes de una operación privilegiada, NestJS valida identidad activa, permiso efectivo, ámbito de acceso y recurso objetivo. La operación registra una entrada de auditoría sin secretos ni respuestas externas sin filtrar.
6. Las rutas con privilegios elevados se implementan en servicios específicos y no aceptan que el cliente elija libremente un usuario, rol privilegiado, programa o curso fuera de su ámbito.
7. Todas las credenciales privilegiadas permanecen en el servidor, separadas por ambiente. Nunca aparecen en el frontend, respuestas HTTP, logs o documentación con valores reales.
8. La clave privilegiada puede omitir RLS. No se afirma ni se presupone que las políticas protejan consultas realizadas con esa credencial.

## Baja reversible de usuarios

La baja ordinaria será un cambio de estado, no el borrado de filas:

1. El perfil pasa a `inactive` y se registra el actor y el momento de la baja.
2. NestJS rechaza nuevas operaciones protegidas para esa identidad y RLS impide el acceso a datos de la aplicación.
3. Se deshabilita el acceso de la identidad en Supabase Auth mediante una operación administrativa protegida. Si este paso falla, el estado `inactive` seguirá bloqueando la API y los datos; el fallo deberá registrarse y resolverse, sin declarar completada la deshabilitación de Auth.
4. Si existe un vínculo Moodle, se establece `desired_status = inactive` en `moodle_user_mappings` y se sincroniza la deshabilitación con una función Web Service que se haya verificado en la versión objetivo. Mientras está pendiente, el registro conserva el estado y el error para reintento; no se declara completada la baja remota.
5. La reactivación requiere permiso administrativo y debe volver a habilitar Auth y solicitar la reactivación Moodle explícitamente. Las solicitudes, asignaciones y registros de auditoría se conservan según las reglas de retención aprobadas.

La eliminación permanente, la anonimización y los plazos legales de retención quedan fuera de esta decisión y requerirán un procedimiento institucional específico. Las claves foráneas evitarán el borrado accidental de identidades todavía referenciadas.

## Identidad, roles y ámbito

- `auth.users.id` es el identificador estable de identidad y la clave relacionada con `profiles`.
- Los roles de aplicación se guardan en tablas propias controladas por el servidor; no se toman como autoridad los metadatos modificables por el usuario.
- El alta de una identidad crea un perfil mínimo y asigna únicamente el rol de menor privilegio `applicant`; no se crea ningún rol administrativo automáticamente.
- `superadmin` puede gestionar todos los roles. `admin` puede gestionar `coordinator`, `teacher`, `student`, `applicant` y `support`, pero no `admin` ni `superadmin`.
- Un usuario puede tener varios roles. El rol de aplicación no equivale automáticamente a un rol de Moodle.
- `user_programs` limita el ámbito de un coordinador y registra la relación de una persona con un programa.
- `course_assignments` limita el acceso docente a cursos autorizados.
- Los estudiantes solo obtienen acceso al curso Moodle cuando la solicitud está autorizada y la sincronización ha sido confirmada.
- `moodle_user_mappings` registra el estado remoto deseado del usuario; la baja local no se considera sincronizada en Moodle hasta recibir confirmación real.
- Un administrador no obtiene privilegios de superadministrador automáticamente.

## Consecuencias y controles requeridos

- Habilitar RLS en todas las tablas de aplicación y aplicar denegación por defecto.
- Restringir permisos SQL además de definir políticas RLS; RLS controla filas, no sustituye la limitación de columnas modificables.
- Separar las consultas con JWT de los clientes privilegiados y probar explícitamente las dos rutas.
- Auditar asignaciones de roles, autorizaciones, bajas/reactivaciones y operaciones de sincronización.
- Mantener entornos de desarrollo, pruebas y producción separados.
- No aplicar migraciones remotas sin revisión y ejecución manual autorizada por el responsable del proyecto.

## Validación pendiente

Esta decisión es de diseño. Aún se requiere validar la configuración de firma de tokens del proyecto, las políticas mediante pruebas con usuarios de distintos roles y el flujo de deshabilitación/reactivación de Auth en el proyecto remoto. La creación del proyecto Supabase no se considera evidencia de que la aplicación esté conectada.
