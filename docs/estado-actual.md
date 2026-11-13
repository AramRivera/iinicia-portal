# Estado actual del proyecto IINICIA

**Revisión documental y del código:** 13 de noviembre de 2026
**Rama de trabajo:** `main` con admisiones en `6c9eff5` y demo dual en `74ccb79`
**Alcance vigente del curso de prueba:** un curso

Este documento separa lo que se observa en el repositorio de lo que requiere confirmación en servicios externos. Los módulos, variables de entorno, mocks, ejemplos y documentos por sí solos no prueban que Supabase o Moodle estén conectados ni que una operación real haya funcionado.

Consulta el [índice de documentación](README.md) para encontrar cada guía. La [bitácora del proyecto](bitacora-proyecto.md) reúne el historial, las decisiones, las pruebas y la matriz de los 20 criterios de aceptación. Para repetir las comprobaciones externas, usa [Identidad y Supabase](validacion-identidad-supabase.md) y [Coordinación con Supabase](pruebas-coordinacion-supabase.md).

## Alcance vigente

El PDF de alcance adjunto especifica dos cursos de ejemplo. El profesor modificó posteriormente ese requisito a **un curso de prueba**; esta instrucción más reciente prevalece para el proyecto. El nombre y los identificadores del curso que permanecerá deben confirmarse con el equipo docente. No se deben tratar los IDs `2` y `3` que aparecen en documentación anterior como datos vigentes o verificados.

Para la demostración, el curso único debe permitir validar profesor, estudiantes, matrícula y acceso por rol. El alcance detallado del PDF para los cursos de ejemplo incluye contenido o recurso, foro, tarea o actividad práctica, evaluación, calificación y seguimiento de finalización. El cambio comunicado afecta la cantidad de cursos, no elimina esos criterios.

## Estado por componente

| Componente | Evidencia | Validación pendiente |
| --- | --- | --- |
| Frontend | Portal rediseñado, accesos rápidos configurables con `dev:demo` y flujo de TOTP integrado. La demo actual escucha en localhost:4000 y ZeroTier `192.168.191.171:4007`. | Recorrer roles con el equipo y completar ajustes de lint/accesibilidad. |
| Frontend | Portal rediseñado, demo local y widget Turnstile para login, registro y recuperación. El token CAPTCHA se envía a NestJS y se renueva tras cada solicitud. | Configurar la Site Key por ambiente y verificar los flujos con un widget real. |
| Backend | Autenticación con TOTP, NestJS reenvía `captcha_token` a Supabase Auth. El commit `6c9eff5` limita dictámenes y asignaciones de coordinación a programas y hacen transaccional la admisión. | Aplicar la migración de admisiones en pruebas y repetir los permisos con cuentas del ambiente objetivo. Probar CAPTCHA con Supabase configurado. |
| Supabase | Se comprobó alta pública, confirmación y lecturas puntuales en el proyecto configurado antes de integrar MFA. La pila local Auth/PostgREST/PostgreSQL validó TOTP y rechazo de AAL1. La API vigente consulta `roles.id`, `roles.slug` y `user_roles.role_id`, distintos de la migración inicial. | La migración `20261110120000_require_mfa_data_api.sql` no está acreditada como aplicada al proyecto remoto. Falta línea base compatible, revisar RLS y escrituras privilegiadas con JWT reales, y completar recuperación con correo operativo. SMTP sigue aplazado. |
| Moodle | Instalación local Moodle 5.3+ (build `20261021`) y Web Service comprobados. Hay [un recurso didáctico candidato](cursos/html-basico/GUIA-MOODLE.txt) para el curso único. | Confirmar nombre e ID del curso, permisos, SSO y mapeo de roles. Registrar evidencia de las actividades y de acceso por rol. |
| Operación | Compilaciones de API y portal y suites unitarias y de API ejecutadas localmente. | Cerrar configuración de despliegue, HTTPS, respaldos y recuperación. |

La activación del CAPTCHA aún requiere crear el widget Cloudflare, permitir los hostnames usados, configurar `NEXT_PUBLIC_TURNSTILE_SITE_KEY` y pegar la Secret Key en la protección CAPTCHA de Supabase Auth. No se han proporcionado ni configurado claves reales.

## Validación registrada

