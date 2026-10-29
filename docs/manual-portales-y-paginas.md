# Manual de Uso del Portal Institucional IINICIA

Documento de referencia operativa y arquitectónica para el portal universitario IINICIA, cubriendo páginas públicas, roles académicos, resolución de doble rol y espacios de trabajo.

---

## 1. Mapa de Navegación del Portal

El portal integra la totalidad de las rutas especificadas en el documento de especificación técnica institucional:

| Ruta | Nombre del Módulo | Propósito y Audiencia |
| :--- | :--- | :--- |
| `/` | **Inicio** | Portal principal, propuesta académica, llamadas de acción y enlaces institucionales. |
| `/universidad` | **Universidad IINICIA** | Misión, Visión, 4 Pilares del Modelo Educativo, Autoridades y Claustro. |
| `/cursos` | **Catálogo de Cursos** | Oferta formativa con matriculación directa y acceso a Moodle LMS. |
| `/diplomados` | **Diplomados** | Programas de especialización modular con créditos curriculares. |
| `/certificaciones` | **Certificaciones** | Credenciales digitales profesionales de 60 a 80 horas lectivas. |
| `/admisiones` | **Admisiones** | Ruta de ingreso en 4 pasos, requisitos documentales y fechas clave. |
| `/contacto` | **Contacto y Soporte** | Directorio institucional y formulario de consultas y asistencia técnica. |
| `/login` | **Iniciar Sesión** | Acceso al campus con botones de verificación rápida y recuperación. |
| `/registro` | **Registro de Aspirantes** | Alta de usuario con creación automática del rol inicial provisional `aspirante`. |
| `/recuperar-password` | **Recuperación de Acceso** | Restablecimiento de credenciales vía correo institucional o personal. |
| `/dashboard` | **Mi IINICIA (Hub)** | Redirige automáticamente al panel correspondiente según el rol activo. |
| `/dashboard/admin` | **Panel Administrativo** | Gestión de usuarios, roles, cursos Moodle, matrículas y auditoría. |
| `/dashboard/admin/asignaciones` | **Asignación de Cursos y Roles** | Tabla dedicada con filtros por nombre/correo, paginación y matriculación. |
| `/dashboard/docente` | **Portal del Profesor** | Asignaturas a cargo, alumnos inscritos, calificaciones y acceso directo a Moodle. |
| `/dashboard/estudiante` | **Portal del Estudiante** | Mis cursos activos, avance académico, calificaciones y botón SSO a aula virtual. |
| `/dashboard/aspirante` | **Portal del Aspirante** | Estado del expediente, catálogo de cursos disponibles y pasos de matriculación. |

---

## 2. Resolución del Problema de Doble Rol

### Comportamiento Previo
Cuando una persona se registraba públicamente en `/registro`, Supabase Auth y el trigger de base de datos le asignaban automáticamente el rol inicial provisional `aspirante`. Cuando el administrador o superadministrador le asignaba un rol superior (ej. `profesor` o `administrador`), el registro en `user_roles` conservaba activo el rol `aspirante`, provocando que el usuario tuviera ambos roles de manera simultánea.

### Solución Implementada en Backend y Frontend

1. **Desactivación Automática de `aspirante` en Backend (`roles.service.ts`):**
   - Al invocar `assignRole(targetUserId, roleId)`, el servicio verifica si el rol asignado no es `aspirante`.
   - Si se asigna un rol formal (`profesor`, `estudiante`, `coordinador`, `administrador`, etc.), se ejecuta automáticamente una actualización en `user_roles` marcando `is_active = false` para el rol `aspirante` de ese usuario.
   - De este modo, la base de datos desactiva de inmediato el rol provisional al conferir el rol definitivo.

2. **Resolución Jerárquica en Frontend (`SiteHeader.tsx` y `AuthContext.tsx`):**
   - En la cabecera y en los redireccionadores de sesión, el rol principal se evalúa por jerarquía estricta:
     $$\text{superadministrador} \succ \text{administrador} \succ \text{coordinador} \succ \text{profesor} \succ \text{estudiante} \succ \text{aspirante}$$
   - Esto previene cualquier ambigüedad visual en etiquetas y enrutamiento en caso de que existan roles secundarios históricos.

---

## 3. Desasignación y Gestión Operativa de Cursos

### Funcionalidad de Desasignación (Unenrollment)
1. **Endpoint Backend `DELETE /enrollments/:id`:**
   - Permite al personal administrativo (superadministrador, administrador, coordinador), a los profesores titulares y a los estudiantes autorizados revocar o dar de baja una matrícula.
   - Invoca el Web Service oficial de Moodle LMS `enrol_manual_unenrol_users` a través de `MoodleClient.unenrolUser`, eliminando el acceso del usuario al aula remota.
   - Remueve el registro en `enrollment_requests` y asienta el evento de auditoría en `audit_logs` (`ENROLLMENT_UNASSIGNED_BY_ADMIN` o `ENROLLMENT_DROPPED_BY_STUDENT`).

