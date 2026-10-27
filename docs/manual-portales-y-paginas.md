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

## 3. Identidad Visual Institucional

- **Tokens Compartidos:**
  - Color Primario: `#2457F5` (Azul eléctrico institucional).
  - Acento de Identidad: `#D5F36A` (Lima ácido, utilizado con moderación en indicadores y viñetas activas).
  - Radios: Controles `rounded-[6px]`, tarjetas `rounded-[10px]`, modales/paneles `rounded-[14px]`.
- **Modo Claro y Oscuro:**
  - Persistencia en almacenamiento local (`iinicia_theme`).
  - Sin emojis en interfaces, iconografía lineal uniforme en formato SVG.
  - Tipografía Geist / Inter optimizada para lectura administrativa y académica prolongada.

---

## 4. Pruebas y Validación Técnica

- **Backend NestJS:** 55 pruebas unitarias automatizadas (`npm test --prefix apps/api`).
- **Frontend Next.js:** Compilación de producción validada sin errores de TypeScript ni Turbopack (`npm run build --prefix apps/web`).
