# Estado actual del proyecto IINICIA

**Revisión documental y del código:** 14 de noviembre de 2026
**Rama de trabajo:** `main`
**Curso para la demo:** HTML Básico Desde Cero, ID 4 en el Moodle de pruebas.

Este documento separa lo que se observa en el repositorio de lo que requiere confirmación en servicios externos. Los módulos, variables de entorno, mocks, ejemplos y documentos por sí solos no prueban que Supabase o Moodle estén conectados ni que una operación real haya funcionado.

Consulta el [índice de documentación](README.md) para encontrar cada guía. La [bitácora del proyecto](bitacora-proyecto.md) reúne el historial, las decisiones, las pruebas y la matriz de los 20 criterios de aceptación. Para repetir las comprobaciones externas, usa [Identidad y Supabase](validacion-identidad-supabase.md) y [Coordinación con Supabase](pruebas-coordinacion-supabase.md).

## Alcance vigente

El PDF de alcance adjunto especifica dos cursos de ejemplo. El profesor modificó posteriormente ese requisito a **un curso de prueba**; esta instrucción más reciente prevalece para el proyecto. El nombre y los identificadores del curso que permanecerá deben confirmarse con el equipo docente. No se deben tratar los IDs `2` y `3` que aparecen en documentación anterior como datos vigentes o verificados.

Para la demostración, el curso único debe permitir validar profesor, estudiantes, matrícula y acceso por rol. El alcance detallado del PDF para los cursos de ejemplo incluye contenido o recurso, foro, tarea o actividad práctica, evaluación, calificación y seguimiento de finalización. El cambio comunicado afecta la cantidad de cursos, no elimina esos criterios.

## Estado por componente

| Componente | Evidencia | Validación pendiente |
| --- | --- | --- |
| Frontend | Paneles por rol y búsqueda desde la cabecera. Demo con la misma API para localhost y ZeroTier. | Revisar accesibilidad, móvil y lint del portal. |
| Identidad | CAPTCHA integrado, TOTP obligatorio y origen permitido en enlaces de confirmación y recuperación. | El usuario reportó que registro, confirmación y recuperación funcionaron por ZeroTier. Repetir la prueba con SMTP operativo y guardar evidencia de CAPTCHA y TOTP. |
| Supabase y API | Línea base unificada `20261115000000_baseline_schema.sql` y `supabase/seed.sql` probadas con éxito en PostgreSQL 16 limpio. Se verificaron AAL2, rechazo AAL1, ámbito de coordinación, admisión atómica, RLS y alta con `auth.users`. | Desplegar en el entorno reproducible de entrega y ampliar la matriz de pruebas con todos los roles. |
| Moodle | Curso ID 4. Admisión con matrícula automática en cursos obligatorios activos del primer módulo, SSO estudiantil y acceso docente al calificador. | El usuario confirmó entrega, calificación y finalización de una actividad. Falta guardar evidencia y verificar tema y permisos en el despliegue de entrega. |
| Operación | Dockerfiles de producción para API y Web; `docker/compose.yaml` validado con PostgreSQL 16, GoTrue, PostgREST, Mailpit y Moodle; manual de despliegue, healthchecks, HTTPS y respaldo/restauración en aislamiento en [`docs/despliegue-recuperacion.md`](despliegue-recuperacion.md). | Ejecutar la primera restauración periódica programada y evidencia de corte. |

## Validación registrada

- 15 de noviembre: Se consolidó la línea base `supabase/migrations/20261115000000_baseline_schema.sql` y las semillas `supabase/seed.sql` (7 roles, 12 permisos, 30 asignaciones, 3 programas, 3 mapeos con curso HTML Básico ID 4). Probada en aislamiento en PostgreSQL 16 (`test_clean_baseline`) con `ON_ERROR_STOP=1`: disparador de alta de usuario, bloqueo de escrituras directas por cliente, AAL1 rechazado (42501) y AAL2 permitido, dictamen de admisión (`iinicia_review_admission`), restricción de ámbito de coordinación y activación de cuentas. [Auditoría de Supabase](supabase-auditoria-esquema.md).

- Baja de estudiante: el usuario confirmó que la cuenta perdió el acceso tanto a la plataforma como al curso mediante el enlace directo de Moodle tras la baja. Queda por probar el reintento ante un fallo de sincronización.

- El usuario reportó que registro, confirmación y recuperación funcionaron en su prueba manual por ZeroTier el día anterior. La cuota de correo de Supabase impidió repetirla. Queda pendiente guardar evidencia y comprobar CAPTCHA y TOTP en el recorrido completo.

- 14 de noviembre: Supabase remoto de pruebas y Moodle validaron postulación, duplicados, admisión, matrícula automática y reintento, acceso estudiantil y SSO al calificador docente. Firefox verificó el flujo de matrícula en ambos orígenes y la búsqueda docente. Para los flujos remotos se aprovisionaron cuentas de prueba y se usaron sesiones AAL2. Correo y CAPTCHA siguen pendientes de una prueba completa. [Evidencia académica](flujo-admisiones.md) · [Guía del portal](frontend.md).
- La lista priorizada para la entrega y su relación con los criterios están en [progreso.md](../progreso.md).


