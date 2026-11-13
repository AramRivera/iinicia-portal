# Portal IINICIA

Portal institucional en Next.js y React, API modular NestJS, Supabase Auth/PostgreSQL y Moodle como LMS. Este repositorio incluye el código de ambas aplicaciones, migraciones SQL y documentación del proyecto.

## Estado documentado

- Turnstile está integrado en login, registro y recuperación. Su configuración en Cloudflare/Supabase queda pendiente.
- El proyecto exige **un curso completo de prueba en Moodle**. Esta actualización del profesor reemplaza los dos cursos indicados originalmente en el PDF.
- El inicio de sesión requiere TOTP para todos los roles. La API y la web implementan el flujo; la exigencia AAL2 en la Data API remota depende de aplicar y verificar la migración Supabase correspondiente.
- CAPTCHA se envía a Supabase Auth para validar el desafío. Actívalo en Supabase después de configurar `NEXT_PUBLIC_TURNSTILE_SITE_KEY` y la Secret Key del widget.
- La integración y los flujos locales no acreditan que las migraciones, permisos, correo, SSO o el curso estén configurados en los servicios de entrega.

La referencia vigente para pendientes y evidencia es [Estado actual](docs/estado-actual.md). El inventario completo está en el [índice de documentación](docs/README.md).

## Estructura

| Ruta | Contenido |
| --- | --- |
| `apps/web` | Portal Next.js, páginas públicas, autenticación y paneles por rol. |
| `apps/api` | API REST NestJS, autenticación, autorización, Supabase y Moodle. |
| `supabase/migrations` | Migraciones versionadas; revisar el estado y el orden antes de aplicarlas. |
| `docs` | Alcance, contratos, arquitectura, manuales, decisiones y evidencia. |
| `ALCANCE.md` | Requisitos del proyecto y criterios operativos. |

## Inicio local

1. En `apps/api`, instala con `npm ci`, prepara `.env` a partir de `.env.example` y ejecuta `npm run start:dev`.
2. En `apps/web`, instala con `npm ci`, prepara `.env.local` a partir de `.env.example` y ejecuta `npm run dev`.
3. Configura únicamente servicios y cuentas de desarrollo. No copies claves privilegiadas a variables `NEXT_PUBLIC_*` ni publiques archivos `.env`.

Para instrucciones completas de variables, Auth, pruebas de aceptación y límites del entorno, consulta la [guía del frontend](docs/frontend.md), [apps/api/README.md](apps/api/README.md) y [Estado actual](docs/estado-actual.md).

## Accesos de demostración

Los botones de acceso rápido aceptan cuentas definidas localmente en `apps/web/.env.demo.local`, archivo ignorado por Git. Desde `apps/web`, ejecuta `npm run dev:demo`. Los botones rellenan el formulario; el login real sigue pasando por NestJS y exige TOTP. No incluyas credenciales reales ni contraseñas en la documentación.

## Autenticación y Supabase

Consulta [Verificación en dos pasos](docs/autenticacion-dos-factores.md) para el contrato, el flujo TOTP, la migración `20261110120000_require_mfa_data_api.sql` y la evidencia de desarrollo. La migración no debe asumirse aplicada al proyecto remoto. Para datos y RLS, revisa la [política de acceso](docs/decisiones/ADR-001-acceso-supabase.md) y [Políticas RLS](docs/politicas-rls.md).

Para Turnstile, configura primero las claves por ambiente siguiendo la [guía CAPTCHA](docs/captcha-auth.md). La verificación externa solo se activa después de habilitar CAPTCHA en Supabase Auth.

## Moodle y curso de prueba

Moodle conserva la fuente de verdad de cursos, actividades, matrículas académicas, calificaciones y progreso. La entrega requiere un único curso completo de prueba. El nombre, ID y actividades deben confirmarse y validarse en la instancia objetivo; los IDs y semillas históricos no son configuración vigente. Consulta [Estado actual](docs/estado-actual.md#demostración-del-curso-único).
