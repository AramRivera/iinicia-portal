# PROYECTO DE REDISEÑO Y MIGRACIÓN DEL PORTAL IINICIA

**React + Moodle**

**Arquitectura propuesta:** Next.js · NestJS · Supabase · Moodle

| Campo | Información |
|---|---|
| Tipo de documento | Alcance técnico y funcional |
| Versión | 1.0 · octubre de 2026 |
| Propósito | Guía de desarrollo, integración, pruebas y entrega |

> **Nota fundamental:** El portal actual en WordPress se utilizará únicamente como referencia de contenido. La solución final deberá operar sin WordPress.

## 1. Resumen ejecutivo

El proyecto tiene como finalidad sustituir el portal actual de IINICIA, construido en WordPress, por una plataforma institucional moderna basada en React, utilizando Next.js como framework principal. Moodle funcionará como sistema de gestión del aprendizaje (LMS), mientras que Supabase proporcionará la base de datos y los servicios de identidad necesarios para el registro, autenticación y control de usuarios del portal.

La solución deberá integrar en una sola experiencia el portal institucional, el registro de aspirantes y usuarios, la gestión de perfiles y roles, la asignación académica y el acceso a Moodle. El backend actuará como capa de integración y seguridad entre React, Supabase y Moodle. El frontend nunca deberá conectarse directamente a la base de datos de Moodle ni exponer credenciales administrativas.

> **Principio rector:** IINICIA deberá ofrecer una sola experiencia digital: el usuario se registra en el portal, recibe el rol correspondiente, puede ser asociado a programas o cursos y accede a Moodle únicamente a los espacios académicos que tenga autorizados.

## 2. Objetivo general

Diseñar, desarrollar e implementar la nueva plataforma digital de IINICIA mediante React/Next.js, integrada con Moodle como LMS y con una base de datos en Supabase para el registro, autenticación, clasificación y control de usuarios, garantizando una arquitectura segura, escalable, mantenible y basada en roles.

### 2.1 Objetivos específicos

- Sustituir completamente WordPress como plataforma del portal institucional.
- Construir el frontend institucional mediante React/Next.js y TypeScript.
- Implementar una API/backend para centralizar la lógica de negocio y la integración con Moodle.
- Utilizar Supabase para identidad, perfiles, roles, estados, programas y trazabilidad de usuarios.
- Implementar control de acceso basado en roles para administradores, profesores, estudiantes, aspirantes y otros perfiles autorizados.
- Instalar, configurar y personalizar Moodle con identidad visual coherente con el portal.
- Cargar en Moodle dos cursos de ejemplo completamente funcionales para validar perfiles, matrículas, actividades y permisos.
- Permitir que los usuarios autorizados accedan desde el portal a sus cursos en Moodle.
- Migrar únicamente los contenidos vigentes y necesarios del sitio actual, preservando las URLs relevantes mediante redirecciones cuando corresponda.
- Documentar arquitectura, instalación, administración, pruebas y operación del sistema.

## 3. Alcance funcional

| Componente | Responsabilidad principal |
|---|---|
| Portal React/Next.js | Sitio institucional, oferta académica, admisiones, registro, login, perfil, paneles por rol y acceso al campus. |
| Backend / API | Lógica de negocio, validaciones, permisos, sincronización de usuarios, comunicación segura con Supabase y Moodle. |
| Supabase | Autenticación del portal, perfiles, roles, estados, programas, relaciones de usuarios, auditoría y datos administrativos. |
| Moodle | Cursos, contenidos, actividades, matrículas, profesores, estudiantes, calificaciones, progreso y finalización. |
| Tema Moodle | Identidad visual consistente con IINICIA y experiencia de usuario mejorada. |

## 4. Arquitectura objetivo

```text
                       USUARIO
                          ↓
             PORTAL IINICIA · React / Next.js
                          ↓
                  BACKEND / API · NestJS
                    ↙             ↘
               SUPABASE          MOODLE
            Auth + PostgreSQL  LMS + Web Services
```

La capa de frontend consumirá exclusivamente la API del proyecto y los servicios públicos necesarios de Supabase bajo políticas de seguridad controladas. Las operaciones privilegiadas, la sincronización con Moodle y el uso de claves de servicio deberán ejecutarse únicamente desde el backend.

> **Regla de integración:** No se permitirá que React acceda directamente a la base de datos de Moodle. Tampoco deberán colocarse tokens administrativos, claves de servicio de Supabase ni credenciales de Moodle en el código del navegador.

