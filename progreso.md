# Progreso de IINICIA — borrador de trabajo

**Base revisada:** `main` en `79b952d`. Auditoría estática del repositorio y de la evidencia registrada. Las pruebas históricas no se volvieron a ejecutar en esta revisión y no se consultaron los paneles ni los servicios externos.

**Fuentes:** [documento del proyecto](Proyecto_Rediseno_Migracion_Portal_IINICIA_React_Moodle.md), [alcance vigente](ALCANCE.md), [estado documentado](docs/estado-actual.md), [bitácora](docs/bitacora-proyecto.md) y [contrato de API](docs/openapi.yaml). Para CA-08 y la demostración se aplica el cambio acordado con el profesor: **un curso completo**. Se conservan las actividades, los roles y la evidencia exigida. La fecha de entrega final indicada en el documento es el **1 de diciembre de 2026**.

## Qué llevamos

- **Portal:** Next.js con páginas institucionales, oferta, detalles de programa, admisiones, contacto, cuenta, recuperación y paneles por rol. Existen controles de sesión y navegación diferenciada. [Guía del frontend](docs/frontend.md)
- **API e identidad:** NestJS con módulos de cuenta, perfiles, usuarios, permisos, programas, cursos, matrículas, admisiones, CMS, Moodle y auditoría. El login pasa por TOTP y las rutas protegidas exigen AAL2. Turnstile está integrado en login, registro y solicitud de recuperación, con verificación delegada a Supabase Auth cuando se habilita. [Arquitectura](docs/backend-architecture.md) · [TOTP](docs/autenticacion-dos-factores.md) · [CAPTCHA](docs/captcha-auth.md)
- **Moodle:** cliente de Web Services, vinculación y creación de usuarios, matrículas, consultas de cursos y enlaces de acceso mediante el plugin `auth_userkey`. El portal distingue avance y nota. La bitácora registra una instalación local y respuesta del Web Service. El [material de HTML básico](docs/cursos/html-basico/GUIA-MOODLE.txt) y el [tema SCSS](docs/moodle-theme.scss) son insumos para configurar la instancia.
- **Evidencia disponible:** compilación de la API, 88 pruebas unitarias, 32 pruebas HTTP con mocks y comprobación de tipos web en la revisión de CAPTCHA. MFA y recuperación se ensayaron antes en contenedores locales con Mailpit. Hubo comprobaciones puntuales de identidad y correo en Supabase remoto antes de MFA. No consta la validación remota del flujo actual con CAPTCHA, TOTP y SMTP.

## Criterios de aceptación

| Criterio | Estado observado | Qué falta para cerrarlo |
| --- | --- | --- |
| CA-01 · Sustituir WordPress | Portal nuevo en código; inventario preliminar de portada. | Inventario completo, respaldo, migración, redirecciones 301, corte y verificación en producción. |
| CA-02 · React/Next.js | Implementado; evidencia previa de compilación y tipos. | Recorrer las páginas públicas y privadas en el despliegue de entrega. |
| CA-03 · Supabase Auth | Registro, login, confirmación, recuperación, TOTP y CAPTCHA en código. | Validar en pruebas con CAPTCHA habilitado, correo operativo y cuentas reales de prueba. |
| CA-04 · Perfiles, roles y relaciones | API y SQL presentes; esquema inicial incompatible con consultas actuales. | Versionar una línea base reproducible y verificar alta, roles múltiples, estados y relaciones en una base vacía. |
| CA-05 · Roles y permisos | Paneles y guards para los roles previstos. | Probar cada rol, incluido soporte, coordinación y aspirante, con casos permitidos y denegados. |
| CA-06 · RLS y backend | Hay políticas, guard AAL2 y comprobaciones de ámbito parciales. | Corregir asignación de programas, verificar RLS y grants reales y comprobar la migración AAL2 de Data API. |
| CA-07 · Moodle configurado | Instalación local y Web Service registrados; SCSS disponible. | Reproducir la configuración objetivo, revisar plugin, roles, permisos del servicio y tema aplicado. |
| CA-08 · Un curso completo | Material didáctico candidato. | Confirmar curso e ID y configurar recurso, foro, tarea, evaluación, calificación y finalización. |
| CA-09 · Profesor y dos estudiantes | Hay flujos de alta y matrícula. | Demostrar las tres asignaciones en el curso elegido y verificar los roles efectivos en Moodle. |
| CA-10 · Vinculación sin duplicados | Búsqueda y vinculación en código. | Separar credenciales del alta y probar usuario nuevo, existente, reintentos y solicitudes concurrentes. |
| CA-11 · Cursos autorizados visibles | Paneles y API de cursos/matrículas. | Contrastar los cursos mostrados con las matrículas efectivas en Moodle. |
| CA-12 · Aislamiento de estudiante | Validaciones en el backend. | Comprobar acceso permitido y denegado por portal y Moodle, incluida la baja. |
| CA-13 · Aislamiento de profesor | Consultas docentes y acceso al calificador. | Verificar acceso al curso asignado y denegación fuera de su asignación. |
| CA-14 · Secretos fuera de frontend | Credenciales privilegiadas se manejan en el backend según el código revisado. | Revisar variables y artefactos del despliegue, incluidas respuestas y logs. |
| CA-15 · React sin escritura directa en Moodle | Integración por NestJS y Web Services. | Confirmar el flujo desplegado y los permisos mínimos de la cuenta de servicio. |
| CA-16 · Responsive | Estilos adaptativos presentes. | Probar teléfono, tableta y escritorio, teclado, foco, contraste y rendimiento. |
| CA-17 · Identidad visual | Portal rediseñado y tema Moodle en SCSS. | Aplicar el tema y comparar ambas interfaces en el ambiente objetivo. |
| CA-18 · Documentación operativa | Arquitectura, OpenAPI y guías existentes. | Validar instalación desde cero y completar manuales de profesor y estudiante con el curso real. |
| CA-19 · Auditoría | Módulo de lectura e inserciones en flujos administrativos. | Confirmar altas, roles, estados, programas y matrículas con actor, resultado y lectura restringida. |
| CA-20 · Despliegue reproducible | Arranque local y plantillas de entorno. `docker/compose.yaml` está vacío. | Probar despliegue en staging, HTTPS, variables por ambiente, respaldo, restauración y reversión del corte. |

