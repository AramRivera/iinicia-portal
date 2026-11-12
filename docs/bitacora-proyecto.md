# Bitácora del proyecto IINICIA

**Corte:** 12 de noviembre de 2026 · **Base de código:** `main` en `6635d9e`; coincide con `origin/main` según las referencias locales revisadas.

Este documento reúne el alcance acordado, las integraciones de Git, las decisiones técnicas y la evidencia. El [estado actual](estado-actual.md) resume los pendientes; los [casos de coordinación](pruebas-coordinacion-supabase.md) y la [validación de identidad](validacion-identidad-supabase.md) permiten repetir las pruebas.

## Alcance acordado

La nueva versión sustituye WordPress por el portal institucional en React/Next.js. NestJS expone REST bajo `/api/v1`; Supabase Auth gestiona identidades y credenciales y PostgreSQL almacena datos administrativos; Moodle administra los cursos, actividades, matrículas académicas, avance y calificaciones. El navegador consume NestJS y abre el enlace al campus devuelto por la API. Las claves privilegiadas y el token de Moodle permanecen en el servidor.

El profesor redujo de dos a **un curso completo en Moodle**. Se mantienen el contenido, foro, actividad práctica, evaluación, calificaciones y seguimiento de finalización, además de un profesor y dos estudiantes para la demostración. Un segundo programa o mapeo de prueba para comprobar permisos no representa un segundo curso que se deba preparar. El PDF fija la entrega final el **1 de diciembre de 2026**; la entrega parcial del **29 de octubre a las 07:00** es una fecha histórica. Véase [ALCANCE.md](../ALCANCE.md).

## Historial de integración

| Fecha | Cambio integrado | Evidencia en Git |
| --- | --- | --- |
| 19–20 oct. | Estructura de las dos aplicaciones y primer esquema de Supabase con políticas. | `82f73a6`, `a7d880d` |
| 29 oct. | Incorporación del portal, dashboards por rol, integración Moodle, sincronización de cursos, separación de avance y nota, y documentación de API. | Merge `e55ad8a` desde `feature-frontend-portal`; `16d8401`, `e5352c6`, `6451820`, `03dea8c`, `c7540eb` |
| 5 nov. | Revisión del alcance, arquitectura, modelo, guías y manuales. En ese punto se incorporó solo la documentación. | `codex/actualizacion-documentacion`, `d5bff72` → `ff35dfe` |
| 9 nov. | Integración posterior del rediseño de navegación y catálogo. Estilo de vidrio aplicado en cabecera, menú y controles de catálogo; corrección del fondo interactivo y el desplazamiento a secciones. | `test/apple-design-nav-catalog`, `e1990d2`, `074d607` → `636181d` |
| 9 nov. | Recuperación de cuenta, validaciones de matrícula y permisos, cambios coordinados del portal y la API, contrato OpenAPI y recurso candidato de HTML básico. | `feature-backend-api`, `b3cbb82` → `77ac093` |
| 9 nov. | Registro público con confirmación, página de retorno y validación de identidad contra el entorno Supabase configurado. | `a6e27a3` → `8492639` |
| 9 nov. | Compatibilidad con el enlace estándar de recuperación mediante PKCE. Ajuste del mensaje de recuperación para no afirmar que el correo se entregó. | `b993585` → `ddd0378`; `1e63daa` → `90e69be` |
| 9 nov. | Coordinación acotada a sus programas en las operaciones revisadas de matrículas y Moodle; pruebas para accesos autorizados y denegados. | `11f7dc6` → `ad33159` |
| 9 nov. | Registro de cambios de demo locales: accesos rápidos configurables por `.env.demo.local` y corrección del iniciador frente a `--env-file= is not allowed in NODE_OPTIONS`. | `ad7059c` |
| 10 nov. | MFA TOTP obligatorio en cada inicio de sesión, rutas protegidas AAL2, recuperación con confirmación TOTP, contratos OpenAPI y migración separada para exigir MFA en la Data API. | `6635d9e` |

