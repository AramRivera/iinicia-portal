# Estado actual del proyecto IINICIA

**Revisión documental y del código:** 9 de noviembre de 2026
**Rama de referencia:** `main` local (`ad33159`)
**Alcance vigente del curso de prueba:** un curso

Este documento separa lo que se observa en el repositorio de lo que requiere confirmación en servicios externos. Los módulos, variables de entorno, mocks, ejemplos y documentos por sí solos no prueban que Supabase o Moodle estén conectados ni que una operación real haya funcionado.

Consulta la [bitácora del proyecto](bitacora-proyecto.md) para el historial de ramas, las decisiones, las pruebas y la matriz de los 20 criterios de aceptación. Para repetir las pruebas reales, usa [Identidad y Supabase](validacion-identidad-supabase.md) y [Coordinación con Supabase](pruebas-coordinacion-supabase.md).

## Alcance vigente

El PDF de alcance adjunto especifica dos cursos de ejemplo. El profesor modificó posteriormente ese requisito a **un curso de prueba**; esta instrucción más reciente prevalece para el proyecto. El nombre y los identificadores del curso que permanecerá deben confirmarse con el equipo docente. No se deben tratar los IDs `2` y `3` que aparecen en documentación anterior como datos vigentes o verificados.

Para la demostración, el curso único debe permitir validar profesor, estudiantes, matrícula y acceso por rol. El alcance detallado del PDF para los cursos de ejemplo incluye contenido o recurso, foro, tarea o actividad práctica, evaluación, calificación y seguimiento de finalización. El cambio comunicado afecta la cantidad de cursos, no elimina esos criterios.

## Estado por componente

| Componente | Evidencia | Validación pendiente |
| --- | --- | --- |
| Frontend | Rediseño de navegación y catálogo y pantallas de cuenta integrados. Los accesos rápidos de demostración existen como cambios locales sin commit. | Revisar accesibilidad, contenido y flujos con cuentas de prueba. |
| Backend | Solicitudes propias pendientes; autorización y ámbito en matrículas y consultas de Moodle revisadas. OpenAPI incluye recuperación y restablecimiento. | Corregir la autoasignación a programas desde la ruta de vinculación y comprobar el alcance con cuentas reales. |
| Supabase | Conectividad, alta pública, confirmación, login y lecturas puntuales por rol comprobados. El SQL inicial usa `roles.code` y `user_roles.role_code`; la API vigente consulta `roles.id`, `roles.slug` y `user_roles.role_id`. | Versionar un esquema compatible, comprobar RLS de coordinación y escrituras privilegiadas. SMTP quedó aplazado y falta completar la recuperación. |
| Moodle | Instalación local Moodle 5.3+ (build `20261021`) y Web Service comprobados. Hay [un recurso didáctico candidato](cursos/html-basico/GUIA-MOODLE.txt) para el curso único. | Confirmar nombre e ID del curso, permisos, SSO y mapeo de roles. Registrar evidencia de las actividades y de acceso por rol. |
| Operación | Compilaciones de API y portal y suites unitarias y de API ejecutadas localmente. | Cerrar configuración de despliegue, HTTPS, respaldos y recuperación. |

## Comprobaciones del 9 de noviembre

- API en `ad33159`: 81 pruebas unitarias y 27 pruebas HTTP con servicios simulados. Compilación correcta. El lint terminó con dos avisos de tipos en `moodle.client.ts`.
- Portal: la compilación pasó en la revisión previa, cuyo lint reportó 93 errores y 41 avisos. Al repetir el lint en la copia local con los cambios de demo, reportó 94 errores y 40 avisos; sigue pendiente.
- Conectividad: `/api/v1/health` reportó `ok` para Supabase y Moodle en la instancia local. Las comprobaciones reales de identidad y RLS se detallan en [su registro de evidencia](validacion-identidad-supabase.md#evidencia-de-acceso-comprobada). SSO y las actividades del curso aún no se acreditaron.

## Demostración del curso único

1. Confirmar el curso y su mapeo existente. Si el equipo elige HTML básico, cargar el recurso y usar sus consignas como base para las actividades nativas.
2. Configurar una lectura o recurso, un foro, una tarea y una evaluación. Definir la calificación y activar el seguimiento de finalización de actividades.
3. Asignar un docente y matricular a dos estudiantes de prueba mediante el flujo autorizado. Confirmar la matrícula en Moodle y comprobar que otra cuenta no pueda entrar al aula.
4. Verificar acceso SSO y calificador docente. Completar una actividad con un estudiante y comprobar que el avance y la calificación se reflejen por separado.
5. Registrar fecha, ambiente, resultados y evidencia sin secretos. Probar también el correo de recuperación con una cuenta de prueba.

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
- La evidencia no contiene contraseñas, tokens ni claves.
