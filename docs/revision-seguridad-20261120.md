# Revisión de seguridad de IINICIA

**Fecha:** 20 de noviembre de 2026. **Base de integración:** `main` en `761edf8`.

La revisión cubrió las rutas HTTP de NestJS, autenticación y alcance por rol, políticas y permisos de Supabase, formularios públicos, accesos a Moodle, configuración del portal, Docker de desarrollo y dependencias npm. Los hallazgos se comprobaron por revisión de código, pruebas automatizadas y una base de datos desechable. Las correcciones están en local y todavía no se han aplicado a producción.

## Hallazgos corregidos

| Prioridad | Hallazgo | Corrección |
| --- | --- | --- |
| Alta | Los roles cliente conservaban permisos de tabla que operan fuera de RLS. Las políticas de la bitácora y del registro de accesos permitían a clientes autenticados insertar sus propios eventos. | Se revocan privilegios de tabla innecesarios y se reserva la escritura en ambos registros a la API y los disparadores internos. |
| Alta | El estado del perfil se comprobaba al cargar la sesión en el portal, pero el guard de las rutas protegidas solo verificaba el JWT y AAL2. La Data API dependía de que estuviera configurado el control previo a las solicitudes. | El guard comprueba el estado actual con el JWT del titular. La migración exige AAL2 y un perfil activo o pendiente en las tablas protegidas. Se conserva el acceso de los aspirantes pendientes. |
| Alta | La integración colocaba el token de Moodle en una URL durante el descubrimiento del campus y podía enviar credenciales al seguir redirecciones o confiar en la dirección devuelta. | La integración utiliza la URL configurada y envía el token en el cuerpo del POST. Aplica un tiempo límite, rechaza redirecciones y valida el origen y la ruta de los enlaces temporales de Moodle. Se evita devolver o registrar el texto de los errores remotos y se marca la respuesta de SSO como no almacenable. |
| Alta | Las contraseñas temporales de aprovisionamiento en Moodle se generaban con un aleatorio no criptográfico. | Se generan con `node:crypto`, con 24 caracteres y las categorías requeridas por la política de Moodle. El cambio afecta nuevas contraseñas. |
| Media | El formulario de contacto permitía escritura directa en Supabase, fuera de la validación de NestJS. | Solo la API guarda el mensaje. El formulario conserva su contrato y devuelve `429` al alcanzar el límite en una instancia de la API. |
| Media | Docker publicaba servicios de desarrollo en todas las interfaces con credenciales de ejemplo. | Los puertos del entorno de desarrollo quedan vinculados a `127.0.0.1`. Un entorno compartido requiere credenciales únicas y un punto de acceso explícito con TLS. |
| Media | Las páginas del portal carecían de una política propia de encuadre y de envío de referencias. | Next.js impide el encuadre, evita enviar la URL como referente y desactiva la detección de tipos MIME por el navegador. |
| Variable | npm detectó alertas en dependencias de desarrollo de la API y del portal. | Se actualizaron las resoluciones que acompañan a Mau y TypeScript ESLint. Se conservan los comandos de compilación y despliegue. |

## Resultados de las pruebas

- API. `npm run build`, `npm test` y `npm run test:e2e` pasaron. Se ejecutaron 150 pruebas unitarias y 38 de API. Los casos de autenticación, Moodle y contacto usan dependencias simuladas.
- Base de datos. Se ejecutaron la línea base, las migraciones, las semillas y los scripts `supabase/tests/staff_scope.sql` y `supabase/tests/client_privileges.sql` en una base desechable con PGlite. Se comprobó el acceso con AAL2, el rechazo de AAL1 y de cuentas suspendidas, el alcance por rol y la reserva de privilegios a la API. Los scripts también se pueden ejecutar con `psql -X -v ON_ERROR_STOP=1 -f <archivo>` en una base de ensayo con migraciones y semillas.
- Portal. `npm run build` compiló las 25 páginas y se verificaron las cabeceras de seguridad en el manifiesto de producción.
- Dependencias. `npm audit` reportó cero alertas conocidas en los árboles de API y web en la fecha de la revisión.
- Docker. `docker compose -f docker/compose.yaml config --quiet` validó la configuración. El motor local estaba apagado y la verificación de la base se hizo de forma aislada.

## Verificación pendiente en servicios externos

- **Supabase de producción.** Confirmar que la migración anterior de alcance por rol está aplicada. Probar la nueva migración en una copia y repetir los flujos con un aspirante pendiente, un profesor, un coordinador, un administrador y una cuenta suspendida. Verificar las listas reales de redirección, Turnstile y la configuración MFA de PostgREST en el panel del servicio.
- **Clave administrativa.** En una comprobación previa Supabase rechazó `SUPABASE_SECRET_KEY` en Vercel. Verificar el valor en el servicio antes del despliegue. El formulario de contacto, la sincronización de cursos y los dictámenes requieren una clave válida del proyecto. Publicar la API actualizada y comprobar el formulario antes de revocar la escritura directa con la migración.
- **Moodle.** Verificar la versión exacta y los avisos de seguridad de la instalación remota y de sus plugins. Confirmar la URL canónica HTTPS, los permisos del usuario de Web Services, la caducidad y el uso único de las claves SSO y el acceso con cada rol. Rotar cualquier credencial de prueba que se haya reutilizado fuera de un entorno aislado.
- **Vercel y chat público.** El límite de NestJS se guarda en memoria por instancia. Validar un límite compartido en el perímetro o con un almacén común antes de considerar cubierto el abuso distribuido. La redacción del chat cubre correos, enlaces y números largos, pero puede dejar otros datos personales en el texto libre enviado a DeepSeek.
- **Sesiones del navegador.** El portal guarda el token de acceso en `localStorage`. Migrarlo a cookies `HttpOnly` requiere coordinar el origen de los servicios, CSRF y los flujos de login, MFA y recuperación. Las cabeceras añadidas protegen contra encuadre y fuga de referentes. Una política completa de scripts requiere validar Next.js y Turnstile.

## Orden de publicación

Validar primero en un entorno de ensayo con una clave administrativa válida, probar el formulario en la API actualizada y aplicar ahí la migración. Repetir las comprobaciones de acceso por rol, contacto y SSO. La migración se ejecuta sobre bases existentes sin reinicializar volúmenes. Docker la incluye al crear una base nueva.