### 4.1 Stack tecnológico propuesto

| Capa | Tecnología propuesta |
|---|---|
| Frontend | React + Next.js + TypeScript |
| Interfaz | Tailwind CSS o sistema de componentes equivalente |
| Backend | Node.js + NestJS |
| Base de datos / identidad | Supabase (PostgreSQL + Auth + RLS) |
| LMS | Moodle |
| Integración Moodle | REST / Web Services oficiales |
| Control de versiones | Git |
| Contenedores | Docker, cuando sea viable |
| Proxy / servidor | Nginx o infraestructura equivalente |
| Diseño | Figma o herramienta equivalente |

## 5. Supabase: registro, identidad y control de usuarios

Supabase será el repositorio de identidad y control administrativo del portal. Se utilizará Supabase Auth para registro, inicio de sesión, recuperación de acceso y verificación de correo, evitando almacenar contraseñas en tablas personalizadas. PostgreSQL, mediante Supabase, almacenará los perfiles y las relaciones necesarias para distinguir alumnos, profesores, administradores y otros roles.

### 5.1 Modelo de datos mínimo

| Tabla / recurso | Propósito |
|---|---|
| `auth.users` | Identidad gestionada por Supabase Auth. No se manipularán contraseñas desde tablas propias. |
| `profiles` | Datos de perfil: nombre, apellidos, teléfono, estado, fecha de alta, `moodle_user_id` y datos complementarios. |
| `roles` | Catálogo de roles de la plataforma. |
| `user_roles` | Relación usuario-rol. Permite más de un rol cuando sea necesario. |
| `programs` | Programas, diplomados, certificaciones o trayectorias académicas. |
| `user_programs` | Relación de usuarios con programas y estatus académico/administrativo. |
| `course_mappings` | Relación entre elementos del portal y `course_id` de Moodle cuando sea necesario. |
| `enrollment_requests` | Solicitudes o autorizaciones de inscripción originadas desde el portal. |
| `audit_logs` | Registro de acciones administrativas y eventos relevantes. |

### 5.2 Seguridad en Supabase

- Habilitar Row Level Security (RLS) en las tablas que contengan información de usuarios.
- Definir políticas diferentes para lectura, edición y administración según rol.
- Mantener la Service Role Key exclusivamente en el backend y en variables de entorno seguras.
- No confiar únicamente en controles visuales del frontend; toda autorización sensible deberá validarse del lado servidor.
- Registrar en `audit_logs` altas, cambios de rol, cambios de estado, asociaciones a programas y operaciones administrativas relevantes.

## 6. Roles y permisos

La plataforma deberá implementar control de acceso basado en roles (RBAC). Los permisos del portal y los roles de Moodle deberán mantenerse relacionados, pero no necesariamente serán idénticos. La asignación final deberá respetar el principio de mínimo privilegio.

| Rol | Funciones principales en el portal | Relación con Moodle |
|---|---|---|
| Superadministrador | Configuración global, usuarios, roles, integraciones, parámetros y auditoría. | Administración técnica controlada; no se utilizará como cuenta de integración diaria. |
| Administrador | Gestión de usuarios, estados, programas, autorizaciones e inscripciones. | Puede gestionar matrículas o acciones académicas autorizadas. |
| Coordinador | Consulta y gestión de usuarios/programas bajo su ámbito. | Supervisión de cursos o categorías asignadas. |
| Profesor | Perfil docente, consulta de cursos asignados y acceso al campus. | Rol Teacher en cursos autorizados. |
| Estudiante | Perfil, programa, cursos asignados y acceso al campus. | Rol Student en cursos autorizados. |
| Aspirante | Registro, actualización de datos y seguimiento de admisión. | Sin acceso a cursos hasta ser autorizado. |
| Soporte | Atención operativa limitada y consulta controlada. | Sin privilegios académicos salvo autorización expresa. |

> **Requisito obligatorio:** Un usuario no deberá visualizar opciones, usuarios, programas o cursos que estén fuera de su rol y ámbito de autorización. Las restricciones deberán validarse en frontend, backend, Supabase RLS y Moodle, según corresponda.

## 7. Flujos funcionales principales

### 7.1 Registro y alta de usuario

1. El usuario accede a `/registro` y captura sus datos.
2. Supabase Auth genera la identidad y procesa la verificación de correo.
3. Se crea el perfil correspondiente en la tabla `profiles`.
4. El sistema asigna un rol inicial, por ejemplo Aspirante, según la regla definida.
5. El administrador puede cambiar estado, rol, programa o autorización.
6. Cuando corresponda, el backend crea o vincula el usuario en Moodle y almacena `moodle_user_id`.
7. El usuario únicamente recibe acceso a los cursos para los que tenga matrícula válida.

