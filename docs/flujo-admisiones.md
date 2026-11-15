# Admisiones y paso a estudiante

El aspirante puede consultar sus postulaciones desde Mi IINICIA. Administración consulta la bandeja general y coordinación consulta las postulaciones de sus programas asignados. El filtro del backend complementa RLS. Los roles sin atribuciones de revisión solo consultan sus propias postulaciones.

El dictamen requiere una cuenta revisora activa. Coordinación requiere permiso `admissions.review` y una asociación académica activa con el programa. El dictamen, la auditoría y, al admitir, la asignación del programa, la activación de un perfil pendiente y la concesión del rol Estudiante se confirman juntos. La admisión conserva roles adicionales. Tras el dictamen, la API autoriza y sincroniza los cursos obligatorios activos del primer módulo del programa. Un dictamen admitido requiere un proceso de baja para revertirse.

## Puesta en marcha

1. Revisar el esquema del ambiente de pruebas. La migración `20261113120000_admission_review.sql` requiere el esquema vigente con `admission_applications`, `roles.slug`, `user_roles.role_id` y las funciones de permisos. La migración inicial del repositorio por sí sola no contiene ese esquema.
2. Aplicar la migración en el ambiente autorizado antes de desplegar la API nueva. La función de dictamen requiere la credencial de servicio. Las escrituras de postulaciones y asociaciones a programas pasan por NestJS.
3. Validar con un aspirante, un administrador y un coordinador de otro programa. Comprobar postulación, bandeja, denegación fuera de ámbito, admisión y acceso al panel Estudiante.
4. Autorizar la matrícula del curso de prueba, confirmar el estado en Moodle e ingresar al aula con la cuenta de estudiante.

El contrato mantiene las rutas y las respuestas exitosas existentes. Para la interfaz, mostrar la carga y los fallos de bandeja por separado del estado vacío. Tras admitir, volver a consultar el perfil para actualizar los roles del usuario. El catálogo de solicitudes de materias y su relación con la admisión quedan como decisión de producto pendiente.

## Evidencia local del 13 de noviembre de 2026

Se levantaron PostgreSQL 16, Supabase Auth v2.197.0, PostgREST v14.6 y Mailpit en una red Docker de pruebas. Se usó el esquema histórico como base exclusiva del laboratorio y se aplicaron las migraciones de MFA y admisiones. Esta ejecución valida el flujo contra servicios locales con ese esquema de prueba. La línea base reproducible y la aplicación en el proyecto remoto siguen pendientes.

| Flujo | Resultado observado |
| --- | --- |
| Identidad | El registro creó un perfil Aspirante. Mailpit recibió el correo, se consumió el enlace y se completó TOTP. NestJS y PostgREST rechazaron AAL1. |
| Postulación | El aspirante se postuló a dos programas. Una segunda postulación al mismo programa devolvió 409. |
| Coordinación | Solo vio la postulación de su programa en NestJS y PostgREST. Pudo pasarla a revisión. El dictamen y la asignación fuera de su programa devolvieron 403. |
| Administración | Vio ambas postulaciones y admitió una. El perfil pasó a Activo, obtuvo el rol Estudiante y quedó asociado al programa. El dictamen quedó auditado. |
| Matrícula | La API sincronizó una matrícula en el Moodle local. El curso **HTML Básico Desde Cero** (ID 4) apareció en la consulta de cursos autorizados del estudiante. |
| Aula | Se consumió el enlace de SSO con un cliente HTTP. Moodle emitió una sesión y devolvió la página del curso. |

El curso contiene foro, recursos, página y tarea. Queda pendiente comprobar evaluación, calificación y finalización, y completar la demo desde navegador con un profesor y dos estudiantes. El registro se probó con Mailpit y TOTP. Turnstile requiere su propia validación.

## Preparación de la demo del curso · 14 de noviembre de 2026

