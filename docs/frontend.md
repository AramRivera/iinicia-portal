# Frontend INICIA — guía vigente

Estado del código: 29 de octubre de 2026, rama `feature-frontend-portal`. Esta guía describe `apps/web`. Los ejemplos históricos de [frontend-integration-guide.md](frontend-integration-guide.md) y [manual-portales-y-paginas.md](manual-portales-y-paginas.md) pueden estar desactualizados. Para solicitudes y respuestas exactas consulta [openapi.yaml](openapi.yaml).

## Arquitectura

El navegador ejecuta Next.js 16, React 19, TypeScript y Tailwind CSS 4. El portal llama a NestJS bajo `/api/v1`; NestJS valida la identidad y los permisos y se comunica con Supabase y Moodle. El navegador abre una URL de acceso al campus que la API devuelve. El token de Web Services de Moodle pertenece al servidor.

| Ubicación | Responsabilidad |
| --- | --- |
| `apps/web/src/app` | Rutas App Router, portada y páginas por rol. |
| `apps/web/src/components` | Navegación, cabecera, pie, paneles, programa y Moodle. |
| `apps/web/src/contexts/AuthContext.tsx` | Sesión, usuario y panel inicial según rol. |
| `apps/web/src/contexts/ThemeContext.tsx` | Tema claro/oscuro. |
| `apps/web/src/lib/api.ts` | Cliente HTTP y operaciones agrupadas por recurso. |
| `apps/web/src/lib/moodle-window.ts` | Apertura de la ventana del campus. |
| `apps/web/src/types/index.ts` | Tipos de datos consumidos. |
| `apps/web/public` | Imágenes y otros recursos estáticos. |

## Instalación y entorno

Desde PowerShell, en `apps/web`, ejecuta `npm.cmd ci`, copia `.env.example` a `.env.local` y ejecuta `npm.cmd run dev`. Abre <http://localhost:4000>. `Ctrl+C` detiene el servidor. Reinícialo al modificar variables.

