# Especificación Técnica de Vistas y Opciones por Rol para Frontend (Next.js / React)

Este documento define la arquitectura de navegación, páginas, componentes, formularios y opciones exactas requeridas en la capa de frontend (`apps/web`) para cada uno de los roles establecidos en el documento de alcance técnico y funcional del proyecto **IINICIA (React + Moodle)**.

---

## 1. Matriz de Roles y Accesos a Paneles

El principio rector del sistema establece: **los datos y opciones que no correspondan al rol y ámbito de autorización del usuario no deben renderizarse ni enviarse al cliente.**

| Rol de Sistema (Supabase / API) | Código Rol | Ruta Base de Dashboard | Rol Equivalente en Moodle | Ámbito y Restricciones Principales |
| :--- | :---: | :--- | :---: | :--- |
| **Superadministrador** | `superadmin` | `/dashboard/admin` | `manager` / Técnico | Acceso irrestricto a usuarios, roles globales, auditoría e integraciones. |
| **Administrador** | `admin` | `/dashboard/admin` | N/A (Gestión) | Gestión de usuarios, programas, asignaciones y aprobaciones de matrículas. |
| **Coordinador** | `coordinator` | `/dashboard/coordinador` | Supervisión de categoría | Consulta y gestión limitada a sus programas y cursos asignados. |
| **Profesor** | `teacher` | `/dashboard/docente` | `editingteacher` (3) | Consulta de cursos asignados, estudiantes inscritos, calificaciones y acceso SSO. |
| **Estudiante** | `student` | `/dashboard/estudiante` | `student` (5) | Consulta de programa, asignaturas matriculadas, calificaciones, avance y acceso SSO. |
| **Aspirante** | `applicant` | `/dashboard/aspirante` | Sin acceso a LMS | Carga de datos de admisión, estatus de postulación y oferta educativa. |
| **Soporte** | `support` | `/dashboard/soporte` | Sin acceso a LMS | Búsqueda operativa de usuarios, consulta de estatus y bitácoras de incidentes. |

---

## 2. Vistas Públicas e Institucionales (Acceso Universal)

Rutas públicas accesibles sin autenticación o con navegación continua integrada:

### 2.1. Portal Institucional (`/` - One Single Page y Subrutas Directas)
- **Cabecera Institucional (`SiteHeader`):**
  - Logotipo oficial de IINICIA con enlace al inicio.
  - Enlaces de navegación con anclas: `#inicio`, `#oferta-academica`, `#universidad`, `#admisiones`, `#contacto`.
  - Botón secundario: «Campus Virtual» (redirección a login de Moodle).
  - Botón primario: «Mi IINICIA» (lleva a `/login` o al dashboard según sesión activa).
- **Secciones de Contenido:**
  1. **Inicio / Hero:** Presentación institucional, lema académico, llamada a la acción hacia admisiones y oferta.
  2. **Universidad:** Misión, visión, modelo educativo y directorio de autoridades académicas.
  3. **Oferta Académica:** Catálogo interactivo con selector de pestañas: Licenciaturas, Diplomados, Certificaciones y Cursos. Cada tarjeta incluye título, modalidad, duración, costo/requisitos y botón «Más información / Postularme».
  4. **Admisiones:** Requisitos de ingreso, etapas del proceso y formulario rápido de contacto inicial.
  5. **Contacto:** Formulario general, mapa de ubicación, teléfonos de atención y correo institucional.
- **Pie de Página (`SiteFooter`):**
  - Datos de contacto institucional, enlaces legales (Aviso de privacidad, Términos y condiciones) y redes oficiales.

### 2.2. Autenticación y Recuperación
- `/login`: Formulario de acceso único (Email, Contraseña, botón de envío, enlaces a registro y recuperación).
- `/registro`: Formulario de registro para aspirantes (Nombre, Apellidos, Correo, Teléfono, Contraseña, Confirmación).
- `/recuperar-password`: Solicitud de restablecimiento vía correo electrónico (Supabase Auth).

---

## 3. Especificación Detallada de Vistas por Rol

### 3.1. Superadministrador y Administrador (`/dashboard/admin`)

#### Navegación Lateral / Pestañas Superiores
1. **Usuarios y Cuentas**
2. **Gestión de Profesores**
3. **Programas y Cursos**
4. **Matrículas y Sincronización Moodle**
5. **Auditoría del Sistema (`audit_logs`)**
6. **Configuración Global (Exclusivo `superadmin`)**