- 10 de noviembre: API compilada; `npm test` pasó con 88 pruebas y `npm run test:e2e` con 31 pruebas HTTP que usan servicios simulados. Se probó MFA localmente con Supabase Auth `v2.197.0`, PostgREST `v14.6`, PostgreSQL 16 y Mailpit. La web compiló y pasó lint dirigido para las páginas de inicio y recuperación. Detalle: [verificación en dos pasos](autenticacion-dos-factores.md).
- Último lint completo del portal registrado antes de MFA: 94 errores y 40 avisos en la copia local de desarrollo. No se volvió a ejecutar lint completo en esta revisión documental.
- En una revisión anterior, `/api/v1/health` reportó `ok` para Supabase y Moodle en la instancia local. Esto no acredita flujos académicos, SMTP, SSO ni configuración remota de MFA.
- En la rama CAPTCHA, la API compiló, pasaron 88 pruebas unitarias y 32 pruebas HTTP con mocks. La web pasó `tsc --noEmit`. No se ha hecho una prueba real de Turnstile/Supabase porque no están configuradas las claves ni la protección CAPTCHA remota.
- El 13 de noviembre la API compiló y pasó 97 pruebas unitarias y 32 pruebas HTTP con mocks. La web compiló con `npm run build`. PostgreSQL 16 local verificó límites de admisión, transacción y denegación fuera de ámbito. El curso HTML Básico Desde Cero se matriculó y abrió mediante SSO en Moodle local.
- La demo dual responde con HTTP 200 en `http://localhost:4000/login` y `http://192.168.191.171:4007/login`. NestJS respondió a preflight CORS para esos orígenes. Esta prueba local no certifica el acceso desde cada dispositivo remoto.

## Demostración del curso único

1. Confirmar el curso y su mapeo existente. Si el equipo elige HTML básico, cargar el recurso y usar sus consignas como base para las actividades nativas.
2. Configurar una lectura o recurso, un foro, una tarea y una evaluación. Definir la calificación y activar el seguimiento de finalización de actividades.
3. Asignar un docente y matricular a dos estudiantes de prueba mediante el flujo autorizado. Confirmar la matrícula en Moodle y comprobar que otra cuenta no pueda entrar al aula.
4. Prueba manual confirmada por el usuario: el estudiante entregó una actividad, el profesor la calificó y el estudiante pudo ver la nota y la actividad marcada como completada.
5. Registrar fecha, ambiente, resultados y evidencia sin secretos. Probar el correo de recuperación y TOTP con cuentas de prueba después de configurar el envío de correo del ambiente.

## Inventario de WordPress y Redirecciones 301 (CA-01, CA-02)

El inventario de migración desde WordPress se encuentra consolidado y cargado en `public.wp_migration_inventory` vía `supabase/seed.sql` y `docker/init-db/03-seed.sql`. El endpoint `GET /api/v1/migration/redirects` devuelve las 11 redirecciones activas 301, y la política RLS `wp_migration_select_public_redirects` protege la integridad del inventario permitiendo lectura pública y restringiendo modificaciones a administradores. Para detalles operativos y contrato con Next.js, consultar [docs/migracion-wordpress.md](migracion-wordpress.md).

| Enlace publicado (WP) | Etiqueta | Destino en Next.js | Código | Estado |
| --- | --- | --- | :---: | :---: |
| `/` | Inicio | `/` | 301 | Portada Next.js (inactivo 301 para evitar bucle) |
| `/?page_id=1172` | Universidad IINICIA | `/universidad` | 301 | Activo |
| `/?page_id=1202` | Cursos | `/cursos` | 301 | Activo |
| `/?page_id=1652` | Certificaciones | `/certificaciones` | 301 | Activo |
| `/?page_id=1653` | Diplomados | `/diplomados` | 301 | Activo |
| `/?page_id=16` | Regístrate | `/registro` | 301 | Activo |
| `/?page_id=2179` | Iniciar sesión | `/login` | 301 | Activo |
| `/contacto/` | Contacto | `/contacto` | 301 | Activo |
| `/admisiones/` | Admisiones | `/admisiones` | 301 | Activo |
| `/?page_id=15` | Recuperar contraseña | `/recuperar-password` | 301 | Activo |
| `/wp-login.php` | Acceso WP | `/login` | 301 | Activo |
| `/wp-admin/` | Panel WP | `/login` | 301 | Activo |

## Criterio para marcar una tarea como terminada

- El código y el contrato describen el mismo comportamiento.
- La comprobación ejecutada y su resultado quedan registrados.
- Para integraciones externas, se indica si la verificación fue real o se limitó a mocks.
- Los flujos se prueban con al menos un rol autorizado y uno sin autorización.
- Cada inicio de sesión debe alcanzar AAL2 mediante TOTP antes de abrir un panel. La protección de la Data API Supabase requiere además aplicar y verificar la migración correspondiente en el ambiente.
- La evidencia no contiene contraseñas, tokens ni claves.
