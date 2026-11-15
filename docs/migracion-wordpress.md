# Migración desde WordPress y Redirecciones 301 — Portal IINICIA

**Fecha de consolidación:** 14 de noviembre de 2026  
**Documentos de referencia:** [Proyecto Rediseño y Migración IINICIA](../Proyecto_Rediseno_Migracion_Portal_IINICIA_React_Moodle.md) (Secciones 12, 18 y 19), [Alcance Vigente](../ALCANCE.md), [Contrato OpenAPI](openapi.yaml).  
**Criterios de aceptación:** `CA-01` (Sustituir WordPress por portal moderno), `CA-02` (Portal opera con React/Next.js y preserva URLs relevantes mediante 301).

---

## 1. Estrategia de Migración y Sustitución Total

La plataforma institucional IINICIA reemplaza de manera definitiva la instalación previa de WordPress por un portal desacoplado de alto rendimiento basado en:
- **Frontend:** Next.js (App Router, Server Components y Tailwind CSS).
- **Backend:** NestJS modular con API REST bajo el prefijo `/api/v1`.
- **Identidad y Base de Datos:** PostgreSQL 16 con Supabase Auth (TOTP AAL2 y RLS).
- **LMS:** Moodle integrado vía Web Services oficiales y autenticación SSO delegada.

### Principios Operativos de la Migración
1. **Sin código heredado:** No se importan ni conservan plugins, temas, constructores visuales (*Elementor/Divi*), shortcodes ni tablas de WordPress (`wp_posts`, `wp_options`, etc.).
2. **Preservación de autoridad SEO:** Toda URL pública o indexada de WordPress que cambie de estructura cuenta con una redirección HTTP 301 permanente registrada en la base de datos y expuesta vía API.
3. **Inventario centralizado y auditable:** El inventario se almacena en la tabla relacional `public.wp_migration_inventory`, protegida mediante Row Level Security (RLS).
4. **Respaldo previo al corte definitivo:** Antes de reasignar los registros DNS del dominio `iinicia.org`, se ejecuta un respaldo completo de la base de datos MySQL/MariaDB de WordPress y su directorio `wp-content/uploads`.

---

## 2. Inventario de Activos y Mapeo de Redirecciones

El inventario de migración clasifica cada recurso legado bajo cuatro acciones estándar (`MIGRAR`, `ACTUALIZAR`, `REESCRIBIR`, `ELIMINAR`):

| URL Legada (WordPress) | Título Legado | Tipo | Acción | Destino en Portal Next.js | Código HTTP | Activo | Notas SEO y Técnicas |
|---|---|---|---|---|---|:---:|---|
| `/` | Portada IINICIA | `page` | `MIGRAR` | `/` | 301 | **No\*** | Portada sustituida por Next.js App Router. Desactivado de redirección para evitar bucles circulares. |
| `/?page_id=1172` | Universidad IINICIA | `page` | `MIGRAR` | `/universidad` | 301 | **Sí** | Página institucional y modelo educativo migrada a ruta estática limpia. |
| `/?page_id=1202` | Cursos IINICIA | `page` | `MIGRAR` | `/cursos` | 301 | **Sí** | Catálogo general de cursos y talleres de capacitación continua. |
| `/?page_id=1652` | Certificaciones IINICIA | `page` | `MIGRAR` | `/certificaciones` | 301 | **Sí** | Oferta de programas de certificación con validez académica. |
| `/?page_id=1653` | Diplomados IINICIA | `page` | `MIGRAR` | `/diplomados` | 301 | **Sí** | Oferta de programas de diplomado de especialización. |
| `/?page_id=16` | Regístrate | `page` | `MIGRAR` | `/registro` | 301 | **Sí** | Formulario legado sustituido por registro con Supabase Auth y validación CAPTCHA. |
| `/?page_id=2179` | Iniciar sesión | `page` | `MIGRAR` | `/login` | 301 | **Sí** | Acceso al campus virtual redirigido a login seguro con verificación TOTP de dos factores. |
| `/contacto/` | Contacto | `page` | `MIGRAR` | `/contacto` | 301 | **Sí** | Formulario de contacto con registro en tabla `contact_messages`. |
| `/admisiones/` | Admisiones | `page` | `MIGRAR` | `/admisiones` | 301 | **Sí** | Convocatoria y postulación académica en línea para aspirantes. |
| `/?page_id=15` | Recuperar Contraseña | `page` | `MIGRAR` | `/recuperar-password` | 301 | **Sí** | Flujo de recuperación mediante enlace PKCE seguro. |
| `/wp-login.php` | WP Login | `system` | `MIGRAR` | `/login` | 301 | **Sí** | Punto de entrada administrativo WP redirigido a login portal para mitigar ataques automatizados. |
| `/wp-admin/` | WP Admin | `system` | `MIGRAR` | `/login` | 301 | **Sí** | Directorio administrativo legado redirigido al portal seguro. |

