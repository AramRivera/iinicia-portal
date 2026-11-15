# Continuación de IINICIA en Antigravity

Usa `Proyecto_Rediseno_Migracion_Portal_IINICIA_React_Moodle.md` como documento de requisitos y `ALCANCE.md` como alcance vigente. La demo requiere **un curso completo**, HTML Básico Desde Cero (Moodle ID 4 en pruebas), un profesor y dos estudiantes. Revisa `git status` antes de editar: hay actualizaciones documentales locales y deben conservarse.

## Primera tarea · Línea base de Supabase

La conexión PostgreSQL al proyecto remoto de pruebas funcionó. La exportación fue de solo esquema y quedó fuera de Git:

- `/home/aram/.local/share/iinicia/schema-export/public.sql`: exportación de `public` con tablas, vistas, funciones, índices, políticas RLS, restricciones y permisos. Se comprobó que el archivo no contiene comandos de carga de filas.
- `/home/aram/.local/share/iinicia/schema-export/auth-triggers.sql`: trigger de alta del portal en `auth.users`. Su función pertenece a `public`; asegúrate de referenciarla explícitamente al preparar la migración.
- Los demás esquemas detectados son `auth`, `extensions`, `graphql`, `graphql_public`, `realtime`, `storage` y `vault`, gestionados por Supabase o sus extensiones. Revisa dependencias y aprovisiónalas según el entorno.
- `/home/aram/.config/iinicia/supabase-db-url` quedó como plantilla protegida. Los SQL ya exportados bastan para iniciar la comparación local.

1. Lee `AGENTS.md`, `ALCANCE.md`, `docs/supabase-auditoria-esquema.md`, las skills `supabase` y `supabase-postgres-best-practices`, el contrato `docs/openapi.yaml` y los tipos de la API. Si usas MCP, conéctalo al proyecto de pruebas en modo lectura.
2. Compara el SQL exportado con `supabase/migrations`. La prueba limpia aplicó la migración inicial y MFA, pero falló en admisiones por ausencia de `admission_applications`. El esquema histórico también difiere en `roles`, `user_roles`, cursos y matrículas.
3. Prepara una línea base revisada para instalaciones nuevas. Extrae las definiciones propias de IINICIA, revisa propietarios, permisos efectivos, RLS, extensiones, vistas, funciones y triggers. Inventaría catálogos indispensables de roles y permisos y prepara semillas sintéticas reproducibles. Revisa por separado la configuración de PostgREST exigida para AAL2, ya que un dump de `public` no captura configuración de roles del clúster. Usa `20261110120000_require_mfa_data_api.sql` como referencia.
4. Restaura únicamente en un Supabase local vacío y aislado. Valida alta y perfil inicial, AAL1 rechazado y AAL2 permitido, lectura y escritura por rol, ámbito de coordinación, admisión, catálogo y matrícula. Conserva comandos y resultados sin credenciales. Documenta cómo adoptar el historial en un entorno existente y deja la aplicación remota para una fase autorizada.
5. Entrega un SQL revisado y versionable, el arranque desde cero y evidencia de las pruebas. Mantén los archivos exportados originales fuera de Git. Usa el SQL como entrada para revisión antes de restaurarlo.

## Qué falta después de la línea base

| Orden | Entregable | Criterio de cierre |
| --- | --- | --- |
| 2 | Despliegue y recuperación | Instalación reproducible de API, web, Supabase y Moodle en pruebas. Documentar HTTPS, variables, configuración del LMS, comprobaciones de salud, respaldo y restauración en aislamiento. |
| 3 | Migración de WordPress | Inventario de páginas, recursos y URLs antiguas. Verificar páginas migradas y redirecciones con solicitudes reales al entorno de entrega. |
| 4 | Seguridad operativa | Matriz de permisos por rol, pruebas RLS con cuentas de prueba, verificación de auditoría y revisión de que el frontend no reciba credenciales privilegiadas. Configurar SMTP y repetir registro, confirmación y recuperación con CAPTCHA y TOTP por ZeroTier. |
| 5 | Experiencia y Moodle | Revisar móvil, escritorio, teclado, foco y tema de Moodle. Guardar evidencia con un profesor y dos estudiantes. El usuario ya confirmó entrega, nota y finalización de una actividad, y bloqueo de acceso al portal y al curso tras la baja. El reintento de baja con Moodle caído se aplazó. |
| 6 | Paquete final | Actualizar manuales de instalación, administración, docente y estudiante. Anexar reporte de pruebas con evidencia y grabar video o preparar presentación de la demo integral. |