Al corte, `main` y `origin/main` apuntaban a `6635d9e`; la rama `codex/2fa-inicio-sesion` conserva el mismo commit. Esto describe las referencias locales disponibles y no acredita despliegue. Los accesos rápidos de demo están incluidos en el historial, pero cada usuario debe crear su `.env.demo.local`, que permanece fuera de Git.

## Qué quedó en cada componente

**Portal.** Portada y páginas de universidad, oferta, admisiones y contacto, detalle de programa, cuenta y paneles por rol. La navegación y el catálogo tienen transparencias y desenfoque CSS. El inicio de sesión exige TOTP: la web conserva la continuación AAL1 en memoria y solo guarda el token después de verificar AAL2. `GET /auth/me` informa los roles efectivos. Quedan por revisar el ciclo de sesión para producción, accesibilidad, tamaños de pantalla y correspondencia editorial con WordPress. Véanse la [guía del frontend](frontend.md), [MFA](autenticacion-dos-factores.md) y los [manuales](README.md#operación-y-uso).

**Demostración local.** Los accesos se configuran con `.env.demo.local`, ignorado por Git. El iniciador usa `process.loadEnvFile()` y abre Next.js en `127.0.0.1:4000`, evitando el error previo de `--env-file`. Los botones rellenan el formulario; el inicio real pasa por la API y requiere TOTP. Usar solo cuentas de prueba. Véase [cómo iniciar la demo](frontend.md#accesos-rápidos-de-prueba).

**API.** NestJS agrupa salud, autenticación, perfiles y usuarios, roles y permisos, programas, cursos, inscripciones, admisiones, Moodle, auditoría y CMS. Hay validación, guards y limitación de intentos en los flujos de cuenta. Las solicitudes propias de inscripción quedan pendientes; las asignaciones a terceros en el módulo de matrículas requieren autorización y, para coordinación, ámbito. El resultado distingue autorización local de sincronización con Moodle. Se evita duplicar una solicitud activa y hay operaciones de consulta, aprobación, sincronización y desmatriculación. Véanse la [arquitectura](backend-architecture.md) y el [contrato OpenAPI](openapi.yaml).

La MFA se probó el 10 de noviembre con Supabase Auth `v2.197.0`, PostgREST `v14.6`, PostgreSQL 16 y Mailpit en contenedores locales. La API compiló; pasaron 88 pruebas unitarias y 31 pruebas HTTP con servicios simulados. La web compiló y el lint dirigido de las páginas de inicio/recuperación pasó. La migración de MFA para la Data API sigue pendiente de comprobarse en el Supabase remoto. Evidencia completa: [Verificación en dos pasos](autenticacion-dos-factores.md).

**Supabase.** Se documentó el [modelo mixto de acceso](decisiones/ADR-001-acceso-supabase.md): JWT de usuario para consultas sujetas a RLS y cliente privilegiado solo en NestJS con autorización explícita. El alta pública y la confirmación de correo se comprobaron antes de MFA. La API espera `roles.id/slug` y `user_roles.role_id`, distintos de la [migración inicial](../supabase/migrations/20261020110000_initial_schema.sql). La presencia de scripts alternativos no demuestra cuál se aplicó. Falta exportar y versionar una base compatible, probarla en un entorno vacío y repetir el login de dos pasos en el proyecto remoto. La migración `20261110120000_require_mfa_data_api.sql` aún no consta aplicada.

**Recuperación.** Se añadió intercambio PKCE compatible con `{{ .ConfirmationURL }}` y la opción `token_hash`. La cuenta de prueba recibió un correo, pero el flujo con el servicio de correo configurado no completó el cambio; un envío posterior recibió `429 over_email_send_rate_limit`. SMTP propio y SMTP2GO se aplazaron porque el equipo no tenía dominio ni buzón emisor. La implementación local de MFA probó ambos formatos de enlace con Mailpit y exigió TOTP antes de cambiar contraseña; esa evidencia no acredita entrega de correo desde Supabase remoto. Véanse [Identidad y Supabase](validacion-identidad-supabase.md) y [MFA](autenticacion-dos-factores.md).

**Coordinación.** El backend deriva el programa del mapeo de curso y toma como asignaciones activas los estados `admitido`, `inscrito` y `cursando` en `user_programs`. Esto limita la supervisión de matrículas y las consultas de curso revisadas en Moodle; una matrícula propia válida conserva el acceso que le corresponda. El control no cubre la ruta de alta de asignaciones de programa: `POST /api/v1/programs/:id/enroll-user` admite coordinación y escribe con el cliente privilegiado sin verificar ámbito ni impedir la autoasignación. También hay SQL histórico con políticas de `user_programs` y `enrollment_requests` más amplias; sus grants y políticas vigentes no se confirmaron. Estos pendientes impiden cerrar CA-06 aunque los filtros de matrícula funcionen. Véase la [guía de reproducción](pruebas-coordinacion-supabase.md).

**Moodle.** Se localizó Moodle 5.3+ (build `20261021`) en `/var/www/html/moodle` y su directorio de datos en `/var/www/moodledata`. El Web Service respondió a la comprobación de salud. El backend incluye búsqueda y vinculación de usuarios, sincronización de cursos y matrículas, acceso al campus mediante `auth_userkey`, consultas de contenidos, participantes y progreso. La interfaz separa `progress_percentage` de `grade_percentage`. Hay un [recurso candidato para HTML básico](cursos/html-basico/GUIA-MOODLE.txt) y un [tema SCSS](moodle-theme.scss); no se verificaron su aplicación, el curso completo ni el SSO con usuarios reales. Los IDs antiguos de ejemplo no deben usarse como configuración comprobada.

**Brecha en el alta de Moodle.** El [alta administrativa](../apps/api/src/modules/users/users.service.ts) pasa actualmente a la creación inicial de Moodle la misma contraseña que recibe para Supabase Auth. Aunque esa llamada ocurre en el servidor, reutiliza una credencial entre ambos sistemas y no cumple la separación exigida por el PDF. Falta cambiar ese flujo y probar la vinculación por identidad y el acceso al campus sin reutilizar la contraseña del portal.

**WordPress.** Se hizo un inventario inicial de la portada pública y se propusieron destinos en Next.js. La consulta local de `/api/v1/migration/redirects` devolvió una lista vacía en esa revisión. Queda inventariar páginas, imágenes, archivos, formularios, usuarios públicos, URLs y metadatos SEO; clasificar cada elemento para migrar, actualizar, reescribir o eliminar; respaldar el sitio anterior y comprobar las redirecciones 301 antes del retiro. Véase el [inventario inicial](estado-actual.md#inventario-inicial-de-wordpress).

## Reproducir el entorno de desarrollo

1. En `apps/api`, ejecuta `npm ci` y configura `.env` a partir de [su plantilla](../apps/api/.env.example). `SUPABASE_URL` y `SUPABASE_PUBLISHABLE_KEY` permiten conectar Auth; las operaciones administrativas necesitan `SUPABASE_SECRET_KEY` solo en el servidor. Para Moodle usa la URL, el token de Web Services y los IDs de roles del ambiente. Alinea `FRONTEND_URL` y `CORS_ORIGIN` con el origen del portal, según el ambiente.
2. Ejecuta `npm run start:dev` en `apps/api`. Comprueba `http://localhost:3000/api/v1/health` y consulta el contrato en `http://localhost:3000/docs` o en [OpenAPI](openapi.yaml). La respuesta de salud no sustituye una prueba con usuarios.
3. En `apps/web`, instala con `npm ci`, prepara `.env.local` según la [guía del frontend](frontend.md) y ejecuta `npm run dev`. El puerto local del portal es `4000`. Usa las configuraciones y cuentas del entorno de pruebas; conserva los archivos con secretos fuera de Git.
4. Antes de preparar una base vacía o cambiar políticas, compara el [esquema activo y los grants](validacion-identidad-supabase.md#esquema-y-rls). Antes de habilitar el campus en otro ambiente, inventaría funciones y permisos del Web Service y prueba el acceso con un usuario autorizado y uno denegado.

## Evidencia de verificación

| Comprobación | Resultado observado | Qué acredita |
| --- | --- | --- |
| API, revisión previa a MFA | 81 unitarias y 27 HTTP con servicios simulados; compilación correcta; lint con dos avisos de tipos en `moodle.client.ts`. | Resultado de `ad33159`, no recuento del commit actual. |
| API con MFA, 10 nov. | Compilación correcta; 88 pruebas unitarias y 31 HTTP con servicios simulados. | Comportamiento del backend cubierto en la revisión `6635d9e`; no prueba servicios remotos. |
| Portal, lint completo antes de MFA | `npm run lint`: 94 errores y 40 avisos en la copia local con demo. | Lint completo queda pendiente; en la revisión MFA pasó lint dirigido de login y recuperación. |
| Portal con MFA, 10 nov. | `npm run build` pasó. | No sustituye la validación de UI en dispositivos ni el lint completo. |
| Salud local | `GET /api/v1/health` reportó `ok` para Supabase y Moodle. | Conectividad en esa ejecución, no un flujo académico o de correo completo. |
| Supabase real: esquema | Consultas de metadatos REST confirmaron campos usados por la API; también se comprobó que la relación matrícula–mapeo se puede consultar. | El proyecto conectado reconoce esos campos y relación; no acredita todas las migraciones ni todas las políticas. |
| Supabase real: lectura | Anónimo: sin perfiles y API `401`. Estudiante y profesor de prueba: perfil propio visible, ajeno y auditoría sin filas; directorio y perfil ajeno en API `403`. | Controles concretos de lectura en esas cuentas; el profesor también tenía rol de estudiante. |
| Supabase real: registro previo a MFA | `201`; login `401` sin confirmar. Tras confirmar, login y `/auth/me` `200`, con rol `aspirante` y estado `pendiente`. | Evidencia del flujo antiguo, anterior al requisito TOTP; no valida el login actual. |
| Supabase real: recuperación | Primer correo recibido, cambio no completado; siguiente solicitud `429`. | No hay evidencia de restablecimiento completo. |
| Coordinación real | Procedimiento documentado; falta repetirlo con una cuenta nueva. | Pendientes la lectura y escritura por ámbito tanto en la API como directamente en Supabase. |
| Moodle real | Versión local y respuesta del Web Service comprobadas. | No acredita matrículas, idempotencia, SSO, actividades, permisos de curso ni finalización. |
| MFA con servicios locales | Auth/PostgREST/PostgreSQL en contenedores y correo capturado con Mailpit; AAL1 bloqueado en NestJS y Data API; setup, códigos erróneos, login posterior y recuperación exigieron TOTP. | Evidencia reproducible local; no demuestra que el proyecto Supabase remoto tenga configuración TOTP o migración Data API aplicada. |

Para repetir los comandos de aplicación: `npm test`, `npm run test:e2e`, `npm run build` y `npm run lint` en `apps/api`; `npm run build` y `npm run lint` en `apps/web`. Para pruebas reales, anotar fecha, ambiente, rama/commit, rol, solicitud, resultado esperado y observado; redactar secretos, datos personales, JWT y enlaces de un solo uso.

## Matriz de criterios de aceptación

La tabla sigue la numeración del PDF (sección 19), con CA-08 ajustado por el profesor. «Implementado» indica que el código lo contempla; la columna final señala la evidencia de entrega que aún se necesita.

| ID | Criterio | Estado y evidencia de cierre |
| --- | --- | --- |
| CA-01 | Sustituir WordPress | Arquitectura nueva en el repositorio. Falta verificar que el portal de producción y sus redirecciones ya no dependan de WordPress. |
| CA-02 | Portal React/Next.js | Implementado y compilado en una revisión previa. Falta registrar la navegación completa de la versión de entrega. |
| CA-03 | Registro, login con TOTP obligatorio y recuperación con Supabase | Registro/confirmación se comprobaron antes de MFA. TOTP y recuperación protegida se probaron localmente; falta repetir login/recuperación con el Supabase remoto y habilitar correo operativo. |
| CA-04 | Perfiles, roles y relaciones en Supabase; credenciales en Auth | Perfil y rol inicial comprobados. Falta reproducir el esquema vigente y validar relaciones y privilegios con los casos administrativos. |
| CA-05 | Roles y permisos diferenciados | Roles y paneles implementados; comprobaciones parciales. Falta una matriz efectiva por rol, incluidos coordinación y soporte. |
| CA-06 | RLS y backend bloquean acceso indebido y exigen AAL2 | AAL1 se rechaza en pruebas locales. Pendientes migración MFA remota, políticas y escrituras con JWT reales, además de corregir la autoasignación de programa por API. |
| CA-07 | Moodle instalado, configurado y personalizado | Instalación local y Web Service comprobados. Falta inventario de funciones/permisos, SSO, tema aplicado y configuración reproducible. |
| CA-08 | Un curso completo utilizable | Recurso candidato disponible. Falta seleccionar y acreditar el curso con actividades nativas, evaluación y finalización. |
| CA-09 | Un profesor y dos estudiantes matriculados | Hay cuentas de prueba; falta acreditar las tres asignaciones en el curso elegido. |
| CA-10 | Crear o vincular usuarios Moodle sin duplicados | Flujo implementado. Falta separar la contraseña de Moodle en el alta administrativa y probar usuario existente, usuario nuevo y repetición con la misma identidad. |
| CA-11 | Mostrar solo cursos autorizados | Portal y API implementados. Falta probar el catálogo personal y Mi IINICIA con cuentas reales y curso controlado. |
| CA-12 | Estudiante solo en cursos matriculados | Controles implementados. Falta comprobar acceso y denegación tanto desde el portal como directamente en Moodle. |
| CA-13 | Profesor solo en sus cursos docentes | Controles implementados. Falta probar contenido, participantes y calificador con un curso asignado y otro acceso denegado. |
| CA-14 | Secretos fuera del frontend | Las integraciones privilegiadas están en el backend. Falta verificar el artefacto final, sus variables y solicitudes de navegador. |
| CA-15 | React no escribe en la BD de Moodle | Cumplido por diseño en el código revisado: NestJS usa Web Services. Conservar comprobación de la configuración desplegada. |
| CA-16 | Móvil, tableta y escritorio | Hay estilos responsive. Falta registrar pruebas de tamaños de pantalla, teclado, foco, contraste y rendimiento, con WCAG 2.2 AA como objetivo del proyecto. |
| CA-17 | Identidad visual consistente | Portal rediseñado y SCSS de Moodle disponible. Falta comparar el tema aplicado en Moodle con el portal. |
| CA-18 | Instalación, administración y mantenimiento documentados | Guías y manuales disponibles. Falta probarlos en un entorno limpio y completar el procedimiento de operación y respaldo. |
| CA-19 | Auditoría de cambios de usuarios y roles | Hay bitácora y flujos que registran operaciones. Falta probar quién puede leerla y verificar entradas reales con actor, objeto y acción. |
| CA-20 | Despliegue de producción reproducible | Pendientes el procedimiento probado, ambientes separados, HTTPS, comprobaciones posteriores, respaldo y restauración. |

Además de los criterios, la entrega pide el inventario de migración, manuales de administración y de profesor/estudiante, reporte de pruebas y un video o presentación del flujo integral. La demostración final debe recorrer registro, rol de estudiante, aprovisionamiento en Moodle, matrícula, Mi IINICIA, acceso al campus y paneles de profesor y administración, con el único curso acordado.

Antes de dar por cerrada la seguridad de entrega, registrar la revisión de HTTPS, orígenes CORS, protección de sesión y entradas, limitación de intentos, permisos mínimos de Supabase y Moodle, MFA, auditoría, respaldo y restauración. El código exige TOTP para todos los roles; falta acreditar configuración de MFA en Supabase remoto, aplicar la migración de la Data API y ejecutar la validación final en el ambiente de entrega.
