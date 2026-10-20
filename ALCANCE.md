\# ALCANCE — Portal IINICIA



\## 1. Propósito



Desarrollar una nueva plataforma institucional para IINICIA que sustituya el portal actual en WordPress mediante una arquitectura basada en Next.js, NestJS, Supabase y Moodle.



El documento técnico del proyecto IINICIA es la fuente principal de requisitos. Si existe alguna discrepancia, se deberá identificar antes de tomar una decisión que afecte el alcance.



\## 2. Estado inicial



El repositorio ya cuenta con la estructura básica de dos aplicaciones:



\- `apps/web`: Next.js, React, TypeScript, Tailwind CSS, ESLint y App Router.

\- `apps/api`: NestJS y TypeScript.



No recrear las aplicaciones ni reemplazar su configuración existente sin una justificación técnica.



Antes de implementar funcionalidades, inspeccionar la estructura real del repositorio, los paquetes instalados, los scripts y la configuración actual.



\## 3. Distribución del trabajo



\### Backend — responsable: desarrollador backend



El backend se implementará en `apps/api` con NestJS.



Responsabilidades:



\- API REST para el portal.

\- Validación de solicitudes.

\- Autenticación y autorización en el servidor.

\- Integración con Supabase Auth y PostgreSQL.

\- Gestión de perfiles, roles y estados.

\- Gestión de programas y solicitudes de inscripción.

\- Autorización de matrículas.

\- Integración con Moodle mediante Web Services oficiales.

\- Sincronización de usuarios y matrículas.

\- Auditoría de operaciones relevantes.

\- Manejo de errores, configuración y seguridad.

\- Documentación OpenAPI y pruebas.



\### Frontend — responsable: otro integrante



El frontend se implementará en `apps/web`.



Responsabilidades:



\- Portal institucional.

\- Navegación y componentes visuales.

\- Registro, inicio de sesión y recuperación de acceso.

\- Perfiles y paneles según el rol.

\- Consumo de la API de NestJS.

\- Catálogo de programas y cursos.

\- Interfaz administrativa.

\- Diseño responsive y accesibilidad.



No modificar páginas, estilos, componentes ni configuración del frontend por iniciativa propia. Los cambios compartidos deberán acordarse con el responsable del frontend.



\### Moodle



Moodle será responsable de:



\- Contenidos y actividades académicas.

\- Cursos y categorías.

\- Roles académicos.

\- Matrículas.

\- Calificaciones y progreso.

\- Finalización de actividades y cursos.



La instalación, configuración y contenido de los dos cursos de ejemplo forman parte del proyecto global, aunque no todo corresponda al código del backend.



\## 4. Arquitectura



La arquitectura objetivo será:



Usuario → Next.js → API NestJS → Supabase y Moodle.



Reglas:



1\. El frontend consumirá la API de NestJS para las operaciones de negocio.

2\. Supabase Auth gestionará las identidades y credenciales.

3\. PostgreSQL almacenará los perfiles y relaciones administrativas.

4\. NestJS verificará permisos antes de ejecutar operaciones protegidas.

5\. Moodle se integrará exclusivamente desde el backend mediante Web Services habilitados.

6\. Las contraseñas no se almacenarán en tablas propias ni se copiarán en texto plano entre sistemas.

7\. No se accederá directamente a la base de datos de Moodle desde React.

8\. Las credenciales privilegiadas permanecerán en el servidor.



\## 5. Roles



El sistema deberá admitir los siguientes roles de aplicación:



\- `superadmin`

\- `admin`

\- `coordinator`

\- `teacher`

\- `student`

\- `applicant`

\- `support`



Los identificadores técnicos podrán ajustarse a la convención existente, pero deberán mantenerse consistentes en base de datos, API y documentación.



Un usuario podrá tener varios roles cuando esté autorizado.



El rol de aplicación no equivale automáticamente a un rol de Moodle. La correspondencia se definirá explícitamente y respetará el principio de mínimo privilegio.



Reglas mínimas:



\- Aspirante: administrar su información y consultar el estado de admisión.

\- Estudiante: consultar su perfil, programa y cursos autorizados.