2. **Portal Docente (`/dashboard/docente`):**
   - **Directorio de Alumnos:** Lista de estudiantes con nombre, correo, fecha y estado de sincronización. Botón **"Desasignar"** para dar de baja a un alumno del grupo con confirmación modal.
   - **Libro de Calificaciones y Actas:** Las actas y calificaciones oficiales se gestionan en Moodle LMS. El portal incluye un botón de salto directo al **Calificador Oficial de Moodle** (`grade/report/grader/index.php`) y no almacena calificaciones.
   - **Mis Asignaturas:** Conteo en tiempo real de alumnos inscritos, enlace directo al calificador y botón de acceso seguro al aula virtual.
   - **Perfil Docente Editable:** Modal interactivo para actualizar nombre, apellidos, teléfono de contacto y semblanza académica mediante `PATCH /users/me/profile`.

3. **Portal Estudiante (`/dashboard/estudiante`):**
   - **Mis Materias Activas:** Fichas con barra de avance didáctico real, botón SSO de acceso a Moodle, modal interactivo de temario/sílabo y botón **"Dar de baja materia"** para desasignarse con confirmación.
   - **Catálogo e Inscripción:** Explorador de materias ofertadas con inscripción en 1 clic y matriculación inmediata a Moodle LMS.
   - **Kárdex y Avance Curricular:** Panel de métricas Bento (Materias Inscritas, Acreditadas, Promedio Parcial en escala oficial 0 a 10 y Créditos SATCA acumulados) junto con la tabla de estatus académico y enlaces SSO a cada aula.
   - **Expediente Escolar Editable:** Matrícula oficial, estatus escolar, correo, teléfono y modal para editar información personal (`PATCH /users/me/profile`).

4. **Panel de Asignaciones Dedicado (`/dashboard/admin/asignaciones`):**
   - Tabla interactiva con filtro instantáneo por nombre o correo.
   - Asignación de materias con rol `student` o `teacher`.
   - Desasignación directa con un clic en la insignia del curso.
   - Asignación y cambio de roles de usuario.

---

## 4. Arquitectura de Single Sign-On (SSO) con Moodle LMS

1. **Auto-descubrimiento de URL Canónica (`MoodleClient.getEffectiveBaseUrl`):**
   - Consulta `core_webservice_get_site_info` mediante GET para resolver de forma transparente la URL canónica de Moodle (`$CFG->wwwroot`), previniendo errores de redirección HTTP 303 que corrompen las llamadas REST en instalaciones alojadas en IPs o dominios locales específicos.

2. **Pre-sincronización Just-In-Time (JIT):**
   - Si un usuario registrado aún no posee `moodle_user_id`, el backend invoca automáticamente `syncUser` antes de solicitar la llave de un solo uso, garantizando que el usuario exista en Moodle para evitar el error `User is not exist`.

3. **Autenticación Efímera con `auth_userkey`:**
   - La API solicita una llave temporal a Moodle Web Services (`auth_userkey_request_login_url`) parametrizando el correo del usuario y el parámetro `wantsurl`.
   - Moodle responde con una URL protegida (`/auth/userkey/login.php?key=...&wantsurl=...`) que al abrirse en el navegador establece la cookie `MoodleSession` y redirige al usuario directamente al aula sin requerir credenciales manuales.

---

## 5. Identidad Visual Institucional (Campus Tech OS)

- **Tokens Compartidos:**
  - Esmeralda principal: `#087654` (botones y selección).
  - Esmeralda de interacción: `#065C42` (estado hover).
  - Fondo de bienvenida: `#064D3B` (paneles destacados).
  - Radios: Controles `rounded-[6px]`, tarjetas `rounded-[10px]`, modales/paneles `rounded-[14px]`.
- **Modo Claro y Oscuro:**
  - Persistencia en almacenamiento local (`iinicia_theme`).
  - Sin emojis en interfaces, iconografía lineal uniforme en formato SVG.
  - Tipografía Geist / Inter optimizada para lectura administrativa y académica prolongada.

---

## 6. Pruebas y Validación Técnica

- **Backend NestJS:** 59 pruebas unitarias automatizadas (`npm test --prefix apps/api`) en 13 suites de prueba aprobadas al 100%.
- **Frontend Next.js:** Compilación de producción validada sin errores de TypeScript ni Turbopack (`npm run build --prefix apps/web`) generando 19 rutas de forma estática.