*\* Nota técnica:* La raíz `/` tiene `is_redirect_active = false` ya que es servida directamente por la ruta raíz de Next.js `apps/web/src/app/page.tsx`.

---

## 3. Modelo de Datos y Seguridad (RLS)

La tabla `public.wp_migration_inventory` cuenta con la siguiente estructura y restricciones:

```sql
CREATE TABLE public.wp_migration_inventory (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    legacy_url text NOT NULL UNIQUE,
    legacy_title text,
    asset_type text DEFAULT 'page'::text NOT NULL,
    action public.wp_migration_action DEFAULT 'MIGRAR'::public.wp_migration_action NOT NULL,
    new_target_url text,
    http_redirect_code smallint DEFAULT 301,
    is_redirect_active boolean DEFAULT true NOT NULL,
    migration_completed boolean DEFAULT false NOT NULL,
    seo_notes text,
    verified_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
    verified_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT wp_migration_inventory_http_redirect_code_check 
        CHECK (http_redirect_code = ANY (ARRAY[301, 302, 307, 308, 410]))
);

CREATE INDEX idx_wp_migration_legacy_url 
    ON public.wp_migration_inventory (legacy_url) 
    WHERE (is_redirect_active = true);
```

### Políticas RLS Aplicadas
- **Lectura Pública (`wp_migration_select_public_redirects`):**  
  Permite a clientes anónimos (`anon`) y autenticados (`authenticated`) consultar únicamente los registros con `is_redirect_active = true` (o cualquier registro si el usuario tiene rol de administración).
- **Gestión Administrativa (`wp_migration_admin_manage`):**  
  Restringe inserciones, modificaciones y borrados exclusivamente a usuarios con rol `administrador` o `superadministrador` (`public.is_admin() = true`). Los clientes anónimos no pueden alterar el inventario ni inyectar destinos maliciosos.

---

## 4. Endpoint de la API REST

### `GET /api/v1/migration/redirects`
- **Autenticación:** Pública (no requiere Bearer token).
- **Descripción:** Devuelve la lista plana de mapeos activos para el middleware o proxies inversos.
- **Respuesta HTTP 200 (JSON):**
```json
[
  {
    "legacy_url": "/?page_id=1172",
    "new_target_url": "/universidad",
    "http_redirect_code": 301
  },
  {
    "legacy_url": "/?page_id=1202",
    "new_target_url": "/cursos",
    "http_redirect_code": 301
  },
  {
    "legacy_url": "/?page_id=1652",
    "new_target_url": "/certificaciones",
    "http_redirect_code": 301
  },
  {
    "legacy_url": "/?page_id=1653",
    "new_target_url": "/diplomados",
    "http_redirect_code": 301
  },
  {
    "legacy_url": "/?page_id=16",
    "new_target_url": "/registro",
    "http_redirect_code": 301
  },
  {
    "legacy_url": "/?page_id=2179",
    "new_target_url": "/login",
    "http_redirect_code": 301
  },
  {
    "legacy_url": "/contacto/",
    "new_target_url": "/contacto",
    "http_redirect_code": 301
  },
  {
    "legacy_url": "/admisiones/",
    "new_target_url": "/admisiones",
    "http_redirect_code": 301
  },
  {
    "legacy_url": "/?page_id=15",
    "new_target_url": "/recuperar-password",
    "http_redirect_code": 301
  },
  {
    "legacy_url": "/wp-login.php",
    "new_target_url": "/login",
    "http_redirect_code": 301
  },
  {
    "legacy_url": "/wp-admin/",
    "new_target_url": "/login",
    "http_redirect_code": 301
  }
]
```