\- Profesor: consultar los cursos donde tenga asignación docente.

\- Coordinador: operar dentro de los programas o ámbitos que tenga asignados.

\- Administrador: gestionar usuarios, roles, estados y autorizaciones según sus permisos.

\- Soporte: acceso operativo limitado.

\- Superadministrador: configuración global y operaciones administrativas privilegiadas.



La autorización se comprobará en el backend. Ocultar botones en el frontend no constituye una medida de seguridad suficiente.



\## 6. Modelo de datos de referencia



El modelo inicial deberá contemplar:



\- `profiles`: perfil asociado a la identidad de Supabase Auth.

\- `roles`: catálogo de roles.

\- `user\_roles`: asignaciones de roles a usuarios.

\- `programs`: programas académicos.

\- `user\_programs`: relación de usuarios con programas y su estado.

\- `course\_mappings`: correspondencia entre elementos académicos del portal y cursos de Moodle.

\- `enrollment\_requests`: solicitudes y autorizaciones de inscripción.

\- `audit\_logs`: registro de operaciones administrativas relevantes.



`auth.users` pertenece a Supabase Auth y no debe recrearse como una tabla de contraseñas.



Este modelo es una base de trabajo, no una autorización para crear todas las tablas de inmediato. Primero se inspeccionará el estado actual de Supabase y se diseñarán las relaciones, restricciones e índices necesarios.



Las migraciones SQL deberán ser reproducibles y estar versionadas en el repositorio.



\## 7. Módulos del backend



\### Módulo de salud



\- Comprobar que la API está disponible.

\- Exponer un endpoint de salud.

\- Diferenciar disponibilidad de la aplicación y estado de integraciones externas cuando corresponda.



\### Módulo de autenticación



\- Verificar tokens de acceso de Supabase.

\- Obtener la identidad del usuario autenticado.

\- Validar sesiones y estados.

\- Evitar implementar un sistema paralelo de contraseñas.



\### Módulo de perfiles y usuarios



\- Consultar y actualizar perfiles permitidos.

\- Consultar usuarios con filtros y paginación.

\- Gestionar estados administrativos.

\- Evitar duplicados al vincular identidades.



\### Módulo de roles y permisos



\- Consultar roles.

\- Asignar o retirar roles según privilegios.

\- Proteger endpoints mediante guards y políticas de autorización.

\- Validar el ámbito de acceso de coordinadores, profesores y estudiantes.



\### Módulo de programas



\- Consultar programas académicos.

\- Gestionar programas mediante permisos administrativos.

\- Asociar usuarios a programas.

\- Mantener el estado de las relaciones académicas.



\### Módulo de inscripciones



\- Crear solicitudes de inscripción.

\- Consultar el estado de las solicitudes.

\- Autorizar o rechazar solicitudes según permisos.

\- Registrar las operaciones relevantes.

\- Ejecutar la sincronización de matrículas autorizadas con Moodle.



\### Módulo de Moodle



\- Comprobar la configuración de conexión.

\- Consultar o localizar usuarios existentes.

\- Crear o vincular usuarios evitando duplicados.

\- Sincronizar información autorizada.

\- Consultar cursos asociados.

\- Matricular y desmatricular usuarios autorizados.

\- Asignar roles académicos en cursos permitidos.

\- Manejar errores, reintentos controlados y resultados de sincronización.



\### Módulo de auditoría



\- Registrar cambios relevantes de roles y estados.

\- Registrar autorizaciones e inscripciones.

\- Registrar resultados de operaciones administrativas y sincronizaciones.

\- Restringir la lectura de la auditoría a los roles autorizados.



\## 8. Contrato entre frontend y backend



La API utilizará REST y JSON bajo el prefijo `/api/v1`.



Se deberá documentar mediante OpenAPI.



Los endpoints concretos se definirán por módulo y se mantendrán en una especificación compartida para evitar que frontend y backend implementen contratos incompatibles.



Las respuestas deberán mantener una estructura coherente. Los errores incluirán un código identificable y un mensaje apropiado, sin revelar secretos, consultas internas ni detalles sensibles.