### 7.2 Profesor

1. El administrador da de alta o autoriza al profesor.
2. Se asigna el rol Profesor en Supabase.
3. El backend verifica o crea el usuario equivalente en Moodle.
4. Se asigna al profesor únicamente a los cursos correspondientes.
5. Al ingresar al portal, el profesor visualiza su perfil y los accesos académicos autorizados.

### 7.3 Estudiante

1. El estudiante completa el registro y es validado.
2. Se le asigna el rol Estudiante y, cuando proceda, un programa académico.
3. El backend sincroniza su identidad con Moodle.
4. La matrícula se genera únicamente en los cursos autorizados.
5. Desde Mi IINICIA el estudiante visualiza y accede a sus cursos.

## 8. Moodle como LMS

Moodle será la fuente de verdad para el entorno académico. La plataforma deberá instalarse, configurarse y personalizarse de manera que los cursos, actividades, calificaciones, profesores y estudiantes sean administrados dentro del LMS, mientras que el portal React se encargará del acceso institucional y de la gestión administrativa integrada.

### 8.1 Dos cursos de ejemplo obligatorios

Para validar el funcionamiento de la integración, Moodle deberá contener al menos dos cursos de ejemplo completamente configurados. No basta con crear el nombre del curso: cada uno deberá permitir comprobar roles, matrículas, contenidos y actividades.

| Curso de ejemplo | Contenido mínimo requerido |
|---|---|
| Curso 1. Introducción a las Tecnologías de la Información | Profesor de prueba; al menos dos estudiantes; presentación del curso; recurso PDF o página; foro; tarea; cuestionario; calificación; finalización de actividad. |
| Curso 2. Desarrollo Web con React | Profesor de prueba; al menos dos estudiantes; unidades o temas; recurso; actividad práctica; foro; cuestionario o evaluación; calificación; finalización de curso. |

Los cursos deberán estar cargados en Moodle y ser visibles exclusivamente para los usuarios matriculados o con privilegios autorizados. El proyecto deberá demostrar al menos un profesor y un estudiante accediendo con permisos diferentes a cada curso.

### 8.2 Integración con Moodle

- Buscar usuarios existentes antes de crear nuevos registros para evitar duplicados.
- Crear, actualizar o suspender usuarios mediante Web Services cuando corresponda.
- Matricular y desmatricular usuarios de acuerdo con las autorizaciones del portal.
- Asignar rol de profesor o estudiante únicamente en los cursos autorizados.
- Consultar los cursos asociados al usuario para mostrarlos en su panel.
- Mantener los tokens de Moodle únicamente en el backend y con permisos mínimos.

## 9. Portal React / Next.js

El nuevo portal no será una copia visual del WordPress actual. Se deberá diseñar una interfaz institucional contemporánea, responsive y coherente con Moodle. El contenido vigente del sitio actual podrá reutilizarse después de una revisión editorial y técnica.

### 9.1 Secciones mínimas

- Inicio.
- Universidad: quiénes somos, misión, visión, modelo educativo y autoridades/docentes.
- Oferta académica: licenciaturas, diplomados, certificaciones y cursos.
- Detalle de programa académico.
- Admisiones.
- Noticias o contenidos institucionales, si se requieren.
- Contacto.
- Registro.
- Inicio de sesión.
- Recuperación de acceso.
- Mi IINICIA / panel personalizado.
- Perfil del usuario.
- Acceso al Campus Moodle.

### 9.2 Panel Mi IINICIA

El panel deberá adaptarse al rol autenticado. Un estudiante verá sus datos, programa y cursos autorizados; un profesor verá sus cursos asignados; un administrador verá herramientas de gestión. La interfaz no deberá mostrar controles inhabilitados como sustituto de permisos: los datos no autorizados no deben enviarse al cliente.

## 10. Panel administrativo

- Consultar, buscar y filtrar usuarios.
- Visualizar tipo de usuario, estado, programa, fecha de alta y vínculo con Moodle.
- Asignar o retirar roles según privilegios del administrador.
- Autorizar o suspender usuarios.
- Asignar estudiantes a programas.
- Autorizar inscripciones y ejecutar la sincronización con Moodle.
- Consultar el estado de sincronización con Moodle.
- Visualizar bitácora de operaciones relevantes.
- No permitir la edición directa de calificaciones de Moodle desde el portal, salvo que exista un requerimiento específico y controlado.

