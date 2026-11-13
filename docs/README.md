# Documentación del proyecto IINICIA

Este índice señala qué documentos contienen decisiones vigentes, cuál es evidencia y cuáles son referencias históricas. Si una guía histórica contradice `ALCANCE.md`, el contrato OpenAPI o `estado-actual.md`, prevalecen estas fuentes vigentes.

## Fuentes vigentes

- [Documento técnico de referencia](../Proyecto_Rediseno_Migracion_Portal_IINICIA_React_Moodle.md) y [borrador de seguimiento](../progreso.md). El alcance vigente conserva el ajuste a un curso de prueba.
- [Alcance del proyecto](../ALCANCE.md): objetivo, arquitectura, seguridad, entregables y responsabilidades. Incluye un curso, MFA TOTP y CAPTCHA en los flujos de cuenta.
- [Estado actual](estado-actual.md): rama/código revisado, evidencia disponible, riesgos y pendientes de aceptación.
- [Bitácora](bitacora-proyecto.md): hitos, decisiones de integración y matriz de 20 criterios de aceptación.
- [Admisiones y paso a estudiante](flujo-admisiones.md)
- [Contrato de API OpenAPI](openapi.yaml) y [copia JSON](openapi.json): rutas, DTOs y respuestas del backend.
- [Guía del frontend](frontend.md): estructura, rutas, CAPTCHA, sesión, TOTP, recuperación y demo local.
- [Arquitectura backend](backend-architecture.md): módulos, controles y responsabilidades de NestJS.

## Identidad, autenticación y autorización

- [CAPTCHA en Supabase Auth](captcha-auth.md): configuración de Turnstile y validación por ambiente.

- [Verificación en dos pasos](autenticacion-dos-factores.md): contrato de login, AAL1/AAL2, TOTP, recuperación, migración de Data API y evidencia local.
- [Validación de identidad y Supabase](validacion-identidad-supabase.md): resultados anteriores y posteriores a MFA, recuperación por correo y preguntas pendientes de RLS.
- [Pruebas de coordinación](pruebas-coordinacion-supabase.md): casos esperados para revisar acceso por programa; la comprobación con una cuenta real está pendiente.
- [ADR-001, acceso a Supabase](decisiones/ADR-001-acceso-supabase.md): comparación y decisión del modelo mixto JWT/RLS y cliente privilegiado.
- [Políticas RLS](politicas-rls.md): diseño de permisos por tabla y límites de las credenciales privilegiadas.
- [Política de acceso (referencia histórica)](supabase-access-policy.md): versión previa de la comparación; no usar como evidencia del esquema actual.
- [Configuración manual de Supabase](supabase-configuracion-manual.md): guía histórica de la migración inicial; revisar la advertencia antes de aplicar cualquier SQL.
- [Modelo relacional](modelo-relacional.md): diseño lógico, no evidencia de esquema remoto.

## Operación y uso

- [Manual del portal](manual-portales-y-paginas.md): referencia de páginas y roles, marcada como histórica.
- [Manual del superadministrador](manual-superadministrador.md): referencia operativa de administración; comprobar funcionalidades en el ambiente.
- [Especificación de vistas por rol](especificacion-vistas-frontend-roles.md): requisitos de interfaz, no evidencia de autorización.
- [Accesos demo locales y por ZeroTier](frontend.md#accesos-rápidos-de-prueba): configuración local ignorada por Git, puertos 4000/4007 y origen CORS.
- [Registro de actualizaciones API/web](actualizaciones-api-y-web.md): historial, no reporte de aceptación.
- [Guía histórica de integración frontend](frontend-integration-guide.md): ejemplos antiguos; no usar sus respuestas de login, IDs ni URLs como contrato vigente.

## Moodle, contenidos y migración

- [Estado actual y demostración del curso único](estado-actual.md#demostración-del-curso-único): actividades requeridas y validación pendiente.
- [Recurso candidato HTML básico](cursos/html-basico/GUIA-MOODLE.txt): material de apoyo, no prueba de curso configurado.
- [`apps/api/db/README.md`](../apps/api/db/README.md): advertencias sobre SQL y semillas históricos.
- `apps/api/db/IINICIA_DATABASE.sql` y `apps/api/db/seed.sql`: diseños anteriores al cambio a un curso; no seguir sus ejemplos de dos cursos.

## Desarrollo y operación

- [README del repositorio](../README.md): visión general y arranque breve.
- [README de API](../apps/api/README.md): entorno NestJS, login de prueba y referencia OpenAPI.
- [README de web](../apps/web/README.md): entorno Next.js.
- [Registro de validación](estado-actual.md#validación-registrada): distingue pruebas locales con mocks, servicios en contenedores y verificaciones externas.

## Convención para actualizar documentación

Cuando se cambie un flujo de API, actualizar `docs/openapi.yaml`, su copia JSON, los tipos/guías que correspondan y el estado de aceptación. Registrar la fecha, commit, ambiente y método de prueba. No marcar una integración como operativa solo porque exista código o una migración local; guardar evidencia sin credenciales, tokens, códigos TOTP, enlaces de recuperación ni datos personales innecesarios.
