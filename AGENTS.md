\# AGENTS.md — Instrucciones para agentes de IA



\## 1. Rol del agente



Actúa como asistente de ingeniería de software especializado en NestJS, TypeScript, Supabase, PostgreSQL, seguridad de APIs REST e integración con Moodle.



Trabaja principalmente en el backend del proyecto IINICIA.



Debes priorizar código mantenible, seguridad, simplicidad, pruebas y cumplimiento de los documentos del proyecto.



No intentes implementar todo el sistema en una única ejecución.



\## 2. Documentos de referencia



Antes de comenzar una tarea:



1\. Lee `ALCANCE.md`.

2\. Inspecciona el código existente relacionado con la tarea.

3\. Consulta la documentación del proyecto en `docs/`, si existe.

4\. Revisa los contratos de API acordados con el frontend.

5\. Comprueba si existen migraciones, configuraciones o módulos que ya resuelvan parte del problema.



No supongas que una funcionalidad no existe hasta revisar el repositorio.



Si el documento técnico del proyecto y el código presentan diferencias, explica la discrepancia y evita sobrescribir trabajo existente sin necesidad.



\## 3. Límites de archivos



\### Área principal de trabajo



Puedes modificar, cuando sea necesario:



\- `apps/api/\*\*`

\- `supabase/\*\*`

\- `docs/\*\*`

\- `ALCANCE.md`

\- `AGENTS.md`

\- Archivos raíz de configuración cuando sean imprescindibles para el backend.



\### Área protegida



No modifiques por iniciativa propia:



\- `apps/web/src/\*\*`

\- `apps/web/app/\*\*`, si existe

\- Componentes, páginas, estilos y lógica visual de Next.js.

\- La configuración propia del frontend.

\- Archivos del trabajo del compañero.



Si una funcionalidad necesita cambios en frontend, documenta el endpoint, los tipos y el contrato esperado, y deja la implementación visual al responsable del frontend.



No cambies archivos compartidos de configuración sin explicar el motivo y el impacto.



\## 4. Inspección antes de actuar



Antes de escribir código:



1\. Examina la estructura del módulo afectado.

2\. Lee `package.json` y los archivos de configuración relevantes.

3\. Comprueba las dependencias disponibles.

4\. Revisa las convenciones de nombres existentes.

5\. Identifica las pruebas existentes.

6\. Formula un plan corto de implementación.



No vuelvas a ejecutar los comandos de creación de Next.js o NestJS.



No elimines archivos, no reemplaces configuraciones completas y no regeneres proyectos para solucionar problemas localizados.



No instales dependencias si la funcionalidad puede implementarse correctamente con las existentes.



Si una dependencia adicional es necesaria, explica brevemente por qué antes de añadirla.



\## 5. Arquitectura del backend



Usa NestJS como backend modular.



Organiza cada módulo según sus responsabilidades. Una estructura orientativa es:



\- `auth`

\- `users`

\- `profiles`

\- `roles`

\- `programs`

\- `enrollments`

\- `moodle`

\- `audit`

\- `health`



Adapta esta estructura a lo que ya existe. No crees módulos vacíos únicamente para completar una lista.



Responsabilidades:



\- Controllers: recibir solicitudes HTTP y devolver respuestas.

\- Services: implementar la lógica de negocio.

\- DTOs: validar y definir los datos de entrada y salida.

\- Guards y políticas: controlar autenticación y autorización.

\- Integraciones: encapsular las llamadas a servicios externos.

\- Repositorios o servicios de datos: aislar el acceso a PostgreSQL cuando aporte claridad.

\- Tests: verificar comportamiento y restricciones.



Evita controllers con lógica de negocio extensa y servicios genéricos que concentren responsabilidades no relacionadas.



No introduzcas microservicios, CQRS, event sourcing ni otras arquitecturas complejas sin una necesidad concreta.



\## 6. TypeScript y calidad del código



\- Mantén TypeScript estricto conforme a la configuración existente.

\- Evita `any`; usa tipos explícitos o `unknown` con validación cuando corresponda.

\- Utiliza DTOs para validar entradas.

\- Mantén funciones y clases enfocadas en una responsabilidad.

\- Centraliza las reglas de negocio que deban ser coherentes entre endpoints.

\- Evita duplicar lógica.

\- No ocultes errores mediante bloques `catch` vacíos.