## 11. Autenticación y acceso al Campus

La experiencia deberá minimizar la duplicidad de credenciales. Supabase Auth será responsable de la identidad del portal. Para el acceso a Moodle se deberá implementar un mecanismo seguro de integración o Single Sign-On compatible con la arquitectura seleccionada, de manera que el usuario autorizado pueda ingresar al campus sin manejar credenciales administrativas ni exponer tokens de servicio en el navegador.

> **Condición de seguridad:** No se deberán sincronizar ni copiar contraseñas en texto plano entre Supabase y Moodle. La identidad y el acceso deberán resolverse mediante mecanismos de autenticación soportados, sesiones seguras y comunicación servidor a servidor.

## 12. Migración desde WordPress

- Realizar inventario de páginas, imágenes, archivos, formularios, usuarios públicos, URLs y metadatos SEO.
- Clasificar el contenido como MIGRAR, ACTUALIZAR, REESCRIBIR o ELIMINAR.
- No migrar plugins, shortcodes, constructores visuales ni código heredado de WordPress.
- Mantener las URLs relevantes cuando sea viable y configurar redirecciones 301 cuando cambien.
- Respaldar WordPress y su base de datos antes del corte final.
- Retirar WordPress de producción únicamente después de validar el nuevo portal, redirecciones y datos migrados.

## 13. UX, accesibilidad y rendimiento

- Diseño responsive para teléfono, tableta y escritorio.
- Sistema visual unificado entre portal y Moodle.
- Objetivo de accesibilidad WCAG 2.2 AA.
- HTML semántico, navegación por teclado, contraste adecuado y etiquetas en formularios.
- Optimización de imágenes, carga diferida, fuentes y recursos.
- Evitar dependencias innecesarias y componentes excesivamente pesados.

## 14. Seguridad mínima

- HTTPS obligatorio.
- Validación de datos en cliente y servidor.
- Protección contra XSS, CSRF, inyección y fuerza bruta según la capa correspondiente.
- Rate limiting en endpoints sensibles.
- CAPTCHA o mecanismo equivalente en registro y recuperación cuando sea necesario.
- Variables de entorno para secretos.
- RLS en Supabase.
- Principio de mínimo privilegio.
- 2FA para administradores cuando la infraestructura lo permita.
- Logs y auditoría.
- Respaldos y procedimiento de recuperación.
- No exponer Service Role Key de Supabase ni tokens Moodle en el navegador.

## 15. Desarrollo, ambientes y repositorios

| Elemento | Requisito |
|---|---|
| Ambientes | DEV, STAGING y PRODUCTION. No desarrollar directamente sobre producción. |
| Git | Repositorio con ramas main/develop y ramas feature o estrategia equivalente. |
| Revisión | Pull requests y revisión antes de integrar cambios relevantes. |
| Configuración | Variables de entorno separadas por ambiente. |
| Despliegue | Proceso documentado y reproducible. |
| Moodle | No modificar Moodle Core. Personalizaciones mediante tema, plugins o extensiones soportadas. |

## 16. Prueba de concepto obligatoria

Antes de considerar estable la arquitectura, el equipo deberá demostrar el siguiente flujo de extremo a extremo:

1. Un usuario se registra en el portal React.
2. Supabase Auth crea la identidad y `profiles` registra la información complementaria.
3. Un administrador asigna el rol Estudiante.
4. El backend verifica o crea el usuario correspondiente en Moodle.
5. El estudiante se matricula en uno de los dos cursos de ejemplo.
6. El usuario inicia sesión en el portal.
7. Mi IINICIA muestra únicamente los cursos autorizados.
8. El usuario accede al campus Moodle con los permisos correctos.
9. Un profesor inicia sesión y visualiza funciones diferentes a las del estudiante.
10. Un administrador consulta usuarios, roles y estado de integración sin utilizar credenciales de Moodle desde el navegador.

## 17. Entregas del proyecto

| Entrega | Fecha | Contenido mínimo |
|---|---|---|
| Entrega parcial | 29 de octubre de 2026 · 07:00 h | Arquitectura implementada; repositorio; React/Next.js funcional; Supabase configurado con Auth, perfiles y roles; Moodle instalado; dos cursos de ejemplo cargados; usuarios profesor/estudiante; integración inicial y evidencia del flujo básico. |
| Entrega final | 1 de diciembre de 2026 | Portal completo; migración; Supabase y RBAC terminados; integración Moodle completa; acceso por roles; matrículas; paneles; seguridad; pruebas; documentación; despliegue y evidencia de los criterios de aceptación. |