---

## 5. Contrato de Integración para el Frontend (Next.js)

> [!NOTE]
> De conformidad con `AGENTS.md`, el backend no modifica directamente `apps/web/src/**`. El responsable de frontend puede implementar la ejecución de redirecciones utilizando este contrato.

### Opción A · Middleware de Next.js (`apps/web/src/middleware.ts`)

```typescript
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

interface RedirectEntry {
  legacy_url: string;
  new_target_url: string;
  http_redirect_code: number;
}

// Mapa estático de respaldo o cargado en tiempo de compilación/inicio
const STATIC_FALLBACK_REDIRECTS: Record<string, string> = {
  '/?page_id=1172': '/universidad',
  '/?page_id=1202': '/cursos',
  '/?page_id=1652': '/certificaciones',
  '/?page_id=1653': '/diplomados',
  '/?page_id=16': '/registro',
  '/?page_id=2179': '/login',
  '/contacto/': '/contacto',
  '/admisiones/': '/admisiones',
  '/?page_id=15': '/recuperar-password',
  '/wp-login.php': '/login',
  '/wp-admin/': '/login',
};

export async function middleware(request: NextRequest) {
  const url = request.nextUrl;
  const requestPathWithQuery = `${url.pathname}${url.search}`;

  // 1. Comprobación directa de ruta exacta o con query string
  const target = STATIC_FALLBACK_REDIRECTS[requestPathWithQuery] || STATIC_FALLBACK_REDIRECTS[url.pathname];

  if (target) {
    const redirectUrl = new URL(target, request.url);
    return NextResponse.redirect(redirectUrl, { status: 301 });
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Coincidir con solicitudes que no sean archivos estáticos ni imágenes:
     */
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
};
```

### Opción B · Configuración en `next.config.ts` (Build Time)

```typescript
// En next.config.ts
const nextConfig = {
  async redirects() {
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1';
      const res = await fetch(`${apiUrl}/migration/redirects`, { next: { revalidate: 3600 } });
      if (!res.ok) return [];
      const redirects: Array<{ legacy_url: string; new_target_url: string; http_redirect_code: number }> = await res.json();
      
      return redirects
        .filter(r => r.legacy_url !== r.new_target_url && !r.legacy_url.includes('?'))
        .map(r => ({
          source: r.legacy_url,
          destination: r.new_target_url,
          permanent: r.http_redirect_code === 301,
        }));
    } catch {
      return [];
    }
  },
};
```

---

## 6. Procedimiento de Corte y Verificación de Producción

1. **Paso 1 · Congelar contenido en WordPress:** Activar modo de mantenimiento o deshabilitar comentarios y altas de usuarios en WordPress.
2. **Paso 2 · Generar respaldo final:**
   ```bash
   mysqldump -u wp_user -p wp_iinicia > /backups/iinicia_wp_final_backup_20261114.sql
   tar -czf /backups/iinicia_wp_uploads_20261114.tar.gz /var/www/html/wordpress/wp-content/uploads
   ```
3. **Paso 3 · Validar despliegue de Portal IINICIA:** Verificar que los servicios en Docker (`iinicia-api`, `iinicia-web`, `iinicia-db`, `iinicia-auth`, `iinicia-rest`, `iinicia-mail`) respondan a sus respectivos healthchecks con HTTP 200.
4. **Paso 4 · Cambiar registros DNS:** Apuntar el dominio `iinicia.org` a la IP pública del nuevo servidor con proxy inverso HTTPS (Caddy/Nginx).
5. **Paso 5 · Prueba de humo de Redirecciones 301:**
   ```bash
   curl -I https://iinicia.org/?page_id=1172 | grep -E "HTTP|Location"
   # Esperado:
   # HTTP/2 301
   # location: /universidad
   ```
6. **Paso 6 · Desmantelamiento:** Detener el servicio PHP/Apache de WordPress tras 7 días de estabilidad post-corte.