---

#### Vista 3.1.1: Gestión de Usuarios (`/dashboard/admin?tab=usuarios`)
- **Barra de Herramientas:**
  - Campo de búsqueda por texto (nombre, correo, ID de Moodle).
  - Filtro por Rol: Todos, Administrador, Coordinador, Docente, Estudiante, Aspirante, Soporte.
  - Filtro por Estado: Activo, Suspendido, Pendiente.
  - Botón de Acción Principal: «+ Nuevo Usuario».
- **Modal de Creación de Usuario (`CreateUserModal`):**
  - Campos: Nombre, Apellidos, Correo institucional, Contraseña inicial, Rol a asignar (selector exclusivo de un solo rol), Teléfono (opcional).
  - Checkbox: «Sincronizar cuenta inmediatamente con Moodle LMS».
  - Botón: «Crear y Autorizar Cuenta».
- **Tabla de Resultados:**
  - Columnas: Nombre completo, Correo electrónico, Roles asignados (etiquetas visuales), Estado de cuenta, ID Moodle (con badge de sincronizado/no sincronizado), Fecha de creación, Acciones.
  - Menú de Acciones por Usuario:
    - «Ver detalle de perfil».
    - «Editar roles y permisos».
    - «Suspender / Reactivar usuario».
    - «Forzar sincronización con Moodle».
    - «Restablecer contraseña».

---

#### Vista 3.1.2: Gestión de Profesores (`/dashboard/admin?tab=profesores`)
- **Objetivo:** Filtrar y gestionar específicamente la plantilla docente.
- **Componentes:**
  - Listado de docentes activos con ID de profesor en Moodle (`editingteacher`).
  - Asignación rápida de asignaturas / cursos: Selector de curso -> Selección de profesor -> Botón «Vincular a Curso».
  - Métrica de cursos asignados por profesor.
  - Indicador de estado de conexión del docente con el aula virtual.

---

#### Vista 3.1.3: Asignaciones y Matrículas (`/dashboard/admin/asignaciones` o pestaña `matriculas`)
- **Filtros:** Estado de matrícula (`pendiente`, `autorizada`, `sincronizada`, `rechazada`), Programa académico, Búsqueda por estudiante.
- **Acciones en Lote:** «Autorizar y sincronizar seleccionados».
- **Tabla de Solicitudes / Matrículas:**
  - Columnas: Estudiante, Programa / Curso solicitado, Fecha de solicitud, Rol en Moodle (`student` / `editingteacher`), Estado de autorización, Estado de sincronización en Moodle, Acciones.
  - Acciones por fila:
    - Botón «Aprobar»: Cambia estado a `autorizada` y ejecuta la sincronización con Moodle vía API.
    - Botón «Rechazar»: Abre modal para capturar motivo o notas de rechazo.
    - Botón «Reintentar Sincronización»: Si falló por conectividad con el LMS.
    - Botón «Desasignar / Dar de baja»: Elimina la matrícula en el portal y desmatricula al usuario en Moodle LMS.

---

#### Vista 3.1.4: Auditoría y Trazabilidad (`/dashboard/admin?tab=auditoria`)
- **Componentes:**
  - Filtro por rango de fechas, actor administrativo, tipo de acción (`ENROLLMENT_ASSIGNED_BY_ADMIN`, `USER_ROLE_CHANGED`, `MOODLE_ENROLLMENT_SYNCED`, etc.).
  - Tabla de registros de auditoría: Fecha y hora exacta, Usuario ejecutor, Usuario afectado, Acción realizada, Entidad modificada, Detalle de cambios (valores anteriores vs nuevos).

---

### 3.2. Coordinador Académico (`/dashboard/coordinador`)

El coordinador cuenta con atribuciones operativas dentro del alcance de su facultad o programa.

#### Vista 3.2.1: Resumen del Programa Asignado
- Indicadores métricos: Total de aspirantes en revisión, Total de alumnos matriculados, Cursos activos en el periodo.

#### Vista 3.2.2: Alumnos del Programa
- Listado de estudiantes vinculados exclusivamente a sus carreras o diplomados.
- Visualización de trayectoria y estatus de materias.
- Aprobación de preinscripciones a materias del ciclo.

#### Vista 3.2.3: Supervisión Docente
- Consulta de profesores asignados a las materias del programa.
- Enlace directo de supervisión a los cursos en Moodle.

