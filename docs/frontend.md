# Frontend INICIA — guía vigente

Revisión del código: 13 de noviembre de 2026 (`codex/captcha-auth`). Esta guía describe `apps/web` y el modo de demostración incluido en el repositorio. Los ejemplos históricos de [frontend-integration-guide.md](frontend-integration-guide.md) y [manual-portales-y-paginas.md](manual-portales-y-paginas.md) pueden estar desactualizados. Consulta [openapi.yaml](openapi.yaml) para el contrato y la [bitácora](bitacora-proyecto.md) para el historial de cambios.

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

En `apps/web`, ejecuta `npm ci`, copia `.env.example` a `.env.local` si no existe y ejecuta `npm run dev`. Abre <http://localhost:4000>. En PowerShell puedes usar `npm.cmd` en lugar de `npm`. `Ctrl+C` detiene el servidor. Reinícialo al modificar variables.

| Variable | Uso |
| --- | --- |
| `NEXT_PUBLIC_API_URL` | Base de NestJS con `/api/v1`. Si falta, el código usa `http://localhost:3000/api/v1`. Para otros ambientes, define la URL correspondiente en la configuración local. |
| `NEXT_PUBLIC_MOODLE_URL` | Base de Moodle accesible desde el navegador; configúrala por ambiente después de confirmar la URL real. |
| `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Están en `.env.example`, pero el frontend actual autentica a través de NestJS y no importa el SDK de Supabase. Nunca pongas claves secretas aquí. |

El puerto 4000 corresponde a Next.js; el 3000 en los ejemplos corresponde a NestJS. Comprueba la API en `<NEXT_PUBLIC_API_URL>/health` y la documentación en `<NEXT_PUBLIC_API_URL>/docs`. `.env.local` se mantiene local, fuera de Git.

Para producción: `npm.cmd run build` seguido de `npm.cmd run start`. Para el análisis estático: `npm.cmd run lint`. El build verifica compilación y TypeScript; no equivale al resultado del lint ni a pruebas de integración.

### Accesos rápidos de prueba

El iniciador y los botones están incluidos en `main`. Crea `apps/web/.env.demo.local` con las cuentas de tu entorno de pruebas. El archivo está ignorado por Git.

```dotenv
NEXT_PUBLIC_DEMO_ACCOUNTS='[{"label":"Estudiante","email":"estudiante@example.test","password":"CONTRASENA_DE_PRUEBA"}]'
```

Desde `apps/web`, ejecuta `npm run dev:demo` y abre <http://127.0.0.1:4000/login>. Si ya hay un servidor en el puerto 4000, detenlo antes. Los botones rellenan el formulario con las cuentas de prueba cargadas en el navegador. El inicio de sesión sigue pasando por la API y exige TOTP.

### Demo por ZeroTier

Inicia el portal con la IP de ZeroTier del equipo que ejecuta Next.js y con la URL de la API de pruebas accesible desde los navegadores del equipo.

```bash
npm run dev:demo -- --hostname 127.0.0.1 --port 4000 --api-url http://192.168.191.171:4527/api/v1
npm run dev:demo -- --hostname 192.168.191.171 --port 4007 --api-url http://192.168.191.171:4527/api/v1
```

En la misma máquina, abre <http://localhost:4000/login>. El equipo por ZeroTier abre <http://192.168.191.171:4007/login>. Los dos procesos usan el mismo código fuente y comparten cuentas configuradas en el archivo local. Next.js genera carpetas de desarrollo separadas por puerto para que puedan correr a la vez. Comparte este modo únicamente con el equipo autorizado para las cuentas de prueba, porque Next.js entrega sus credenciales al navegador. La API debe incluir `http://localhost:4000`, `http://127.0.0.1:4000` y `http://192.168.191.171:4007` en `CORS_ORIGIN`. Para probar enlaces de correo, establece `FRONTEND_URL=http://192.168.191.171:4007` y permite esa ruta en la lista de redirecciones de Supabase.

El iniciador carga `.env.demo.local` con `process.loadEnvFile()` para evitar el error `--env-file= is not allowed in NODE_OPTIONS`. Las dos instancias usan directorios Next aislados por puerto para evitar colisiones.

## Mapa de páginas

| Ruta | Uso |
| --- | --- |
| `/` | Portada con universidad, oferta, admisiones y contacto. |
| `/universidad`, `/cursos`, `/diplomados`, `/certificaciones`, `/admisiones`, `/contacto` | Entradas públicas. |
| `/programas/[slug]` | Detalle de programa consultado por identificador o slug. |
| `/registro`, `/confirmar-correo`, `/login`, `/recuperar-password`, `/restablecer-password` | Cuenta, confirmación y recuperación. |
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