En el laboratorio, el portal por ZeroTier respondió con HTTP 200 y la API informó conexión con Supabase y Moodle. El curso **HTML Básico Desde Cero** (ID 4) tiene una matrícula de estudiante sincronizada desde el portal. Supabase local tiene dos perfiles activos con rol Estudiante y ningún perfil activo con rol Profesor.

El curso tiene el seguimiento de finalización habilitado. El servicio web devolvió finalización desactivada en todas las actividades que listó, y entre ellas no apareció un cuestionario nativo.

1. Iniciar sesión en el portal con una cuenta administradora del laboratorio. Crear o activar el perfil Profesor, asignarlo al curso y matricular al segundo estudiante. Comprobar en Moodle los roles de las tres cuentas.
2. Con un usuario autorizado para editar el curso, configurar una evaluación calificable y activar los criterios de finalización de las actividades que se usarán en la demo.
3. Entrar desde los tres perfiles, realizar y calificar una entrega, y comprobar los indicadores de calificación y avance desde el panel del estudiante.

## Postulación, dictamen y asignación desde el portal

1. En el panel de aspirante, selecciona un programa y envía la postulación. Los programas con una postulación registrada aparecen en el historial y salen del selector. Puedes consultar el dictamen con **Actualizar estado**. La carga de cursos e inscripciones se gestiona por separado.
2. En administración, abre **Postulaciones**, localiza la solicitud y pulsa **Admitir**. El portal actualiza la fila con la respuesta confirmada de la API. La bandeja distingue un fallo de consulta de una lista vacía.
3. En el panel del aspirante, actualiza el estado y pulsa **Ir a mi panel de estudiante**. El portal consulta de nuevo los roles de la cuenta y muestra los programas asociados en **Mis programas**.
4. Si administración necesita asociar un programa directamente, abre **Programas → Asignar programa a un usuario**. Busca por nombre o correo, selecciona el usuario y el programa y confirma. Esto registra el estado académico `inscrito` y conserva los roles actuales de la persona. Las matrículas de cursos en Moodle se gestionan desde **Asignaciones**.

Se comprobó por HTTP con cuentas del laboratorio autenticadas con TOTP que el aspirante puede postularse, que un duplicado recibe 409, que un aspirante no puede dictaminar y que administración puede admitir y asignar otro programa. La consulta del perfil devolvió ambas asociaciones.

Con las sesiones AAL2 obtenidas en el laboratorio, se comprobó en Firefox que el aspirante envía la postulación, administración la admite y asigna un segundo programa, y el estudiante ve ambas asociaciones en su panel. Para repetir la prueba, iniciar ambas instancias con `--lab`.

## Reparación y validación en Supabase remoto · 14 de noviembre de 2026

Ambiente confirmado por el responsable como **desarrollo/pruebas**: `mmtuaangwbsdtddeplfv`. El responsable ejecutó `supabase/repairs/20261114_remote_admissions.sql` en SQL Editor. El archivo agrupa MFA, admisión transaccional y lectura de oferta; se comprobó su ejecución local antes de entregarlo. La validación posterior usó el Supabase remoto, no el laboratorio.

### Causas y correcciones