Las operaciones de listado deberán admitir paginación cuando corresponda.



El backend no debe implementar endpoints que el frontend consuma directamente desde Supabase y, simultáneamente, dupliquen innecesariamente la misma lógica de negocio.



\## 9. Seguridad



Requisitos obligatorios:



\- Validación de datos en el servidor.

\- Verificación de tokens de Supabase.

\- Guards y políticas de autorización.

\- Row Level Security (RLS) en las tablas pertinentes.

\- Variables de entorno para secretos.

\- Rate limiting en endpoints sensibles.

\- Protección de las credenciales y sesiones.

\- CORS limitado a los orígenes configurados.

\- Manejo seguro de errores.

\- Auditoría de operaciones privilegiadas.

\- Permisos mínimos en Moodle.

\- Ninguna clave `service\_role` ni token administrativo de Moodle en el navegador.

\- Ninguna confianza exclusiva en los roles declarados por el cliente.



\## 10. Entrega parcial — 29 de octubre de 2026, 07:00 h



Prioridad: demostrar un flujo funcional de extremo a extremo.



El avance deberá contemplar:



\- Estructura existente del proyecto funcional.

\- Supabase Auth configurado.

\- Perfil y roles iniciales.

\- API NestJS ejecutable.

\- Verificación de autenticación en la API.

\- Primeras migraciones y políticas RLS.

\- Conexión inicial con Moodle mediante Web Services.

\- Dos cursos de ejemplo configurados en Moodle.

\- Usuario de prueba con rol de profesor y al menos dos estudiantes.

\- Demostración de consulta de cursos y autorización de acceso.

\- Documentación inicial y evidencias.



El orden definitivo se ajustará a las dependencias reales. No se considerará terminada una integración únicamente porque existan archivos de configuración o endpoints sin probar.



\## 11. Entrega final — 1 de diciembre de 2026



El sistema deberá contemplar:



\- Portal institucional completo.

\- Migración de contenidos seleccionados de WordPress.

\- Autenticación y recuperación de acceso.

\- Roles y permisos efectivos.

\- Administración de usuarios y programas.

\- Solicitudes y autorizaciones de inscripción.

\- Sincronización con Moodle.

\- Acceso autorizado a cursos.

\- Dos cursos de ejemplo completos.

\- Auditoría.

\- Diseño responsive y accesible.

\- Pruebas automatizadas y de integración.

\- Documentación de instalación, administración y despliegue.

\- Procedimiento de respaldo y recuperación.

\- Evidencias del cumplimiento de criterios de aceptación.



\## 12. Criterios de aceptación del backend



\- La API inicia correctamente con la configuración documentada.

\- Los usuarios no autenticados no acceden a endpoints protegidos.

\- Un usuario no puede modificar su rol o privilegios mediante una solicitud manipulada.

\- Los permisos se comprueban en el servidor.

\- Las políticas RLS impiden accesos no autorizados.

\- Las migraciones se pueden aplicar de forma reproducible.

\- La integración con Moodle utiliza exclusivamente credenciales de servidor.

\- No se crean usuarios duplicados por reintentos normales de sincronización.

\- Un estudiante solo recibe acceso a sus cursos autorizados.

\- Un profesor solo recibe acceso a sus asignaciones autorizadas.

\- Los errores de Moodle no provocan asignaciones ficticias ni estados de sincronización exitosos incorrectos.

\- Las operaciones administrativas relevantes quedan auditadas.

\- La API dispone de documentación y pruebas verificables.



\## 13. Fuera de alcance, salvo acuerdo explícito



\- Reescribir Moodle.

\- Modificar el núcleo de Moodle.

\- Crear un LMS propio.

\- Duplicar en Supabase las calificaciones y actividades que Moodle administra.

\- Migrar automáticamente todo WordPress sin revisar los contenidos.

\- Implementar pagos, comercio electrónico o facturación sin requisitos adicionales.

\- Construir microservicios independientes sin una necesidad demostrada.

\- Añadir funcionalidades no solicitadas que retrasen la entrega.



\## 14. Principio de implementación