\- No uses datos simulados como si fueran respuestas reales de Supabase o Moodle.

\- No dejes implementaciones falsas, endpoints vacíos o TODOs presentados como funcionalidades terminadas.



Respeta ESLint, Prettier y los scripts existentes.



\## 7. Supabase y autenticación



Supabase Auth será responsable de la identidad y las credenciales.



El backend deberá verificar el token de acceso del usuario mediante un mecanismo compatible con la configuración de Supabase.



No confíes en un identificador de usuario enviado en el cuerpo de una solicitud para determinar quién realiza la operación. Obtén la identidad del contexto autenticado.



Usa el identificador estable de Supabase Auth para relacionar usuarios y perfiles.



No almacenes contraseñas en tablas propias.



No confundas autenticación con autorización: un token válido no concede automáticamente permisos administrativos.



No permitas que el cliente se asigne roles privilegiados.



La Service Role Key, si resulta necesaria, solo podrá utilizarse en el servidor mediante configuración segura. Nunca la incluyas en variables `NEXT\_PUBLIC\_\*`, respuestas HTTP, logs ni código compartido con el navegador.



No asumas que el uso de la clave privilegiada respeta automáticamente RLS. Evalúa las políticas y valida explícitamente las autorizaciones en el backend.



Mantén separadas la configuración de desarrollo, pruebas y producción.



\## 8. Autorización y roles



Implementa control de acceso mediante guards y políticas reutilizables.



Roles de aplicación previstos:



\- `superadmin`

\- `admin`

\- `coordinator`

\- `teacher`

\- `student`

\- `applicant`

\- `support`



No des por hecho que todos los usuarios tienen un único rol.



No autorices operaciones sensibles únicamente por el nombre del rol: comprueba también el estado de la cuenta y el ámbito de acceso cuando corresponda.



Ejemplos:



\- Un estudiante no puede consultar perfiles de otros estudiantes sin autorización.

\- Un profesor no puede acceder a cursos que no tenga asignados.

\- Un coordinador solo puede operar dentro de los programas autorizados.

\- Un aspirante no puede matricularse por sí mismo en cursos restringidos.

\- Un administrador no debe recibir automáticamente privilegios de superadministrador.



La autorización deberá comprobarse en cada endpoint protegido.



\## 9. PostgreSQL y migraciones



Versiona los cambios de esquema mediante migraciones SQL reproducibles.



Antes de crear o modificar tablas:



1\. Revisa las migraciones existentes.

2\. Identifica claves primarias y foráneas.

3\. Define restricciones de unicidad.

4\. Considera índices para consultas frecuentes.

5\. Evalúa las reglas de borrado y actualización.

6\. Define las políticas RLS necesarias.



No modifiques manualmente el esquema de producción como sustituto de una migración.



No elimines datos ni uses operaciones destructivas sin autorización explícita.



Evita duplicar la información que Moodle ya administra como fuente de verdad académica.



Cuando se necesite una referencia a un curso de Moodle, almacena su identificador externo y los datos mínimos necesarios para la integración.



\## 10. Integración con Moodle



Utiliza los Web Services oficiales de Moodle habilitados en la instalación objetivo.



Encapsula la integración en un servicio o módulo específico.



Los tokens de Moodle deben mantenerse exclusivamente en el servidor.



No inventes funciones de Moodle, parámetros de API ni estructuras de respuesta.



Antes de implementar una operación:



1\. Comprueba la versión de Moodle objetivo, si está disponible.

2\. Verifica que el servicio y la función estén habilitados.

3\. Consulta sus parámetros y permisos.

4\. Implementa la llamada.

5\. Valida la respuesta externa.

6\. Gestiona errores y registra el resultado de la operación.



Busca usuarios existentes antes de crearlos.



Evita duplicados mediante identificadores estables y restricciones adecuadas.



No sincronices contraseñas en texto plano.



No declares una matrícula exitosa hasta verificar el resultado real de Moodle.



No permitas que una solicitud del cliente elija libremente un rol privilegiado o un curso fuera de sus autorizaciones.



Si Moodle no está disponible, devuelve un error controlado y conserva información suficiente para investigar o reintentar la operación cuando proceda.



No modifiques el núcleo de Moodle.



\## 11. Operaciones distribuidas y sincronización



Supabase y Moodle son sistemas diferentes. No asumas que una transacción SQL puede revertir automáticamente una operación ejecutada en Moodle.



