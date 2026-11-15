# Manual del Estudiante — Portal IINICIA y Campus Virtual Moodle

**Fecha de emisión:** 14 de noviembre de 2026  
**Perfil objetivo:** Estudiantes Regulares y Alumnos Matriculados  
**Ruta del Panel:** `/dashboard/estudiante`  
**Criterios asociados:** `CA-05`, `CA-09`, `CA-11`, `CA-12`, `CA-15`, `CA-17`, `CA-18`.

---

## 1. Ingreso al Portal de Estudiantes

1. Visita la página de inicio de sesión: `http://localhost:4000/login` (o dominio del portal).
2. Escribe tu correo electrónico y contraseña.
3. Resuelve el desafío interactivo de seguridad **Turnstile CAPTCHA**.
4. Abre la aplicación de autenticación en tu dispositivo móvil e ingresa tu código **TOTP** de 6 dígitos.
5. Tras verificar el segundo factor (**AAL2**), ingresarás directamente a tu panel en `/dashboard/estudiante`.

---

## 2. Pestañas y Módulos de Tu Espacio Estudiantil

### 2.1 Pestaña «Mis Cursos»
- **Cursos Autorizados:** Visualiza únicamente las asignaturas en las que cuentas con matrícula activa y aprobada.
- **Barra de Avance Académico:** Consulta el porcentaje de progreso completado conforme realizas lecturas, foros y tareas en el campus virtual.
- **Botón `🚀 Entrar al curso`:** Te conecta de manera inmediata al aula virtual de Moodle mediante un enlace firmado seguro (**SSO**). No necesitas memorizar ni ingresar una segunda contraseña.
- **Temario de la Asignatura:** Botón **`Ver temario`** que despliega el plan de estudios, competencias, duración en horas y módulos del programa.
- **Baja Voluntaria:** Si por motivos de fuerza mayor requieres desmatricularte de una materia, puedes pulsar el botón **`Solicitar baja`**. Un modal de confirmación solicitará tu validación antes de tramitar la baja y desasignación en el campus.

### 2.2 Pestaña «Inscripciones»
- **Historial de Solicitudes:** Consulta el estado en tiempo real de tus trámites de inscripción:
  - `Pendiente`: Espera revisión y autorización por parte de la coordinación o administración.
  - `Autorizada`: Aprobada administrativamente, en cola de sincronización.
  - `Sincronizada`: Confirmada en Moodle LMS; el curso ya aparece habilitado en tu pestaña de cursos.
  - `Error de sincronización`: La plataforma reintentará la sincronización automáticamente ante fallos temporales.
- **Solicitar Nueva Materia:** Puedes postularte a materias adicionales de tu programa formativo seleccionando el curso disponible y pulsando **`Solicitar inscripción`**.

### 2.3 Pestaña «Calificaciones»
- **Libro de Notas Personal:** Muestra la calificación final y el desglose de evaluaciones calificadas por tus profesores en Moodle.
- **Aislamiento Estricto:** Por políticas de privacidad, solo puedes consultar tus propias notas; no tienes acceso a las calificaciones de otros compañeros.

### 2.4 Pestaña «Campus Virtual»
- **Estado de Cuenta Moodle:** Comprueba que tu usuario se encuentre vinculado y activo en el campus.
- **Acceso General:** Salto directo a la portada general de Moodle para revisar el calendario institucional o foros generales.

### 2.5 Pestaña «Perfil»
- Consulta tu información registrada (nombre, apellido, correo) y actualiza tu teléfono o biografía de estudiante.

---

## 3. Guía de Estudio en el Curso (Ejemplo: HTML Básico Desde Cero)

1. En **Mis Cursos**, pulsa **`🚀 Entrar al curso`** en la tarjeta de *HTML Básico Desde Cero*.
2. **Revisión del Material:** Abre el recurso interactivo *HTML básico desde cero — Material interactivo*, lee los módulos teóricos y practica en el laboratorio interactivo.
3. **Participación en Foro:** Ingresa al *Foro de Bienvenida y Dudas Técnicas* y comparte tu presentación o formula tus preguntas al docente.
4. **Entrega de la Tarea Práctica 1:**
   - Haz clic en *Tarea Práctica 1: Mi Primera Página HTML Semántica*.
   - Pulsa *Añadir entrega*. Sube tu archivo `.html` o pega el código en el editor.
   - Pulsa *Guardar cambios*. Tu estado cambiará a *Enviado para calificar*.
5. **Evaluación Teórica:** Contesta el cuestionario de opción múltiple dentro del plazo establecido.
6. **Consulta de Avance:** Al regresar a tu panel en el portal, observarás cómo tu porcentaje de progreso y tu nota final se actualizan automáticamente tras la calificación del profesor.
