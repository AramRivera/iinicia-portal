# Auditoría, pruebas y programación literaria de IINICIA

23 de noviembre de 2026. Base de trabajo en `main` (`6f17bd8`).

## Alcance

La revisión abarcó el portal Next.js, las rutas NestJS, la autenticación y recuperación, las políticas de Supabase, el campus Moodle, el chat, las dependencias npm y la configuración local de Docker. Se contrastó el código actual con la [auditoría del 20 de noviembre](revision-seguridad-20261120.md) y se verificaron los controles con pruebas. Los hallazgos de esta revisión corresponden al código y al entorno local.

## Hallazgos y correcciones

| Componente | Hallazgo | Corrección |
| --- | --- | --- |
| Diagnóstico público de la API | El endpoint de salud devolvía los mensajes de error internos de Supabase al navegador, lo que podía revelar detalles de configuración o de la base. | Conserva el estado del servicio y devuelve un mensaje público fijo. Una prueba HTTP comprueba que el detalle interno queda fuera de la respuesta. |
| Disponibilidad de Moodle | Las consultas al diagnóstico podían iniciar una llamada remota por cada solicitud, incluidas las solicitudes simultáneas. | La misma instancia comparte una comprobación en curso y reutiliza su resultado hasta 15 segundos desde el inicio. La prueba unitaria verifica que haya una sola llamada en paralelo y que se vuelva a consultar al vencer el plazo. |
| Navegación SSO en el portal | El navegador verificaba la ruta inicial de Moodle, pero confiaba en el destino posterior del enlace. | Verifica que haya una sola clave, que el destino pertenezca al origen configurado y que la ruta corresponda al campus, al curso o al calificador. La suite del frontend prueba destinos legítimos y enlaces que deben rechazarse. |
| Dependencias instaladas | La primera compilación de la web encontró Next.js 16.4.2 en `node_modules`, aunque el lockfile fija 16.4.6. También se encontraron diferencias entre las dependencias instaladas de la API y su lockfile. | Se reinstalan las dependencias con `npm ci` y se vuelven a ejecutar las comprobaciones desde esas versiones. El escaneo de los lockfiles del 23 de noviembre reportó cero alertas conocidas en ambas aplicaciones. |

Siguen vigentes los controles de la revisión anterior en el repositorio, incluidos la comprobación del estado de la cuenta, el segundo factor en tablas protegidas, la bitácora reservada al servidor y el envío del token de Moodle en el cuerpo del POST. Las pruebas SQL volvieron a comprobar estos permisos en una base desechable.

## Comandos de verificación

Desde la raíz de Git:

```powershell
npm.cmd --prefix apps/api run build
npm.cmd --prefix apps/api test
npm.cmd --prefix apps/api run test:e2e
npm.cmd --prefix apps/web test
npm.cmd --prefix apps/web run build
npm.cmd --prefix apps/api audit
npm.cmd --prefix apps/web audit
node scripts/literate.mjs verify
```

La suite unitaria del frontend usa el ejecutor nativo de Node.js con soporte para TypeScript. Las pruebas SQL `supabase/tests/staff_scope.sql` y `supabase/tests/client_privileges.sql` se ejecutaron con las migraciones y semillas en PGlite.

| Prueba | Resultado |
| --- | --- |
| Compilación de la API | Correcta después de `npm ci`. |
| Pruebas unitarias de la API | 152 aprobadas. |
| Pruebas HTTP de integración de la API | 39 aprobadas con servicios externos simulados. |
| Pruebas unitarias del frontend | 3 aprobadas sobre enlaces de Moodle. |
| Compilación del frontend | 25 páginas generadas con Next.js 16.4.6 después de `npm ci`. |
| Permisos y políticas SQL | Ambas suites pasaron en la base desechable. |
| Dependencias de la API y el frontend | Cero alertas conocidas según `npm audit` en la fecha indicada. |
| Reconstrucción literaria | 203 bloques coinciden con sus archivos y se pueden extraer a una carpeta nueva. |

## Código en programación literaria

Los capítulos narran el flujo y contienen el código editable de **203 archivos**. `scripts/literate.mjs` permite verificar los bloques contra los archivos de trabajo y extraerlos a un directorio nuevo. La guía indica qué capítulos leer y cómo modificar o reconstruir el código. [Guía de programación literaria](programacion-literaria.md)

## Verificación pendiente

Queda pendiente comprobar la API actualizada y las políticas de Supabase con cuentas reales en un entorno de ensayo, incluidas las operaciones administrativas y el formulario de contacto. La revisión anterior detectó una clave administrativa rechazada en Vercel. El estado de esa credencial y el de la migración requieren verificación en los servicios administrados.

También quedan pendientes la revisión de versiones y configuración de la instalación remota de Moodle, un límite compartido para el chat entre instancias y la evaluación del almacenamiento de sesiones en el navegador. El límite local de Moodle y el del chat operan por instancia. El escaneo npm cubre alertas conocidas de paquetes en la fecha de ejecución.