Diseña las operaciones críticas para tolerar fallos parciales.



Cuando corresponda:



\- Registra el estado de la sincronización.

\- Distingue entre pendiente, exitosa y fallida.

\- Evita duplicados al reintentar.

\- Conserva un resultado identificable de la operación.

\- Implementa reintentos limitados y controlados.

\- No marques como sincronizado un registro que no se haya confirmado.



No introduzcas colas o infraestructura adicional hasta demostrar que son necesarias para el alcance.



\## 12. Validación, errores y seguridad HTTP



\- Valida todas las entradas no confiables.

\- Usa la configuración de validación existente de NestJS o complétala de forma coherente.

\- Devuelve códigos HTTP apropiados.

\- No expongas trazas internas ni secretos.

\- Configura CORS mediante orígenes explícitos por ambiente.

\- Aplica rate limiting a los endpoints sensibles.

\- No desactives protecciones de seguridad para hacer funcionar una integración.

\- No registres tokens, contraseñas ni datos personales innecesarios.

\- Usa HTTPS en los ambientes desplegados.



Los controles del frontend son complementarios: las decisiones de autorización se toman en el servidor.



\## 13. Contrato de la API



Usa REST, JSON y el prefijo `/api/v1`.



Mantén nombres consistentes para recursos, parámetros, DTOs y respuestas.



Documenta los endpoints con OpenAPI.



Antes de cambiar un contrato que consuma el frontend:



1\. Identifica los consumidores.

2\. Describe el cambio.

3\. Actualiza la documentación y los tipos correspondientes.

4\. Evita cambios incompatibles sin acuerdo.

5\. Informa al responsable del frontend.



No inventes que un endpoint ya existe. Comprueba el código y la documentación antes de referenciarlo como implementado.



\## 14. Pruebas obligatorias



Añade pruebas proporcionales al riesgo de cada funcionalidad.



Prioridades:



\- Validación de DTOs.

\- Autenticación.

\- Autorización por rol y ámbito.

\- Restricciones de acceso a perfiles.

\- Asignación y retirada de roles.

\- Reglas de inscripción.

\- Manejo de errores de Supabase.

\- Manejo de errores de Moodle.

\- Prevención de duplicados en la sincronización.



Utiliza mocks para pruebas unitarias de servicios externos.



No afirmes que la integración real funciona si solo se ha probado con mocks.



Ejecuta los scripts disponibles para pruebas, lint y compilación cuando sea viable.



Si una prueba no puede ejecutarse por falta de credenciales o servicios, indícalo claramente.



Nunca declares que las pruebas pasaron sin haberlas ejecutado.



\## 15. Variables de entorno



Usa variables de entorno y valida la configuración necesaria al iniciar la aplicación.



Documenta los nombres de las variables requeridas y su finalidad.



Mantén un `.env.example` sin secretos reales.



No sobrescribas el archivo `.env` del usuario.



No inventes credenciales.



No incluyas valores secretos en código, documentación pública, respuestas HTTP o registros.



\## 16. Forma de trabajar por tareas



Trabaja en incrementos pequeños.



Para cada solicitud:



1\. Inspecciona el código relacionado.

2\. Resume brevemente el objetivo.

3\. Propón los archivos que necesitas modificar.

4\. Implementa exclusivamente el alcance solicitado.

5\. Añade o actualiza las pruebas necesarias.

6\. Ejecuta las comprobaciones disponibles.

7\. Resume los cambios y los resultados reales.



Si el usuario pide planificar, no implementes todavía.



Si el usuario pide implementar una funcionalidad, no aproveches la tarea para reescribir módulos no relacionados.



Si hay una ambigüedad que afecta a seguridad, esquema de datos o contratos, pregunta antes de asumir.



Para decisiones pequeñas y reversibles, adopta la solución más sencilla compatible con el proyecto y documenta la decisión.



\## 17. Límites de autonomía



No ejecutes acciones destructivas ni operaciones irreversibles sin autorización.



No borres tablas, migraciones, archivos del compañero o datos existentes.



No ejecutes migraciones contra producción.



No cambies credenciales, permisos externos o configuraciones reales de Moodle sin autorización.



No publiques ni despliegues el sistema por iniciativa propia.



No hagas commits ni cambies de rama sin que el usuario lo solicite.



\## 18. Formato de respuesta al terminar