---

### 3.3. Profesor / Docente (`/dashboard/docente`)

#### Navegación Principal
1. **Mis Cursos Asignados**
2. **Detalle de Curso / Participantes**
3. **Calificaciones y Evaluaciones**
4. **Mi Perfil Institucional**

---

#### Vista 3.3.1: Panel Principal de Cursos Asignados
- **Tarjeta de Bienvenida:** Saludo personalizado, indicador de rol docente institucional, estado de sincronización con Moodle (`moodle_user_id`).
- **Cuadrícula de Cursos:**
  - Tarjeta de Curso:
    - Nombre del curso y código de asignatura (ej. `IINICIA-REACT-102`).
    - Programa académico asociado.
    - Contador de estudiantes matriculados activos.
    - Botón principal: «Ingresar al Aula Virtual (SSO)» (abre Moodle directamente autenticado en el curso).
    - Botón secundario: «Ver Participantes y Avance».

---

#### Vista 3.3.2: Detalle de Curso y Lista de Estudiantes
- **Encabezado:** Nombre del curso, periodo lectivo, botón de regreso.
- **Pestaña 1 - Contenidos del Curso:** Lista de secciones, temas, recursos y actividades configuradas en Moodle.
- **Pestaña 2 - Estudiantes Matriculados:**
  - Tabla de participantes: Nombre del alumno, Correo electrónico, Fecha de último acceso al aula virtual, Estado de entrega de tareas.
- **Pestaña 3 - Calificaciones:**
  - Tabla de calificaciones por estudiante obtenida de Moodle Web Services (`gradereport_user_get_grade_items`).
  - *Nota arquitectónica:* Solo lectura desde el portal; el registro y edición de notas se realiza en Moodle.

---

### 3.4. Estudiante (`/dashboard/estudiante`)

#### Navegación Principal
1. **Mi Panel / Mis Cursos**
2. **Oferta Disponible / Inscripciones**
3. **Historial Académico y Calificaciones**
4. **Mi Perfil**

---

#### Vista 3.4.1: Panel de Cursos Matriculados
- **Cabecera:** Nombre completo del estudiante, programa académico al que pertenece, matrícula institucional.
- **Sección «Mis Cursos Activos»:**
  - Tarjeta de Curso:
    - Nombre de la materia y profesor titular asignado.
    - Barra de progreso de actividades completadas (% calculado desde Moodle `core_completion_get_course_completion_status`).
    - Estado de matrícula: `sincronizada` / `activa`.
    - Botón de Acción Principal: «Ir a Clase en Moodle» (acceso transparente mediante token/SSO sin pedir contraseña de Moodle).
    - Botón de Acción Secundaria: «Ver Temario y Calificaciones».
    - Opción de Baja: Botón «Dar de baja de esta materia» (con modal de confirmación; desmatricula de Moodle y actualiza el expediente en Supabase).

---

#### Vista 3.4.2: Catálogo de Inscripciones Disponibles
- **Listado de Cursos Abiertos para Autoinscripción:**
  - Tarjetas con información del curso, prerrequisitos y fechas.
  - Botón «Inscribirme»: Envía solicitud a la API `/api/v1/enrollments`, actualiza el estado a autorizada/sincronizada según las reglas del programa y genera la matrícula en Moodle.

---

#### Vista 3.4.3: Detalle de Asignatura y Calificaciones
- Desglose de actividades evaluadas: Tareas, Foros, Cuestionarios, Examen final, Nota parcial y Nota final obtenida de Moodle.

---

### 3.5. Aspirante (`/dashboard/aspirante`)

#### Vista 3.5.1: Estado de Postulación y Trámite de Admisión
- **Línea de Tiempo del Proceso:**
  - Paso 1: Registro de cuenta (Completado).
  - Paso 2: Datos personales y socioeconómicos (Pendiente / En revisión).
  - Paso 3: Selección de programa académico de interés.
  - Paso 4: Carga de documentos de admisión (Identificación, Certificados).
  - Paso 5: Dictamen y pase a matrícula.
- **Formulario de Actualización de Expediente:**
  - Campos: Teléfono, Ciudad/Estado, Nivel máximo de estudios, Programa deseado.
- **Aviso Informativo:** «Tu solicitud está siendo revisada por el área de admisiones. Una vez aprobada tu postulación, se habilitará tu cuenta de estudiante y el acceso al Campus Virtual».