Construir primero una versión mínima, segura y verificable. Ampliar el sistema por módulos, manteniendo los contratos compartidos y sin romper las aplicaciones existentes.



Cada funcionalidad deberá tener criterios de aceptación, pruebas y documentación suficiente para integrarse con el frontend.



\## 15. Decisiones pendientes y preparación del entorno



Las siguientes decisiones deberán resolverse antes de implementar las integraciones correspondientes. OpenCode no debe inventar valores, credenciales, versiones instaladas ni funcionalidades disponibles.



\### 15.1. Supabase



Estado: proyecto pendiente de creación.



Antes de implementar el acceso a datos:



1\. Confirmar el proyecto de Supabase que se utilizará.

2\. Obtener la URL del proyecto y configurar las claves necesarias en variables de entorno.

3\. Definir el modelo de acceso desde NestJS.

4\. Documentar si cada operación utilizará el contexto autenticado del usuario o un cliente privilegiado del servidor.

5\. Explicar qué operaciones eluden RLS y cómo se protegerán.

6\. Crear migraciones SQL versionadas.

7\. Definir políticas RLS, privilegios de base de datos y pruebas de acceso.



No se necesitan credenciales reales para diseñar el modelo ni planificar las migraciones.



\### 15.2. Moodle



Estado: instalación y configuración pendientes.



Antes de implementar la integración, identificar:



\- Versión de Moodle elegida.

\- Método de instalación y ejecución.

\- URL base accesible desde NestJS.

\- Tipo y versión de la base de datos compatible.

\- Disponibilidad de Web Services.

\- Protocolo habilitado, inicialmente REST.

\- Servicio externo y funciones permitidas.

\- Usuario de integración y permisos necesarios.

\- Mecanismo de acceso del estudiante a Moodle.

\- Necesidad de SSO, pendiente de confirmar con los requisitos del proyecto.



Se permite preparar un entorno local con Docker Compose. La configuración deberá ser reproducible y utilizar volúmenes persistentes.



No inventar una URL funcional de Moodle ni asumir que un endpoint está disponible sin comprobarlo.



\### 15.3. Acceso al campus



El acceso por enlace y el inicio de sesión único son requisitos distintos.



La primera fase podrá presentar enlaces a cursos y gestionar las matrículas mediante Web Services.



Si se requiere SSO, deberá diseñarse y validarse como una integración independiente. No se implementarán mecanismos de autenticación improvisados ni se enviarán contraseñas o tokens administrativos al navegador.



\### 15.4. Estado de las inscripciones



Las solicitudes de inscripción y su sincronización con Moodle deberán distinguirse.



Estados mínimos de sincronización:



\- `pending`: pendiente de sincronizar.

\- `synced`: operación confirmada por Moodle.

\- `failed`: intento fallido.



Se conservarán la fecha del último intento, el número de intentos y un resultado seguro que permita identificar el problema sin guardar tokens, contraseñas ni respuestas sensibles.



Las solicitudes no autorizadas no podrán generar matrículas.



Los reintentos deberán evitar duplicados y no podrán marcar una operación como sincronizada sin confirmación suficiente.



\### 15.5. Contrato compartido



El contrato de la API se publicará en `docs/openapi.yaml`, generado o actualizado a partir de la implementación de NestJS cuando sea viable.



Antes de modificar endpoints, DTOs, nombres de campos o estructuras de respuesta:



1\. Revisar el contrato existente.

2\. Comunicar el cambio al responsable del frontend.

3\. Actualizar la especificación.

4\. Implementar y probar el cambio.

5\. Mantener compatibilidad o documentar las modificaciones necesarias.



El contrato compartido será la referencia común para frontend y backend.



\### 15.6. Criterio para decisiones pendientes



OpenCode deberá separar:



\- Decisiones ya confirmadas.

\- Decisiones que requieren validación.

\- Datos que faltan para implementar.

\- Tareas que pueden desarrollarse sin servicios externos.



No bloquear el desarrollo de módulos independientes por falta de credenciales. Preparar interfaces, DTOs, pruebas con mocks y documentación cuando sea posible, indicando claramente qué falta validar en un entorno real.