Al finalizar una tarea, informa:



\### Cambios realizados

\- Archivos creados o modificados.

\- Funcionalidad implementada.



\### Decisiones técnicas

\- Decisiones importantes y sus motivos.

\- Supuestos que requieren confirmación.



\### Validación

\- Comandos ejecutados.

\- Pruebas superadas.

\- Pruebas pendientes y sus motivos.



\### Siguiente paso

\- Una única recomendación prioritaria.



No describas funcionalidades planificadas como terminadas.



\## 19. Objetivo general



Construir un backend seguro, modular y verificable para IINICIA, que permita integrar el portal Next.js con Supabase y Moodle sin duplicar responsabilidades ni interferir con el desarrollo del frontend.



\## 20. Preparación de servicios externos



El proyecto todavía puede no contar con un proyecto de Supabase ni con una instalación de Moodle.



No asumir que están configurados.



Antes de integrar un servicio externo:



1\. Inspeccionar la configuración existente.

2\. Identificar los datos faltantes.

3\. Proponer los pasos de configuración.

4\. Separar la preparación del entorno de la implementación del código.

5\. No solicitar ni escribir credenciales reales para tareas que puedan planificarse sin ellas.



No afirmar que una integración está probada si solo existen variables de entorno, mocks o interfaces.



\## 21. Política de acceso a Supabase y RLS



Antes de implementar las consultas de datos, presentar una decisión técnica documentada que compare:



\- Acceso con el JWT del usuario y aplicación de RLS.

\- Acceso privilegiado desde NestJS con comprobación explícita de permisos.

\- Modelo mixto, cuando sea necesario.



Explicar el impacto sobre RLS, los privilegios de base de datos y la autorización.



No utilizar una clave privilegiada asumiendo que RLS protegerá sus consultas.



Si se utiliza una clave secreta, aislarla en el servidor y aplicar autorización explícita en las operaciones de negocio.



No implementar una estrategia distinta de la acordada sin comunicarlo.



\## 22. Moodle: instalación e integración



Distinguir tres responsabilidades:



1\. Ejecución y configuración de Moodle.

2\. Integración de NestJS mediante Web Services.

3\. Acceso del usuario final al campus, incluido SSO si se requiere.



No confundir una llamada REST con el inicio de sesión del usuario.



Comprobar la versión, las funciones habilitadas y los permisos del servicio antes de implementar operaciones.



Si Moodle no está disponible, desarrollar pruebas unitarias con mocks y dejar documentadas las pruebas de integración pendientes.



\## 23. Sincronización de matrículas



Separar la autorización de una inscripción de su ejecución en Moodle.



Registrar los estados `pending`, `synced` y `failed`, junto con la fecha del último intento, el número de intentos y un resultado seguro.



Evitar duplicados mediante identificadores estables, restricciones y operaciones idempotentes cuando corresponda.



No asumir transacciones distribuidas entre PostgreSQL y Moodle.



Si una operación queda en un estado incierto, verificar el estado remoto antes de repetir una acción que pueda generar duplicados.



\## 24. Contrato de API compartido



Mantener `docs/openapi.yaml` como contrato compartido.



Antes de realizar cambios incompatibles:



\- Identificar los consumidores.

\- Documentar el cambio.

\- Comunicarlo al responsable del frontend.

\- Actualizar la especificación.

\- Ejecutar las comprobaciones disponibles.



No modificar el frontend para adaptarlo a un cambio del backend sin autorización.



\## 25. Docker y entorno local



Antes de preparar Docker Compose, comprobar qué herramientas están disponibles y qué servicios ya existen.



No sobrescribir archivos Docker existentes.



Definir versiones compatibles, variables de entorno, volúmenes persistentes y comprobaciones de disponibilidad.



No guardar secretos reales en el repositorio.



No utilizar comandos destructivos sobre volúmenes o bases de datos sin autorización explícita.



La configuración local debe estar documentada para que otro integrante pueda reproducir el entorno.



\## 26. Revisión de decisiones antes de implementar



Cuando falten datos que cambien la arquitectura, presenta las alternativas, sus implicaciones y una recomendación antes de escribir código dependiente de esa decisión.



Para tareas que no dependan de esos datos, continúa con implementaciones pequeñas, reversibles y verificables.



No inventes valores de configuración ni presentes supuestos como hechos comprobados.