- Ambas instancias del frontend apuntaban al laboratorio. Ahora usan la API `:3000`, configurada con Supabase remoto. Se conservan los archivos de entorno del usuario y las cuentas demo originales. `--lab` queda como opción explícita, con directorios de compilación separados.
- Faltaba `iinicia_review_admission` en remoto. La reparación instala la función y las restricciones de escritura; la API devuelve 503 accionable si falta la migración.
- La política histórica solo dejaba leer cursos ya autorizados, dejando al aspirante sin oferta. La nueva política permite consultar cursos activos con AAL2 y perfil activo/pendiente. Se mantiene JWT/RLS; conocer la oferta no autoriza el aula.
- RolesGuard no cargaba roles cuando no había una lista de roles obligatorios. GET /courses ahora distingue correctamente el catálogo administrativo de los cursos propios. Coordinación solo obtiene el catálogo de sus programas.
- El estudiante perdía toda la carga cuando fallaba una consulta. Ahora conserva las fuentes exitosas y carga progreso por separado. Administración y Asignaciones muestran fallos en lugar de listas vacías ficticias.
- Al autorizar una matrícula se activa el rol Estudiante incluso si antes estaba inactivo o vencido. Los fallos al activar el rol son explícitos. La respuesta de autorización devuelve el estado persistido después de sincronizar, incluyendo errores.
- Tras admitir hay una acción **Asignar curso** con el usuario seleccionado. Admitir asocia programa y rol; la matrícula se autoriza por separado. SSO de curso y botón de acceso requieren estado `sincronizada`; la autorización pendiente se etiqueta como tal.
- Al volver a la pestaña se consulta el perfil para recoger los nuevos roles. Un error transitorio de red ya no elimina el token; 401/403 sí cierran el acceso local.

### Evidencia externa

Con fixtures nuevos en Supabase remoto (dominio reservado `iinicia.invalid`), sesiones emitidas por Supabase y TOTP real:

1. Aspirante consultó oferta; sus cursos autorizados estaban vacíos. API y Data API rechazaron AAL1.
2. Postulación creada; duplicado 409; dictamen de aspirante y coordinación sin ámbito 403.
3. Administración admitió; el perfil devolvió Estudiante y el programa asociado. La admisión por sí sola no creó cursos autorizados.
4. Solicitud de curso pasó de pendiente a sincronizada tras aprobación. La API del estudiante devolvió HTML Básico Desde Cero, Moodle ID 4.
5. Asignación directa a otro aspirante creó matrícula y rol Estudiante; su consulta mostró el curso.
6. Se consumió SSO por HTTP y Moodle devolvió el curso con sesión válida.
7. Firefox recorrió con un tercer aspirante: oferta → postulación → administración admite → Asignar curso → matrícula confirmada → panel Estudiante con programa, curso y botón de aula. La misma cuenta mostró sus datos desde localhost:4000 y ZeroTier:4007.

Los fixtures se aprovisionaron por la API administrativa de Auth y recibieron sesión mediante enlace generado y TOTP; el navegador recibió esa sesión AAL2. **Esto no prueba el formulario de login, CAPTCHA ni entrega de correo.** No se desactivaron esas protecciones. Las cuentas de prueba quedaron conservadas e identificadas como «Prueba flujo»; las credenciales/tokens no forman parte del repositorio.

El curso aún requiere la demostración de evaluación, calificación y finalización con profesor y estudiantes. Tampoco se considera resuelta aquí la baja con fallo de Moodle, la línea base completa de esquema o el despliegue final.

### Comprobaciones del código

- API: `npm test` — 107 pruebas aprobadas; `npm run test:e2e` — 32 pruebas HTTP con mocks aprobadas; `npm run build` aprobado.
- API: `npm run lint` finalizó sin errores, con dos advertencias en `moodle.client.ts` sobre uniones con `any`.
- Web: `npm run build` aprobado. `npm run lint` sigue fallando: 82 errores y 41 advertencias distribuidos en los paneles, tipos, API y contextos. No se declara cerrado ese trabajo de calidad.
- `git diff --check` aprobado. No se realizó commit ni cambio de rama en esta reparación.


## Matrícula automática y panel docente

Al admitir, se intenta matricular al estudiante en los cursos obligatorios activos vinculados al primer módulo del programa. Un fallo de Moodle conserva el dictamen. En Postulaciones, **Sincronizar cursos iniciales** permite volver a intentar sin duplicar matrículas. Las matrículas rechazadas o dadas de baja conservan su estado. Los cursos optativos y posteriores se asignan por separado.

El panel docente muestra las asignaciones sincronizadas como profesor y consulta los estudiantes de cada materia en Moodle. El calificador usa un enlace SSO que exige una asignación docente sincronizada en ese curso. Las bajas se gestionan desde administración.