**Sesión.** `POST /auth/register` inicia el alta. `POST /auth/login` valida la contraseña y entrega la continuación para el autenticador. `POST /auth/mfa/verify` completa el inicio con TOTP y `GET /auth/me` carga el perfil y sus roles. El cliente conserva en memoria la continuación AAL1 y guarda `iinicia_access_token` en `localStorage` después de verificar la sesión AAL2. `apiFetch` lo envía como Bearer. Si `/auth/me` falla, se borra el token. El logout borra el token local y vuelve al login. Consulta la [guía de verificación en dos pasos](autenticacion-dos-factores.md).

**CAPTCHA.** Si `NEXT_PUBLIC_TURNSTILE_SITE_KEY` está configurada, las vistas de login, registro y recuperación presentan Turnstile y envían el token al backend en `captcha_token`. El token es de un solo uso, así que el portal solicita uno nuevo después de cada intento. La [guía de CAPTCHA](captcha-auth.md) describe Cloudflare y Supabase.

**Oferta.** La portada usa `GET /programs`; el detalle usa `GET /programs/:idOrSlug`. `GET /courses/offerings` requiere sesión. `coursesApi` normaliza los campos de la API para las tarjetas.

**Inscripciones.** `POST /enrollments` registra las solicitudes propias como pendientes y con rol de estudiante. Administración puede asignar un curso a otra cuenta con el permiso y ámbito correspondientes, aprobar solicitudes con `PATCH /enrollments/:id/status` y reintentar la sincronización con `POST /enrollments/:id/sync`. La interfaz distingue entre autorización y confirmación de Moodle.

**Campus.** `POST /moodle/launch` y `POST /moodle/courses/:courseMappingId/launch` devuelven URLs de acceso. `moodle-window.ts` abre una ventana durante el clic y luego la dirige a la URL devuelta. Los permisos y el enlace temporal dependen del backend.

**Avance.** El estudiante consulta `GET /moodle/courses/:courseId/progress`. `grade_percentage` significa calificación y `progress_percentage` significa finalización del curso. La barra usa solo `progress_percentage` y muestra “Progreso no disponible” si vale `null`. `completed_activities` y `total_tracked_activities` muestran el desglose cuando Moodle rastrea actividades. El campo heredado `percentage` no debe alimentar la barra. La API desplegada y Moodle deben tener disponibles el contrato y el seguimiento de finalización.

**Cliente HTTP.** `api.ts` exporta `authApi`, `coursesApi`, `enrollmentsApi`, `admissionsApi`, `contactApi`, `rolesApi`, `auditApi`, `moodleApi`, `programsApi` y `usersApi`. `ApiError` conserva código HTTP y respuesta. Ante `401`, revisa la sesión; ante `403`, el rol, permiso y ámbito. Si no hay cursos, revisa la sesión, la API y las publicaciones/mapeos.

**Recuperación de acceso.** El portal usa el enlace estándar de Supabase con PKCE. En Supabase Auth agrega la URL exacta de `/restablecer-password` a las redirecciones permitidas y mantén la plantilla estándar **Reset Password** con `{{ .ConfirmationURL }}`. Usa en el navegador el mismo origen configurado en `FRONTEND_URL`. `localhost` y `127.0.0.1` cuentan como orígenes distintos.

Solicita el correo desde `/recuperar-password` y abre el enlace en ese mismo navegador. El portal guarda un verificador temporal y la API intercambia el código con Supabase. Si la cuenta ya tiene un autenticador registrado, se solicita su código antes de cambiar la contraseña. La API también acepta una plantilla personalizada con `token_hash`. [Recuperación de Supabase Auth](https://supabase.com/docs/reference/javascript/auth-resetpasswordforemail).

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

- El token de acceso se almacena en `localStorage`; falta revisar almacenamiento, renovación y revocación para producción.
- Algunos enlaces Moodle tienen valores de respaldo fijos. Configura `NEXT_PUBLIC_MOODLE_URL` para cada entorno.
- La barra depende del backend desplegado y de la finalización de actividades configurada en Moodle.
- Las vistas de coordinación y soporte requieren cuentas con permisos y ámbito reales para una comprobación completa.
- Las secciones públicas cubren la estructura del portal anterior, pero la migración de textos y archivos necesita inventario editorial.
- El código de interfaz no acredita por sí solo pruebas de accesibilidad, contenido aprobado ni conexión real a Moodle/Supabase.

Cuando cambie un contrato, actualiza `docs/openapi.yaml`, `src/types/index.ts`, `src/lib/api.ts` y la pantalla que consume el dato. Prueba con un rol autorizado y otro denegado.