| Variable | Uso |
| --- | --- |
| `NEXT_PUBLIC_API_URL` | Base de NestJS con `/api/v1`. Si falta, el código usa `http://localhost:3000/api/v1`. Para la API compartida: `http://192.168.191.171:3000/api/v1`. |
| `NEXT_PUBLIC_MOODLE_URL` | Base de Moodle accesible desde el navegador, por ejemplo `http://192.168.191.171/moodle`. |
| `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Están en `.env.example`, pero el frontend actual autentica a través de NestJS y no importa el SDK de Supabase. Nunca pongas claves secretas aquí. |

El puerto 4000 corresponde a Next.js; el 3000 en los ejemplos corresponde a NestJS. Comprueba la API en `<NEXT_PUBLIC_API_URL>/health` y la documentación en `<NEXT_PUBLIC_API_URL>/docs`. `.env.local` se mantiene local, fuera de Git.

Para producción: `npm.cmd run build` seguido de `npm.cmd run start`. Para el análisis estático: `npm.cmd run lint`. El build verifica compilación y TypeScript; no equivale al resultado del lint ni a pruebas de integración.

## Mapa de páginas

| Ruta | Uso |
| --- | --- |
| `/` | Portada con universidad, oferta, admisiones y contacto. |
| `/universidad`, `/cursos`, `/diplomados`, `/certificaciones`, `/admisiones`, `/contacto` | Entradas públicas. |
| `/programas/[slug]` | Detalle de programa consultado por identificador o slug. |
| `/registro`, `/login`, `/recuperar-password`, `/restablecer-password` | Cuenta y recuperación. |
| `/dashboard` | Redirección al panel que corresponde al perfil. |
| `/dashboard/admin` | Gestión administrativa y superadministrativa según permisos. |
| `/dashboard/admin/asignaciones` | Asignación de roles y cursos. |
| `/dashboard/docente` | Cursos asignados, participantes y acceso al calificador Moodle. |
| `/dashboard/estudiante` | Cursos, solicitudes, avance, expediente y campus. |
| `/dashboard/aspirante` | Oferta y admisiones. |
| `/dashboard/coordinador` | Consulta dentro del ámbito autorizado. |
| `/dashboard/soporte` | Consulta operativa limitada. |

`AuthContext` prioriza superadministrador/administrador, coordinador, profesor, estudiante, soporte y aspirante para la redirección inicial. Un usuario puede tener varios roles. La API decide qué operaciones y datos son realmente accesibles; ocultar botones no concede seguridad.

## Flujos y contratos usados

**Sesión.** `POST /auth/register` y `POST /auth/login` inician el flujo. `GET /auth/me` restaura el perfil y sus roles. `AuthContext` ofrece `user`, `loading`, `login`, `register`, `logout`, `refreshUser`, `hasRole`, `hasPermission` y `getDefaultDashboardPath`. El cliente actual guarda `iinicia_access_token` en `localStorage` y `apiFetch` lo envía como Bearer. Si `/auth/me` falla, se borra el token. El logout borra el token local y vuelve al login; no revoca por sí solo la sesión remota.

**Oferta.** La portada usa `GET /programs`; el detalle usa `GET /programs/:idOrSlug`. `GET /courses/offerings` requiere sesión. `coursesApi` normaliza los campos de la API para las tarjetas.

**Inscripciones.** El estudiante pide acceso con `POST /enrollments`, consulta su estado con `GET /enrollments` y sus cursos autorizados con `GET /courses`. Administración usa `PATCH /enrollments/:id/status` y `POST /enrollments/:id/sync` según permisos. Una solicitud pendiente no confirma matrícula en Moodle.

**Campus.** `POST /moodle/launch` y `POST /moodle/courses/:courseMappingId/launch` devuelven URLs de acceso. `moodle-window.ts` abre una ventana durante el clic y luego la dirige a la URL devuelta. Los permisos y el enlace temporal dependen del backend.

**Avance.** El estudiante consulta `GET /moodle/courses/:courseId/progress`. `grade_percentage` significa calificación y `progress_percentage` significa finalización del curso. La barra usa solo `progress_percentage` y muestra “Progreso no disponible” si vale `null`. `completed_activities` y `total_tracked_activities` muestran el desglose cuando Moodle rastrea actividades. El campo heredado `percentage` no debe alimentar la barra. La API desplegada y Moodle deben tener disponibles el contrato y el seguimiento de finalización.

**Cliente HTTP.** `api.ts` exporta `authApi`, `coursesApi`, `enrollmentsApi`, `admissionsApi`, `contactApi`, `rolesApi`, `auditApi`, `moodleApi`, `programsApi` y `usersApi`. `ApiError` conserva código HTTP y respuesta. Ante `401`, revisa la sesión; ante `403`, el rol, permiso y ámbito. Si no hay cursos, revisa la sesión, la API y las publicaciones/mapeos.

## Identidad visual y tema

`ThemeContext` aplica `light` o `dark` a `html`, guarda la preferencia como `campus-tech-theme` en `localStorage` y usa la preferencia del sistema al inicio si no hay valor guardado. Los colores se definen en `src/app/globals.css`. El logotipo completo de cabecera, menú y pie está en `public/inicia-nav-wordmark.png`; el título de universidad usa `public/universidad-inicia-wordmark.png`.

## Prueba funcional recomendada

1. Ejecuta `npm.cmd run build` y `npm.cmd run lint` y conserva ambos resultados.
2. Revisa portada, programa, navegación móvil y ambos temas.
3. Prueba registro, login, recuperación y perfil con cuentas de prueba.
4. Accede con cada rol; comprueba también que NestJS rechace acciones fuera del rol.
5. Solicita una matrícula, autorízala con cuenta administrativa y verifica el curso en estudiante y Moodle.
6. Completa una actividad con seguimiento Moodle y comprueba que la barra cambie independientemente de la nota.

## Límites actuales

- Los accesos rápidos del login contienen credenciales de desarrollo en el código. Deben aislarse o retirarse antes de publicar el portal.
- El token de acceso se almacena en `localStorage`; falta revisar almacenamiento, renovación y revocación para producción.
- Algunos enlaces Moodle tienen valores de respaldo fijos. Configura `NEXT_PUBLIC_MOODLE_URL` para cada entorno.
- La barra depende del backend desplegado y de la finalización de actividades configurada en Moodle.
- Las vistas de coordinación y soporte requieren cuentas con permisos y ámbito reales para una comprobación completa.
- Las secciones públicas cubren la estructura del portal anterior, pero la migración de textos y archivos necesita inventario editorial.

Cuando cambie un contrato, actualiza `docs/openapi.yaml`, `src/types/index.ts`, `src/lib/api.ts` y la pantalla que consume el dato. Prueba con un rol autorizado y otro denegado.