- 10 de noviembre: API compilada; `npm test` pasó con 88 pruebas y `npm run test:e2e` con 31 pruebas HTTP que usan servicios simulados. Se probó MFA localmente con Supabase Auth `v2.197.0`, PostgREST `v14.6`, PostgreSQL 16 y Mailpit. La web compiló y pasó lint dirigido para las páginas de inicio y recuperación. Detalle: [verificación en dos pasos](autenticacion-dos-factores.md).
- Último lint completo del portal registrado antes de MFA: 94 errores y 40 avisos en la copia local de desarrollo. No se volvió a ejecutar lint completo en esta revisión documental.
- En una revisión anterior, `/api/v1/health` reportó `ok` para Supabase y Moodle en la instancia local. Esto no acredita flujos académicos, SMTP, SSO ni configuración remota de MFA.
- Las pruebas de identidad contra el Supabase configurado son anteriores a MFA. No se han repetido tras el cambio del contrato de login; la migración de protección de Data API no consta aplicada al proyecto remoto.
- En la rama CAPTCHA, la API compiló, pasaron 88 pruebas unitarias y 32 pruebas HTTP con mocks. La web pasó `tsc --noEmit`. No se ha hecho una prueba real de Turnstile/Supabase porque no están configuradas las claves ni la protección CAPTCHA remota.
- El 13 de noviembre la API compiló y pasó 97 pruebas unitarias y 32 pruebas HTTP con mocks. La web compiló con `npm run build`. PostgreSQL 16 local verificó límites de admisión, transacción y denegación fuera de ámbito. El curso HTML Básico Desde Cero se matriculó y abrió mediante SSO en Moodle local.
- La demo dual responde con HTTP 200 en `http://localhost:4000/login` y `http://192.168.191.171:4007/login`. NestJS respondió a preflight CORS para esos orígenes. Esta prueba local no certifica el acceso desde cada dispositivo remoto.

## Demostración del curso único

1. Confirmar el curso y su mapeo existente. Si el equipo elige HTML básico, cargar el recurso y usar sus consignas como base para las actividades nativas.
2. Configurar una lectura o recurso, un foro, una tarea y una evaluación. Definir la calificación y activar el seguimiento de finalización de actividades.
3. Asignar un docente y matricular a dos estudiantes de prueba mediante el flujo autorizado. Confirmar la matrícula en Moodle y comprobar que otra cuenta no pueda entrar al aula.
4. Verificar acceso SSO y calificador docente. Completar una actividad con un estudiante y comprobar que el avance y la calificación se reflejen por separado.
5. Registrar fecha, ambiente, resultados y evidencia sin secretos. Probar el correo de recuperación y TOTP con cuentas de prueba después de configurar el envío de correo del ambiente.

## Inventario inicial de WordPress

El [portal público de WordPress](https://iinicia.org/) mostró estos enlaces en portada el 9 de noviembre de 2026. El endpoint local `GET /api/v1/migration/redirects` devolvió una lista vacía. Los destinos son propuestas para revisar con el equipo editorial.

| Enlace publicado | Etiqueta | Destino propuesto |
| --- | --- | --- |
| `/` | Inicio | `/` |
| `/?page_id=1172` | Universidad IINICIA | `/universidad` |
| `/?page_id=1202` | Cursos | `/cursos` |
| `/?page_id=1652` | Certificaciones | `/certificaciones` |
| `/?page_id=1653` | Diplomados | `/diplomados` |
| `/?page_id=16` | Regístrate | `/registro` |
| `/?page_id=2179` | Iniciar sesión | `/login` |

La revisión cubrió la navegación visible en la portada. Completar el inventario con una exportación de WordPress, comparar contenidos y metadatos y verificar las redirecciones al publicar el portal.

## Criterio para marcar una tarea como terminada

- El código y el contrato describen el mismo comportamiento.
- La comprobación ejecutada y su resultado quedan registrados.
- Para integraciones externas, se indica si la verificación fue real o se limitó a mocks.
- Los flujos se prueban con al menos un rol autorizado y uno sin autorización.
- Cada inicio de sesión debe alcanzar AAL2 mediante TOTP antes de abrir un panel. La protección de la Data API Supabase requiere además aplicar y verificar la migración correspondiente en el ambiente.
- La evidencia no contiene contraseñas, tokens ni claves.
