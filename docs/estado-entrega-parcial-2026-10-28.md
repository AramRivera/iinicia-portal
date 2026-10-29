# Estado de INICIA para la entrega parcial — 28 de octubre de 2026

Verificación de esta copia de trabajo con el PDF rector, `ALCANCE.md`, los contratos y pruebas locales. No equivale a una demostración completa de extremo a extremo.

## Comprobado

| Requisito | Estado |
| --- | --- |
| Portal Next.js | Compila con 23 rutas. Incluye portada, catálogo, admisiones, contacto y paneles de administración, estudiante, profesor, aspirante, coordinación y soporte. |
| Marca INICIA | El texto visible usa una sola I. El encabezado y la barra lateral muestran una I con un 2 elevado. |
| Login y roles | Estudiante, profesor, aspirante y superadministrador iniciaron sesión en la API local y recibieron sus perfiles y roles. Los accesos rápidos del login siguen disponibles. |
| API local | Responde en `http://localhost:3000/api/v1`. La última consulta de salud informó API, Supabase y Moodle conectados. |
| Cursos | La API devolvió dos mapeos y dos programas públicos de tipo curso. La portada muestra la oferta pública real; con sesión, adapta `id`, `portal_course_code` y `course_name` al contrato visual para solicitar acceso con el ID correcto. |
| Solicitudes | El portal presenta una solicitud de inscripción como pendiente de autorización, sin afirmar que ya existe una matrícula en Moodle. |
| Admisiones | Existe formulario de postulación de aspirantes y revisión administrativa. Las escrituras con privilegios de Supabase aún no se han probado realmente. |
| Seguridad académica | Un estudiante recibió 403 al consultar participantes, vista docente y progreso ajeno. |

## Pendiente o limitado

1. **Clave privilegiada Supabase.** El valor local de `SUPABASE_SECRET_KEY` fue rechazado con 401 en una lectura administrativa. El usuario no tiene acceso a la clave válida. Registro administrativo, aprobación de inscripciones, revisión de admisiones y restablecimiento final de contraseña no pueden validarse de extremo a extremo hasta que el administrador del proyecto configure la clave en `apps/api/.env` de forma segura.
2. **Detalle público de cursos.** La portada muestra los dos programas publicados de tipo curso. `/api/v1/courses/offerings` exige sesión, por lo que los detalles de sus mapeos y la solicitud de inscripción solo aparecen después del login.
3. **Dos cursos de muestra.** Existen dos mapeos y dos cursos remotos. Falta demostrar que ambos tienen las actividades y la asignación de un profesor y dos estudiantes exigidas para la entrega.
4. **Vistas de coordinación y soporte.** Compilan y muestran datos permitidos por los permisos disponibles, pero no se probaron con cuentas reales de esos roles. No hay un ámbito de programa definido para habilitar operaciones de coordinación.
5. **Vista docente.** El listado y las calificaciones reales requieren comprobar los datos académicos del servicio. Se retiró “Nota Rápida”; el portal enlaza al calificador oficial de Moodle y no guarda calificaciones.
6. **Moodle.** El compañero del usuario se encarga de su instalación y diseño. No se cambió el tema del Moodle compartido. La instalación local iniciada por este agente se detuvo a petición del usuario; no debe considerarse lista para uso.

## Inicio desde PowerShell

Abrir dos terminales en **esta copia de trabajo**, `C:\Users\Aaron\.codex\worktrees\feature-frontend-portal\iinicia-portal`:

```powershell
cd C:\Users\Aaron\.codex\worktrees\feature-frontend-portal\iinicia-portal\apps\api
npm.cmd run start:dev
```

```powershell
cd C:\Users\Aaron\.codex\worktrees\feature-frontend-portal\iinicia-portal\apps\web
npm.cmd run dev
```

Abrir `http://localhost:4000`. Si un puerto ya está ocupado, usar la instancia que ya está ejecutándose o cerrar esa terminal antes de iniciar otra. `apps/api/.env` y `apps/web/.env.local` son archivos locales ignorados por Git. No enviar la clave privada al frontend.

## Validación ejecutada

- `npm.cmd run build` en API y web: correcto.
- `npm.cmd test` en API: 69 pruebas de 15 archivos, correctas.
- `npm.cmd run lint` en API: sin errores, con 3 advertencias anteriores en `moodle.client.ts`.
- Lint completo de web: falla por 98 errores existentes en varias páginas y servicios. La compilación web pasó; la comprobación dirigida de archivos nuevos de roles y recuperación pasó.
- `git diff --check`: sin errores de espacios.

**Siguiente paso prioritario:** conseguir que un administrador del proyecto Supabase coloque una clave secreta válida en el `.env` local y ejecutar el flujo real de aprobación desde el portal.
