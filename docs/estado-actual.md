# Estado actual del proyecto IINICIA

**Revisión documental y del código:** 5 de noviembre de 2026  
**Rama de referencia:** `main`  
**Alcance vigente del curso de prueba:** un curso

Este documento separa lo que se observa en el repositorio de lo que requiere confirmación en servicios externos. Los módulos, variables de entorno, mocks, ejemplos y documentos por sí solos no prueban que Supabase o Moodle estén conectados ni que una operación real haya funcionado.

## Alcance vigente

El PDF de alcance adjunto especifica dos cursos de ejemplo. El profesor modificó posteriormente ese requisito a **un curso de prueba**; esta instrucción más reciente prevalece para el proyecto. El nombre y los identificadores del curso que permanecerá deben confirmarse con el equipo docente. No se deben tratar los IDs `2` y `3` que aparecen en documentación anterior como datos vigentes o verificados.

Para la demostración, el curso único debe permitir validar profesor, estudiantes, matrícula y acceso por rol. El alcance detallado del PDF para los cursos de ejemplo incluye contenido o recurso, foro, tarea o actividad práctica, evaluación, calificación y seguimiento de finalización. El cambio comunicado afecta la cantidad de cursos, no elimina esos criterios.

## Estado por componente

| Componente | Evidencia en el repositorio | Pendiente para aceptar el componente |
| --- | --- | --- |
| Frontend | Aplicación Next.js/React con páginas públicas, registro, login, rutas de recuperación y paneles por rol. La guía vigente está en [`frontend.md`](frontend.md). | Comparar y aprobar los contenidos migrados desde WordPress; revisar textos, imágenes, SEO y redirecciones; validar pantallas responsive y accesibilidad; probar flujos con servicios y usuarios reales. |
| Backend | API NestJS modular con módulos de auth, users, roles, permissions, programs, courses, enrollments, admissions, Moodle, audit y CMS. Hay DTOs, guards, migraciones, contrato OpenAPI y pruebas unitarias. | Resolver discrepancias de flujos y contratos; verificar todas las rutas con Supabase/Moodle reales; comprobar autorizaciones por rol y ámbito; ejecutar y registrar las comprobaciones de build, lint y pruebas del equipo. |
| Supabase | Hay una migración versionada con tablas iniciales y RLS, además de la decisión de acceso mixto. La guía manual informa que la migración está pendiente de aplicación. | Confirmar ambiente, aplicar y registrar la migración, validar configuración de Auth y correo, probar RLS con JWT de distintos roles y verificar las operaciones privilegiadas. No se afirma aquí que haya conectividad activa. |
| Moodle | Existe código para Web Services, sincronización de usuarios/matrículas, consulta de datos académicos y generación de enlaces de acceso. Hay configuración de ejemplo y documentación sobre `auth_userkey`. | Confirmar instalación y versión objetivo, URL accesible, servicio y funciones habilitadas, permisos, plugin/mecanismo SSO y mapeo de roles. Configurar y probar un solo curso completo con una cuenta docente y al menos dos estudiantes de prueba. |
| Migración desde WordPress | El frontend contiene rutas institucionales y el backend contempla un endpoint para consultar redirecciones. | Completar inventario editorial y técnico, decidir qué migrar/actualizar/reescribir, validar redirecciones y conservar evidencia. El endpoint no demuestra que exista un inventario completo ni que ya se hayan aplicado redirecciones. |
| Operación y entrega | Hay ejemplos de variables de entorno, guías de instalación y varios documentos de operación. | Preparar ambientes separados, despliegue reproducible, HTTPS, respaldos y recuperación; retirar datos de acceso de desarrollo; registrar resultados de pruebas y demostración integral. |

## Diferencias conocidas que deben resolverse

1. La API no expone actualmente `POST /auth/recover` ni `POST /auth/reset-password`, aunque el cliente web invoca esas rutas. El flujo visual de recuperación existe, pero no debe anunciarse como funcional hasta cerrar el contrato y probarlo.
2. El cliente web describe una solicitud de inscripción pendiente de autorización; el servicio de inscripciones contiene flujos que autorizan y sincronizan inmediatamente. El equipo debe definir la regla y alinear API, frontend y OpenAPI.
3. El código SSO con Moodle existe, pero su operación depende de configuración externa que no se verifica desde el repositorio.
4. El PDF adjunto y varios documentos históricos todavía mencionan dos cursos, versiones de Moodle y/o identificadores de cursos. Se deben considerar referencias antiguas hasta confirmarlas con el equipo y el entorno real.
5. Hay varios scripts SQL bajo `apps/api/db/` y una migración bajo `supabase/migrations/`. Antes de aplicar cambios al esquema, el equipo debe mantener claro cuál migración es la fuente reproducible y evitar ejecutar scripts históricos sin revisión.

## Revisión de integraciones

La guía [`supabase-configuracion-manual.md`](supabase-configuracion-manual.md) describe la aplicación manual de la migración y las pruebas de RLS pendientes. Las variables de [`apps/api/.env.example`](../apps/api/.env.example) y [`apps/web/.env.example`](../apps/web/.env.example) son plantillas; no acreditan configuración real. No se deben copiar valores secretos a documentación.

Para Moodle, la integración se considera validada únicamente cuando se registra evidencia de una llamada real a la instancia elegida y de los flujos de creación/vinculación, matrícula, acceso y permisos del curso único. Las pruebas con mocks solo validan el comportamiento local del código.

## Criterio para marcar una tarea como terminada

- El código y el contrato describen el mismo comportamiento.
- La comprobación ejecutada y su resultado quedan registrados.
- Para integraciones externas, se indica si la verificación fue real o se limitó a mocks.
- Los flujos se prueban con al menos un rol autorizado y uno sin autorización.
- La evidencia no contiene contraseñas, tokens ni claves.