Para identidad, registro, confirmación y recuperación funcionaron según la prueba manual del usuario. El límite de correos impidió repetirla. Documenta por separado lo comprobado por el usuario, lo verificado por automatización y lo pendiente.

Registra avances en `progreso.md`, `docs/estado-actual.md` y `docs/bitacora-proyecto.md`. Consulta `docs/flujo-admisiones.md` para ensayar el recorrido académico.

## Lista de cierre para entregar el proyecto

El documento original fija la entrega final para el **1 de diciembre de 2026**. El ajuste acordado con el profesor cambia la cantidad a **un curso completo**, y se mantienen el contenido, el foro, la actividad práctica, la evaluación, la nota y el seguimiento de finalización. Usa esta lista para marcar cada requisito cuando tenga evidencia en el entorno de entrega.

- [ ] **CA-01 y CA-02 · Portal institucional y migración.** Contrastar el inventario de WordPress con las secciones publicadas, revisar contenido y recursos, probar las redirecciones y verificar que el portal final funcione en Next.js sin depender de WordPress.
- [ ] **CA-03 · Identidad.** El usuario reportó que registro, confirmación y recuperación funcionaron por ZeroTier. Configurar el correo SMTP del entorno, autorizar las URLs de retorno correspondientes y guardar una prueba completa de registro, confirmación, login, TOTP y recuperación con CAPTCHA habilitado. La cuota de correo impidió repetir la prueba anterior.
- [ ] **CA-04 a CA-06 · Esquema y permisos.** Cerrar la línea base reproducible. Probar con administrador, superadministrador, docente, estudiante, aspirante, coordinación y soporte según sus permisos. Registrar casos permitidos y denegados en NestJS y Supabase RLS, incluidos ámbito de coordinación, acceso a datos de otro usuario y rechazo de AAL1.
- [ ] **CA-07 a CA-09 · Moodle y curso único.** Documentar los servicios web, roles, SSO y tema. Guardar evidencia del curso HTML Básico Desde Cero con un profesor y dos estudiantes, foro y actividad calificable. Ya se confirmó manualmente que el estudiante pudo entregar, ver la nota y ver la actividad completada.
- [ ] **CA-10 a CA-13 · Matrícula y acceso por rol.** Guardar evidencia de vinculación sin duplicados, admisión con matrícula automática, acceso del estudiante y apertura del calificador por el profesor. Incluir una cuenta fuera del curso como control. El usuario ya confirmó que una baja normal bloqueó el acceso al portal y al enlace directo de Moodle. La simulación de una caída y reintento de baja queda aplazada.
- [ ] **CA-14 y CA-15 · Integración segura.** Revisar artefactos, variables y solicitudes de navegador en el despliegue. Verificar que las claves privilegiadas estén en el servidor, que NestJS use los servicios web de Moodle y que la cuenta de integración tenga los permisos necesarios.
- [ ] **CA-16 y CA-17 · Experiencia y diseño.** Revisar páginas públicas y paneles en móvil y escritorio. Comprobar teclado, foco, contraste y mensajes de error. Comparar el tema aplicado en Moodle con el portal.
- [ ] **CA-18 y CA-20 · Operación y entrega.** Completar y ejecutar el manual de instalación con HTTPS y configuración por ambiente. Verificar respaldo y restauración en aislamiento. Terminar manuales de administración, profesor y estudiante y adjuntar el diagrama de componentes.
- [ ] **CA-19 · Auditoría.** Verificar que los cambios de usuarios y roles registren actor, acción y objeto, y que la consulta de la bitácora esté restringida a los roles autorizados.
- [ ] **Evidencia final.** Adjuntar inventario y evidencia de migración, reporte de pruebas y video o presentación. En la demo, recorrer el alta, autenticación, admisión, matrícula, Mi IINICIA, SSO, entrega y calificación. Registrar versión, entorno, rol, resultado esperado y observado, sin credenciales ni datos personales.

Antigravity puede empezar por la línea base y el ensayo local. Después, cerrar el despliegue y la restauración, validar migración y seguridad en el entorno de entrega y reunir las evidencias con la misma versión que se va a presentar.