## 18. Entregables finales

- Código fuente completo del frontend y backend.
- Repositorio Git con historial de desarrollo.
- Proyecto Supabase configurado y scripts/migraciones necesarios para reproducir tablas, políticas y relaciones.
- Moodle configurado con los dos cursos de ejemplo y usuarios/roles de prueba.
- Documentación de arquitectura y diagrama de componentes.
- Manual de instalación y despliegue.
- Manual de administración.
- Manual de profesor y manual de estudiante.
- Inventario y evidencia de migración desde WordPress.
- Plan de respaldo y recuperación.
- Reporte de pruebas y evidencias del sistema funcionando.
- Video demostrativo o presentación de funcionamiento integral.

## 19. Criterios de aceptación

| ID | Criterio |
|---|---|
| CA-01 | WordPress no forma parte de la arquitectura final de producción. |
| CA-02 | El portal institucional opera con React/Next.js. |
| CA-03 | Supabase Auth permite registro, login, recuperación y verificación según configuración. |
| CA-04 | Supabase almacena perfiles, roles y relaciones administrativas sin guardar contraseñas en tablas propias. |
| CA-05 | Existen roles diferenciados y permisos efectivos para administrador, profesor y estudiante, además de los perfiles adicionales definidos. |
| CA-06 | RLS y el backend impiden el acceso no autorizado a datos. |
| CA-07 | Moodle se encuentra instalado, configurado y personalizado. |
| CA-08 | Moodle contiene dos cursos de ejemplo completos y utilizables. |
| CA-09 | Existe al menos un profesor y dos estudiantes de prueba correctamente matriculados para validar los cursos. |
| CA-10 | El backend puede crear o vincular usuarios de Moodle sin duplicados. |
| CA-11 | El portal puede mostrar los cursos autorizados del usuario. |
| CA-12 | El estudiante únicamente accede a cursos en los que está matriculado. |
| CA-13 | El profesor únicamente accede a los cursos donde tiene rol docente. |
| CA-14 | Las credenciales privilegiadas de Supabase y Moodle no se exponen en el frontend. |
| CA-15 | React no escribe directamente en la base de datos de Moodle. |
| CA-16 | La plataforma funciona correctamente en resoluciones móviles y de escritorio. |
| CA-17 | El portal y Moodle comparten una identidad visual consistente. |
| CA-18 | Existe documentación suficiente para instalar, administrar y mantener la solución. |
| CA-19 | Los cambios relevantes de usuarios y roles quedan auditados. |
| CA-20 | El sistema puede desplegarse en producción a partir de un procedimiento documentado. |

## 20. Distribución sugerida del trabajo del equipo

| Frente | Responsabilidades |
|---|---|
| Frontend | Next.js, componentes, navegación, responsive, accesibilidad, paneles y experiencia de usuario. |
| Backend | NestJS, lógica de negocio, seguridad, validaciones, sincronización Supabase-Moodle y auditoría. |
| Datos / Supabase | Modelo de datos, Auth, RLS, migraciones, políticas, roles y pruebas de acceso. |
| Moodle | Instalación, configuración, tema, roles, categorías, cursos de ejemplo, matrículas y Web Services. |
| UX/UI | Sistema visual, prototipos, coherencia portal-Moodle y revisión de accesibilidad. |
| DevOps / QA | Ambientes, despliegue, variables, backups, pruebas, monitoreo y evidencias. |

## 21. Resultado esperado

El resultado final deberá ser una Plataforma Digital Universitaria IINICIA integrada y funcional, no únicamente un rediseño visual. La solución deberá separar claramente las responsabilidades de cada componente y ofrecer una experiencia coherente para aspirantes, estudiantes, profesores y administradores.

```text
PORTAL INSTITUCIONAL · REACT / NEXT.JS
                  +
IDENTIDAD, ROLES Y CONTROL · SUPABASE
                  +
      API E INTEGRACIÓN · NESTJS
                  +
             LMS · MOODLE
```

> **Criterio de éxito:** Un usuario deberá poder registrarse, ser clasificado con el rol correspondiente, ser autorizado para uno o más cursos y acceder a Moodle con los permisos correctos. Los administradores deberán controlar usuarios y autorizaciones desde una arquitectura segura y auditable.