## Flujos prioritarios para trabajar

- [ ] **P0 · Autorización por programa.** La API comprueba el ámbito de coordinación y la migración restringe la escritura directa de asociaciones. Falta aplicar la migración y verificar que coordinación pueda operar en su programa y reciba denegación fuera de él con cuentas reales. [Servicio](apps/api/src/modules/programs/programs.service.ts)
- [ ] **P0 · Alta administrativa y credenciales.** El flujo de alta pasa `dto.password` tanto a Supabase como a la creación de la cuenta Moodle. Reutilizar la vinculación y el aprovisionamiento con credenciales independientes y documentar recuperación ante un fallo parcial. Cierre: identidad nueva o existente se vincula una sola vez y el acceso al campus funciona con SSO. [Servicio de usuarios](apps/api/src/modules/users/users.service.ts)
- [ ] **P0 · Desmatriculación.** El cliente de Moodle puede fallar y el flujo registra el error pero elimina el registro local. Conservar un estado y un intento auditable mientras la baja remota esté pendiente o incierta. Cierre: una caída de Moodle conserva el registro, un reintento reconcilia la baja y se confirma que la cuenta perdió acceso. [Matrículas](apps/api/src/modules/enrollments/enrollments.service.ts) · [Moodle](apps/api/src/modules/moodle/moodle.service.ts)
- [ ] **P0 · Esquema y RLS reproducibles.** La migración inicial usa `roles.code` y `user_roles.role_code`, mientras la API consulta `roles.slug` y `user_roles.role_id`. Inventariar esquema, grants, políticas y hook existente. Cierre: una base vacía soporta el contrato y el ambiente de pruebas rechaza AAL1 y el acceso fuera del ámbito con usuarios reales. [Migración inicial](supabase/migrations/20261020110000_initial_schema.sql) · [Repositorio de Auth](apps/api/src/modules/auth/auth.repository.ts)
- [ ] **P1 · Registro → confirmación → sesión.** Habilitar Turnstile y correo en pruebas y comprobar alta, perfil inicial, confirmación y login con TOTP. Revisar estados del widget, caducidad y reintento. Cierre: un reto válido permite continuar; uno ausente o inválido se rechaza. [Configuración CAPTCHA](docs/captcha-auth.md)
- [ ] **P1 · Recuperación.** Probar correo, retorno PKCE, cambio de contraseña, reuso del enlace y TOTP. Definir procedimiento de soporte para pérdida del autenticador. Cierre: la cuenta entra con la nueva contraseña y los enlaces inválidos o usados se rechazan con un mensaje accionable. [Validación de identidad](docs/validacion-identidad-supabase.md)
- [ ] **P1 · Demostración del curso.** Seleccionar el curso y validar el recorrido desde aspirante a estudiante autorizado, matrícula, Mi IINICIA, acceso Moodle, actividad, avance y nota. Demostrar el flujo del profesor y un caso denegado, y registrar evidencia con cuentas de prueba.
- [ ] **P1 · Sesión y experiencia por rol.** Revisar expiración, renovación y cierre de sesión, incluido el almacenamiento del token en `localStorage`. En los paneles probar acceso directo, usuarios con varios roles y estados de error o vacío. Incluir revisión de accesibilidad y lint del frontend. [Contexto de sesión](apps/web/src/contexts/AuthContext.tsx)
- [ ] **P2 · Migración y operación.** Completar inventario editorial y SEO, configurar y probar redirecciones, ensayar restauración de respaldos, y preparar el manual de despliegue y los manuales por rol. Grabar la demo integral cuando el ambiente de entrega esté validado.

## Revisión de los recorridos por rol

Revisión de código y del contrato de API. Quedan pendientes los recorridos con cuentas reales y el curso de prueba en Moodle.

