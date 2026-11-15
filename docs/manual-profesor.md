# Manual del Profesor — Portal IINICIA y Campus Virtual Moodle

**Fecha de emisión:** 14 de noviembre de 2026  
**Perfil objetivo:** Docentes y Profesores Titulares  
**Ruta del Panel:** `/dashboard/docente`  
**Criterios asociados:** `CA-05`, `CA-09`, `CA-13`, `CA-15`, `CA-17`, `CA-18`.

---

## 1. Acceso y Autenticación Segura

1. Ingresa a la página de acceso en `http://localhost:4000/login` (o dominio institucional).
2. Proporciona tu correo electrónico registrado y contraseña institucional.
3. Completa el reto de seguridad de **Turnstile CAPTCHA**.
4. Ingresa el código numérico de 6 dígitos desde tu aplicación de autenticación vinculada (**TOTP / AAL2**).
5. El sistema detectará automáticamente tu rol docente y te dirigirá al panel `/dashboard/docente`.

> [!IMPORTANT]
> El acceso a las herramientas docentes y al calificador de Moodle exige nivel de autenticación AAL2. No es posible acceder sin completar la verificación en dos pasos.

---

## 2. Pestañas y Funcionalidades del Panel Docente

### 2.1 Pestaña «Mis Materias»
- **Catálogo de Cursos Asignados:** Muestra únicamente los cursos donde la coordinación o administración te ha asignado como docente (`editingteacher` o `teacher`).
- **Estado de Sincronización:** Cada tarjeta indica si la materia se encuentra sincronizada activamente con Moodle.
- **Acceso Directo al Aula (SSO):** Al presionar **`🚀 Entrar al curso`**, el portal genera un enlace firmado seguro de un solo uso (`auth_userkey`). Se abre una nueva pestaña autenticada directamente en el aula del curso sin necesidad de escribir contraseñas.
- **Detalle de Asignatura:** Permite consultar el código del curso, número de módulos, carga horaria y resumen de estudiantes inscritos.

### 2.2 Pestaña «Estudiantes»
- **Directorio de Participantes:** Listado de los alumnos matriculados en tus cursos activos.
- **Filtro por Materia:** Permite alternar la lista entre tus diferentes cursos asignados o filtrar por nombre/correo mediante la barra de búsqueda en tiempo real.
- **Aislamiento de Privacidad:** Solo puedes visualizar información de los estudiantes pertenecientes a tus asignaturas. Los estudiantes de otros programas o grupos no son visibles.

### 2.3 Pestaña «Calificaciones»
- **Resumen de Evaluaciones:** Visualiza el estado de las tareas entregadas por los alumnos.
- **Salto al Calificador Oficial:** Incluye el botón **`Abrir Libro de Calificaciones en Moodle`**, el cual realiza un salto SSO firmado directamente al libro de calificaciones (`grade/report/grader/index.php?id=<course_id>`) del curso objetivo.
- **Calificación en Moodle:** Siguiendo la arquitectura del sistema, la asignación de notas oficiales y retroalimentación se realiza dentro de la interfaz oficial de Moodle para garantizar la validez académica. Una vez guardada la nota en Moodle, el portal la sincroniza en el perfil del alumno.

### 2.4 Pestaña «Moodle»
- **Diagnóstico del Campus:** Verifica el estado de comunicación del Web Service y la vinculación de tu identificador `moodle_user_id`.
- **Acceso General:** Botón para ingresar a la portada principal del campus virtual.

### 2.5 Pestaña «Perfil»
- Permite actualizar tus datos de contacto: teléfono celular y biografía profesional, los cuales se reflejan en el directorio institucional público previa confirmación.

---

## 3. Operación en el Aula Virtual Moodle (Ejemplo: HTML Básico Desde Cero)

1. **Gestión de Contenidos:** Con el botón *Activar modo de edición* en Moodle, puedes agregar recursos (como el archivo interactivo `index.html`) o foros de avisos.
2. **Revisión de Tareas:**
   - En *Tarea Práctica 1: Mi Primera Página HTML Semántica*, pulsa *Ver todos los envíos*.
   - Selecciona al estudiante (ej: Ana Alumna o Beto Alumno).
   - Revisa el archivo adjunto o texto en línea, asigna la calificación sobre 100 y escribe la retroalimentación cualitativa.
   - Pulsa *Guardar cambios*. La finalización de la actividad se registrará automáticamente.
3. **Cierre de Sesión:** Al cerrar sesión en el portal IINICIA, se revoca la sesión activa y se invalidan los tokens temporales de acceso al campus.