---

### 3.6. Soporte Técnico Operativo (`/dashboard/soporte`)

#### Vista 3.6.1: Consulta y Diagnóstico de Usuarios
- Búsqueda por correo o matrícula.
- Ficha de diagnóstico:
  - Estado en Supabase Auth (correo verificado, último login).
  - Estado en Moodle (ID remoto, si el usuario existe o está suspendido).
  - Historial de intentos de acceso al campus (`campus_access_logs`).
  - Botón: «Reenviar correo de confirmación».
  - Botón: «Verificar estado de conectividad con Moodle».

---

## 4. Contrato de Endpoints Backend Consumidos por Vista

| Módulo / Vista | Endpoint API | Método | Rol Mínimo Requerido | Propósito |
| :--- | :--- | :---: | :---: | :--- |
| **Auth** | `/api/v1/auth/login` | `POST` | Público | Autenticación y obtención de JWT de sesión. |
| **Perfil** | `/api/v1/auth/me` | `GET` | Autenticado | Retorna datos de perfil, roles y vínculo de Moodle. |
| **Usuarios** | `/api/v1/users` | `GET` | `admin` | Consulta y filtrado paginado de usuarios. |
| **Usuarios** | `/api/v1/users/admin-create` | `POST` | `admin` | Alta administrativa con rol específico y sincronización a Moodle. |
| **Roles** | `/api/v1/roles` | `GET` | `admin` | Catálogo de roles de la plataforma. |
| **Programas** | `/api/v1/programs` | `GET` | Público / Auth | Lista de programas académicos activos. |
| **Matrículas** | `/api/v1/enrollments/my` | `GET` | `student` / `teacher` | Retorna los cursos autorizados del usuario en sesión. |
| **Matrículas** | `/api/v1/enrollments` | `POST` | `student` / `admin` | Registro de matrícula o inscripción a materia. |
| **Matrículas** | `/api/v1/enrollments/:id` | `DELETE` | `student` / `admin` | Baja de curso (desmatricula en Moodle y borra en Supabase). |
| **Moodle SSO** | `/api/v1/moodle/sso` | `POST` | `student` / `teacher` | Genera URL de acceso seguro al aula virtual. |
| **Moodle Curso**| `/api/v1/moodle/courses/:id/contents` | `GET` | `student` / `teacher` | Contenidos, temas y módulos del curso. |
| **Moodle Curso**| `/api/v1/moodle/courses/:id/participants` | `GET` | `teacher` / `admin` | Participantes matriculados en la materia. |
| **Moodle Curso**| `/api/v1/moodle/courses/:id/my-progress` | `GET` | `student` | Calificaciones y % de compleción del alumno. |
| **Auditoría** | `/api/v1/audit` | `GET` | `superadmin` / `admin` | Consulta de la bitácora de eventos del sistema. |

---

## 5. Directrices de UX, Accesibilidad y Seguridad para Frontend

1. **Protección de Rutas por Middleware y Guards:**
   - Toda ruta bajo `/dashboard/*` debe validar la sesión activa de Supabase Auth.
   - Si un usuario con rol `student` intenta ingresar a `/dashboard/admin` o `/dashboard/docente`, el cliente debe redirigir a su propio dashboard sin exponer la vista.
2. **Manejo de Errores y Feedback Visual:**
   - Modales de confirmación para acciones destructivas (baja de materias, suspensión de usuarios).
   - Notificaciones toast para operaciones exitosas o fallos de red.
   - Indicadores de carga (`skeletons` o spinners) en todas las consultas asíncronas a la API.
3. **Cero Secretos en el Frontend:**
   - Ninguna variable privada de Supabase (`SUPABASE_SECRET_KEY`) ni tokens de Moodle (`MOODLE_WS_TOKEN`) deben estar en el bundle de Next.js ni en variables `NEXT_PUBLIC_*`.
   - Toda interacción con Moodle se realiza a través de los endpoints de la API NestJS en `/api/v1/moodle/*`.
4. **Accesibilidad (WCAG 2.2 AA):**
   - Jerarquía clara de títulos (`h1`, `h2`, `h3`).
   - Contraste cromático en botones y badges de estado.
   - Navegación accesible por teclado (`Tab`, `Enter`, `Escape` en modales).
   - Atributos `aria-label` en botones de solo icono.