| Rol | Flujo actual y punto de fricción | Recorrido propuesto |
| --- | --- | --- |
| Aspirante | Puede postular a un programa y también pedir una materia desde el mismo panel. La admisión y la sincronización de una matrícula son caminos distintos que pueden acabar asignando el rol Estudiante. | Mostrar como acción principal **Continuar mi admisión**. Indicar el programa, el estado y el siguiente paso. Definir si se aceptan solicitudes de materias antes de la admisión y en qué casos. |
| Estudiante | Puede consultar cursos, solicitar otros, abrir Moodle, ver notas y pedir una baja. La pantalla espera las consultas de avance al cargar. Si falla la baja en Moodle, la API puede eliminar igualmente el registro del portal. | Abrir **Mis cursos** de inmediato y cargar el avance por separado. Mostrar junto a cada curso si espera autorización, espera confirmación de Moodle, ya permite entrar o tiene una baja en trámite. |
| Profesor | Tiene accesos al aula, listados y calificador. El listado local filtra matrículas por curso, pero la API general limita al docente sin otros roles a sus propias matrículas. La interfaz ofrece **Desasignar** a un alumno y la API deniega esa operación al docente. El calificador abre una URL directa de Moodle. | Entrar a **Mis cursos → curso → participantes o calificador**. Usar la consulta por curso con autorización docente y un acceso al calificador que mantenga el flujo SSO. Enviar cambios de matrícula a coordinación o administración. |
| Coordinador | Ve programas, cursos y un directorio. El panel funciona principalmente como consulta. La API permite ciertas operaciones sobre matrículas, pero la asignación a programas y el dictamen de admisión carecen de una comprobación equivalente de ámbito. | Empezar en **Mis programas → programa → solicitudes y matrículas**. Exigir ámbito por programa en el servidor antes de exponer operaciones de revisión y asignación en el panel. |
| Administrador | Tiene usuarios, roles, asignaciones, programas, admisiones y Moodle. Varias pantallas repiten operaciones y las peticiones fallidas pueden aparecer como listas vacías. La consulta de admisiones depende de roles que su guard actual no carga. | Centralizar **Usuario → rol y programa → curso → estado en Moodle**. Añadir una bandeja de admisiones con estados de carga, error y vacío, y confirmar cada acción con su resultado real. |
| Superadministrador | Comparte el panel de administración. La asignación de roles comprueba el permiso general, pero el servicio no restringe el rol de destino según los privilegios del actor. | Mantener el panel común y reservar controles globales, integraciones y gestión de roles privilegiados para permisos explícitos. Aplicar la misma política en el alta, la asignación y la retirada. |
| Soporte | Consulta el directorio, la vinculación de cuentas y el estado general de Moodle. La vista carece de una ficha operativa con siguiente paso por incidencia. | Empezar con **Buscar cuenta → diagnóstico → siguiente paso**. Mostrar los datos mínimos necesarios para distinguir problemas de cuenta, vinculación y disponibilidad del campus. |

### Primer cambio implementado

La API ya carga los roles para la bandeja de admisiones, verifica el ámbito de coordinación al dictaminar y al asignar usuarios a programas, y guarda el dictamen en una transacción. PostgreSQL 16 local confirmó la denegación fuera de ámbito y la reversión de la admisión ante un fallo de auditoría. Queda por aplicar la migración en pruebas y recorrer el flujo con cuentas reales. [Guía de admisiones](docs/flujo-admisiones.md)

### Prioridad para la primera ronda

1. **Admisión y acceso del estudiante comprobados en local.** Supabase local y NestJS confirmaron registro con Mailpit y TOTP, bandejas por ámbito, dictamen y perfil de estudiante. La matrícula se sincronizó y el SSO abrió **HTML Básico Desde Cero** en Moodle local. Falta repetirlo en el ambiente de entrega. [Evidencia](docs/flujo-admisiones.md#evidencia-local-del-13-de-noviembre-de-2026)
2. **Completar la demo del curso único.** Recorrer la interfaz con un profesor y dos estudiantes. Verificar participantes, evaluación, calificación y finalización. Probar el fallo y reintento de una baja. [Panel docente](apps/web/src/app/dashboard/docente/page.tsx) · [Matrículas](apps/api/src/modules/enrollments/enrollments.service.ts)
3. **Hacer explícito el espacio activo.** Actualmente el inicio de sesión elige un panel por orden de roles y la cabecera vuelve a ese mismo panel. Para una cuenta con varios roles, mostrar un selector con sus espacios autorizados. Para un rol único, entrar directo. Mostrar un estado propio si la cuenta carece de rol activo. [Contexto de sesión](apps/web/src/contexts/AuthContext.tsx) · [Cabecera](apps/web/src/components/SiteHeader.tsx)

## Registro para próximas comprobaciones

Por cada caso anotar fecha, commit, ambiente, rol de prueba, resultado esperado, resultado observado y enlace a evidencia. Omitir credenciales, JWT, códigos TOTP y enlaces de recuperación. Mantener abiertos los criterios cuyo cierre dependa de configuración o evidencia externa.
