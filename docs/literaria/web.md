# Portal y pruebas

Las páginas componen la interfaz. Las bibliotecas compartidas documentan el contrato con la API y las reglas para tratar datos y enlaces.

## apps/web

Archivos de este componente y su configuración.

### apps/web/Dockerfile

<!-- archivo: apps/web/Dockerfile -->
```dockerfile
# IINICIA Portal · portal Next.js · Dockerfile
# Compila Next.js con las variables públicas del portal y prepara su imagen de ejecución.
# Multi-stage Dockerfile para Next.js Portal (IINICIA)
# Etapa 1: Dependencias
FROM node:22-alpine AS deps

WORKDIR /app

RUN apk add --no-cache libc6-compat

COPY package.json package-lock.json* ./
RUN npm ci

# Etapa 2: Construcción
FROM node:22-alpine AS builder

WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Argumentos para variables públicas en el empaquetado de producción
ARG NEXT_PUBLIC_API_URL=http://localhost:3000/api/v1
ARG NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
ARG NEXT_PUBLIC_MOODLE_URL=http://localhost/moodle
ARG NEXT_PUBLIC_TURNSTILE_SITE_KEY=

ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL
ENV NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY
ENV NEXT_PUBLIC_MOODLE_URL=$NEXT_PUBLIC_MOODLE_URL
ENV NEXT_PUBLIC_TURNSTILE_SITE_KEY=$NEXT_PUBLIC_TURNSTILE_SITE_KEY

ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

RUN npm run build

# Etapa 3: Imagen de producción
FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=4000

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json

RUN chown -R nextjs:nodejs ./.next

USER nextjs

EXPOSE 4000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:4000/ || exit 1

CMD ["npm", "start"]

```

### apps/web/eslint.config.mjs

<!-- archivo: apps/web/eslint.config.mjs -->
```javascript
// IINICIA Portal · portal Next.js · eslint.config.mjs
/** Configura las reglas de Next.js y TypeScript para el análisis del frontend. */
import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    ".next-demo-*/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;

```

### apps/web/next.config.ts

<!-- archivo: apps/web/next.config.ts -->
```typescript
// IINICIA Portal · portal Next.js · next.config.ts
/** Configura la compilación de Next.js y las reglas de Turbopack para los estilos. */
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  /** Configura las cabeceras globales que limitan el encuadre, el envío del referente y la interpretación de tipos MIME. */
  async headers() {
    return [{
      source: "/:path*",
      headers: [
        { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "Referrer-Policy", value: "no-referrer" },
        { key: "X-Frame-Options", value: "DENY" },
      ],
    }];
  },
  distDir: process.env.NEXT_DIST_DIR || ".next",
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      // La salida del loader es CSS global. Los módulos deben conservar su procesamiento nativo.
      "globals.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;

```

### apps/web/package.json

Agrupa los comandos del portal y las dependencias usadas por Next.js y las pruebas.

<!-- archivo: apps/web/package.json -->
```json
{
  "name": "web",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev -p 4000",
    "dev:demo": "node scripts/dev-demo.cjs",
    "build": "next build",
    "start": "next start --port ${PORT:-4000}",
    "lint": "eslint",
    "test": "node --test test/*.test.mjs"
  },
  "dependencies": {
    "next": "16.4.6",
    "react": "19.3.0",
    "react-dom": "19.3.0"
  },
  "devDependencies": {
    "@tailwindcss/turbopack": "^4",
    "@types/node": "^20",
    "@types/react": "^19",
    "@types/react-dom": "^19",
    "eslint": "^9",
    "eslint-config-next": "16.4.6",
    "tailwindcss": "^4",
    "typescript": "^5"
  }
}

```

### apps/web/tsconfig.json

Define cómo TypeScript comprueba el portal y resuelve sus rutas de importación.

<!-- archivo: apps/web/tsconfig.json -->
```json
{
  "compilerOptions": {
    "target": "ES2017",
    "lib": [
      "dom",
      "dom.iterable",
      "esnext"
    ],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "react-jsx",
    "incremental": true,
    "plugins": [
      {
        "name": "next"
      }
    ],
    "paths": {
      "@/*": [
        "./src/*"
      ]
    }
  },
  "include": [
    "next-env.d.ts",
    "**/*.ts",
    "**/*.tsx",
    ".next/types/**/*.ts",
    ".next/dev/types/**/*.ts",
    "**/*.mts",
    ".next-demo-4007/types/**/*.ts",
    ".next-demo-4007/dev/types/**/*.ts",
    ".next-demo-4000/types/**/*.ts",
    ".next-demo-4000/dev/types/**/*.ts",
    ".next-demo-remote-4000/types/**/*.ts",
    ".next-demo-remote-4000/dev/types/**/*.ts",
    ".next-demo-remote-4007/types/**/*.ts",
    ".next-demo-remote-4007/dev/types/**/*.ts"
  ],
  "exclude": [
    "node_modules"
  ]
}

```

## apps/web/public

Archivos de este componente y su configuración.

### apps/web/public/file.svg

<!-- archivo: apps/web/public/file.svg -->
```xml
<svg fill="none" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg"><path d="M14.5 13.5V5.41a1 1 0 0 0-.3-.7L9.8.29A1 1 0 0 0 9.08 0H1.5v13.5A2.5 2.5 0 0 0 4 16h8a2.5 2.5 0 0 0 2.5-2.5m-1.5 0v-7H8v-5H3v12a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1M9.5 5V2.12L12.38 5zM5.13 5h-.62v1.25h2.12V5zm-.62 3h7.12v1.25H4.5zm.62 3h-.62v1.25h7.12V11z" clip-rule="evenodd" fill="#666" fill-rule="evenodd"/></svg>
```

### apps/web/public/globe.svg

<!-- archivo: apps/web/public/globe.svg -->
```xml
<svg fill="none" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><g clip-path="url(#a)"><path fill-rule="evenodd" clip-rule="evenodd" d="M10.27 14.1a6.5 6.5 0 0 0 3.67-3.45q-1.24.21-2.7.34-.31 1.83-.97 3.1M8 16A8 8 0 1 0 8 0a8 8 0 0 0 0 16m.48-1.52a7 7 0 0 1-.96 0H7.5a4 4 0 0 1-.84-1.32q-.38-.89-.63-2.08a40 40 0 0 0 3.92 0q-.25 1.2-.63 2.08a4 4 0 0 1-.84 1.31zm2.94-4.76q1.66-.15 2.95-.43a7 7 0 0 0 0-2.58q-1.3-.27-2.95-.43a18 18 0 0 1 0 3.44m-1.27-3.54a17 17 0 0 1 0 3.64 39 39 0 0 1-4.3 0 17 17 0 0 1 0-3.64 39 39 0 0 1 4.3 0m1.1-1.17q1.45.13 2.69.34a6.5 6.5 0 0 0-3.67-3.44q.65 1.26.98 3.1M8.48 1.5l.01.02q.41.37.84 1.31.38.89.63 2.08a40 40 0 0 0-3.92 0q.25-1.2.63-2.08a4 4 0 0 1 .85-1.32 7 7 0 0 1 .96 0m-2.75.4a6.5 6.5 0 0 0-3.67 3.44 29 29 0 0 1 2.7-.34q.31-1.83.97-3.1M4.58 6.28q-1.66.16-2.95.43a7 7 0 0 0 0 2.58q1.3.27 2.95.43a18 18 0 0 1 0-3.44m.17 4.71q-1.45-.12-2.69-.34a6.5 6.5 0 0 0 3.67 3.44q-.65-1.27-.98-3.1" fill="#666"/></g><defs><clipPath id="a"><path fill="#fff" d="M0 0h16v16H0z"/></clipPath></defs></svg>
```

### apps/web/public/next.svg

<!-- archivo: apps/web/public/next.svg -->
```xml
<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 394 80"><path fill="#000" d="M262 0h68.5v12.7h-27.2v66.6h-13.6V12.7H262V0ZM149 0v12.7H94v20.4h44.3v12.6H94v21h55v12.6H80.5V0h68.7zm34.3 0h-17.8l63.8 79.4h17.9l-32-39.7 32-39.6h-17.9l-23 28.6-23-28.6zm18.3 56.7-9-11-27.1 33.7h17.8l18.3-22.7z"/><path fill="#000" d="M81 79.3 17 0H0v79.3h13.6V17l50.2 62.3H81Zm252.6-.4c-1 0-1.8-.4-2.5-1s-1.1-1.6-1.1-2.6.3-1.8 1-2.5 1.6-1 2.6-1 1.8.3 2.5 1a3.4 3.4 0 0 1 .6 4.3 3.7 3.7 0 0 1-3 1.8zm23.2-33.5h6v23.3c0 2.1-.4 4-1.3 5.5a9.1 9.1 0 0 1-3.8 3.5c-1.6.8-3.5 1.3-5.7 1.3-2 0-3.7-.4-5.3-1s-2.8-1.8-3.7-3.2c-.9-1.3-1.4-3-1.4-5h6c.1.8.3 1.6.7 2.2s1 1.2 1.6 1.5c.7.4 1.5.5 2.4.5 1 0 1.8-.2 2.4-.6a4 4 0 0 0 1.6-1.8c.3-.8.5-1.8.5-3V45.5zm30.9 9.1a4.4 4.4 0 0 0-2-3.3 7.5 7.5 0 0 0-4.3-1.1c-1.3 0-2.4.2-3.3.5-.9.4-1.6 1-2 1.6a3.5 3.5 0 0 0-.3 4c.3.5.7.9 1.3 1.2l1.8 1 2 .5 3.2.8c1.3.3 2.5.7 3.7 1.2a13 13 0 0 1 3.2 1.8 8.1 8.1 0 0 1 3 6.5c0 2-.5 3.7-1.5 5.1a10 10 0 0 1-4.4 3.5c-1.8.8-4.1 1.2-6.8 1.2-2.6 0-4.9-.4-6.8-1.2-2-.8-3.4-2-4.5-3.5a10 10 0 0 1-1.7-5.6h6a5 5 0 0 0 3.5 4.6c1 .4 2.2.6 3.4.6 1.3 0 2.5-.2 3.5-.6 1-.4 1.8-1 2.4-1.7a4 4 0 0 0 .8-2.4c0-.9-.2-1.6-.7-2.2a11 11 0 0 0-2.1-1.4l-3.2-1-3.8-1c-2.8-.7-5-1.7-6.6-3.2a7.2 7.2 0 0 1-2.4-5.7 8 8 0 0 1 1.7-5 10 10 0 0 1 4.3-3.5c2-.8 4-1.2 6.4-1.2 2.3 0 4.4.4 6.2 1.2 1.8.8 3.2 2 4.3 3.4 1 1.4 1.5 3 1.5 5h-5.8z"/></svg>
```

### apps/web/public/vercel.svg

<!-- archivo: apps/web/public/vercel.svg -->
```xml
<svg fill="none" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1155 1000"><path d="m577.3 0 577.4 1000H0z" fill="#fff"/></svg>
```

### apps/web/public/window.svg

<!-- archivo: apps/web/public/window.svg -->
```xml
<svg fill="none" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><path fill-rule="evenodd" clip-rule="evenodd" d="M1.5 2.5h13v10a1 1 0 0 1-1 1h-11a1 1 0 0 1-1-1zM0 1h16v11.5a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 0 12.5zm3.75 4.5a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5M7 4.75a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0m1.75.75a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5" fill="#666"/></svg>
```

## apps/web/scripts

Archivos de este componente y su configuración.

### apps/web/scripts/dev-demo.cjs

<!-- archivo: apps/web/scripts/dev-demo.cjs -->
```javascript
// IINICIA Portal · portal Next.js · dev-demo.cjs
/** Arranca la demo local o compartida con su configuración de red y un directorio de compilación propio. */
/* eslint-disable @typescript-eslint/no-require-imports */
const { spawn } = require('node:child_process');
const { isIPv4 } = require('node:net');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { parseArgs, parseEnv } = require('node:util');

let options;
try {
  ({ values: options } = parseArgs({
    options: {
      hostname: { type: 'string', default: '127.0.0.1' },
      port: { type: 'string', default: '4000' },
      'api-url': { type: 'string' },
      lab: { type: 'boolean', default: false },
    },
  }));
} catch (error) {
  console.error(error.message);
  console.error('Uso: npm run dev:demo -- [--lab] [--hostname IP] [--port PUERTO] [--api-url URL]');
  process.exit(1);
}

const { hostname, port, 'api-url': apiUrl, lab } = options;
const shared = hostname !== '127.0.0.1';
const webDir = join(__dirname, '..');

if (!isIPv4(hostname) || !/^\d+$/.test(port) || Number(port) < 1 || Number(port) > 65535) {
  console.error('Indica una IPv4 local, 0.0.0.0 para varias interfaces y un puerto válido.');
  process.exit(1);
}

const envFile = lab ? '.env.demo.lab.local' : '.env.demo.local';
let demoEnv;
try {
  demoEnv = parseEnv(readFileSync(join(webDir, envFile), 'utf8'));
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
  console.error(`Crea apps/web/${envFile} con las cuentas de prueba.`);
  process.exit(1);
}

let localEnv = {};
try {
  localEnv = parseEnv(readFileSync(join(webDir, '.env.local'), 'utf8'));
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
}
// Las variables de la demo prevalecen sobre el entorno local. El argumento --api-url puede reemplazar la URL resultante.
const env = { ...process.env, ...localEnv, ...demoEnv };
if (apiUrl) env.NEXT_PUBLIC_API_URL = apiUrl;
if ((shared || lab) && !env.NEXT_PUBLIC_API_URL) {
  console.error('Indica la URL de la API de pruebas con --api-url o en el archivo de demo.');
  process.exit(1);
}
if (shared && !apiUrl && !demoEnv.NEXT_PUBLIC_API_URL) {
  console.error('Para ZeroTier indica --api-url con la dirección accesible de la API.');
  process.exit(1);
}
// Aísla la compilación de la demo por perfil y puerto para que no comparta su caché con el arranque habitual.
env.NEXT_DIST_DIR = `.next-demo-${lab ? 'lab' : 'remote'}-${port}`;
console.log(`Demo ${lab ? 'laboratorio' : 'Supabase configurado en la API'} · API: ${env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1'}`);

const server = spawn(process.execPath, [
  require.resolve('next/dist/bin/next'),
  'dev',
  '--hostname', hostname,
  '--port', port,
], { cwd: webDir, env, stdio: 'inherit' });

server.on('error', (error) => {
  console.error('No fue posible iniciar Next.js:', error.message);
  process.exitCode = 1;
});

server.on('exit', (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  else process.exitCode = code;
});

```

## apps/web/src/app

El enrutador de Next.js carga las vistas públicas y los paneles. La API decide los permisos de los recursos protegidos.

### apps/web/src/app/admisiones/page.tsx

<!-- archivo: apps/web/src/app/admisiones/page.tsx -->
```tsx
// IINICIA Portal · portal Next.js · page.tsx
/** Conserva la URL de admisiones y dirige al visitante a esa sección de la portada. */
import { redirect } from 'next/navigation';

/** Conserva la ruta pública de admisiones y la dirige a la sección correspondiente de la portada. */
export default function AdmisionesPage() {
  redirect('/#admisiones');
}

```

### apps/web/src/app/certificaciones/page.tsx

<!-- archivo: apps/web/src/app/certificaciones/page.tsx -->
```tsx
// IINICIA Portal · portal Next.js · page.tsx
/** Dirige al visitante a las certificaciones publicadas en la portada. */
import { redirect } from 'next/navigation';

/** Mantiene una dirección pública estable para la sección de certificaciones de la portada. */
export default function CertificacionesPage() {
  redirect('/#certificaciones');
}

```

### apps/web/src/app/confirmar-correo/page.tsx

<!-- archivo: apps/web/src/app/confirmar-correo/page.tsx -->
```tsx
// IINICIA Portal · portal Next.js · page.tsx
/** Interpreta el resultado del enlace de verificación de correo y orienta al usuario hacia el inicio de sesión. */
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

type Confirmation = 'checking' | 'confirmed' | 'invalid';

/** Presenta el resultado de la confirmación de correo y ofrece continuar hacia el inicio de sesión. */
export default function ConfirmarCorreoPage() {
  const [confirmation, setConfirmation] = useState<Confirmation>('checking');

  // Interpreta el retorno del flujo de correo una vez disponible la URL del navegador.
  useEffect(() => {
    // El enlace de Supabase confirma el correo antes de redirigir a esta página.
    // El portal retira el fragmento sin conservar la sesión del enlace.
    const timer = window.setTimeout(() => {
      const result = new URLSearchParams(window.location.hash.slice(1));
      const confirmed = result.get('type') === 'signup' && result.has('access_token');
      window.history.replaceState(null, '', window.location.pathname);
      setConfirmation(confirmed ? 'confirmed' : 'invalid');
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <div className="grid min-h-[70vh] place-items-center bg-aurora px-4 py-12">
      <div className="w-full max-w-md rounded-3xl border border-border bg-surface p-7 shadow-panel">
        <h1 className="text-2xl font-bold">Confirmación de correo</h1>
        <div className="mt-4 space-y-3 text-sm" role="status">
          {confirmation === 'checking' && <p>Verificando el enlace…</p>}
          {confirmation === 'confirmed' && (
            <>
              <p>Tu correo quedó confirmado. Ya puedes iniciar sesión.</p>
              <Link href="/login" className="font-semibold text-primary underline">
                Ir a iniciar sesión
              </Link>
            </>
          )}
          {confirmation === 'invalid' && (
            <>
              <p>El enlace no está disponible o ya fue usado. Si confirmaste tu correo antes, puedes iniciar sesión.</p>
              <Link href="/login" className="font-semibold text-primary underline">
                Ir a iniciar sesión
              </Link>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

```

### apps/web/src/app/contacto/page.tsx

<!-- archivo: apps/web/src/app/contacto/page.tsx -->
```tsx
// IINICIA Portal · portal Next.js · page.tsx
/** Conserva el acceso directo a la sección pública de contacto. */
import { redirect } from 'next/navigation';

/** Traslada la ruta pública antigua de contacto a la sección de contacto en la portada. */
export default function ContactoPage() {
  redirect('/#contacto');
}

```

### apps/web/src/app/cursos/page.tsx

<!-- archivo: apps/web/src/app/cursos/page.tsx -->
```tsx
// IINICIA Portal · portal Next.js · page.tsx
/** Dirige al catálogo de cursos que se muestra en la portada. */
import { redirect } from 'next/navigation';

/** Conserva el enlace a la oferta de cursos y lo dirige al catálogo dentro de la portada. */
export default function CursosPage() {
  redirect('/#cursos');
}

```

### apps/web/src/app/dashboard/admin/asignaciones/page.tsx

<!-- archivo: apps/web/src/app/dashboard/admin/asignaciones/page.tsx -->
```tsx
// IINICIA Portal · administración · page.tsx
/** Reúne las operaciones de asignación académica y revocación de matrículas desde administración. */
'use client';

import React, { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { usersApi, coursesApi, rolesApi, enrollmentsApi, moodleApi } from '@/lib/api';
import type { UserProfile, CourseOffering, RoleItem, EnrollmentRequest } from '@/types';
import { CampusShell } from '@/components/campus-tech/CampusShell';
import { MoodleSyncBadge } from '@/components/moodle/MoodleSyncBadge';
import {
  IconStudents,
  IconTeachers,
  IconGroups,
  IconShield,
  IconSearch,
  IconPlus,
  IconCheck,
  IconAlertTriangle,
  IconClose,
  IconRefresh,
  IconExternalLink,
} from '@/components/campus-tech/Icons';

/** Carga el directorio administrativo y las asignaciones disponibles para gestionar la relación de usuarios con cursos. */
export default function AsignacionesPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  const [users, setUsers] = useState<UserProfile[]>([]);
  const [courses, setCourses] = useState<CourseOffering[]>([]);
  const [roles, setRoles] = useState<RoleItem[]>([]);
  const [enrollments, setEnrollments] = useState<EnrollmentRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Filtros
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('todos');
  const [statusFilter, setStatusFilter] = useState('todos');

  // Notificaciones
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Modales
  const [assignCourseUser, setAssignCourseUser] = useState<UserProfile | null>(null);
  const [selectedCourseId, setSelectedCourseId] = useState('');
  const [selectedMoodleRole, setSelectedMoodleRole] = useState<'student' | 'teacher'>('student');
  const [assignNotes, setAssignNotes] = useState('');

  const [roleTargetUser, setRoleTargetUser] = useState<UserProfile | null>(null);
  const [selectedRoleId, setSelectedRoleId] = useState('');

  const [unenrollTarget, setUnenrollTarget] = useState<{
    enrollmentId: string;
    userName: string;
    courseName: string;
  } | null>(null);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [usersRes, coursesData, rolesData, enrollmentsData] = await Promise.allSettled([
        usersApi.getUsers({ limit: 100 }),
        coursesApi.getCatalog(),
        rolesApi.getRoles(),
        enrollmentsApi.getAllEnrollments(),
      ]);
      if (usersRes.status === 'fulfilled') setUsers(usersRes.value.data);
      if (coursesData.status === 'fulfilled') setCourses(coursesData.value);
      if (rolesData.status === 'fulfilled') setRoles(rolesData.value);
      if (enrollmentsData.status === 'fulfilled') setEnrollments(enrollmentsData.value);
      if ([usersRes, coursesData, rolesData, enrollmentsData].some((result) => result.status === 'rejected')) {
        setError('No se pudo actualizar toda la información de asignaciones. Pulsa Actualizar para reintentar.');
      }

    } catch (err: any) {
      setError(err.message || 'Error al cargar datos de asignaciones.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.push('/login');
      return;
    }
    const hasAdminAccess = user.roles.some((r) =>
      ['superadministrador', 'administrador'].includes(r),
    );
    if (!hasAdminAccess) {
      router.push('/dashboard');
      return;
    }

    loadData();
  }, [user, authLoading, router]);

  // Mapa de matrículas por usuario
  const userEnrollmentsMap = useMemo(() => {
    const map = new Map<string, EnrollmentRequest[]>();
    for (const enr of enrollments) {
      if (!map.has(enr.user_id)) {
        map.set(enr.user_id, []);
      }
      map.get(enr.user_id)!.push(enr);
    }
    return map;
  }, [enrollments]);

  // Usuarios filtrados
  const filteredUsers = useMemo(() => {
    let list = users;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter((u) => {
        const full = `${u.first_name || ''} ${u.last_name || ''}`.toLowerCase();
        const email = (u.email || '').toLowerCase();
        return full.includes(q) || email.includes(q);
      });
    }

    if (roleFilter !== 'todos') {
      list = list.filter((u) => u.roles?.includes(roleFilter as any));
    }

    if (statusFilter !== 'todos') {
      list = list.filter((u) => u.status === statusFilter);
    }

    return list;
  }, [users, searchQuery, roleFilter, statusFilter]);

  // Asignar curso
  // Usa el rol académico seleccionado para crear la asignación en el curso.
  const handleAssignCourse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assignCourseUser || !selectedCourseId) {
      setError('Debes seleccionar un curso para asignar.');
      return;
    }

    setActionLoading('assign-course');
    setNotice(null);
    setError(null);

    try {
      const assignment = await enrollmentsApi.requestEnrollment(selectedCourseId, {
        user_id: assignCourseUser.id,
        moodle_role: selectedMoodleRole,
        notes: assignNotes || 'Asignado administrativamente desde panel de Asignaciones',
      });
      setNotice(
        assignment.status === 'sincronizada'
          ? 'Curso asignado y matriculado en Moodle LMS.'
          : 'Asignación registrada. Moodle aún no confirma la matrícula.',
      );
      setAssignCourseUser(null);
      setSelectedCourseId('');
      setAssignNotes('');
      await loadData();
    } catch (err: any) {
      setError(err.message || 'Error al asignar curso al usuario.');
    } finally {
      setActionLoading(null);
    }
  };

  // Desasignar curso
  // Ejecuta la baja después de la confirmación y vuelve a consultar las asignaciones.
  const handleConfirmUnenroll = async () => {
    if (!unenrollTarget) return;

    setActionLoading(`unenroll-${unenrollTarget.enrollmentId}`);
    setNotice(null);
    setError(null);

    try {
      await enrollmentsApi.deleteEnrollment(unenrollTarget.enrollmentId);
      setNotice(
        `Materia "${unenrollTarget.courseName}" desasignada correctamente para ${unenrollTarget.userName}. Se actualizó Moodle LMS.`,
      );
      setUnenrollTarget(null);
      await loadData();
    } catch (err: any) {
      setError(err.message || 'Error al desasignar curso.');
    } finally {
      setActionLoading(null);
    }
  };

  // Asignar rol
  const handleAssignRole = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!roleTargetUser || !selectedRoleId) {
      setError('Selecciona un rol válido.');
      return;
    }

    setActionLoading('assign-role');
    setNotice(null);
    setError(null);

    try {
      await rolesApi.assignRole(roleTargetUser.id, Number(selectedRoleId));
      setNotice(
        `Rol asignado exitosamente a ${roleTargetUser.first_name} ${roleTargetUser.last_name}. Si contaba con rol provisional de aspirante, se desactivó automáticamente.`,
      );
      setRoleTargetUser(null);
      setSelectedRoleId('');
      await loadData();
    } catch (err: any) {
      setError(err.message || 'Error al asignar rol.');
    } finally {
      setActionLoading(null);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <p className="text-xs font-medium text-muted">Cargando módulo de asignaciones...</p>
        </div>
      </div>
    );
  }

  return (
    <CampusShell
      searchItems={courses.map((course) => ({ id: course.id, title: course.name, detail: course.code, section: 'Cursos' }))}
      currentTab="asignaciones"
      onSelectTab={(tab) => {
        if (tab === 'usuarios' || tab === 'cursos' || tab === 'auditoria') {
          router.push('/dashboard/admin');
        }
      }}
      breadcrumbs={['INICIA', 'Administración', 'Asignación de Cursos y Roles']}
    >
      <div className="space-y-6">
        {/* Header Asignaciones */}
        <div className="campus-heading">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="rounded-[4px] bg-primary/10 px-2 py-0.5 text-[11px] font-mono font-semibold text-primary border border-primary/20">
                  Gestión Curricular Centralizada
                </span>
                <span className="rounded-[4px] bg-accent-sky/20 px-2 py-0.5 text-[11px] font-mono font-semibold text-foreground border border-accent-sky/40">
                  Control de Matrícula y Roles
                </span>
              </div>
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
                Asignación de Cursos y Roles de Usuario
              </h1>
              <p className="text-xs sm:text-sm text-muted">
                Filtra alumnos, docentes y aspirantes por nombre o correo para asignar materias en Moodle LMS, vincular roles y desasignar cursos.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <Link
                href="/dashboard/admin"
                className="rounded-[6px] border border-border bg-surface hover:bg-surface-muted px-3 py-1.5 text-xs font-medium text-foreground transition-all"
              >
                ← Volver al Panel Admin
              </Link>
              <button
                type="button"
                onClick={loadData}
                className="h-8 w-8 rounded-[6px] border border-border bg-surface hover:bg-surface-muted text-muted hover:text-foreground flex items-center justify-center transition-all"
                title="Actualizar datos"
              >
                <IconRefresh className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Estadísticas de Asignaciones */}
          <div className="mt-5 grid grid-cols-1 gap-3 border-t border-border pt-4 sm:grid-cols-4">
            <div className="rounded-[8px] border border-border bg-surface-muted/30 p-3">
              <span className="text-[11px] font-mono uppercase tracking-wider text-muted">Usuarios Registrados</span>
              <p className="mt-1 font-mono text-base font-bold text-foreground">{users.length}</p>
            </div>
            <div className="rounded-[8px] border border-border bg-surface-muted/30 p-3">
              <span className="text-[11px] font-mono uppercase tracking-wider text-muted">Cursos Ofertados</span>
              <p className="mt-1 font-mono text-base font-bold text-foreground">{courses.length}</p>
            </div>
            <div className="rounded-[8px] border border-border bg-surface-muted/30 p-3">
              <span className="text-[11px] font-mono uppercase tracking-wider text-muted">Matrículas Totales</span>
              <p className="mt-1 font-mono text-base font-bold text-foreground">{enrollments.length}</p>
            </div>
            <div className="rounded-[8px] border border-border bg-surface-muted/30 p-3">
              <span className="text-[11px] font-mono uppercase tracking-wider text-muted">Sincronizadas Moodle</span>
              <p className="mt-1 font-mono text-base font-bold text-success">
                {enrollments.filter((e) => e.status === 'sincronizada').length}
              </p>
            </div>
          </div>
        </div>

        {/* Notificaciones */}
        {notice && (
          <div className="rounded-[8px] border border-success/25 bg-success/10 p-3.5 text-xs font-medium text-success flex items-center justify-between shadow-minimal">
            <div className="flex items-center gap-2">
              <IconCheck className="w-4 h-4 text-success shrink-0" />
              <span>{notice}</span>
            </div>
            <button
              type="button"
              onClick={() => setNotice(null)}
              className="text-xs text-muted hover:text-foreground"
            >
              <IconClose className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {error && (
          <div className="rounded-[8px] border border-danger/30 bg-danger/10 p-3.5 text-xs font-medium text-danger flex items-center justify-between shadow-minimal">
            <div className="flex items-center gap-2">
              <IconAlertTriangle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
            <button
              type="button"
              onClick={() => setError(null)}
              className="text-xs text-muted hover:text-foreground"
            >
              <IconClose className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Barra de Filtros y Búsqueda */}
        <div className="rounded-[10px] border border-border bg-surface p-4 shadow-minimal flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="relative w-full sm:w-80">
            <input
              type="text"
              placeholder="Filtrar por nombre o correo..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-[6px] border border-border bg-surface-muted/40 px-3 py-1.5 text-xs text-foreground placeholder:text-muted focus:border-primary focus:bg-surface focus:outline-none transition-all"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-2 text-xs text-muted hover:text-foreground"
              >
                <IconClose className="w-3 h-3" />
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs">
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="rounded-[6px] border border-border bg-surface-muted/40 px-3 py-1.5 text-xs text-foreground focus:border-primary focus:outline-none"
            >
              <option value="todos">Todos los roles</option>
              <option value="estudiante">Estudiantes</option>
              <option value="profesor">Profesores</option>
              <option value="aspirante">Aspirantes</option>
              <option value="administrador">Administradores</option>
              <option value="coordinador">Coordinadores</option>
            </select>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded-[6px] border border-border bg-surface-muted/40 px-3 py-1.5 text-xs text-foreground focus:border-primary focus:outline-none"
            >
              <option value="todos">Todos los estados</option>
              <option value="activo">Activo</option>
              <option value="pendiente">Pendiente</option>
              <option value="suspendido">Suspendido</option>
            </select>
          </div>
        </div>

        {/* Tabla Central de Asignaciones */}
        <div className="rounded-[10px] border border-border bg-surface overflow-hidden shadow-minimal">
          {filteredUsers.length === 0 ? (
            <div className="p-10 text-center text-xs text-muted">
              No se encontraron usuarios que coincidan con los criterios de búsqueda.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-surface-muted/60 text-muted font-medium border-b border-border">
                  <tr>
                    <th className="px-5 py-3.5">Usuario / Correo</th>
                    <th className="px-5 py-3.5">Roles Activos</th>
                    <th className="px-5 py-3.5">Cursos Asignados</th>
                    <th className="px-5 py-3.5">Moodle LMS</th>
                    <th className="px-5 py-3.5 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredUsers.map((u) => {
                    const userEnrs = userEnrollmentsMap.get(u.id) || [];
                    const activeRoles = u.roles || [];

                    return (
                      <tr key={u.id} className="hover:bg-surface-muted/30 transition-colors">
                        <td className="px-5 py-3.5">
                          <span className="font-semibold text-foreground block">
                            {u.first_name} {u.last_name}
                          </span>
                          <span className="font-mono text-[11px] text-muted">{u.email}</span>
                        </td>

                        <td className="px-5 py-3.5">
                          <div className="flex flex-wrap gap-1">
                            {activeRoles.map((r) => (
                              <span
                                key={r}
                                className={`rounded-[4px] px-2 py-0.5 text-[10px] font-mono font-medium border ${
                                  r === 'profesor'
                                    ? 'bg-primary/10 text-primary border-primary/20 font-bold'
                                    : r === 'estudiante'
                                    ? 'bg-success/10 text-success border-success/20'
                                    : r === 'aspirante'
                                    ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20'
                                    : 'bg-surface-muted text-foreground border-border'
                                }`}
                              >
                                {r}
                              </span>
                            ))}
                          </div>
                        </td>

                        <td className="px-5 py-3.5">
                          {userEnrs.length === 0 ? (
                            <span className="text-[11px] text-muted italic">Sin materias asignadas</span>
                          ) : (
                            <div className="flex flex-wrap gap-1.5">
                              {userEnrs.map((enr) => {
                                const courseName =
                                  enr.course_mappings?.courses?.name ||
                                  enr.course_mappings?.portal_course_code ||
                                  'Materia';

                                return (
                                  <span
                                    key={enr.id}
                                    className="inline-flex items-center gap-1.5 rounded-[4px] bg-surface-muted px-2 py-1 text-[11px] border border-border"
                                  >
                                    <span className="font-medium text-foreground">{courseName}</span>
                                    <span className="font-mono text-[9px] text-primary">
                                      ({enr.moodle_role || 'student'})
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setUnenrollTarget({
                                          enrollmentId: enr.id,
                                          userName: `${u.first_name} ${u.last_name}`,
                                          courseName,
                                        })
                                      }
                                      className="text-muted hover:text-danger ml-0.5"
                                      title="Desasignar curso"
                                    >
                                      <IconClose className="w-2.5 h-2.5" />
                                    </button>
                                  </span>
                                );
                              })}
                            </div>
                          )}
                        </td>

                        <td className="px-5 py-3.5">
                          <MoodleSyncBadge status={u.moodle_sync_status} moodleId={u.moodle_user_id} />
                        </td>

                        <td className="px-5 py-3.5 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => {
                                setAssignCourseUser(u);
                                setSelectedCourseId(courses[0]?.course_mapping_id || '');
                                setSelectedMoodleRole(
                                  u.roles.includes('profesor') ? 'teacher' : 'student',
                                );
                              }}
                              className="rounded-[4px] bg-primary/10 border border-primary/20 px-2.5 py-1 text-[11px] font-semibold text-primary hover:bg-primary/20 transition-all"
                            >
                              + Asignar Curso
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                setRoleTargetUser(u);
                                setSelectedRoleId('');
                              }}
                              className="rounded-[4px] border border-border bg-surface px-2.5 py-1 text-[11px] font-medium text-foreground hover:bg-surface-muted transition-all"
                            >
                              Roles
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* MODAL: ASIGNAR CURSO AL USUARIO */}
        {assignCourseUser && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="w-full max-w-md rounded-[14px] border border-border bg-surface p-6 shadow-xl space-y-4 animate-in fade-in zoom-in-95">
              <div className="flex items-center justify-between border-b border-border pb-3">
                <div className="flex items-center gap-2">
                  <IconGroups className="w-5 h-5 text-primary" />
                  <h3 className="text-base font-bold text-foreground">
                    Asignar Curso a Usuario
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setAssignCourseUser(null)}
                  className="text-muted hover:text-foreground"
                >
                  <IconClose className="w-4 h-4" />
                </button>
              </div>

              <div className="text-xs space-y-1">
                <div>
                  <span className="text-muted">Destinatario: </span>
                  <strong className="text-foreground">
                    {assignCourseUser.first_name} {assignCourseUser.last_name}
                  </strong>{' '}
                  <span className="font-mono text-muted">({assignCourseUser.email})</span>
                </div>
              </div>

              <form onSubmit={handleAssignCourse} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1">
                    Seleccionar Asignatura *
                  </label>
                  <select
                    value={selectedCourseId}
                    onChange={(e) => setSelectedCourseId(e.target.value)}
                    className="w-full rounded-[6px] border border-border bg-surface-muted/40 px-3 py-2 text-xs text-foreground focus:border-primary focus:bg-surface focus:outline-none transition-all"
                  >
                    {courses.map((c) => (
                      <option key={c.course_mapping_id} value={c.course_mapping_id}>
                        {c.code} - {c.name} (Moodle #{c.moodle_course_id})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-foreground mb-1">
                    Rol en Moodle LMS *
                  </label>
                  <select
                    value={selectedMoodleRole}
                    onChange={(e) => setSelectedMoodleRole(e.target.value as any)}
                    className="w-full rounded-[6px] border border-border bg-surface-muted/40 px-3 py-2 text-xs text-foreground focus:border-primary focus:bg-surface focus:outline-none transition-all"
                  >
                    <option value="student">Estudiante (student)</option>
                    <option value="teacher">Profesor Titular (editingteacher)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-foreground mb-1">
                    Nota o Justificación Administrativa
                  </label>
                  <input
                    type="text"
                    value={assignNotes}
                    onChange={(e) => setAssignNotes(e.target.value)}
                    placeholder="Ej. Asignación para ciclo 2026-A"
                    className="w-full rounded-[6px] border border-border bg-surface-muted/40 px-3 py-2 text-xs text-foreground focus:border-primary focus:bg-surface focus:outline-none transition-all"
                  />
                </div>

                <div className="flex justify-end gap-2.5 pt-2 border-t border-border">
                  <button
                    type="button"
                    onClick={() => setAssignCourseUser(null)}
                    disabled={actionLoading === 'assign-course'}
                    className="rounded-[6px] border border-border bg-surface px-4 py-2 text-xs font-semibold text-foreground hover:bg-surface-muted transition-all"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={actionLoading === 'assign-course'}
                    className="rounded-[6px] bg-primary-action px-4 py-2 text-xs font-semibold text-white shadow-minimal hover:bg-primary-action/90 transition-all disabled:opacity-50"
                  >
                    {actionLoading === 'assign-course' ? 'Matriculando en Moodle...' : 'Asignar y Matricular'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* MODAL: CONFIRMACIÓN DE DESASIGNACIÓN DE CURSO */}
        {unenrollTarget && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="w-full max-w-md rounded-[14px] border border-border bg-surface p-6 shadow-xl space-y-4 animate-in fade-in zoom-in-95">
              <div className="flex items-center gap-3 text-danger">
                <div className="grid h-10 w-10 place-items-center rounded-full bg-danger/10 border border-danger/20">
                  <IconAlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-foreground">
                    Desasignar materia a usuario
                  </h3>
                  <p className="text-xs text-muted">Revocación de matrícula y acceso Moodle</p>
                </div>
              </div>

              <div className="rounded-[8px] bg-surface-muted/50 border border-border p-3.5 text-xs text-muted space-y-1">
                <p>
                  ¿Estás seguro de que deseas desasignar el curso{' '}
                  <strong className="text-foreground">{unenrollTarget.courseName}</strong> a{' '}
                  <strong className="text-foreground">{unenrollTarget.userName}</strong>?
                </p>
                <p className="text-[11px] text-danger/90 pt-1">
                  Esta acción revocará su matrícula en Moodle LMS y retirará el aula virtual de su panel.
                </p>
              </div>

              <div className="flex justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setUnenrollTarget(null)}
                  disabled={actionLoading === `unenroll-${unenrollTarget.enrollmentId}`}
                  className="rounded-[6px] border border-border bg-surface px-4 py-2 text-xs font-semibold text-foreground hover:bg-surface-muted transition-all"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleConfirmUnenroll}
                  disabled={actionLoading === `unenroll-${unenrollTarget.enrollmentId}`}
                  className="rounded-[6px] bg-danger px-4 py-2 text-xs font-semibold text-white shadow-minimal hover:bg-danger/90 transition-all disabled:opacity-50"
                >
                  {actionLoading === `unenroll-${unenrollTarget.enrollmentId}`
                    ? 'Desasignando...'
                    : 'Sí, desasignar materia'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* MODAL: ASIGNAR ROL */}
        {roleTargetUser && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="w-full max-w-md rounded-[14px] border border-border bg-surface p-6 shadow-xl space-y-4 animate-in fade-in zoom-in-95">
              <div className="flex items-center justify-between border-b border-border pb-3">
                <div className="flex items-center gap-2">
                  <IconShield className="w-5 h-5 text-primary" />
                  <h3 className="text-base font-bold text-foreground">
                    Asignar Rol a Usuario
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setRoleTargetUser(null)}
                  className="text-muted hover:text-foreground"
                >
                  <IconClose className="w-4 h-4" />
                </button>
              </div>

              <div className="text-xs space-y-1">
                <div>
                  <span className="text-muted">Usuario: </span>
                  <strong className="text-foreground">
                    {roleTargetUser.first_name} {roleTargetUser.last_name}
                  </strong>{' '}
                  <span className="font-mono text-muted">({roleTargetUser.email})</span>
                </div>
                <div>
                  <span className="text-muted">Roles Actuales: </span>
                  <span className="font-mono text-foreground font-semibold">
                    {roleTargetUser.roles.join(', ')}
                  </span>
                </div>
              </div>

              <form onSubmit={handleAssignRole} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1">
                    Seleccionar Rol a Otorgar *
                  </label>
                  <select
                    value={selectedRoleId}
                    onChange={(e) => setSelectedRoleId(e.target.value)}
                    className="w-full rounded-[6px] border border-border bg-surface-muted/40 px-3 py-2 text-xs text-foreground focus:border-primary focus:bg-surface focus:outline-none transition-all"
                  >
                    {roles.filter((role) => user?.roles.includes('superadministrador') || !['administrador', 'superadministrador'].includes(role.slug)).map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name} ({r.slug})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="rounded-[6px] bg-primary/10 border border-primary/20 p-3 text-[11px] text-muted">
                  Al asignar un rol formal (profesor, estudiante, etc.), el rol provisional de aspirante se desactivará automáticamente para evitar duplicidades.
                </div>

                <div className="flex justify-end gap-2.5 pt-2 border-t border-border">
                  <button
                    type="button"
                    onClick={() => setRoleTargetUser(null)}
                    disabled={actionLoading === 'assign-role'}
                    className="rounded-[6px] border border-border bg-surface px-4 py-2 text-xs font-semibold text-foreground hover:bg-surface-muted transition-all"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={actionLoading === 'assign-role'}
                    className="rounded-[6px] bg-primary-action px-4 py-2 text-xs font-semibold text-white shadow-minimal hover:bg-primary-action/90 transition-all disabled:opacity-50"
                  >
                    {actionLoading === 'assign-role' ? 'Guardando...' : 'Asignar Rol'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </CampusShell>
  );
}

```

### apps/web/src/app/dashboard/admin/page.tsx

<!-- archivo: apps/web/src/app/dashboard/admin/page.tsx -->
```tsx
// IINICIA Portal · administración · page.tsx
/** Centraliza los flujos administrativos de usuarios, admisiones, programas, matrículas y auditoría. */
'use client';

import React, { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import {
  auditApi,
  admissionsApi,
  authApi,
  coursesApi,
  enrollmentsApi,
  moodleApi,
  programsApi,
  rolesApi,
  usersApi,
} from '@/lib/api';
import type {
  AuditLog,
  AdmissionApplication,
  CourseOffering,
  EnrollmentRequest,
  MoodleStatusResponse,
  Program,
  RoleItem,
  RoleSlug,
  UserProfile,
} from '@/types';
import { MoodleSyncBadge } from '@/components/moodle/MoodleSyncBadge';
import { CampusShell } from '@/components/campus-tech/CampusShell';
import {
  closeMoodleLaunchWindow,
  navigateMoodleLaunchWindow,
  openMoodleLaunchWindow,
} from '@/lib/moodle-window';
import {
  IconPlus,
  IconRefresh,
  IconExternalLink,
  IconCheck,
  IconAlertTriangle,
  IconSearch,
  IconFilter,
  IconStudents,
  IconTeachers,
  IconGroups,
  IconAttendance,
  IconGrades,
  IconAudit,
  IconSettings,
  IconClose,
} from '@/components/campus-tech/Icons';

type AdminTab =
  | 'asignaciones'
  | 'usuarios'
  | 'docentes'
  | 'cursos'
  | 'matriculas'
  | 'admisiones'
  | 'programas'
  | 'moodle'
  | 'auditoria'
  | 'configuracion';

/** Coordina las consultas de catálogo, usuarios y solicitudes en la vista administrativa. Los servicios del servidor determinan qué datos y operaciones están permitidos. */
export default function AdminDashboardPage() {
  const router = useRouter();
  const { user, loading: authLoading, hasRole } = useAuth();

  // Estados de pestañas y carga
  const [activeTab, setActiveTab] = useState<AdminTab>('asignaciones');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Datos principales
  const [moodleStatus, setMoodleStatus] = useState<MoodleStatusResponse | null>(null);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [roles, setRoles] = useState<RoleItem[]>([]);
  const [courses, setCourses] = useState<CourseOffering[]>([]);
  const [enrollments, setEnrollments] = useState<EnrollmentRequest[]>([]);
  const [applications, setApplications] = useState<AdmissionApplication[]>([]);
  const [applicationsError, setApplicationsError] = useState<string | null>(null);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [programsError, setProgramsError] = useState<string | null>(null);
  const [programToAssign, setProgramToAssign] = useState('');
  const [programUserId, setProgramUserId] = useState('');
  const [programUserSearch, setProgramUserSearch] = useState('');
  const [programUsers, setProgramUsers] = useState<UserProfile[] | null>(null);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);

  // Filtros de asignaciones
  const [assignSearch, setAssignSearch] = useState('');
  const [assignRoleFilter, setAssignRoleFilter] = useState('');
  const [assignCourseFilter, setAssignCourseFilter] = useState('');
  const [assignUserModalSearch, setAssignUserModalSearch] = useState('');

  // Filtros de usuarios
  const [userSearch, setUserSearch] = useState('');
  const [userRoleFilter, setUserRoleFilter] = useState('');
  const [userStatusFilter, setUserStatusFilter] = useState('');

  // Filtros de matrículas
  const [enrollmentStatusFilter, setEnrollmentStatusFilter] = useState('');

  // Modales existentes
  const [selectedUserForRole, setSelectedUserForRole] = useState<UserProfile | null>(null);
  const [roleToAssign, setRoleToAssign] = useState<number>(5);

  const [selectedUserForStatus, setSelectedUserForStatus] = useState<UserProfile | null>(null);
  const [newStatus, setNewStatus] = useState<string>('activo');
  const [statusReason, setStatusReason] = useState<string>('');

  const [showAssignCourseModal, setShowAssignCourseModal] = useState(false);
  const [assignTargetUserId, setAssignTargetUserId] = useState<string>('');
  const [assignCourseId, setAssignCourseId] = useState<string>('');
  const [assignMoodleRole, setAssignMoodleRole] = useState<'student' | 'editingteacher'>('student');

  const [showCreateCourseModal, setShowCreateCourseModal] = useState(false);
  const [newCourseName, setNewCourseName] = useState('');
  const [newCourseCode, setNewCourseCode] = useState('');
  const [newCourseSlug, setNewCourseSlug] = useState('');
  const [newMoodleCourseId, setNewMoodleCourseId] = useState<number>(1);
  const [newMoodleShortname, setNewMoodleShortname] = useState('');
  const [newCourseProgramId, setNewCourseProgramId] = useState('');
  const [newCourseTerm, setNewCourseTerm] = useState<number>(1);

  // Nuevos Modales: Crear Usuario y Crear Programa
  const [showCreateUserModal, setShowCreateUserModal] = useState(false);
  const [newFirstName, setNewFirstName] = useState('');
  const [newLastName, setNewLastName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newInitialRole, setNewInitialRole] = useState('');

  const [showCreateProgramModal, setShowCreateProgramModal] = useState(false);
  const [newProgName, setNewProgName] = useState('');
  const [newProgCode, setNewProgCode] = useState('');
  const [newProgSlug, setNewProgSlug] = useState('');
  const [newProgType, setNewProgType] = useState<any>('licenciatura');
  const [newProgModality, setNewProgModality] = useState<any>('en_linea');
  const [newProgDuration, setNewProgDuration] = useState('3 años');
  const [newProgHours, setNewProgHours] = useState<number>(1800);
  const [newProgDesc, setNewProgDesc] = useState('');

  const isAdminOrCoordinator =
    hasRole('superadministrador') || hasRole('administrador');

  // Carga los datos del panel administrativo según los accesos de la sesión.
  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      const [statusRes, usersRes, rolesRes, coursesRes, enrollRes, progRes, auditRes, admissionsRes] =
        await Promise.allSettled([
          moodleApi.getStatus(),
          usersApi.getUsers({ limit: 100 }),
          rolesApi.getRoles(),
          coursesApi.getCatalog(),
          enrollmentsApi.getAllEnrollments(),
          programsApi.getPrograms(),
          auditApi.getLogs({ limit: 30 }),
          admissionsApi.getMyApplications(),
        ]);

      setMoodleStatus(statusRes.status === 'fulfilled' ? statusRes.value : { ok: false, message: 'No disponible' });
      if (usersRes.status === 'fulfilled') setUsers(usersRes.value.data);
      if (rolesRes.status === 'fulfilled') setRoles(rolesRes.value);
      if (coursesRes.status === 'fulfilled') setCourses(coursesRes.value);
      if (enrollRes.status === 'fulfilled') setEnrollments(enrollRes.value);
      if (admissionsRes.status === 'fulfilled') setApplications(admissionsRes.value);
      setApplicationsError(admissionsRes.status === 'rejected' ? 'No fue posible cargar las postulaciones.' : null);
      if (progRes.status === 'fulfilled') setPrograms(progRes.value);
      setProgramsError(progRes.status === 'rejected' ? 'No fue posible cargar los programas.' : null);
      if (auditRes.status === 'fulfilled') {
        setAuditLogs(Array.isArray(auditRes.value) ? auditRes.value : auditRes.value?.data ?? []);
      }
      const failures = [
        usersRes.status === 'rejected' && 'usuarios',
        rolesRes.status === 'rejected' && 'roles',
        coursesRes.status === 'rejected' && 'cursos',
        enrollRes.status === 'rejected' && 'matrículas',
      ].filter(Boolean);
      if (failures.length) setError(`No fue posible actualizar ${failures.join(', ')}. Pulsa Actualizar para reintentar.`);

    } catch (err: any) {
      setError(err.message || 'Error al cargar los módulos administrativos.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.push('/login');
      return;
    }
    if (!isAdminOrCoordinator) {
      router.push('/dashboard');
      return;
    }

    loadData();
  }, [user, authLoading, isAdminOrCoordinator, router]);

  // Filtrado de usuarios
  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      const matchesSearch =
        userSearch === '' ||
        u.email.toLowerCase().includes(userSearch.toLowerCase()) ||
        `${u.first_name} ${u.last_name}`.toLowerCase().includes(userSearch.toLowerCase()) ||
        (u.moodle_username && u.moodle_username.toLowerCase().includes(userSearch.toLowerCase()));

      const userRoles = ((u.active_roles || u.roles || []) as string[]).map((r) => r.toLowerCase());
      const matchesRole =
        userRoleFilter === '' ||
        (userRoleFilter === 'profesor'
          ? userRoles.some((r) => ['profesor', 'teacher', 'docente', 'editingteacher'].includes(r))
          : userRoleFilter === 'estudiante'
          ? userRoles.some((r) => ['estudiante', 'student'].includes(r))
          : userRoles.includes(userRoleFilter.toLowerCase()));

      const matchesStatus = userStatusFilter === '' || u.status === userStatusFilter;

      return matchesSearch && matchesRole && matchesStatus;
    });
  }, [users, userSearch, userRoleFilter, userStatusFilter]);

  // Filtrado de matrículas
  const filteredEnrollments = useMemo(() => {
    return enrollments.filter((e) => {
      if (!enrollmentStatusFilter) return true;
      return e.status === enrollmentStatusFilter;
    });
  }, [enrollments, enrollmentStatusFilter]);

  // Envía el dictamen de la postulación y actualiza los datos que dependen de él.
  const handleReviewApplication = async (applicationId: string, status: 'en_revision' | 'admitido' | 'rechazado') => {
    setActionLoading(`admission-${applicationId}`);
    setError(null);
    setNotice(null);
    try {
      const reviewed = await admissionsApi.reviewApplication(applicationId, status, applications.find((item) => item.id === applicationId)?.reviewer_notes ?? undefined);
      setApplications((current) => current.map((application) =>
        application.id === applicationId ? { ...application, ...reviewed } : application,
      ));
      const summary = reviewed.enrollment_summary;
      if (status !== 'admitido') setNotice('El dictamen de admisión se guardó correctamente.');
      else if (summary?.state === 'synced') setNotice('Admisión confirmada. Moodle confirmó las matrículas de los cursos iniciales.');
      else if (summary?.state === 'no_courses') setNotice('Admisión confirmada. El programa no tiene cursos obligatorios activos en el primer módulo.');
      else setNotice('Admisión confirmada. Quedaron matrículas sin confirmar. Revisa Matrículas o vuelve a sincronizar los cursos iniciales.');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'No fue posible actualizar la postulación.');
    } finally {
      setActionLoading(null);
    }
  };

  const searchProgramUsers = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setActionLoading('program-user-search');
    setError(null);
    setProgramUserId('');
    try {
      const result = await usersApi.getUsers({ search: programUserSearch.trim(), limit: 50 });
      setProgramUsers(result.data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'No fue posible buscar usuarios.');
    } finally {
      setActionLoading(null);
    }
  };

  const assignProgram = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!programToAssign || !programUserId) return;
    setActionLoading('assign-program');
    setError(null);
    setNotice(null);
    try {
      await programsApi.enrollUserInProgram(programToAssign, { user_id: programUserId, status: 'inscrito' });
      setNotice('El programa quedó asignado al usuario.');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'No fue posible asignar el programa.');
    } finally {
      setActionLoading(null);
    }
  };

  // Acciones: Roles
  const handleAssignRole = async () => {
    if (!selectedUserForRole) return;
    setActionLoading('assign-role');
    setNotice(null);
    setError(null);

    try {
      await rolesApi.assignRole(selectedUserForRole.id, Number(roleToAssign));
      setNotice(`Rol asignado con éxito a ${selectedUserForRole.email}.`);
      setSelectedUserForRole(null);
      await loadData();
    } catch (err: any) {
      setError(err.message || 'Error al asignar rol.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleRevokeRole = async (userId: string, roleId: number, roleName: string) => {
    if (!confirm(`¿Confirmas que deseas retirar el rol "${roleName}" a este usuario?`)) return;
    setActionLoading(`revoke-${userId}-${roleId}`);
    setNotice(null);
    setError(null);

    try {
      await rolesApi.revokeRole(userId, roleId);
      setNotice(`Rol "${roleName}" retirado exitosamente.`);
      await loadData();
    } catch (err: any) {
      setError(err.message || 'Error al retirar rol.');
    } finally {
      setActionLoading(null);
    }
  };

  // Acciones: Estado de usuario
  const handleUpdateUserStatus = async () => {
    if (!selectedUserForStatus) return;
    setActionLoading('update-status');
    setNotice(null);
    setError(null);

    try {
      await usersApi.updateStatus(selectedUserForStatus.id, {
        status: newStatus,
        reason: statusReason || undefined,
      });
      setNotice(`Estado de ${selectedUserForStatus.email} actualizado a "${newStatus}".`);
      setSelectedUserForStatus(null);
      setStatusReason('');
      await loadData();
    } catch (err: any) {
      setError(err.message || 'Error al actualizar estado del usuario.');
    } finally {
      setActionLoading(null);
    }
  };

  // Acciones: Matrículas
  // Envía la decisión sobre la matrícula y mantiene visible el resultado de la sincronización.
  const handleAuthorizeEnrollment = async (
    enrollmentId: string,
    status: 'autorizada' | 'rechazada',
  ) => {
    setActionLoading(`enr-${enrollmentId}`);
    setNotice(null);
    setError(null);

    try {
      const result = await enrollmentsApi.authorizeEnrollment(enrollmentId, {
        status,
        sync_to_moodle: true,
      });
      setNotice(
        status === 'autorizada'
          ? result.moodle_sync?.success
            ? 'Matrícula autorizada y sincronizada con Moodle LMS.'
            : 'Matrícula autorizada. La sincronización con Moodle sigue pendiente.'
          : 'Solicitud rechazada.',
      );
      await loadData();
    } catch (err: any) {
      setError(err.message || 'Error al procesar matrícula.');
    } finally {
      setActionLoading(null);
    }
  };

  // Reintenta la matrícula con el identificador de la solicitud existente.
  const handleRetryMoodleSync = async (enrollmentId: string) => {
    setActionLoading(`sync-enr-${enrollmentId}`);
    setNotice(null);
    setError(null);

    try {
      const res = await enrollmentsApi.retrySync(enrollmentId);
      setNotice(
        res.success
          ? 'Sincronización con Moodle ejecutada exitosamente.'
          : 'La sincronización devolvió un aviso.',
      );
      await loadData();
    } catch (err: any) {
      setError(err.message || 'Error al sincronizar matrícula con Moodle.');
    } finally {
      setActionLoading(null);
    }
  };

  // Acciones: Asignar curso directo
  // Registra la asignación académica a partir del usuario y el curso elegidos.
  const handleDirectCourseAssignment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assignTargetUserId || !assignCourseId) {
      setError('Debes seleccionar un usuario y un curso.');
      return;
    }

    setActionLoading('assign-course');
    setNotice(null);
    setError(null);

    try {
      const assignment = await enrollmentsApi.requestEnrollment(assignCourseId, {
        user_id: assignTargetUserId,
        moodle_role: assignMoodleRole,
        notes: 'Asignado directamente desde el panel de Superadministrador',
      });
      setNotice(
        assignment.status === 'sincronizada'
          ? 'Curso asignado y matriculado en Moodle LMS.'
          : 'Asignación registrada. Moodle aún no confirma la matrícula.',
      );
      setShowAssignCourseModal(false);
      setAssignTargetUserId('');
      setAssignCourseId('');
      await loadData();
    } catch (err: any) {
      setError(err.message || 'Error al asignar curso al usuario.');
    } finally {
      setActionLoading(null);
    }
  };

  // Acciones: Desasignar curso de usuario
  const handleDeleteEnrollment = async (enrollmentId: string, studentName: string, courseName: string) => {
    if (!window.confirm(`¿Estás seguro de que deseas desasignar a ${studentName} del curso "${courseName}"? Esta acción revocará su matrícula en Moodle LMS.`)) {
      return;
    }

    setActionLoading(`delete-enr-${enrollmentId}`);
    setNotice(null);
    setError(null);

    try {
      await enrollmentsApi.deleteEnrollment(enrollmentId);
      setNotice(`Matrícula desasignada exitosamente para ${studentName}.`);
      await loadData();
    } catch (err: any) {
      setError(err.message || 'Error al desasignar matrícula.');
    } finally {
      setActionLoading(null);
    }
  };

  // Acciones: Crear nuevo mapeo de curso
  // Asocia un curso ya identificado en Moodle con su equivalente en el catálogo del portal.
  const handleCreateCourseMapping = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCourseName || !newCourseCode || !newMoodleCourseId || !newMoodleShortname) {
      setError('Por favor completa todos los campos requeridos del curso.');
      return;
    }

    setActionLoading('create-course');
    setNotice(null);
    setError(null);

    try {
      await coursesApi.createCourse({
        portal_course_code: newCourseCode.trim(),
        slug: newCourseSlug.trim() || newCourseCode.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-'),
        course_name: newCourseName.trim(),
        moodle_course_id: Number(newMoodleCourseId),
        moodle_shortname: newMoodleShortname.trim(),
        program_id: newCourseProgramId || undefined,
        term_or_module: Number(newCourseTerm) || 1,
        is_mandatory: true,
        is_active: true,
      });

      setNotice(`Curso "${newCourseName}" vinculado exitosamente con Moodle (ID #${newMoodleCourseId}).`);
      setShowCreateCourseModal(false);
      setNewCourseName('');
      setNewCourseCode('');
      setNewCourseSlug('');
      setNewMoodleShortname('');
      await loadData();
    } catch (err: any) {
      setError(err.message || 'Error al crear y mapear el curso.');
    } finally {
      setActionLoading(null);
    }
  };

  // Acciones: Crear Usuario Administrativo
  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmail || !newPassword || !newFirstName || !newLastName || !newInitialRole) {
      setError('Completa todos los campos obligatorios del nuevo usuario.');
      return;
    }

    setActionLoading('create-user');
    setNotice(null);
    setError(null);

    try {
      await usersApi.createUser({
        email: newEmail.trim(),
        password: newPassword,
        first_name: newFirstName.trim(),
        last_name: newLastName.trim(),
        phone: newPhone.trim() || undefined,
        role_id: Number(newInitialRole),
      });

      setNotice(`Usuario "${newEmail}" creado exitosamente con su rol asignado.`);
      setShowCreateUserModal(false);
      setNewFirstName('');
      setNewLastName('');
      setNewEmail('');
      setNewPassword('');
      setNewPhone('');
      setNewInitialRole('');
      await loadData();
    } catch (err: any) {
      setError(err.message || 'Error al crear el nuevo usuario.');
    } finally {
      setActionLoading(null);
    }
  };

  // Acciones: Crear Programa Académico
  const handleCreateProgram = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProgName || !newProgCode) {
      setError('Completa el código y nombre del programa.');
      return;
    }

    setActionLoading('create-program');
    setNotice(null);
    setError(null);

    try {
      await programsApi.createProgram({
        code: newProgCode.trim().toUpperCase(),
        name: newProgName.trim(),
        slug: newProgSlug.trim() || newProgCode.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-'),
        type: newProgType,
        modality: newProgModality,
        duration_text: newProgDuration.trim() || '120 horas',
        duration_hours: Number(newProgHours) || 120,
        description: newProgDesc.trim() || undefined,
        is_active: true,
      });

      setNotice(`Programa académico "${newProgName}" creado exitosamente.`);
      setShowCreateProgramModal(false);
      setNewProgCode('');
      setNewProgName('');
      setNewProgSlug('');
      setNewProgDesc('');
      await loadData();
    } catch (err: any) {
      setError(err.message || 'Error al registrar el programa.');
    } finally {
      setActionLoading(null);
    }
  };

  // Acciones: Sincronización y Acceso SSO a Moodle
  const handleLaunchCampusSSO = async () => {
    const launchWindow = openMoodleLaunchWindow();
    if (!launchWindow) {
      setError('Permite las ventanas emergentes para abrir Moodle.');
      return;
    }
    setActionLoading('launch-campus');
    setNotice(null);
    setError(null);

    try {
      const res = await moodleApi.launchCampus();
      navigateMoodleLaunchWindow(launchWindow, res.access_url);
      setNotice('Sesión iniciada con éxito en Moodle vía SSO (abierta en nueva pestaña).');
    } catch (err: any) {
      closeMoodleLaunchWindow(launchWindow);
      setError(err.message || 'Error al iniciar sesión SSO en Moodle.');
    } finally {
      setActionLoading(null);
    }
  };

  // Envía la solicitud administrativa para sincronizar cuentas por lote.
  const handleBulkMoodleSync = async () => {
    setActionLoading('bulk-sync');
    setNotice(null);
    setError(null);

    try {
      const res = await moodleApi.syncAllUsers();
      setNotice(
        `Sincronización masiva finalizada: ${res.synced} usuarios vinculados en Moodle LMS (${res.failed} errores).`,
      );
      await loadData();
    } catch (err: any) {
      setError(err.message || 'Error en la sincronización masiva con Moodle.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleSyncSingleUser = async (userId: string) => {
    setActionLoading(`user-sync-${userId}`);
    setNotice(null);
    setError(null);

    try {
      await moodleApi.syncUser(userId);
      setNotice('Usuario sincronizado con éxito en Moodle LMS.');
      await loadData();
    } catch (err: any) {
      setError(err.message || 'Error al sincronizar usuario con Moodle.');
    } finally {
      setActionLoading(null);
    }
  };

  // Mapeo O(1) de usuario a matrículas/cursos
  const userEnrollmentsMap = useMemo(() => {
    const map: Record<string, EnrollmentRequest[]> = {};
    for (const enr of enrollments) {
      if (!map[enr.user_id]) map[enr.user_id] = [];
      map[enr.user_id].push(enr);
    }
    return map;
  }, [enrollments]);

  // Filtro de usuarios para la pestaña de Asignación de Cursos y Roles
  const filteredAssignmentUsers = useMemo(() => {
    return users.filter((u) => {
      const fullName = `${u.first_name || ''} ${u.last_name || ''}`.toLowerCase();
      const email = (u.email || '').toLowerCase();
      const username = (u.moodle_username || '').toLowerCase();
      const q = assignSearch.toLowerCase().trim();

      const matchesQuery = !q || fullName.includes(q) || email.includes(q) || username.includes(q);

      const userRoles = ((u.active_roles || u.roles || []) as string[]).map((r) => r.toLowerCase());
      const matchesRole =
        !assignRoleFilter ||
        (assignRoleFilter === 'profesor'
          ? userRoles.some((r) => ['profesor', 'teacher', 'docente', 'editingteacher'].includes(r))
          : assignRoleFilter === 'estudiante'
          ? userRoles.some((r) => ['estudiante', 'student'].includes(r))
          : userRoles.some((r) => r.includes(assignRoleFilter.toLowerCase())));

      const userEnrs = userEnrollmentsMap[u.id] || [];
      const matchesCourse =
        !assignCourseFilter ||
        (assignCourseFilter === 'con_cursos' && userEnrs.length > 0) ||
        (assignCourseFilter === 'sin_cursos' && userEnrs.length === 0);

      return matchesQuery && matchesRole && matchesCourse;
    });
  }, [users, assignSearch, assignRoleFilter, assignCourseFilter, userEnrollmentsMap]);

  // Búsqueda de usuarios dentro del modal interactivo
  const matchingModalUsers = useMemo(() => {
    if (!assignUserModalSearch.trim()) return users.slice(0, 8);
    const q = assignUserModalSearch.toLowerCase().trim();
    return users
      .filter((u) => {
        const fullName = `${u.first_name || ''} ${u.last_name || ''}`.toLowerCase();
        const email = (u.email || '').toLowerCase();
        return fullName.includes(q) || email.includes(q);
      })
      .slice(0, 10);
  }, [users, assignUserModalSearch]);

  const openAssignModalForUser = (targetUser: UserProfile) => {
    setAssignTargetUserId(targetUser.id);
    const defaultCourseId = courses[0]?.id || (courses[0] as any)?.course_mapping_id || '';
    setAssignCourseId(defaultCourseId);
    setAssignMoodleRole('student');
    setShowAssignCourseModal(true);
  };

  const openRolesModalForUser = (targetUser: UserProfile) => {
    setSelectedUserForRole(targetUser);
    setRoleToAssign(5);
  };

  if (authLoading || loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-3 border-accent border-t-transparent" />
          <p className="text-sm text-foreground/60">Cargando Centro de Control Maestro...</p>
        </div>
      </div>
    );
  }

  const getTabLabel = (tab: AdminTab) => {
    switch (tab) {
      case 'asignaciones':
        return 'Asignaciones & Cursos';
      case 'usuarios':
        return 'Directorio de Estudiantes';
      case 'docentes':
        return 'Cuerpo Docente';
      case 'cursos':
        return 'Grupos y Asignaturas';
      case 'matriculas':
        return 'Solicitudes y Matrículas';
      case 'admisiones':
        return 'Admisiones';
      case 'programas':
        return 'Programas Académicos';
      case 'moodle':
        return 'Moodle LMS 5.3+';
      case 'auditoria':
        return 'Bitácora & Reportes';
      case 'configuracion':
        return 'Configuración OS';
      default:
        return 'Control Maestro';
    }
  };

  return (
    <>
      <CampusShell
      searchItems={[...courses.map((course) => ({ id: course.id, title: course.course_name || '', detail: course.portal_course_code, section: 'Cursos', tab: 'cursos' })),
...programs.map((program) => ({ id: program.id, title: program.name, detail: program.code, section: 'Programas', tab: 'programas' })),
...applications.map((application) => ({ id: application.id, title: application.programs?.name || 'Postulación', detail: [application.profiles?.email, application.status].filter(Boolean).join(' · '), section: 'Postulaciones', tab: 'admisiones' })),]}
      currentTab={activeTab}
      onSelectTab={(tabId) => setActiveTab(tabId as AdminTab)}
      breadcrumbs={['INICIA', 'Control Maestro', getTabLabel(activeTab)]}
      counts={{
        users: users.length,
        courses: courses.length,
        enrollments: enrollments.length,
        programs: programs.length,
        audit: Array.isArray(auditLogs) ? auditLogs.length : 0,
      }}
      onLaunchCampusSSO={handleLaunchCampusSSO}
    >
      <div className="space-y-6">
        {/* Header Principal de Control Maestro */}
        <div className="campus-heading">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-[4px] bg-success/10 px-2.5 py-0.5 text-[11px] font-mono font-medium text-success border border-success/20">
                  <span className="h-1.5 w-1.5 rounded-full bg-success animate-pulse" />
                  Moodle LMS 5.3+ Activo (auth_userkey SSO)
                </span>
                <span className="rounded-[4px] bg-primary/10 px-2.5 py-0.5 text-[11px] font-mono font-semibold text-primary border border-primary/20">
                  {hasRole('superadministrador') ? 'Superadministrador' : 'Administrador'}
                </span>
              </div>
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
                {hasRole('superadministrador') ? 'Panel de control maestro' : 'Panel de administración'}
              </h1>
              <p className="text-xs sm:text-sm text-muted max-w-2xl leading-relaxed">
                Gestión unificada de estudiantes, docentes, materias, roles y salto automático sin contraseñas a Moodle LMS.
              </p>
            </div>

            {/* Acciones Rápidas */}
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleLaunchCampusSSO}
                disabled={actionLoading === 'launch-campus'}
                className="inline-flex items-center justify-center gap-1.5 rounded-[6px] bg-primary-action text-white font-medium px-3.5 py-2 text-xs shadow-minimal hover:bg-primary-action/90 active:scale-[0.98] transition-all disabled:opacity-50"
                title="Abrir Moodle como Administrador con sesión iniciada al instante"
              >
                {actionLoading === 'launch-campus' ? (
                  <>
                    <span className="h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    <span>Iniciando SSO...</span>
                  </>
                ) : (
                  <>
                    <IconExternalLink className="w-3.5 h-3.5 text-accent-sky" />
                    <span>Entrar al Campus (SSO)</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => setShowCreateUserModal(true)}
                className="inline-flex items-center justify-center gap-1.5 rounded-[6px] border border-border bg-surface hover:bg-surface-muted px-3 py-2 text-xs font-medium text-foreground transition-all shadow-minimal"
              >
                <IconPlus className="w-3.5 h-3.5 text-primary" />
                <span>Nuevo Usuario</span>
              </button>

              <button
                type="button"
                onClick={() => setShowAssignCourseModal(true)}
                className="inline-flex items-center justify-center gap-1.5 rounded-[6px] bg-primary-action text-white hover:bg-primary-action/90 px-3 py-2 text-xs font-semibold transition-all shadow-minimal"
              >
                <IconPlus className="w-3.5 h-3.5 text-accent-sky" />
                <span>Asignar Curso</span>
              </button>

              <button
                type="button"
                onClick={handleBulkMoodleSync}
                disabled={actionLoading === 'bulk-sync'}
                className="inline-flex items-center justify-center gap-1.5 rounded-[6px] border border-border bg-surface hover:bg-surface-muted px-3 py-2 text-xs font-medium text-muted hover:text-foreground transition-all shadow-minimal disabled:opacity-50"
              >
                {actionLoading === 'bulk-sync' ? (
                  <>
                    <span className="h-3 w-3 animate-spin rounded-full border-2 border-foreground border-t-transparent" />
                    <span>Sincronizando...</span>
                  </>
                ) : (
                  <>
                    <IconRefresh className="w-3.5 h-3.5" />
                    <span>Sync Moodle</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Operational Metrics Grid */}
          <div className="mt-5 grid grid-cols-2 gap-3 sm:gap-4 sm:grid-cols-4 border-t border-border pt-4">
            <div className="rounded-[8px] border border-border bg-surface-muted/30 p-3.5 hover:bg-surface-muted/60 transition-colors">
              <span className="text-[11px] font-mono uppercase tracking-wider text-muted">Usuarios Registrados</span>
              <p className="mt-1 text-2xl font-bold tracking-tight text-foreground">{users.length}</p>
              <span className="text-[11px] text-muted flex items-center gap-1 mt-1 font-normal">
                <span className="h-1.5 w-1.5 rounded-full bg-success" />
                {users.filter((u) => u.moodle_sync_status === 'sincronizado').length} en Moodle LMS
              </span>
            </div>

            <div className="rounded-[8px] border border-border bg-surface-muted/30 p-3.5 hover:bg-surface-muted/60 transition-colors">
              <span className="text-[11px] font-mono uppercase tracking-wider text-muted">Cursos Vinculados</span>
              <p className="mt-1 text-2xl font-bold tracking-tight text-foreground">{courses.length}</p>
              <span className="text-[11px] text-muted flex items-center gap-1 mt-1 font-normal">
                <span className="h-1.5 w-1.5 rounded-full bg-primary-action" />
                Catálogo activo oficial
              </span>
            </div>

            <div className="rounded-[8px] border border-border bg-surface-muted/30 p-3.5 hover:bg-surface-muted/60 transition-colors">
              <span className="text-[11px] font-mono uppercase tracking-wider text-muted">Solicitudes Matrícula</span>
              <p className="mt-1 text-2xl font-bold tracking-tight text-foreground">{enrollments.length}</p>
              <span className="text-[11px] text-muted flex items-center gap-1 mt-1 font-normal">
                <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                {enrollments.filter((e) => e.status === 'pendiente').length} pendientes
              </span>
            </div>

            <div className="rounded-[8px] border border-border bg-surface-muted/30 p-3.5 hover:bg-surface-muted/60 transition-colors">
              <span className="text-[11px] font-mono uppercase tracking-wider text-muted">Campus Virtual</span>
              <p className="mt-1 text-sm font-semibold text-success flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-success" />
                Conectado
              </p>
              <button
                type="button"
                onClick={handleLaunchCampusSSO}
                className="text-[11px] text-primary hover:underline inline-block mt-1 font-medium text-left"
              >
                Abrir campus con SSO ↗
              </button>
            </div>
          </div>
        </div>

        {/* Alertas Operativas */}
        {notice && (
          <div className="rounded-[8px] border border-success/25 bg-success/10 p-3.5 text-xs font-medium text-success flex items-center justify-between shadow-minimal">
            <div className="flex items-center gap-2">
              <IconCheck className="w-4 h-4 text-success shrink-0" />
              <span>{notice}</span>
            </div>
            <button type="button" onClick={() => setNotice(null)} className="text-xs opacity-70 hover:opacity-100"><IconClose className="w-3.5 h-3.5" /></button>
          </div>
        )}

        {error && (
          <div className="rounded-[8px] border border-rose-500/25 bg-rose-500/10 p-3.5 text-xs font-medium text-rose-700 dark:text-rose-400 flex items-center justify-between shadow-minimal">
            <div className="flex items-center gap-2">
              <IconAlertTriangle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
              <span>{error}</span>
            </div>
            <button type="button" onClick={() => setError(null)} className="text-xs opacity-70 hover:opacity-100"><IconClose className="w-3.5 h-3.5" /></button>
          </div>
        )}

      {/* ========================================================================= */}
      {/* PESTAÑA PRINCIPAL: ASIGNACIÓN DE CURSOS Y ROLES (FILTRADO AVANZADO)       */}
      {/* ========================================================================= */}
      {activeTab === 'asignaciones' && (
        <div className="space-y-4">
          {/* Header y Filtros Apple SaaS Style */}
          <div className="rounded-[24px] border border-border/60 bg-surface/75 backdrop-blur-xl p-5 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold tracking-tight text-foreground flex items-center gap-2">
                  <IconGroups className="w-5 h-5 text-primary" />
                  <span>Tabla Maestra de Asignación de Cursos y Roles</span>
                </h2>
                <p className="mt-0.5 text-xs text-muted">
                  Filtra usuarios instantáneamente por nombre o correo para asignar materias en Moodle LMS y gestionar roles.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setAssignTargetUserId('');
                    setAssignUserModalSearch('');
                    setAssignCourseId(courses[0]?.id || (courses[0] as any)?.course_mapping_id || '');
                    setShowAssignCourseModal(true);
                  }}
                  className="rounded-xl bg-accent px-4 py-2 text-xs font-medium text-white shadow-xs hover:bg-accent-strong active:scale-[0.98] transition-all flex items-center gap-1.5"
                >
                  <span>+</span>
                  <span>Asignar Curso a Usuario</span>
                </button>
              </div>
            </div>

            {/* Barra de Búsqueda y Filtros en Tiempo Real */}
            <div className="mt-4 grid grid-cols-1 gap-2.5 sm:grid-cols-4 border-t border-border/40 pt-4">
              <div className="sm:col-span-2 relative">
                <input
                  type="text"
                  placeholder="Buscar por nombre, apellido, correo o usuario Moodle..."
                  value={assignSearch}
                  onChange={(e) => setAssignSearch(e.target.value)}
                  className="w-full rounded-xl border border-border/70 bg-foreground/[0.03] focus:bg-surface focus:border-accent px-4 py-2.5 text-xs text-foreground placeholder:text-muted/60 transition-all outline-none"
                />
                {assignSearch && (
                  <button
                    type="button"
                    onClick={() => setAssignSearch('')}
                    className="absolute right-3 top-2.5 text-xs text-muted hover:text-foreground"
                  ><IconClose className="w-3.5 h-3.5" /></button>
                )}
              </div>

              <select
                value={assignRoleFilter}
                onChange={(e) => setAssignRoleFilter(e.target.value)}
                className="rounded-xl border border-border/70 bg-foreground/[0.03] focus:bg-surface focus:border-accent px-3 py-2 text-xs text-foreground transition-all outline-none"
              >
                <option value="">Todos los Roles</option>
                <option value="estudiante">Estudiantes</option>
                <option value="profesor">Docentes / Profesores</option>
                <option value="aspirante">Aspirantes</option>
                <option value="coordinador">Coordinadores</option>
                <option value="administrador">Administradores</option>
                <option value="superadministrador">Superadministradores</option>
              </select>

              <select
                value={assignCourseFilter}
                onChange={(e) => setAssignCourseFilter(e.target.value)}
                className="rounded-xl border border-border/70 bg-foreground/[0.03] focus:bg-surface focus:border-accent px-3 py-2 text-xs text-foreground transition-all outline-none"
              >
                <option value="">Todos los Cursos</option>
                <option value="con_cursos">Con cursos matriculados</option>
                <option value="sin_cursos">Sin cursos asignados</option>
              </select>
            </div>

            <div className="mt-2 text-[11px] text-muted flex items-center justify-between">
              <span>
                Mostrando <strong className="text-foreground">{filteredAssignmentUsers.length}</strong> de <strong className="text-foreground">{users.length}</strong> usuarios
              </span>
              {(assignSearch || assignRoleFilter || assignCourseFilter) && (
                <button
                  type="button"
                  onClick={() => {
                    setAssignSearch('');
                    setAssignRoleFilter('');
                    setAssignCourseFilter('');
                  }}
                  className="text-accent hover:underline font-medium"
                >
                  Restablecer filtros
                </button>
              )}
            </div>
          </div>

          {/* Tabla de Asignaciones Apple Style */}
          <div className="overflow-hidden rounded-[24px] border border-border/60 bg-surface/80 backdrop-blur-2xl shadow-apple">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-border/40 bg-foreground/[0.015] text-muted uppercase tracking-wider text-[10px] font-semibold">
                  <tr>
                    <th className="px-6 py-3.5">Usuario</th>
                    <th className="px-6 py-3.5">Roles en Portal</th>
                    <th className="px-6 py-3.5">Materias Asignadas en Moodle</th>
                    <th className="px-6 py-3.5 text-right">Acciones Rápidas</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {filteredAssignmentUsers.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="p-8 text-center text-muted">
                        No se encontraron usuarios con los criterios de búsqueda especificados.
                      </td>
                    </tr>
                  ) : (
                    filteredAssignmentUsers.map((u) => {
                      const userEnrs = userEnrollmentsMap[u.id] || [];
                      const initials = `${(u.first_name || 'U')[0]}${(u.last_name || 'U')[0]}`.toUpperCase();
                      const userRoles = (u.active_roles || u.roles || []) as string[];

                      return (
                        <tr key={u.id} className="hover:bg-foreground/[0.015] transition-colors">
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-tr from-accent/20 to-accent/5 font-semibold text-accent text-xs ring-1 ring-accent/20">
                                {initials}
                              </div>
                              <div>
                                <p className="font-semibold text-foreground text-sm tracking-tight">
                                  {u.first_name} {u.last_name}
                                </p>
                                <p className="text-xs text-muted font-mono">
                                  {u.email}
                                </p>
                                <div className="mt-1 flex items-center gap-1.5">
                                  <MoodleSyncBadge status={u.moodle_sync_status} moodleId={u.moodle_user_id} />
                                  {u.moodle_username && (
                                    <span className="text-[10px] text-muted font-mono">
                                      (@{u.moodle_username})
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          </td>

                          <td className="px-6 py-4">
                            <div className="flex flex-wrap items-center gap-1.5 max-w-xs">
                              {userRoles.map((role) => (
                                <span
                                  key={role}
                                  className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium border ${
                                    role === 'superadministrador'
                                      ? 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20'
                                      : role === 'administrador'
                                      ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20'
                                      : role === 'coordinador'
                                      ? 'bg-primary/10 text-primary border-primary/20'
                                      : role === 'profesor'
                                      ? 'bg-success/10 text-success border-success/20'
                                      : role === 'estudiante'
                                      ? 'bg-accent/10 text-accent border-accent/20'
                                      : 'bg-foreground/[0.04] text-muted border-border/80'
                                  }`}
                                >
                                  {role}
                                </span>
                              ))}
                              <button
                                type="button"
                                onClick={() => openRolesModalForUser(u)}
                                className="rounded-full border border-border/80 bg-surface px-2.5 py-0.5 text-[11px] font-medium text-accent hover:bg-foreground/[0.04] transition-colors"
                                title="Agregar o revocar roles de este usuario"
                              >
                                Roles
                              </button>
                            </div>
                          </td>

                          <td className="px-6 py-4">
                            {userEnrs.length === 0 ? (
                              <span className="text-xs text-muted/70 italic">
                                Sin cursos asignados
                              </span>
                            ) : (
                              <div className="flex flex-col gap-1.5 max-w-md">
                                {userEnrs.map((enr) => {
                                  const cName =
                                    enr.course_mappings?.course_name ||
                                    enr.course_mappings?.courses?.name ||
                                    enr.course_mappings?.moodle_shortname ||
                                    'Materia';
                                  const cCode =
                                    enr.course_mappings?.portal_course_code ||
                                    enr.course_mappings?.code ||
                                    '';
                                  const mId = enr.course_mappings?.moodle_course_id;

                                  return (
                                    <div
                                      key={enr.id}
                                      className="flex items-center justify-between rounded-xl border border-border/50 bg-foreground/[0.015] px-3 py-1.5"
                                    >
                                      <div className="flex items-center gap-1.5">
                                        {cCode && (
                                          <span className="font-mono text-[10px] font-semibold text-accent">
                                            [{cCode}]
                                          </span>
                                        )}
                                        <span className="font-medium text-foreground text-xs">
                                          {cName}
                                        </span>
                                        {mId && (
                                          <span className="text-[10px] text-muted">
                                            (Moodle #{mId})
                                          </span>
                                        )}
                                      </div>
                                      <span
                                        className={`rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider ${
                                          enr.status === 'sincronizada' || enr.status === 'autorizada'
                                            ? 'bg-success/10 text-success border border-success/20'
                                            : enr.status === 'pendiente'
                                            ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20'
                                            : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20'
                                        }`}
                                      >
                                        {enr.status}
                                      </span>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </td>

                          <td className="px-6 py-4 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <button
                                type="button"
                                onClick={() => openAssignModalForUser(u)}
                                className="rounded-xl bg-accent hover:bg-accent-strong text-white px-3.5 py-1.5 text-xs font-medium shadow-xs transition-all active:scale-[0.98]"
                              >
                                + Asignar Curso
                              </button>
                              <button
                                type="button"
                                onClick={() => openRolesModalForUser(u)}
                                className="rounded-xl border border-border/80 bg-surface hover:bg-foreground/[0.04] text-foreground/80 px-2.5 py-1.5 text-xs font-medium transition-all"
                              >
                                Roles
                              </button>
                              {!u.moodle_user_id && (
                                <button
                                  type="button"
                                  onClick={() => handleSyncSingleUser(u.id)}
                                  disabled={actionLoading === `user-sync-${u.id}`}
                                  className="rounded-xl border border-accent/30 bg-accent/10 px-2.5 py-1.5 text-xs font-medium text-accent hover:bg-accent/20 transition-all"
                                  title="Crear cuenta de este usuario en Moodle"
                                >
                                  Sync Moodle
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* PESTAÑA 2: GESTIÓN DE USUARIOS                                            */}
      {/* ========================================================================= */}
      {activeTab === 'usuarios' && (
        <div className="space-y-4">
          {/* Header y Filtros Apple SaaS Style */}
          <div className="rounded-[24px] border border-border/60 bg-surface/75 backdrop-blur-xl p-5 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold tracking-tight text-foreground flex items-center gap-2">
                  <IconStudents className="w-5 h-5 text-primary" />
                  <span>Directorio de Usuarios y Accesos</span>
                </h2>
                <p className="mt-0.5 text-xs text-muted">
                  Consulta de identidades registradas, estados de cuenta y sincronización directa con Moodle LMS.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setShowCreateUserModal(true)}
                className="rounded-xl bg-accent px-4 py-2 text-xs font-medium text-white shadow-xs hover:bg-accent-strong active:scale-[0.98] transition-all flex items-center gap-1.5 self-start sm:self-auto"
              >
                <span>+</span>
                <span>Crear Usuario</span>
              </button>
            </div>

            {/* Barra de Filtros */}
            <div className="mt-4 grid grid-cols-1 gap-2.5 sm:grid-cols-4 border-t border-border/40 pt-4">
              <div className="sm:col-span-2 relative">
                <input
                  type="text"
                  placeholder="Buscar por nombre, apellido, correo o usuario Moodle..."
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  className="w-full rounded-xl border border-border/70 bg-foreground/[0.03] focus:bg-surface focus:border-accent px-4 py-2.5 text-xs text-foreground placeholder:text-muted/60 transition-all outline-none"
                />
                {userSearch && (
                  <button
                    type="button"
                    onClick={() => setUserSearch('')}
                    className="absolute right-3 top-2.5 text-xs text-muted hover:text-foreground"
                  ><IconClose className="w-3.5 h-3.5" /></button>
                )}
              </div>

              <select
                value={userRoleFilter}
                onChange={(e) => setUserRoleFilter(e.target.value)}
                className="rounded-xl border border-border/70 bg-foreground/[0.03] focus:bg-surface focus:border-accent px-3 py-2 text-xs text-foreground transition-all outline-none"
              >
                <option value="">Todos los Roles</option>
                <option value="estudiante">Estudiantes</option>
                <option value="profesor">Docentes / Profesores</option>
                <option value="aspirante">Aspirantes</option>
                <option value="coordinador">Coordinadores</option>
                <option value="administrador">Administradores</option>
                <option value="superadministrador">Superadministradores</option>
              </select>

              <select
                value={userStatusFilter}
                onChange={(e) => setUserStatusFilter(e.target.value)}
                className="rounded-xl border border-border/70 bg-foreground/[0.03] focus:bg-surface focus:border-accent px-3 py-2 text-xs text-foreground transition-all outline-none"
              >
                <option value="">Todos los Estados</option>
                <option value="activo">Activo</option>
                <option value="pendiente">Pendiente</option>
                <option value="suspendido">Suspendido</option>
                <option value="inactivo">Inactivo</option>
                <option value="baja">Baja</option>
              </select>
            </div>

            <div className="mt-2 text-[11px] text-muted flex items-center justify-between">
              <span>
                Mostrando <strong className="text-foreground">{filteredUsers.length}</strong> de <strong className="text-foreground">{users.length}</strong> usuarios
              </span>
              {(userSearch || userRoleFilter || userStatusFilter) && (
                <button
                  type="button"
                  onClick={() => {
                    setUserSearch('');
                    setUserRoleFilter('');
                    setUserStatusFilter('');
                  }}
                  className="text-accent hover:underline font-medium"
                >
                  Restablecer filtros
                </button>
              )}
            </div>
          </div>

          {/* Tabla de Usuarios Apple Style */}
          <div className="overflow-hidden rounded-[24px] border border-border/60 bg-surface/80 backdrop-blur-2xl shadow-apple">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-border/40 bg-foreground/[0.015] text-muted uppercase tracking-wider text-[10px] font-semibold">
                  <tr>
                    <th className="px-6 py-3.5">Usuario / Correo</th>
                    <th className="px-6 py-3.5">Roles Activos</th>
                    <th className="px-6 py-3.5">Estado Portal</th>
                    <th className="px-6 py-3.5">Programa asignado</th>
                    <th className="px-6 py-3.5">Fecha de alta</th>
                    <th className="px-6 py-3.5">Vinculación Moodle</th>
                    <th className="px-6 py-3.5 text-right">Acciones de Control</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {filteredUsers.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-muted">
                        No se encontraron usuarios con los criterios de búsqueda especificados.
                      </td>
                    </tr>
                  ) : (
                    filteredUsers.map((u) => {
                      const initials = `${(u.first_name || 'U')[0]}${(u.last_name || 'U')[0]}`.toUpperCase();
                      const userRoles = (u.active_roles || u.roles || []) as string[];

                      return (
                        <tr key={u.id} className="hover:bg-foreground/[0.015] transition-colors">
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-tr from-accent/20 to-accent/5 font-semibold text-accent text-xs ring-1 ring-accent/20">
                                {initials}
                              </div>
                              <div>
                                <p className="font-semibold text-foreground text-sm tracking-tight">
                                  {u.first_name} {u.last_name}
                                </p>
                                <p className="text-xs text-muted font-mono">{u.email}</p>
                                {u.phone && <p className="text-[10px] text-muted/70 mt-0.5">Tel: {u.phone}</p>}
                              </div>
                            </div>
                          </td>

                          <td className="px-6 py-4">
                            <div className="flex flex-wrap items-center gap-1.5 max-w-xs">
                              {userRoles.length > 0 ? (
                                userRoles.map((r: string) => (
                                  <span
                                    key={r}
                                    className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium border ${
                                      r === 'superadministrador'
                                        ? 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20'
                                        : r === 'administrador'
                                        ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20'
                                        : r === 'coordinador'
                                        ? 'bg-primary/10 text-primary border-primary/20'
                                        : r === 'profesor'
                                        ? 'bg-success/10 text-success border-success/20'
                                        : r === 'estudiante'
                                        ? 'bg-accent/10 text-accent border-accent/20'
                                        : 'bg-foreground/[0.04] text-muted border-border/80'
                                    }`}
                                  >
                                    {r}
                                  </span>
                                ))
                              ) : (
                                <span className="text-[11px] text-muted italic">Sin roles</span>
                              )}
                            </div>
                          </td>

                          <td className="px-6 py-4">
                            <span
                              className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium capitalize border ${
                                u.status === 'activo'
                                  ? 'bg-success/10 text-success border-success/20'
                                  : u.status === 'pendiente'
                                  ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20'
                                  : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20'
                              }`}
                            >
                              {u.status}
                            </span>
                          </td>

                          <td className="px-6 py-4 text-muted">
                            {u.programs?.length ? (
                              <div className="flex min-w-40 flex-col gap-1.5">
                                {u.programs.map((program) => (
                                  <span key={program.program_id} className="rounded-md bg-primary/10 px-2 py-1 text-[11px] font-medium text-primary">
                                    {program.name}<span className="ml-1 text-muted">· {program.academic_status}</span>
                                  </span>
                                ))}
                              </div>
                            ) : 'Sin programa'}
                          </td>

                          <td className="px-6 py-4 text-muted">
                            {u.created_at ? new Date(u.created_at).toLocaleDateString('es-MX') : 'No disponible'}
                          </td>

                          <td className="px-6 py-4">
                            <MoodleSyncBadge status={u.moodle_sync_status} moodleId={u.moodle_user_id} />
                            {u.moodle_username && (
                              <p className="mt-1 font-mono text-[10px] text-muted">
                                @{u.moodle_username}
                              </p>
                            )}
                          </td>

                          <td className="px-6 py-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                type="button"
                                disabled={!hasRole('superadministrador') && (u.active_roles ?? u.roles).some((role) => role === 'administrador' || role === 'superadministrador')}
                                onClick={() => setSelectedUserForRole(u)}
                                className="rounded-xl border border-border/80 bg-surface hover:bg-foreground/[0.04] text-foreground/80 px-2.5 py-1 text-xs font-medium transition-all"
                                title="Gestionar roles"
                              >
                                Roles
                              </button>

                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedUserForStatus(u);
                                  setNewStatus(u.status || 'activo');
                                }}
                                className="rounded-xl border border-border/80 bg-surface hover:bg-foreground/[0.04] text-foreground/80 px-2.5 py-1 text-xs font-medium transition-all"
                                disabled={!hasRole('superadministrador') && (u.active_roles ?? u.roles).some((role) => role === 'administrador' || role === 'superadministrador')}
                                title="Modificar estado de cuenta"
                              >
                                Estado
                              </button>

                              {!u.moodle_user_id && (
                                <button
                                  type="button"
                                  disabled={actionLoading === `user-sync-${u.id}`}
                                  onClick={() => handleSyncSingleUser(u.id)}
                                  className="rounded-xl border border-accent/30 bg-accent/10 px-2.5 py-1 text-xs font-medium text-accent hover:bg-accent/20 transition-all disabled:opacity-50"
                                  title="Sincronizar a Moodle"
                                >
                                  {actionLoading === `user-sync-${u.id}` ? '...' : 'Sync Moodle'}
                                </button>
                              )}

                              <button
                                type="button"
                                onClick={() => {
                                  setAssignTargetUserId(u.id);
                                  setShowAssignCourseModal(true);
                                }}
                                className="rounded-xl bg-accent hover:bg-accent-strong text-white px-3 py-1 text-xs font-medium shadow-xs transition-all active:scale-[0.98]"
                                title="Asignar curso directamente"
                              >
                                + Curso
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* PESTAÑA 3: CURSOS & ASIGNACIÓN A MOODLE                                    */}
      {/* ========================================================================= */}
      {activeTab === 'cursos' && (
        <div className="space-y-4">
          <div className="rounded-[24px] border border-border/60 bg-surface/75 backdrop-blur-xl p-5 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold tracking-tight text-foreground flex items-center gap-2">
                  <IconGroups className="w-5 h-5 text-primary" />
                  <span>Catálogo de Cursos Vinculados con Moodle</span>
                </h2>
                <p className="mt-0.5 text-xs text-muted">
                  Cada materia se enlaza a un curso en Moodle LMS con enrolamiento automático y salto SSO sin contraseña.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowCreateCourseModal(true)}
                  className="rounded-xl bg-accent px-4 py-2 text-xs font-medium text-white shadow-xs hover:bg-accent-strong active:scale-[0.98] transition-all flex items-center gap-1.5"
                >
                  <span>+</span>
                  <span>Vincular Nuevo Curso Moodle</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowAssignCourseModal(true)}
                  className="rounded-xl border border-border/80 bg-surface hover:bg-foreground/[0.04] px-3.5 py-2 text-xs font-medium text-foreground transition-all shadow-xs"
                >
                  + Asignar Curso
                </button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {courses.length === 0 ? (
              <div className="col-span-full rounded-[24px] border border-dashed border-border/70 p-12 text-center text-muted">
                No hay cursos vinculados actualmente. Pulsa &quot;Vincular Nuevo Curso Moodle&quot; para registrar uno.
              </div>
            ) : (
              courses.map((course) => (
                <div
                  key={course.id}
                  className="rounded-[24px] border border-border/60 bg-surface/80 backdrop-blur-2xl p-6 shadow-apple hover:border-accent/40 hover:shadow-lg transition-all flex flex-col justify-between group"
                >
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="rounded-full bg-accent/10 px-2.5 py-0.5 font-mono text-[10px] font-semibold text-accent border border-accent/20">
                        {course.portal_course_code || course.code || 'CUR-00'}
                      </span>
                      <span className="rounded-full bg-success/10 px-2.5 py-0.5 text-[10px] font-medium text-success border border-success/20">
                        Moodle #{course.moodle_course_id}
                      </span>
                    </div>

                    <h3 className="mt-3.5 font-semibold text-foreground text-sm tracking-tight leading-snug group-hover:text-accent transition-colors">
                      {course.course_name || course.name}
                    </h3>
                    <p className="mt-1 font-mono text-[11px] text-muted">
                      Shortname: {course.moodle_shortname || 'N/A'}
                    </p>
                    {course.programs?.name && (
                      <p className="mt-1.5 text-[11px] text-muted/80 flex items-center gap-1">
                        <IconGrades className="w-5 h-5 text-primary" />
                        <span>{course.programs.name}</span>
                      </p>
                    )}
                  </div>

                  <div className="mt-6 border-t border-border/40 pt-4 flex items-center justify-between gap-2">
                    <a
                      href={`${process.env.NEXT_PUBLIC_MOODLE_URL || 'http://192.168.191.171/moodle'}/course/view.php?id=${course.moodle_course_id}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs text-accent font-medium hover:underline inline-flex items-center gap-1"
                    >
                      Abrir en Moodle ↗
                    </a>
                    <button
                      type="button"
                      onClick={() => {
                        setAssignCourseId(course.id);
                        setShowAssignCourseModal(true);
                      }}
                      className="rounded-xl border border-border/80 bg-surface hover:bg-foreground/[0.04] px-3 py-1.5 text-xs font-medium text-foreground transition-all shadow-xs"
                    >
                      Asignar Matrícula
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* PESTAÑA 4: MATRÍCULAS & APROBACIONES                                      */}
      {/* ========================================================================= */}
      {activeTab === 'matriculas' && (
        <div className="space-y-4">
          <div className="rounded-[24px] border border-border/60 bg-surface/75 backdrop-blur-xl p-5 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold tracking-tight text-foreground flex items-center gap-2">
                  <IconAttendance className="w-5 h-5 text-primary" />
                  <span>Solicitudes y Autorizaciones de Matrícula</span>
                </h2>
                <p className="mt-0.5 text-xs text-muted">
                  Al autorizar una inscripción, NestJS invoca automáticamente el Web Service de Moodle para enrolar al estudiante.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2.5">
                <select
                  value={enrollmentStatusFilter}
                  onChange={(e) => setEnrollmentStatusFilter(e.target.value)}
                  className="rounded-xl border border-border/70 bg-foreground/[0.03] focus:bg-surface focus:border-accent px-3 py-2 text-xs text-foreground transition-all outline-none"
                >
                  <option value="">Todas las Solicitudes</option>
                  <option value="pendiente">Solo Pendientes</option>
                  <option value="autorizada">Autorizadas</option>
                  <option value="sincronizada">Sincronizadas con Moodle</option>
                  <option value="rechazada">Rechazadas</option>
                </select>

                <button
                  type="button"
                  onClick={() => setShowAssignCourseModal(true)}
                  className="rounded-xl bg-accent px-4 py-2 text-xs font-medium text-white shadow-xs hover:bg-accent-strong active:scale-[0.98] transition-all flex items-center gap-1.5"
                >
                  <span>+</span>
                  <span>Nueva Matrícula</span>
                </button>
              </div>
            </div>
          </div>

          <div className="overflow-hidden rounded-[24px] border border-border/60 bg-surface/80 backdrop-blur-2xl shadow-apple">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-border/40 bg-foreground/[0.015] text-muted uppercase tracking-wider text-[10px] font-semibold">
                  <tr>
                    <th className="px-6 py-3.5">Aspirante / Estudiante</th>
                    <th className="px-6 py-3.5">Materia / Curso</th>
                    <th className="px-6 py-3.5">Rol Aula</th>
                    <th className="px-6 py-3.5">Estado</th>
                    <th className="px-6 py-3.5 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {filteredEnrollments.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="p-8 text-center text-muted">
                        No hay solicitudes de matrícula que coincidan con el filtro seleccionado.
                      </td>
                    </tr>
                  ) : (
                    filteredEnrollments.map((enr) => {
                      const studentName = `${enr.profiles?.first_name || 'Estudiante'} ${enr.profiles?.last_name || ''}`.trim();
                      const initials = `${(enr.profiles?.first_name || 'E')[0]}${(enr.profiles?.last_name || '')[0] || ''}`.toUpperCase();

                      return (
                        <tr key={enr.id} className="hover:bg-foreground/[0.015] transition-colors">
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-tr from-accent/20 to-accent/5 font-semibold text-accent text-xs ring-1 ring-accent/20">
                                {initials}
                              </div>
                              <div>
                                <p className="font-semibold text-foreground text-sm tracking-tight">
                                  {studentName}
                                </p>
                                <p className="text-xs text-muted font-mono">{enr.profiles?.email}</p>
                              </div>
                            </div>
                          </td>

                          <td className="px-6 py-4">
                            <p className="font-semibold text-foreground text-xs">
                              {enr.course_mappings?.course_name || enr.course_mappings?.courses?.name || enr.course_mappings?.moodle_shortname || 'Curso INICIA'}
                            </p>
                            <p className="font-mono text-[10px] text-muted mt-0.5">
                              ID Moodle: #{enr.course_mappings?.moodle_course_id || 'N/A'}
                            </p>
                          </td>

                          <td className="px-6 py-4">
                            <span className="font-mono text-xs font-semibold text-accent">
                              {enr.moodle_role || 'student'}
                            </span>
                          </td>

                          <td className="px-6 py-4">
                            <span
                              className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium capitalize border ${
                                enr.status === 'sincronizada' || enr.status === 'autorizada'
                                  ? 'bg-success/10 text-success border-success/20'
                                  : enr.status === 'pendiente'
                                  ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20'
                                  : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20'
                              }`}
                            >
                              {enr.status}
                            </span>
                          </td>

                          <td className="px-6 py-4 text-right">
                            <div className="inline-flex items-center justify-end gap-1.5">
                              {enr.status === 'pendiente' && (
                                <>
                                  <button
                                    type="button"
                                    disabled={actionLoading === `enr-${enr.id}`}
                                    onClick={() => handleAuthorizeEnrollment(enr.id, 'autorizada')}
                                    className="rounded-xl bg-primary-action px-3 py-1.5 text-xs font-medium text-white hover:bg-accent-strong transition-all shadow-xs disabled:opacity-50 active:scale-[0.98]"
                                  >
                                    {actionLoading === `enr-${enr.id}` ? '...' : 'Aprobar & Matricular'}
                                  </button>
                                  <button
                                    type="button"
                                    disabled={actionLoading === `enr-${enr.id}`}
                                    onClick={() => handleAuthorizeEnrollment(enr.id, 'rechazada')}
                                    className="rounded-xl border border-rose-500/20 bg-rose-500/10 px-2.5 py-1.5 text-xs font-medium text-rose-600 dark:text-rose-400 hover:bg-rose-500/20 transition-all disabled:opacity-50"
                                  >
                                    Rechazar
                                  </button>
                                </>
                              )}

                              {enr.status === 'autorizada' && (
                                <button
                                  type="button"
                                  disabled={actionLoading === `sync-enr-${enr.id}`}
                                  onClick={() => handleRetryMoodleSync(enr.id)}
                                  className="rounded-xl border border-accent/30 bg-accent/10 px-3 py-1.5 text-xs font-medium text-accent hover:bg-accent/20 transition-all disabled:opacity-50"
                                >
                                  {actionLoading === `sync-enr-${enr.id}` ? 'Sincronizando...' : 'Reintentar Moodle'}
                                </button>
                              )}

                              <button
                                type="button"
                                disabled={actionLoading === `delete-enr-${enr.id}`}
                                onClick={() =>
                                  handleDeleteEnrollment(
                                    enr.id,
                                    studentName,
                                    enr.course_mappings?.course_name || 'Curso',
                                  )
                                }
                                className="rounded-[6px] border border-rose-500/20 bg-rose-500/10 px-2.5 py-1.5 text-xs font-medium text-rose-600 dark:text-rose-400 hover:bg-rose-500/20 transition-all disabled:opacity-50"
                                title="Desasignar curso al usuario"
                              >
                                {actionLoading === `delete-enr-${enr.id}` ? '...' : 'Desasignar'}
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* PESTAÑA 5: PROGRAMAS ACADÉMICOS                                           */}
      {/* ========================================================================= */}
      {activeTab === 'admisiones' && (
        <section className="space-y-4 rounded-xl border border-border bg-surface p-5 shadow-minimal">
          <div>
            <h2 className="text-lg font-semibold text-foreground">Postulaciones a programas</h2>
            <p className="mt-1 text-sm text-muted">Revisa cada solicitud y registra el dictamen. Admitir activa el perfil del aspirante según las reglas de la API.</p>
          </div>
          {applicationsError ? (
            <div className="flex items-center gap-3 text-sm">
              <p role="alert" className="text-danger">{applicationsError}</p>
              <button type="button" onClick={() => void loadData()} className="font-semibold text-primary underline">Reintentar</button>
            </div>
          ) : applications.length === 0 ? <p className="text-sm text-muted">No hay postulaciones registradas.</p> : (
            <ul className="space-y-3">
              {applications.map((application) => (
                <li key={application.id} className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-border p-4">
                  <div className="min-w-0 text-sm">
                    <p className="font-semibold text-foreground">{application.profiles ? `${application.profiles.first_name} ${application.profiles.last_name}` : application.applicant_id}</p>
                    <p className="text-muted">{application.profiles?.email} · {application.programs?.name || 'Programa académico'}</p>
                    <p className="mt-1 text-xs capitalize text-primary">Estado: {application.status.replace('_', ' ')}</p>
                  </div>
                  {application.status === 'admitido' && (
                    <div className="flex flex-wrap gap-2">
                    <button type="button" onClick={() => {
                      setAssignTargetUserId(application.applicant_id);
                      setAssignCourseId('');
                      setAssignMoodleRole('student');
                      setShowAssignCourseModal(true);
                    }} className="rounded-md border border-border px-3 py-1.5 text-xs font-medium text-primary">
                      Asignar curso
                    </button>
                    <button type="button" disabled={actionLoading !== null} onClick={() => handleReviewApplication(application.id, 'admitido')} className="rounded-md border border-border px-3 py-1.5 text-xs">
                      Sincronizar cursos iniciales
                    </button>
                    </div>
                  )}
                  {application.status !== 'admitido' && <div className="flex flex-wrap gap-2">
                    {([
                      ['en_revision', 'Poner en revisión'],
                      ['admitido', 'Admitir'],
                      ['rechazado', 'Rechazar'],
                    ] as const).map(([status, label]) => (
                      <button key={status} type="button" disabled={actionLoading !== null || application.status === status} onClick={() => handleReviewApplication(application.id, status)} className="rounded-md border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:border-primary disabled:opacity-50">
                        {label}
                      </button>
                    ))}
                  </div>}
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {activeTab === 'programas' && (
        <div className="space-y-4">
          <div className="rounded-[24px] border border-border/60 bg-surface/75 backdrop-blur-xl p-5 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold tracking-tight text-foreground flex items-center gap-2">
                  <IconGrades className="w-5 h-5 text-primary" />
                  <span>Programas Académicos Oficiales</span>
                </h2>
                <p className="mt-0.5 text-xs text-muted">
                  Licenciaturas, Maestrías, Diplomados y Certificaciones que estructuran los cursos del campus.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowCreateProgramModal(true)}
                className="rounded-xl bg-accent px-4 py-2 text-xs font-medium text-white shadow-xs hover:bg-accent-strong active:scale-[0.98] transition-all flex items-center gap-1.5 self-start sm:self-auto"
              >
                <span>+</span>
                <span>Nuevo Programa</span>
              </button>
            </div>
          </div>

          <section className="space-y-4 rounded-xl border border-border bg-surface p-5" aria-labelledby="assign-program-heading">
            <h3 id="assign-program-heading" className="font-semibold">Asignar programa a un usuario</h3>
            <p className="text-sm text-muted">Usa Postulaciones para aprobar una postulación y habilitar el rol Estudiante. Aquí puedes registrar la inscripción académica a un programa.</p>
            {programsError && <p role="alert" className="text-sm text-danger">{programsError} <button type="button" onClick={() => void loadData()} className="underline">Reintentar</button></p>}
            <form onSubmit={searchProgramUsers} className="flex flex-wrap items-end gap-2">
              <label className="text-sm">Buscar usuario por nombre o correo
                <input value={programUserSearch} onChange={(event) => setProgramUserSearch(event.target.value)} className="block w-full rounded-md border border-border bg-surface px-3 py-2" />
              </label>
              <button type="submit" disabled={actionLoading !== null} className="rounded-md border border-border px-3 py-2 text-sm">Buscar</button>
            </form>
            {programUsers?.length === 0 && <p className="text-sm text-muted">No se encontraron usuarios.</p>}
            <form onSubmit={assignProgram} className="flex flex-wrap items-end gap-3">
              <label className="text-sm">Usuario
                <select required value={programUserId} onChange={(event) => setProgramUserId(event.target.value)} className="block max-w-full rounded-md border border-border bg-surface px-3 py-2">
                  <option value="">Selecciona un usuario</option>
                  {(programUsers ?? users).map((person) => <option key={person.id} value={person.id}>{person.first_name} {person.last_name} · {person.email}</option>)}
                </select>
              </label>
              <label className="text-sm">Programa
                <select required value={programToAssign} onChange={(event) => setProgramToAssign(event.target.value)} className="block max-w-full rounded-md border border-border bg-surface px-3 py-2">
                  <option value="">Selecciona un programa</option>
                  {programs.filter((program) => program.is_active).map((program) => <option key={program.id} value={program.id}>{program.name}</option>)}
                </select>
              </label>
              <button type="submit" disabled={actionLoading !== null || !programUserId || !programToAssign || Boolean(programsError)} className="rounded-md bg-primary-action px-3 py-2 text-sm text-white disabled:opacity-50">Asignar programa</button>
            </form>
          </section>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {programs.map((prog) => (
              <div
                key={prog.id}
                className="rounded-[24px] border border-border/60 bg-surface/80 backdrop-blur-2xl p-6 shadow-apple hover:shadow-lg transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="rounded-full bg-accent/10 px-2.5 py-0.5 text-[10px] font-semibold text-accent uppercase border border-accent/20">
                      {prog.type}
                    </span>
                    <span className="text-[11px] text-muted capitalize font-medium">{prog.modality}</span>
                  </div>
                  <h3 className="mt-3.5 font-semibold text-foreground text-sm tracking-tight">{prog.name}</h3>
                  <p className="mt-1.5 text-xs text-muted leading-relaxed line-clamp-2">{prog.description}</p>
                </div>
                <div className="mt-5 border-t border-border/40 pt-4 flex items-center justify-between text-[11px] text-muted">
                  <span className="font-mono font-medium text-foreground/80">Código: {prog.code}</span>
                  <span>{prog.duration_text || `${prog.duration_hours} hrs`}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* PESTAÑA 6: DIAGNÓSTICO E INTEGRACIÓN MOODLE                               */}
      {/* ========================================================================= */}
      {activeTab === 'moodle' && (
        <div className="space-y-6">
          <div className="rounded-[28px] border border-border/60 bg-surface/80 backdrop-blur-2xl p-6 sm:p-8 shadow-apple space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-success/10 px-3 py-0.5 text-[11px] font-medium text-success border border-success/20">
                    <span className="h-1.5 w-1.5 rounded-full bg-success animate-pulse" />
                    Enlace Bidireccional Activo
                  </span>
                </div>
                <h2 className="text-xl font-semibold tracking-tight text-foreground">
                  Diagnóstico e Integración con Moodle LMS
                </h2>
                <p className="text-xs text-muted max-w-2xl mt-0.5">
                  Conexión REST mediante Web Services oficiales y autenticación transparente vía token seguro (<code>auth_userkey</code>).
                </p>
              </div>

              <button
                type="button"
                onClick={handleLaunchCampusSSO}
                disabled={actionLoading === 'launch-campus'}
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-foreground text-background font-medium px-5 py-2.5 text-xs shadow-xs hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-50 self-start sm:self-auto"
              >
                {actionLoading === 'launch-campus' ? (
                  <>
                    <span className="h-3 w-3 animate-spin rounded-full border-2 border-background border-t-transparent" />
                    <span>Iniciando SSO...</span>
                  </>
                ) : (
                  <>
                    <IconExternalLink className="w-4 h-4 text-accent-sky" />
                    <span>Abrir Campus con SSO Admin</span>
                  </>
                )}
              </button>
            </div>

            {/* Tarjetas de Telemetría Bento */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 border-t border-border/40 pt-6">
              <div className="rounded-2xl border border-border/50 bg-foreground/[0.015] p-5">
                <span className="text-[11px] font-medium tracking-wide uppercase text-muted">URL del Campus</span>
                <p className="mt-1 font-mono text-sm font-semibold text-foreground">{process.env.NEXT_PUBLIC_MOODLE_URL || 'http://192.168.191.171/moodle'}</p>
                <span className="text-[11px] text-muted mt-1 block">Acceso local y de intranet</span>
              </div>
              <div className="rounded-2xl border border-border/50 bg-foreground/[0.015] p-5">
                <span className="text-[11px] font-medium tracking-wide uppercase text-muted">Versión del Core</span>
                <p className="mt-1 text-sm font-semibold text-success flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-success" />
                  Moodle 5.3+ (Build 20261021)
                </p>
                <span className="text-[11px] text-muted mt-1 block">Compatibilidad REST total</span>
              </div>
              <div className="rounded-2xl border border-border/50 bg-foreground/[0.015] p-5">
                <span className="text-[11px] font-medium tracking-wide uppercase text-muted">Mecanismo SSO</span>
                <p className="mt-1 text-sm font-semibold text-success flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-success" />
                  auth_userkey (One-Time Key)
                </p>
                <span className="text-[11px] text-muted mt-1 block">Cero contraseñas compartidas</span>
              </div>
            </div>

            <div className="border-t border-border/40 pt-6 space-y-3">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted">
                Funciones Web Services Oficiales Habilitadas
              </h3>
              <div className="flex flex-wrap gap-2">
                {[
                  'auth_userkey_request_login_url (SSO)',
                  'core_webservice_get_site_info',
                  'core_user_create_users',
                  'core_user_update_users',
                  'core_user_get_users_by_field',
                  'core_enrol_get_users_courses',
                  'enrol_manual_enrol_users',
                  'enrol_manual_unenrol_users',
                  'core_course_get_courses',
                  'core_course_get_courses_by_field',
                ].map((fn) => (
                  <span
                    key={fn}
                    className="rounded-xl bg-foreground/[0.025] border border-border/60 px-3 py-1.5 font-mono text-[11px] text-foreground/80 flex items-center gap-1.5"
                  >
                    <span className="h-1.5 w-1.5 rounded-full bg-success" />
                    <span>{fn}</span>
                  </span>
                ))}
              </div>
            </div>

            <div className="border-t border-border/40 pt-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <p className="text-xs text-muted max-w-xl">
                La sincronización opera en tiempo real con tolerancia a fallos transitorios y registro auditable en PostgreSQL.
              </p>
              <button
                type="button"
                onClick={handleBulkMoodleSync}
                disabled={actionLoading === 'bulk-sync'}
                className="rounded-xl border border-border/80 bg-surface hover:bg-foreground/[0.04] px-4 py-2 text-xs font-medium text-foreground transition-all shadow-xs disabled:opacity-50 active:scale-[0.98] flex items-center gap-2 self-start sm:self-auto"
              >
                {actionLoading === 'bulk-sync' ? (
                  <>
                    <span className="h-3 w-3 animate-spin rounded-full border-2 border-foreground border-t-transparent" />
                    <span>Ejecutando...</span>
                  </>
                ) : (
                  <>
                    <IconRefresh className="w-4 h-4 text-primary" />
                    <span>Sincronización Masiva</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* PESTAÑA 7: AUDITORÍA & LOGS                                               */}
      {/* ========================================================================= */}
      {activeTab === 'auditoria' && (
        <div className="space-y-4">
          <div className="rounded-[24px] border border-border/60 bg-surface/75 backdrop-blur-xl p-5 shadow-xs">
            <h2 className="text-lg font-semibold tracking-tight text-foreground flex items-center gap-2">
              <IconAudit className="w-5 h-5 text-primary" />
              <span>Bitácora Inmutable de Auditoría</span>
            </h2>
            <p className="mt-0.5 text-xs text-muted">
              Trazabilidad completa de operaciones administrativas, cambios de roles, accesos por SSO y sincronizaciones.
            </p>
          </div>

          <div className="overflow-hidden rounded-[24px] border border-border/60 bg-surface/80 backdrop-blur-2xl shadow-apple">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-border/40 bg-foreground/[0.015] text-muted uppercase tracking-wider text-[10px] font-semibold">
                  <tr>
                    <th className="px-6 py-3.5">Fecha / Hora</th>
                    <th className="px-6 py-3.5">Acción Registrada</th>
                    <th className="px-6 py-3.5">Entidad / ID</th>
                    <th className="px-6 py-3.5">Detalle Operacional</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {!Array.isArray(auditLogs) || auditLogs.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="p-8 text-center text-muted">
                        No hay registros de auditoría acumulados.
                      </td>
                    </tr>
                  ) : (
                    (Array.isArray(auditLogs) ? auditLogs : []).map((log) => (
                      <tr key={log.id} className="hover:bg-foreground/[0.015] transition-colors">
                        <td className="px-6 py-4 font-mono text-xs text-muted whitespace-nowrap">
                          {new Date(log.created_at).toLocaleString()}
                        </td>
                        <td className="px-6 py-4">
                          <span className="rounded-full bg-accent/10 px-2.5 py-0.5 font-mono text-[11px] font-medium text-accent border border-accent/20">
                            {log.action}
                          </span>
                        </td>
                        <td className="px-6 py-4 font-mono text-xs text-foreground/80">
                          {log.entity_name} {log.entity_id ? `(#${log.entity_id.slice(0, 8)})` : ''}
                        </td>
                        <td className="px-6 py-4 font-mono text-[11px] text-muted truncate max-w-md">
                          {log.details ? JSON.stringify(log.details) : 'Operación del sistema'}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* PESTAÑA: CUERPO DOCENTE                                                   */}
      {/* ========================================================================= */}
      {activeTab === 'docentes' && (
        <div className="space-y-4">
          <div className="rounded-[10px] border border-border bg-surface p-5 shadow-minimal">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h2 className="text-base font-semibold tracking-tight text-foreground flex items-center gap-2">
                  <IconTeachers className="w-5 h-5 text-primary" />
                  <span>Cuerpo Docente y Titulares de Asignatura</span>
                </h2>
                <p className="mt-0.5 text-xs text-muted">
                  Profesores registrados con permisos de edición y gestión de grupos en Moodle LMS.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowCreateUserModal(true)}
                  className="rounded-[6px] bg-primary-action px-3.5 py-2 text-xs font-semibold text-white shadow-minimal hover:bg-primary-action/90 flex items-center gap-1.5 transition-all active:scale-[0.98]"
                >
                  <IconPlus className="w-3.5 h-3.5" />
                  <span>Registrar Profesor</span>
                </button>
              </div>
            </div>
          </div>

          <div className="rounded-[10px] border border-border bg-surface overflow-hidden shadow-minimal">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-surface-muted/60 text-muted font-medium border-b border-border">
                  <tr>
                    <th className="px-5 py-3.5">Profesor / Titular</th>
                    <th className="px-5 py-3.5">Identificador & Usuario</th>
                    <th className="px-5 py-3.5">Estado en Portal</th>
                    <th className="px-5 py-3.5">Moodle LMS</th>
                    <th className="px-5 py-3.5 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {users
                    .filter((u) => {
                      const userRoles = ((u.active_roles || u.roles || []) as string[]).map((r) => r.toLowerCase());
                      return userRoles.some((r) => ['profesor', 'teacher', 'docente', 'editingteacher'].includes(r));
                    })
                    .map((prof) => (
                      <tr key={prof.id} className="hover:bg-surface-muted/30 transition-colors">
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-3">
                            <div className="h-8 w-8 rounded-[6px] bg-primary/10 text-primary flex items-center justify-center font-bold text-xs">
                              {prof.first_name?.[0] || 'P'}
                            </div>
                            <div>
                              <p className="font-semibold text-foreground text-xs">
                                Prof. {prof.first_name} {prof.last_name}
                              </p>
                              <p className="text-[11px] text-muted">{prof.email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-4 font-mono text-[11px] text-muted">
                          {prof.moodle_username || prof.email.split('@')[0]}
                        </td>
                        <td className="px-5 py-4">
                          <span
                            className={`inline-flex items-center gap-1.5 rounded-[4px] px-2 py-0.5 text-[11px] font-medium border ${
                              prof.status === 'activo'
                                ? 'bg-success/10 text-success border-success/20'
                                : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20'
                            }`}
                          >
                            <span className="h-1.5 w-1.5 rounded-full bg-success" />
                            {prof.status}
                          </span>
                        </td>
                        <td className="px-5 py-4">
                          <MoodleSyncBadge status={prof.moodle_sync_status} moodleId={prof.moodle_user_id} />
                        </td>
                        <td className="px-5 py-4 text-right">
                          <button
                            type="button"
                            onClick={() => openAssignModalForUser(prof)}
                            className="rounded-[6px] border border-border bg-surface hover:bg-surface-muted px-2.5 py-1 text-[11px] font-medium text-foreground transition-all shadow-minimal"
                          >
                            Asignar Materia
                          </button>
                        </td>
                      </tr>
                    ))}
                  {users.filter((u) => {
                    const userRoles = ((u.active_roles || u.roles || []) as string[]).map((r) => r.toLowerCase());
                    return userRoles.some((r) => ['profesor', 'teacher', 'docente', 'editingteacher'].includes(r));
                  }).length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-5 py-8 text-center text-muted">
                        No hay profesores registrados con el rol de docente aún.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* PESTAÑA: CONFIGURACIÓN OS                                                 */}
      {/* ========================================================================= */}
      {activeTab === 'configuracion' && hasRole('superadministrador') && (
        <div className="space-y-4">
          <div className="rounded-[10px] border border-border bg-surface p-5 shadow-minimal">
            <h2 className="text-base font-semibold tracking-tight text-foreground flex items-center gap-2">
              <IconSettings className="w-5 h-5 text-primary" />
              <span>Configuración del Sistema INICIA</span>
            </h2>
            <p className="mt-0.5 text-xs text-muted">
              Parámetros de entorno institucional, sincronización y arquitectura.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="rounded-[10px] border border-border bg-surface p-5 space-y-3 shadow-minimal">
              <span className="text-[11px] font-mono uppercase tracking-wider text-muted">Infraestructura & Stack</span>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between py-1 border-b border-border/50">
                  <span className="text-muted">Frontend Framework</span>
                  <span className="font-mono font-medium text-foreground">Next.js 16.4 (App Router)</span>
                </div>
                <div className="flex justify-between py-1 border-b border-border/50">
                  <span className="text-muted">Backend API</span>
                  <span className="font-mono font-medium text-foreground">NestJS (Modular REST)</span>
                </div>
                <div className="flex justify-between py-1 border-b border-border/50">
                  <span className="text-muted">Base de Datos</span>
                  <span className="font-mono font-medium text-foreground">PostgreSQL 17 / Supabase</span>
                </div>
                <div className="flex justify-between py-1 border-b border-border/50">
                  <span className="text-muted">LMS Core</span>
                  <span className="font-mono font-medium text-foreground">Moodle 5.3+ (Web Services REST)</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-muted">SSO Provider</span>
                  <span className="font-mono font-medium text-success">auth_userkey (Sin contraseñas)</span>
                </div>
              </div>
            </div>

            <div className="rounded-[10px] border border-border bg-surface p-5 space-y-3 shadow-minimal">
              <span className="text-[11px] font-mono uppercase tracking-wider text-muted">Diseño & Tokens</span>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between py-1 border-b border-border/50">
                  <span className="text-muted">Sistema de Diseño</span>
                  <span className="font-medium text-foreground">INICIA</span>
                </div>
                <div className="flex justify-between py-1 border-b border-border/50">
                  <span className="text-muted">Color Primario</span>
                  <span className="font-mono text-primary font-bold">Azul institucional</span>
                </div>
                <div className="flex justify-between py-1 border-b border-border/50">
                  <span className="text-muted">Acento de Marca</span>
                  <span className="font-mono text-foreground font-bold bg-accent-soft px-1.5 py-0.5 rounded-[3px]">Celeste</span>
                </div>
                <div className="flex justify-between py-1 border-b border-border/50">
                  <span className="text-muted">Radios de Componente</span>
                  <span className="font-mono text-foreground">Controles: 6px | Superficies: 10px | Paneles: 14px</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-muted">Tema Actual</span>
                  <span className="font-mono text-foreground">Soporte Dinámico Claro & Oscuro</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
        </div>
      </CampusShell>

      {/* ========================================================================= */}
      {/* MODAL 1: GESTIÓN DE ROLES                                                 */}
      {/* ========================================================================= */}
      {selectedUserForRole && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-md p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-md rounded-[28px] border border-border/80 bg-surface/95 dark:bg-surface/90 backdrop-blur-2xl p-6 sm:p-7 shadow-2xl">
            <div className="flex items-center justify-between border-b border-border/40 pb-4">
              <h3 className="text-base font-semibold tracking-tight text-foreground">Gestionar Roles de Usuario</h3>
              <button
                type="button"
                onClick={() => setSelectedUserForRole(null)}
                className="h-8 w-8 rounded-full bg-foreground/[0.05] hover:bg-foreground/[0.1] text-foreground/70 flex items-center justify-center transition-colors text-xs"
              ><IconClose className="w-3.5 h-3.5" /></button>
            </div>

            <div className="mt-5 space-y-4">
              <div className="rounded-2xl border border-border/50 bg-foreground/[0.02] p-3.5">
                <span className="text-[11px] font-medium text-muted uppercase tracking-wider">Usuario Seleccionado</span>
                <p className="font-semibold text-foreground text-sm tracking-tight mt-0.5">
                  {selectedUserForRole.first_name} {selectedUserForRole.last_name}
                </p>
                <p className="font-mono text-xs text-muted">{selectedUserForRole.email}</p>
              </div>

              <div>
                <p className="text-xs font-medium text-muted mb-2">Roles Actuales Asignados:</p>
                <div className="flex flex-wrap gap-1.5">
                  {(((selectedUserForRole.active_roles || selectedUserForRole.roles || []) as string[])).map((r: string) => {
                    const roleObj = roles.find((item) => item.slug === r);
                    return (
                      <span
                        key={r}
                        className="inline-flex items-center gap-1.5 rounded-full bg-foreground/[0.04] border border-border/60 px-3 py-1 text-xs font-medium text-foreground"
                      >
                        <span>{r}</span>
                        {roleObj && (
                          <button
                            type="button"
                            disabled={actionLoading === `revoke-${selectedUserForRole.id}-${roleObj.id}`}
                            onClick={() => handleRevokeRole(selectedUserForRole.id, roleObj.id, r)}
                            className="text-rose-500 hover:text-rose-600 font-bold ml-0.5 text-xs"
                            title="Retirar rol"
                          >
                            ×
                          </button>
                        )}
                      </span>
                    );
                  })}
                </div>
              </div>

              <div className="border-t border-border/40 pt-4">
                <label className="block text-xs font-medium text-foreground mb-1.5">
                  Asignar Nuevo Rol:
                </label>
                <select
                  value={roleToAssign}
                  onChange={(e) => setRoleToAssign(Number(e.target.value))}
                  className="w-full rounded-xl border border-border/70 bg-surface focus:border-accent px-3.5 py-2.5 text-xs text-foreground transition-all outline-none"
                >
                  {roles.filter((role) => hasRole('superadministrador') || !['administrador', 'superadministrador'].includes(role.slug)).map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name} ({r.slug})
                    </option>
                  ))}
                </select>
              </div>

              <div className="mt-6 flex justify-end gap-2 border-t border-border/40 pt-4">
                <button
                  type="button"
                  onClick={() => setSelectedUserForRole(null)}
                  className="rounded-xl border border-border/80 bg-surface hover:bg-foreground/[0.04] px-4 py-2 text-xs font-medium text-foreground transition-all"
                >
                  Cerrar
                </button>
                <button
                  type="button"
                  disabled={actionLoading === 'assign-role'}
                  onClick={handleAssignRole}
                  className="rounded-xl bg-accent hover:bg-accent-strong text-white px-5 py-2 text-xs font-medium shadow-xs transition-all active:scale-[0.98] disabled:opacity-50"
                >
                  {actionLoading === 'assign-role' ? 'Asignando...' : 'Confirmar Rol'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: CAMBIO DE ESTADO DE USUARIO                                      */}
      {/* ========================================================================= */}
      {selectedUserForStatus && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-md p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-md rounded-[28px] border border-border/80 bg-surface/95 dark:bg-surface/90 backdrop-blur-2xl p-6 sm:p-7 shadow-2xl">
            <div className="flex items-center justify-between border-b border-border/40 pb-4">
              <h3 className="text-base font-semibold tracking-tight text-foreground">Modificar Estado de Usuario</h3>
              <button
                type="button"
                onClick={() => setSelectedUserForStatus(null)}
                className="h-8 w-8 rounded-full bg-foreground/[0.05] hover:bg-foreground/[0.1] text-foreground/70 flex items-center justify-center transition-colors text-xs"
              ><IconClose className="w-3.5 h-3.5" /></button>
            </div>

            <div className="mt-5 space-y-4">
              <div className="rounded-2xl border border-border/50 bg-foreground/[0.02] p-3.5">
                <p className="font-semibold text-foreground text-sm tracking-tight">
                  {selectedUserForStatus.first_name} {selectedUserForStatus.last_name}
                </p>
                <p className="font-mono text-xs text-muted">{selectedUserForStatus.email}</p>
              </div>

              <div>
                <label className="block text-xs font-medium text-foreground mb-1.5">
                  Nuevo Estado en el Portal:
                </label>
                <select
                  value={newStatus}
                  onChange={(e) => setNewStatus(e.target.value)}
                  className="w-full rounded-xl border border-border/70 bg-surface focus:border-accent px-3.5 py-2.5 text-xs text-foreground transition-all outline-none"
                >
                  <option value="activo">Activo (Habilitado)</option>
                  <option value="pendiente">Pendiente de Aprobación</option>
                  <option value="suspendido">Suspendido (Sin acceso a cursos)</option>
                  <option value="inactivo">Inactivo</option>
                  <option value="baja">Baja Definitiva</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-foreground mb-1.5">
                  Motivo o justificación administrativa:
                </label>
                <input
                  type="text"
                  placeholder="Ej: Aprobación de admisión o baja administrativa"
                  value={statusReason}
                  onChange={(e) => setStatusReason(e.target.value)}
                  className="w-full rounded-xl border border-border/70 bg-foreground/[0.03] focus:bg-surface focus:border-accent px-3.5 py-2.5 text-xs text-foreground placeholder:text-muted/60 transition-all outline-none"
                />
              </div>

              <div className="mt-6 flex justify-end gap-2 border-t border-border/40 pt-4">
                <button
                  type="button"
                  onClick={() => setSelectedUserForStatus(null)}
                  className="rounded-xl border border-border/80 bg-surface hover:bg-foreground/[0.04] px-4 py-2 text-xs font-medium text-foreground transition-all"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={actionLoading === 'update-status'}
                  onClick={handleUpdateUserStatus}
                  className="rounded-xl bg-accent hover:bg-accent-strong text-white px-5 py-2 text-xs font-medium shadow-xs transition-all active:scale-[0.98] disabled:opacity-50"
                >
                  {actionLoading === 'update-status' ? 'Guardando...' : 'Actualizar Estado'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 3: CREAR NUEVO USUARIO (ADMINISTRATIVO)                             */}
      {/* ========================================================================= */}
      {showCreateUserModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-md p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-lg rounded-[28px] border border-border/80 bg-surface/95 dark:bg-surface/90 backdrop-blur-2xl p-6 sm:p-7 shadow-2xl">
            <div className="flex items-center justify-between border-b border-border/40 pb-4">
              <h3 className="text-base font-semibold tracking-tight text-foreground">Crear Nuevo Usuario</h3>
              <button
                type="button"
                onClick={() => setShowCreateUserModal(false)}
                className="h-8 w-8 rounded-full bg-foreground/[0.05] hover:bg-foreground/[0.1] text-foreground/70 flex items-center justify-center transition-colors text-xs"
              ><IconClose className="w-3.5 h-3.5" /></button>
            </div>

            <form onSubmit={handleCreateUser} className="mt-5 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1.5">Nombre(s):</label>
                  <input
                    type="text"
                    required
                    placeholder="Ej: Laura"
                    value={newFirstName}
                    onChange={(e) => setNewFirstName(e.target.value)}
                    className="w-full rounded-xl border border-border/70 bg-foreground/[0.03] focus:bg-surface focus:border-accent px-3.5 py-2.5 text-xs text-foreground placeholder:text-muted/60 transition-all outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1.5">Apellidos:</label>
                  <input
                    type="text"
                    required
                    placeholder="Ej: Gómez Pérez"
                    value={newLastName}
                    onChange={(e) => setNewLastName(e.target.value)}
                    className="w-full rounded-xl border border-border/70 bg-foreground/[0.03] focus:bg-surface focus:border-accent px-3.5 py-2.5 text-xs text-foreground placeholder:text-muted/60 transition-all outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-foreground mb-1.5">Correo Electrónico:</label>
                <input
                  type="email"
                  required
                  placeholder="correo@iinicia.org"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  className="w-full rounded-xl border border-border/70 bg-foreground/[0.03] focus:bg-surface focus:border-accent px-3.5 py-2.5 text-xs text-foreground placeholder:text-muted/60 transition-all outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1.5">Contraseña Inicial:</label>
                  <input
                    type="password"
                    required
                    minLength={8}
                    placeholder="Mínimo 8 caracteres"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full rounded-xl border border-border/70 bg-foreground/[0.03] focus:bg-surface focus:border-accent px-3.5 py-2.5 text-xs text-foreground placeholder:text-muted/60 transition-all outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1.5">Teléfono (opcional):</label>
                  <input
                    type="tel"
                    placeholder="5500000000"
                    value={newPhone}
                    onChange={(e) => setNewPhone(e.target.value)}
                    className="w-full rounded-xl border border-border/70 bg-foreground/[0.03] focus:bg-surface focus:border-accent px-3.5 py-2.5 text-xs text-foreground placeholder:text-muted/60 transition-all outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-foreground mb-1.5">Rol Inicial Asignado:</label>
                <select
                  value={newInitialRole}
                  onChange={(e) => setNewInitialRole(e.target.value)}
                  required
                  className="w-full rounded-xl border border-border/70 bg-surface focus:border-accent px-3.5 py-2.5 text-xs text-foreground transition-all outline-none"
                >
                  <option value="" disabled>Selecciona un rol</option>
                  {roles.filter((role) => hasRole('superadministrador') || !['administrador', 'superadministrador'].includes(role.slug)).map((role) => (
                    <option key={role.id} value={role.id}>{role.name}</option>
                  ))}
                </select>
              </div>

              <div className="mt-6 flex justify-end gap-2 border-t border-border/40 pt-4">
                <button
                  type="button"
                  onClick={() => setShowCreateUserModal(false)}
                  className="rounded-xl border border-border/80 bg-surface hover:bg-foreground/[0.04] px-4 py-2 text-xs font-medium text-foreground transition-all"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={actionLoading === 'create-user'}
                  className="rounded-xl bg-accent hover:bg-accent-strong text-white px-5 py-2 text-xs font-medium shadow-xs transition-all active:scale-[0.98] disabled:opacity-50"
                >
                  {actionLoading === 'create-user' ? 'Creando...' : 'Crear Usuario'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 4: ASIGNAR CURSO A ALUMNO O PROFESOR                                */}
      {/* ========================================================================= */}
      {showAssignCourseModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-md p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-lg rounded-[28px] border border-border/80 bg-surface/95 dark:bg-surface/90 backdrop-blur-2xl p-6 sm:p-7 shadow-2xl">
            <div className="flex items-center justify-between border-b border-border/40 pb-4">
              <h3 className="text-base font-semibold tracking-tight text-foreground">Asignar Materia y Matricular en Moodle</h3>
              <button
                type="button"
                onClick={() => setShowAssignCourseModal(false)}
                className="h-8 w-8 rounded-full bg-foreground/[0.05] hover:bg-foreground/[0.1] text-foreground/70 flex items-center justify-center transition-colors text-xs"
              ><IconClose className="w-3.5 h-3.5" /></button>
            </div>

            <form onSubmit={handleDirectCourseAssignment} className="mt-5 space-y-4">
              <div>
                <label className="block text-xs font-medium text-foreground mb-1.5">
                  Alumno o Docente a Matricular:
                </label>
                {assignTargetUserId ? (
                  <div className="rounded-2xl border border-success/30 bg-success/10 p-3.5 flex items-center justify-between">
                    <div>
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-success">
                        Usuario Seleccionado
                      </span>
                      <p className="font-semibold text-foreground text-xs mt-0.5">
                        {users.find((u) => u.id === assignTargetUserId)?.first_name}{' '}
                        {users.find((u) => u.id === assignTargetUserId)?.last_name}
                      </p>
                      <p className="text-[11px] text-muted font-mono">
                        {users.find((u) => u.id === assignTargetUserId)?.email}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setAssignTargetUserId('')}
                      className="rounded-xl border border-border/80 bg-surface hover:bg-foreground/[0.04] px-3 py-1 text-xs font-medium text-foreground transition-all shadow-xs"
                    >
                      Cambiar
                    </button>
                  </div>
                ) : (
                  <div>
                    <input
                      type="text"
                      placeholder="Escribe el nombre o correo del usuario para filtrar..."
                      value={assignUserModalSearch}
                      onChange={(e) => setAssignUserModalSearch(e.target.value)}
                      className="w-full rounded-xl border border-border/70 bg-foreground/[0.03] focus:bg-surface focus:border-accent px-3.5 py-2.5 text-xs text-foreground placeholder:text-muted/60 transition-all outline-none mb-2"
                    />
                    <div className="max-h-44 overflow-y-auto divide-y divide-border/40 rounded-2xl border border-border/60 bg-surface/60">
                      {matchingModalUsers.length === 0 ? (
                        <div className="p-4 text-center text-xs text-muted">
                          No se encontraron usuarios coincidentes.
                        </div>
                      ) : (
                        matchingModalUsers.map((u) => (
                          <button
                            key={u.id}
                            type="button"
                            onClick={() => {
                              setAssignTargetUserId(u.id);
                              setAssignUserModalSearch('');
                            }}
                            className="w-full text-left px-3.5 py-2.5 hover:bg-foreground/[0.03] flex items-center justify-between transition-colors text-xs"
                          >
                            <div>
                              <p className="font-semibold text-foreground">
                                {u.first_name} {u.last_name}
                              </p>
                              <p className="text-[11px] text-muted font-mono">
                                {u.email}
                              </p>
                            </div>
                            <span className="rounded-full bg-foreground/[0.05] px-2.5 py-0.5 text-[10px] text-muted font-medium">
                              {((u.active_roles || u.roles || []) as string[]).join(', ') || 'Sin rol'}
                            </span>
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-foreground mb-1.5">
                  Seleccionar Curso Vinculado a Moodle:
                </label>
                <select
                  required
                  value={assignCourseId}
                  onChange={(e) => setAssignCourseId(e.target.value)}
                  className="w-full rounded-xl border border-border/70 bg-surface focus:border-accent px-3.5 py-2.5 text-xs text-foreground transition-all outline-none"
                >
                  <option value="">-- Elige un curso --</option>
                  {courses.map((c) => {
                    const cId = c.id || (c as any).course_mapping_id;
                    return (
                      <option key={cId} value={cId}>
                        {c.portal_course_code || c.code} - {c.course_name || c.name} (Moodle #{c.moodle_course_id})
                      </option>
                    );
                  })}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-foreground mb-1.5">
                  Rol en el Aula de Moodle:
                </label>
                <select
                  value={assignMoodleRole}
                  onChange={(e) => setAssignMoodleRole(e.target.value as any)}
                  className="w-full rounded-xl border border-border/70 bg-surface focus:border-accent px-3.5 py-2.5 text-xs text-foreground transition-all outline-none"
                >
                  <option value="student">Estudiante (student)</option>
                  <option value="editingteacher">Profesor con Edición (editingteacher)</option>
                </select>
              </div>

              <div className="rounded-2xl border border-primary/20 bg-primary/5 p-3.5 text-xs text-muted leading-relaxed">
                ℹ️ Esta acción crea la autorización inmediata e invoca el Web Service oficial de Moodle (<code>enrol_manual_enrol_users</code>).
              </div>

              <div className="mt-6 flex justify-end gap-2 border-t border-border/40 pt-4">
                <button
                  type="button"
                  onClick={() => setShowAssignCourseModal(false)}
                  className="rounded-xl border border-border/80 bg-surface hover:bg-foreground/[0.04] px-4 py-2 text-xs font-medium text-foreground transition-all"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={actionLoading === 'assign-course'}
                  className="rounded-xl bg-accent hover:bg-accent-strong text-white px-5 py-2 text-xs font-medium shadow-xs transition-all active:scale-[0.98] disabled:opacity-50"
                >
                  {actionLoading === 'assign-course' ? 'Matriculando en Moodle...' : 'Asignar & Matricular'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 5: VINCULAR NUEVO CURSO MOODLE                                      */}
      {/* ========================================================================= */}
      {showCreateCourseModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-md p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-lg rounded-[28px] border border-border/80 bg-surface/95 dark:bg-surface/90 backdrop-blur-2xl p-6 sm:p-7 shadow-2xl">
            <div className="flex items-center justify-between border-b border-border/40 pb-4">
              <h3 className="text-base font-semibold tracking-tight text-foreground">Vincular Nuevo Curso con Moodle</h3>
              <button
                type="button"
                onClick={() => setShowCreateCourseModal(false)}
                className="h-8 w-8 rounded-full bg-foreground/[0.05] hover:bg-foreground/[0.1] text-foreground/70 flex items-center justify-center transition-colors text-xs"
              ><IconClose className="w-3.5 h-3.5" /></button>
            </div>

            <form onSubmit={handleCreateCourseMapping} className="mt-5 space-y-4">
              <div>
                <label className="block text-xs font-medium text-foreground mb-1.5">
                  Nombre del Curso en el Portal:
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ej: Curso 3. Inteligencia Artificial Aplicada"
                  value={newCourseName}
                  onChange={(e) => setNewCourseName(e.target.value)}
                  className="w-full rounded-xl border border-border/70 bg-foreground/[0.03] focus:bg-surface focus:border-accent px-3.5 py-2.5 text-xs text-foreground placeholder:text-muted/60 transition-all outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1.5">
                    Código en Portal:
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ej: CUR-MOO-003"
                    value={newCourseCode}
                    onChange={(e) => setNewCourseCode(e.target.value)}
                    className="w-full rounded-xl border border-border/70 bg-foreground/[0.03] focus:bg-surface focus:border-accent px-3.5 py-2.5 text-xs text-foreground placeholder:text-muted/60 transition-all outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-foreground mb-1.5">
                    Slug / URL:
                  </label>
                  <input
                    type="text"
                    placeholder="curso-3-ia"
                    value={newCourseSlug}
                    onChange={(e) => setNewCourseSlug(e.target.value)}
                    className="w-full rounded-xl border border-border/70 bg-foreground/[0.03] focus:bg-surface focus:border-accent px-3.5 py-2.5 text-xs text-foreground placeholder:text-muted/60 transition-all outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1.5">
                    ID del Curso en Moodle:
                  </label>
                  <input
                    type="number"
                    required
                    min={1}
                    placeholder="Ej: 3"
                    value={newMoodleCourseId}
                    onChange={(e) => setNewMoodleCourseId(Number(e.target.value))}
                    className="w-full rounded-xl border border-border/70 bg-foreground/[0.03] focus:bg-surface focus:border-accent px-3.5 py-2.5 text-xs text-foreground placeholder:text-muted/60 transition-all outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-foreground mb-1.5">
                    Shortname en Moodle:
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ej: INICIA-IA-103"
                    value={newMoodleShortname}
                    onChange={(e) => setNewMoodleShortname(e.target.value)}
                    className="w-full rounded-xl border border-border/70 bg-foreground/[0.03] focus:bg-surface focus:border-accent px-3.5 py-2.5 text-xs text-foreground placeholder:text-muted/60 transition-all outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-foreground mb-1.5">
                  Programa Académico Asociado:
                </label>
                <select
                  value={newCourseProgramId}
                  onChange={(e) => setNewCourseProgramId(e.target.value)}
                  className="w-full rounded-xl border border-border/70 bg-surface focus:border-accent px-3.5 py-2.5 text-xs text-foreground transition-all outline-none"
                >
                  <option value="">-- Sin programa asignado --</option>
                  {programs.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.code})
                    </option>
                  ))}
                </select>
              </div>

              <div className="mt-6 flex justify-end gap-2 border-t border-border/40 pt-4">
                <button
                  type="button"
                  onClick={() => setShowCreateCourseModal(false)}
                  className="rounded-xl border border-border/80 bg-surface hover:bg-foreground/[0.04] px-4 py-2 text-xs font-medium text-foreground transition-all"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={actionLoading === 'create-course'}
                  className="rounded-xl bg-accent hover:bg-accent-strong text-white px-5 py-2 text-xs font-medium shadow-xs transition-all active:scale-[0.98] disabled:opacity-50"
                >
                  {actionLoading === 'create-course' ? 'Guardando...' : 'Crear Vinculación'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 6: CREAR NUEVO PROGRAMA ACADÉMICO                                   */}
      {/* ========================================================================= */}
      {showCreateProgramModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-md p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-lg rounded-[28px] border border-border/80 bg-surface/95 dark:bg-surface/90 backdrop-blur-2xl p-6 sm:p-7 shadow-2xl">
            <div className="flex items-center justify-between border-b border-border/40 pb-4">
              <h3 className="text-base font-semibold tracking-tight text-foreground">Crear Programa Académico</h3>
              <button
                type="button"
                onClick={() => setShowCreateProgramModal(false)}
                className="h-8 w-8 rounded-full bg-foreground/[0.05] hover:bg-foreground/[0.1] text-foreground/70 flex items-center justify-center transition-colors text-xs"
              ><IconClose className="w-3.5 h-3.5" /></button>
            </div>

            <form onSubmit={handleCreateProgram} className="mt-5 space-y-4">
              <div>
                <label className="block text-xs font-medium text-foreground mb-1.5">Nombre del Programa:</label>
                <input
                  type="text"
                  required
                  placeholder="Ej: Licenciatura en Tecnologías de la Información"
                  value={newProgName}
                  onChange={(e) => setNewProgName(e.target.value)}
                  className="w-full rounded-xl border border-border/70 bg-foreground/[0.03] focus:bg-surface focus:border-accent px-3.5 py-2.5 text-xs text-foreground placeholder:text-muted/60 transition-all outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1.5">Código Oficial:</label>
                  <input
                    type="text"
                    required
                    placeholder="Ej: LIC-TI-2026"
                    value={newProgCode}
                    onChange={(e) => setNewProgCode(e.target.value)}
                    className="w-full rounded-xl border border-border/70 bg-foreground/[0.03] focus:bg-surface focus:border-accent px-3.5 py-2.5 text-xs text-foreground placeholder:text-muted/60 transition-all outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1.5">Slug / URL:</label>
                  <input
                    type="text"
                    placeholder="licenciatura-ti"
                    value={newProgSlug}
                    onChange={(e) => setNewProgSlug(e.target.value)}
                    className="w-full rounded-xl border border-border/70 bg-foreground/[0.03] focus:bg-surface focus:border-accent px-3.5 py-2.5 text-xs text-foreground placeholder:text-muted/60 transition-all outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1.5">Tipo de Oferta:</label>
                  <select
                    value={newProgType}
                    onChange={(e) => setNewProgType(e.target.value as any)}
                    className="w-full rounded-xl border border-border/70 bg-surface focus:border-accent px-3.5 py-2.5 text-xs text-foreground transition-all outline-none"
                  >
                    <option value="licenciatura">Licenciatura</option>
                    <option value="maestria">Maestría</option>
                    <option value="diplomado">Diplomado</option>
                    <option value="certificacion">Certificación</option>
                    <option value="curso">Curso Especializado</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1.5">Modalidad:</label>
                  <select
                    value={newProgModality}
                    onChange={(e) => setNewProgModality(e.target.value as any)}
                    className="w-full rounded-xl border border-border/70 bg-surface focus:border-accent px-3.5 py-2.5 text-xs text-foreground transition-all outline-none"
                  >
                    <option value="en_linea">En Línea (Online)</option>
                    <option value="presencial">Presencial</option>
                    <option value="hibrido">Híbrido</option>
                    <option value="autogestivo">Autogestivo</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1.5">Texto de Duración:</label>
                  <input
                    type="text"
                    placeholder="Ej: 3 años / 6 semestres"
                    value={newProgDuration}
                    onChange={(e) => setNewProgDuration(e.target.value)}
                    className="w-full rounded-xl border border-border/70 bg-foreground/[0.03] focus:bg-surface focus:border-accent px-3.5 py-2.5 text-xs text-foreground placeholder:text-muted/60 transition-all outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1.5">Total de Horas:</label>
                  <input
                    type="number"
                    min={1}
                    value={newProgHours}
                    onChange={(e) => setNewProgHours(Number(e.target.value))}
                    className="w-full rounded-xl border border-border/70 bg-foreground/[0.03] focus:bg-surface focus:border-accent px-3.5 py-2.5 text-xs text-foreground placeholder:text-muted/60 transition-all outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-foreground mb-1.5">Descripción Breve:</label>
                <textarea
                  rows={2}
                  placeholder="Síntesis del perfil de egreso y objetivos..."
                  value={newProgDesc}
                  onChange={(e) => setNewProgDesc(e.target.value)}
                  className="w-full rounded-xl border border-border/70 bg-foreground/[0.03] focus:bg-surface focus:border-accent px-3.5 py-2.5 text-xs text-foreground placeholder:text-muted/60 transition-all outline-none"
                />
              </div>

              <div className="mt-6 flex justify-end gap-2 border-t border-border/40 pt-4">
                <button
                  type="button"
                  onClick={() => setShowCreateProgramModal(false)}
                  className="rounded-xl border border-border/80 bg-surface hover:bg-foreground/[0.04] px-4 py-2 text-xs font-medium text-foreground transition-all"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={actionLoading === 'create-program'}
                  className="rounded-xl bg-accent hover:bg-accent-strong text-white px-5 py-2 text-xs font-medium shadow-xs transition-all active:scale-[0.98] disabled:opacity-50"
                >
                  {actionLoading === 'create-program' ? 'Guardando...' : 'Crear Programa'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

```

### apps/web/src/app/dashboard/aspirante/page.tsx

<!-- archivo: apps/web/src/app/dashboard/aspirante/page.tsx -->
```tsx
// IINICIA Portal · panel de aspirantes · page.tsx
/** Muestra el avance de las postulaciones y las opciones académicas que puede solicitar el aspirante. */
'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { admissionsApi, coursesApi, enrollmentsApi, programsApi } from '@/lib/api';
import type { AdmissionApplication, CourseOffering, EnrollmentRequest, Program } from '@/types';
import { MoodleSyncBadge } from '@/components/moodle/MoodleSyncBadge';
import { CampusShell } from '@/components/campus-tech/CampusShell';
import {
  IconStudents,
  IconGroups,
  IconCheck,
  IconAlertTriangle,
  IconPlus,
} from '@/components/campus-tech/Icons';

/** Muestra el estado del perfil y las postulaciones de la cuenta aspirante. Las nuevas solicitudes se validan en la API. */
export default function AspiranteDashboardPage() {
  const router = useRouter();
  const { user, loading: authLoading, refreshUser } = useAuth();

  const [offerings, setOfferings] = useState<CourseOffering[]>([]);
  const [enrollments, setEnrollments] = useState<EnrollmentRequest[]>([]);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [applications, setApplications] = useState<AdmissionApplication[]>([]);
  const [selectedProgram, setSelectedProgram] = useState('');
  const [motivation, setMotivation] = useState('');
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [admissionError, setAdmissionError] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.push('/login');
      return;
    }
    if (!user.roles.includes('aspirante') && !user.roles.includes('superadministrador')) {
      router.replace('/dashboard');
      return;
    }

    /** Consulta el perfil y las solicitudes del aspirante en paralelo para actualizar las secciones del panel. */
    async function loadData() {
      try {
        setLoading(true);
        const [catalog, history, offeringsResult, enrollmentsResult] = await Promise.allSettled([
          programsApi.getPrograms(),
          admissionsApi.getMyApplications(),
          coursesApi.getOfferings(),
          enrollmentsApi.getMyEnrollments(),
        ]);
        if (catalog.status === 'fulfilled') setPrograms(catalog.value.filter((program) => program.is_active));
        if (history.status === 'fulfilled') setApplications(history.value);
        if (offeringsResult.status === 'fulfilled') setOfferings(offeringsResult.value);
        if (enrollmentsResult.status === 'fulfilled') setEnrollments(enrollmentsResult.value);
        setAdmissionError(catalog.status === 'rejected' || history.status === 'rejected'
          ? 'No fue posible cargar los programas o tus postulaciones. Pulsa Actualizar estado para reintentar.'
          : null);
        setError(offeringsResult.status === 'rejected' || enrollmentsResult.status === 'rejected'
          ? 'No fue posible cargar la oferta de cursos o tus inscripciones.'
          : null);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [user, authLoading, router]);

  // Inicia la solicitud desde una opción del catálogo de cursos.
  const handleApply = async (courseMappingId: string, courseName: string) => {
    setActionLoading(courseMappingId);
    setError(null);
    setMessage(null);

    try {
      await enrollmentsApi.requestEnrollment(courseMappingId);
      setMessage(`Tu solicitud para "${courseName}" quedó registrada. Un administrador revisará tu acceso antes de matricularte en Moodle.`);

      // Recargar solicitudes
      const updated = await enrollmentsApi.getMyEnrollments();
      setEnrollments(updated);
    } catch (err: any) {
      setError(err.message || 'No fue posible registrar la inscripción.');
    } finally {
      setActionLoading(null);
    }
  };

  const isAlreadyEnrolled = (courseMappingId: string) => {
    return enrollments.some((e) => e.course_mapping_id === courseMappingId && e.status !== 'rechazada');
  };

  // Tramita una postulación al programa desde el formulario de admisión.
  const handleApplication = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedProgram) return;
    setActionLoading('admission');
    setError(null);
    setMessage(null);
    try {
      const application = await admissionsApi.createApplication({
        program_id: selectedProgram,
        motivation_letter: motivation.trim() || undefined,
      });
      setApplications((current) => [application, ...current]);
      setSelectedProgram('');
      setMotivation('');
      setMessage('Tu postulación quedó registrada. Puedes seguir su estado en esta página.');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'No fue posible registrar la postulación.');
    } finally {
      setActionLoading(null);
    }
  };

  const availablePrograms = programs.filter(
    (program) => !applications.some((application) => application.program_id === program.id),
  );

  const refreshAdmissions = async () => {
    setActionLoading('refresh-admissions');
    setAdmissionError(null);
    try {
      const [catalog, history] = await Promise.all([
        programsApi.getPrograms(),
        admissionsApi.getMyApplications(),
      ]);
      setPrograms(catalog.filter((program) => program.is_active));
      setApplications(history);
      setSelectedProgram('');
      const [offerings, enrollments] = await Promise.all([coursesApi.getOfferings(), enrollmentsApi.getMyEnrollments()]);
      setOfferings(offerings);
      setEnrollments(enrollments);
      await refreshUser();
    } catch (err: unknown) {
      setAdmissionError(err instanceof Error ? err.message : 'No fue posible actualizar tus postulaciones.');
    } finally {
      setActionLoading(null);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <p className="text-xs font-medium text-muted">Cargando portal de admisiones...</p>
        </div>
      </div>
    );
  }

  return (
    <CampusShell
      searchItems={[...offerings.map((course) => ({ id: course.course_mapping_id, title: course.name || '', detail: course.portal_course_code, section: 'Cursos' })),
...programs.map((program) => ({ id: program.id, title: program.name, detail: program.code, section: 'Programas' })),
...applications.map((application) => ({ id: application.id, title: application.programs?.name || 'Postulación', detail: [application.profiles?.email, application.status].filter(Boolean).join(' · '), section: 'Postulaciones' })),]}
      currentTab="ofertas"
      onSelectTab={() => {}}
      breadcrumbs={['INICIA', 'Portal de Admisiones', 'Oferta Académica']}
      counts={{
        enrollments: enrollments.length,
      }}
    >
      <div className="space-y-6">
        {/* Header Aspirante */}
        <div className="campus-heading">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-[4px] bg-primary/10 px-2 py-0.5 text-[11px] font-mono font-semibold text-primary border border-primary/20">
                  Admisiones INICIA
                </span>
                <span className="rounded-[4px] bg-surface-muted px-2 py-0.5 text-[11px] font-mono font-medium text-muted border border-border">
                  Rol: Aspirante
                </span>
              </div>
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
                Bienvenido, {user?.first_name} {user?.last_name}
              </h1>
              <p className="text-xs sm:text-sm text-muted">
                Consulta la oferta y solicita acceso. Tu matrícula en Moodle requiere autorización administrativa.
              </p>
            </div>
          </div>

          {/* Guía operativa */}
          <div className="mt-5 rounded-[8px] border border-primary/20 bg-primary/5 p-4 text-xs text-foreground/85">
            <p className="font-semibold text-foreground flex items-center gap-2">
              <IconStudents className="w-4 h-4 text-primary" />
              <span>Pasos para iniciar tu formación</span>
            </p>
            <ol className="mt-2 list-decimal pl-5 space-y-1 text-muted leading-relaxed">
              <li>Elige un curso y pulsa <strong>&quot;Solicitar acceso&quot;</strong>.</li>
              <li>Un administrador revisará tu solicitud y te asignará el rol correspondiente.</li>
              <li>Cuando se autorice tu matrícula, podrás entrar al aula desde tu panel de estudiante.</li>
            </ol>
          </div>
        </div>

        {message && (
          <div className="rounded-[8px] border border-success/25 bg-success/10 p-4 text-xs font-medium text-success flex flex-col sm:flex-row items-center justify-between gap-3 shadow-minimal">
            <div className="flex items-center gap-2">
              <IconCheck className="w-4 h-4 text-success shrink-0" />
              <span>{message}</span>
            </div>
            <a
              href="#mis-solicitudes"
              className="rounded-[6px] bg-primary-action px-3 py-1.5 text-xs font-semibold text-white shadow-minimal hover:bg-primary-action/90 transition-all shrink-0"
            >
              Ver estado de mi solicitud →
            </a>
          </div>
        )}

        {error && (
          <div className="rounded-[8px] border border-danger/30 bg-danger/10 p-3.5 text-xs font-medium text-danger flex items-center gap-2 shadow-minimal">
            <IconAlertTriangle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <section className="space-y-4 rounded-[10px] border border-border bg-surface p-5 sm:p-6 shadow-minimal" aria-labelledby="admisiones-heading">
          <div>
            <h2 id="admisiones-heading" className="text-base font-semibold text-foreground">Postulación a programas</h2>
            <p className="mt-1 text-xs text-muted">Registra tu interés y consulta el dictamen de admisiones.</p>
            <button type="button" onClick={refreshAdmissions} disabled={actionLoading !== null} className="mt-2 text-xs font-semibold text-primary underline disabled:opacity-50">
              Actualizar estado
            </button>
          </div>
          {admissionError && <p role="alert" className="text-sm text-danger">{admissionError}</p>}
          {(user?.roles.includes('estudiante') || applications.some((application) => application.status === 'admitido')) && (
            <button type="button" onClick={() => window.location.assign('/dashboard/estudiante')} className="text-sm font-semibold text-primary underline">
              Ir a mi panel de estudiante
            </button>
          )}
          {applications.length > 0 && (
            <ul className="space-y-2">
              {applications.map((application) => (
                <li key={application.id} className="flex flex-wrap items-center justify-between gap-2 rounded-[8px] border border-border bg-surface-muted/40 p-3 text-xs">
                  <span className="font-medium text-foreground">{application.programs?.name || programs.find((program) => program.id === application.program_id)?.name || 'Programa académico'}</span>
                  <span className="rounded-full border border-primary/20 bg-primary/10 px-2 py-0.5 font-medium capitalize text-primary">{application.status.replace('_', ' ')}</span>
                </li>
              ))}
            </ul>
          )}
          {!admissionError && availablePrograms.length === 0 && (
            <p className="text-sm text-muted">No hay programas disponibles para una nueva postulación.</p>
          )}
          <form onSubmit={handleApplication} className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
            <div className="space-y-1.5">
              <label htmlFor="programa-postulacion" className="block text-xs font-medium text-foreground">Programa de interés</label>
              <select id="programa-postulacion" required value={selectedProgram} onChange={(event) => setSelectedProgram(event.target.value)} className="w-full rounded-[6px] border border-border bg-surface px-3 py-2 text-xs text-foreground focus:border-primary focus:outline-none">
                <option value="">Selecciona un programa</option>
                {availablePrograms.map((program) => <option key={program.id} value={program.id}>{program.name}</option>)}
              </select>
            </div>
            <button type="submit" disabled={actionLoading !== null || !selectedProgram} className="rounded-[6px] bg-primary-action px-4 py-2 text-xs font-semibold text-white disabled:opacity-50">
              {actionLoading === 'admission' ? 'Enviando...' : 'Enviar postulación'}
            </button>
            <div className="sm:col-span-2">
              <label htmlFor="motivacion-postulacion" className="mb-1.5 block text-xs font-medium text-foreground">Motivación (opcional)</label>
              <textarea id="motivacion-postulacion" maxLength={2000} rows={3} value={motivation} onChange={(event) => setMotivation(event.target.value)} className="w-full rounded-[6px] border border-border bg-surface px-3 py-2 text-xs text-foreground focus:border-primary focus:outline-none" />
            </div>
          </form>
        </section>

        {/* Mis Solicitudes Actuales */}
        {enrollments.length > 0 && (
          <div id="mis-solicitudes" className="space-y-4">
            <h2 className="text-base font-semibold text-foreground">
              Estado de mis Solicitudes
            </h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {enrollments.map((enr) => (
                <div
                  key={enr.id}
                  className="rounded-[10px] border border-border bg-surface p-5 shadow-minimal"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs text-muted">
                      {enr.course_mappings?.code || 'CURSO'}
                    </span>
                    <span
                      className={`rounded-[4px] px-2 py-0.5 text-[11px] font-medium capitalize border ${
                        enr.status === 'autorizada' || enr.status === 'sincronizada'
                          ? 'bg-success/10 text-success border-success/20'
                          : enr.status === 'rechazada'
                          ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20'
                          : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20'
                      }`}
                    >
                      {enr.status}
                    </span>
                  </div>
                  <h3 className="mt-2 text-sm font-semibold text-foreground">
                    {enr.course_mappings?.courses?.name || enr.course_mappings?.moodle_shortname || 'Curso INICIA'}
                  </h3>
                  <div className="mt-4 flex items-center justify-between border-t border-border pt-3 text-xs text-muted">
                    <span>Moodle LMS:</span>
                    <MoodleSyncBadge status={enr.moodle_sync_status} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Catálogo de Cursos Disponibles */}
        <div className="space-y-4 pt-2">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-foreground">
                Oferta de Cursos
              </h2>
              <p className="text-xs text-muted">
                Solicita acceso a los cursos que te interesan. La matrícula requiere autorización.
              </p>
            </div>
            <span className="rounded-[4px] bg-surface-muted px-2 py-1 text-xs font-mono font-medium text-muted">
              {offerings.length} opciones
            </span>
          </div>

          {!error && offerings.length === 0 && <p className="text-sm text-muted">No hay cursos publicados disponibles. Administración debe revisar la oferta y su configuración de acceso.</p>}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {offerings.map((off) => {
              const already = isAlreadyEnrolled(off.course_mapping_id);
              const isSubmitting = actionLoading === off.course_mapping_id;

              return (
                <div
                  key={off.course_mapping_id}
                  className="flex flex-col justify-between rounded-[10px] border border-border bg-surface p-5 shadow-minimal hover:border-primary/40 transition-all"
                >
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="rounded-[4px] bg-surface-muted px-2 py-0.5 font-mono text-[11px] font-semibold text-foreground">
                        {off.code}
                      </span>
                      <span className="text-xs text-muted font-mono">
                        Moodle #{off.moodle_course_id}
                      </span>
                    </div>

                    <h3 className="mt-3 text-base font-semibold text-foreground">
                      {off.name}
                    </h3>
                    <p className="mt-1 text-xs text-muted">
                      Programa: {off.program_name}
                    </p>

                    {(off.credits != null || off.hours_theory != null || off.hours_practice != null) && (
                      <div className="mt-4 flex items-center gap-3 text-xs text-muted font-mono">
                        {off.credits != null && <span>{off.credits} créditos</span>}
                        {(off.hours_theory != null || off.hours_practice != null) && (
                          <span>{(off.hours_theory ?? 0) + (off.hours_practice ?? 0)} horas</span>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="mt-5 border-t border-border pt-3.5">
                    {already ? (
                      <button
                        disabled
                        className="w-full rounded-[6px] border border-border bg-surface-muted py-2 text-xs font-medium text-muted cursor-not-allowed flex items-center justify-center gap-1.5"
                      >
                        <IconCheck className="w-3.5 h-3.5 text-success" />
                        <span>Solicitud registrada previamente</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleApply(off.course_mapping_id, off.name)}
                        disabled={isSubmitting}
                        className="w-full rounded-[6px] bg-primary-action py-2 text-xs font-semibold text-white shadow-minimal hover:bg-primary-action/90 transition-all disabled:opacity-50 active:scale-[0.98] flex items-center justify-center gap-1.5"
                      >
                        {isSubmitting ? (
                          <>
                            <span className="h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" />
                            <span>Inscribiendo...</span>
                          </>
                        ) : (
                          <>
                            <IconPlus className="w-3.5 h-3.5 text-accent-sky" />
                            <span>Solicitar acceso</span>
                          </>
                        )}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </CampusShell>
  );
}

```

### apps/web/src/app/dashboard/coordinador/page.tsx

<!-- archivo: apps/web/src/app/dashboard/coordinador/page.tsx -->
```tsx
// IINICIA Portal · panel de coordinación · page.tsx
/** Carga el espacio de coordinación para la gestión dentro de los programas asignados. */
import { RoleWorkspace } from '@/components/RoleWorkspace';

/** Selecciona la vista de coordinación del espacio compartido que aplica los permisos de la sesión. */
export default function CoordinadorDashboardPage() {
  return <RoleWorkspace role="coordinador" />;
}

```

### apps/web/src/app/dashboard/docente/page.tsx

<!-- archivo: apps/web/src/app/dashboard/docente/page.tsx -->
```tsx
// IINICIA Portal · panel docente · page.tsx
/** Muestra las asignaciones docentes y abre el curso o el calificador en Moodle. */
'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { coursesApi, moodleApi, usersApi } from '@/lib/api';
import type { AuthorizedCourse } from '@/types';
import { LaunchCourseButton } from '@/components/moodle/LaunchCourseButton';
import { MoodleSyncBadge } from '@/components/moodle/MoodleSyncBadge';
import { CampusShell } from '@/components/campus-tech/CampusShell';
import {
  closeMoodleLaunchWindow,
  navigateMoodleLaunchWindow,
  openMoodleLaunchWindow,
} from '@/lib/moodle-window';
import {
  IconTeachers,
  IconGroups,
  IconStudents,
  IconGrades,
  IconExternalLink,
  IconSearch,
  IconRefresh,
  IconSettings,
  IconCheck,
  IconAlertTriangle,
  IconClose,
  IconBookOpen,
  IconClock,
  IconAnnouncements,
} from '@/components/campus-tech/Icons';

type TeacherTab = 'materias' | 'estudiantes' | 'calificaciones' | 'moodle' | 'perfil';

interface TeacherOverview {
  total_students: number;
  total_activities: number;
  total_sections: number;
  students: { id: number; fullname: string; email?: string }[];
}

/** Conecta las asignaturas del docente con sus vistas de seguimiento y con la apertura del campus en una ventana separada. */
export default function DocenteDashboardPage() {
  const router = useRouter();
  const { user, loading: authLoading, refreshUser } = useAuth();

  const [activeTab, setActiveTab] = useState<TeacherTab>('materias');
  const [courses, setCourses] = useState<AuthorizedCourse[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCourseFilter, setSelectedCourseFilter] = useState('');
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Modales interactivos
  const [selectedCourseDetail, setSelectedCourseDetail] = useState<AuthorizedCourse | null>(null);
  const [editProfileOpen, setEditProfileOpen] = useState(false);
  const [profileForm, setProfileForm] = useState({
    first_name: '',
    last_name: '',
    phone: '',
    bio: '',
  });

  const [moodleCourseOverviews, setMoodleCourseOverviews] = useState<Record<number, TeacherOverview>>({});

  // Carga los cursos asignados y la información académica necesaria para la vista docente.
  const loadTeacherData = async () => {
    try {
      setLoading(true);
      setError(null);
      const coursesData = (await coursesApi.getAuthorizedCourses()).filter(
        (course) => course.enrollment_status === 'sincronizada' &&
          (course.moodle_role === 'teacher' || course.moodle_role === 'editingteacher'),
      );
      setCourses(coursesData);
      const overviews: Record<number, TeacherOverview> = {};
      const results = await Promise.allSettled(coursesData.map(async (course) => {
        overviews[course.moodle_course_id] = await moodleApi.getCourseTeacherOverview(course.moodle_course_id);
      }));
      setMoodleCourseOverviews(overviews);
      if (results.some((result) => result.status === 'rejected')) {
        setError('No fue posible consultar los estudiantes de todas tus materias en Moodle.');
      }
    } catch (err: any) {
      setError(err.message || 'No fue posible cargar tus asignaturas.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.push('/login');
      return;
    }
    if (!user.roles.includes('profesor') && !user.roles.includes('superadministrador')) {
      router.replace('/dashboard');
      return;
    }

    loadTeacherData();
  }, [user, authLoading, router]);

  const handleLaunchCampusSSO = async () => {
    const launchWindow = openMoodleLaunchWindow();
    if (!launchWindow) {
      setError('Permite las ventanas emergentes para abrir Moodle.');
      return;
    }
    setActionLoading('launch-campus');
    setNotice(null);
    setError(null);

    try {
      const res = await moodleApi.launchCampus();
      navigateMoodleLaunchWindow(launchWindow, res.access_url);
      setNotice('Sesión docente iniciada en Moodle LMS vía SSO en una nueva pestaña.');
    } catch (err: any) {
      closeMoodleLaunchWindow(launchWindow);
      setError(err.message || 'Error al iniciar sesión SSO en Moodle.');
    } finally {
      setActionLoading(null);
    }
  };

  // Usa el destino solicitado para abrir el aula o el calificador con un enlace de sesión.
  const handleLaunchCourseSSO = async (courseMappingId: string, destination: 'launch' | 'launch-gradebook' = 'launch') => {
    const launchWindow = openMoodleLaunchWindow();
    if (!launchWindow) {
      setError('Permite las ventanas emergentes para abrir Moodle.');
      return;
    }
    setActionLoading(`launch-${courseMappingId}`);
    setNotice(null);
    setError(null);

    try {
      const res = await coursesApi.launchCourse(courseMappingId, destination);
      navigateMoodleLaunchWindow(launchWindow, res.access_url);
    } catch (err: any) {
      closeMoodleLaunchWindow(launchWindow);
      setError(err.message || 'Error al acceder al aula de Moodle.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleOpenGradebook = (moodleCourseId: number) => {
    const course = courses.find((item) => item.moodle_course_id === moodleCourseId);
    if (course) void handleLaunchCourseSSO(course.course_mapping_id, 'launch-gradebook');
  };

  const handleOpenEditProfile = () => {
    setProfileForm({
      first_name: user?.first_name || '',
      last_name: user?.last_name || '',
      phone: user?.phone || '',
      bio: (user as any)?.bio || '',
    });
    setEditProfileOpen(true);
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionLoading('save-profile');
    setNotice(null);
    setError(null);

    try {
      await usersApi.updateOwnProfile({
        first_name: profileForm.first_name.trim(),
        last_name: profileForm.last_name.trim(),
        phone: profileForm.phone.trim(),
        bio: profileForm.bio.trim(),
      });
      await refreshUser();
      setNotice('Tus credenciales y datos de perfil docente han sido actualizados con éxito.');
      setEditProfileOpen(false);
    } catch (err: any) {
      setError(err.message || 'No fue posible actualizar tu perfil docente.');
    } finally {
      setActionLoading(null);
    }
  };

  // Desasignar / dar de baja alumno de la materia
  // Filtrado de cursos del profesor
  const filteredCourses = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return courses;
    return courses.filter((c) => {
      const name = (c.course_name || '').toLowerCase();
      const code = (c.course_code || c.portal_course_code || '').toLowerCase();
      const mId = String(c.moodle_course_id || '');
      return name.includes(q) || code.includes(q) || mId.includes(q);
    });
  }, [courses, searchQuery]);

  const enrolledStudents = courses.flatMap((course) =>
    (moodleCourseOverviews[course.moodle_course_id]?.students ?? []).map((student) => ({ course, student })),
  );
  const filteredStudents = enrolledStudents.filter(({ course, student }) => {
    if (selectedCourseFilter && course.course_mapping_id !== selectedCourseFilter) return false;
    const query = searchQuery.toLowerCase().trim();
    return [course.course_name, course.portal_course_code, student.fullname, student.email]
      .some((value) => value?.toLowerCase().includes(query));
  });

  const getBreadcrumbs = (tab: TeacherTab) => {
    switch (tab) {
      case 'materias':
        return ['INICIA', 'Portal Docente', 'Mis Asignaturas'];
      case 'estudiantes':
        return ['INICIA', 'Portal Docente', 'Alumnos y Grupos'];
      case 'calificaciones':
        return ['INICIA', 'Portal Docente', 'Libro de Calificaciones'];
      case 'perfil':
        return ['INICIA', 'Portal Docente', 'Perfil Institucional'];
      default:
        return ['INICIA', 'Portal Docente'];
    }
  };

  if (authLoading || loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <p className="text-xs font-medium text-muted">Cargando panel del profesor...</p>
        </div>
      </div>
    );
  }

  return (
    <CampusShell
      searchItems={[...courses.map((course) => ({ id: course.course_mapping_id, title: course.course_name || '', detail: course.portal_course_code, section: 'Cursos', tab: 'materias' })),
...enrolledStudents.map(({ course, student }) => ({ id: course.course_mapping_id + student.id, title: student.fullname, detail: [student.email, course.course_name].join(' · '), section: 'Estudiantes', tab: 'estudiantes' })),]}
      currentTab={activeTab}
      onSelectTab={(tabId) => {
        if (tabId === 'moodle') {
          handleLaunchCampusSSO();
        } else {
          setActiveTab(tabId as TeacherTab);
        }
      }}
      breadcrumbs={getBreadcrumbs(activeTab)}
      counts={{
        courses: courses.length,
      }}
      onLaunchCampusSSO={handleLaunchCampusSSO}
    >
      <div className="space-y-6">
        {/* Header Docente */}
        <div className="campus-heading">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-[4px] bg-primary/10 px-2 py-0.5 text-[11px] font-mono font-semibold text-primary border border-primary/20">
                  Cuerpo Docente
                </span>
                <span className="rounded-[4px] bg-accent-sky/20 px-2 py-0.5 text-[11px] font-mono font-semibold text-foreground border border-accent-sky/40">
                  Profesor Titular
                </span>
                <MoodleSyncBadge
                  status={user?.moodle_sync_status}
                  moodleId={user?.moodle_user_id}
                />
              </div>
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
                Prof. {user?.first_name} {user?.last_name}
              </h1>
              <p className="text-xs sm:text-sm text-muted">
                Gestión de asignaturas, actas de evaluación, alumnos inscritos y acceso con privilegios de edición en Moodle LMS.
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={handleLaunchCampusSSO}
                disabled={actionLoading === 'launch-campus'}
                className="inline-flex items-center justify-center gap-1.5 rounded-[6px] bg-primary-action text-white font-medium px-3.5 py-2 text-xs shadow-minimal hover:bg-primary-action/90 active:scale-[0.98] transition-all disabled:opacity-50"
                title="Abrir Moodle como Profesor con sesión iniciada al instante"
              >
                {actionLoading === 'launch-campus' ? (
                  <>
                    <span className="h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    <span>Iniciando SSO...</span>
                  </>
                ) : (
                  <>
                    <IconExternalLink className="w-3.5 h-3.5 text-accent-sky" />
                    <span>Abrir Campus Virtual (SSO)</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={loadTeacherData}
                className="h-8 w-8 rounded-[6px] border border-border bg-surface hover:bg-surface-muted text-muted hover:text-foreground flex items-center justify-center transition-all"
                title="Actualizar datos"
              >
                <IconRefresh className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Tarjetas de Métricas Operativas */}
          <div className="mt-5 grid grid-cols-1 gap-3 border-t border-border pt-4 sm:grid-cols-3">
            <div className="rounded-[8px] border border-border bg-surface-muted/30 p-3.5">
              <span className="text-[11px] font-mono uppercase tracking-wider text-muted">Cuenta Moodle</span>
              <p className="mt-1 font-mono text-sm font-semibold text-foreground">
                {user?.moodle_username || 'profesor'}
              </p>
              <span className="text-[11px] text-muted mt-0.5 block">Identificador de acceso oficial</span>
            </div>

            <div className="rounded-[8px] border border-border bg-surface-muted/30 p-3.5">
              <span className="text-[11px] font-mono uppercase tracking-wider text-muted">Cursos a Cargo</span>
              <p className="mt-1 text-sm font-semibold text-foreground">
                {courses.length} asignatura(s) asignadas
              </p>
              <span className="text-[11px] text-muted mt-0.5 block">Con permisos de edición de aula</span>
            </div>

            <div className="rounded-[8px] border border-border bg-surface-muted/30 p-3.5">
              <span className="text-[11px] font-mono uppercase tracking-wider text-muted">Alumnos Asignados</span>
              <p className="mt-1 text-sm font-semibold text-foreground">
                {enrolledStudents.length} estudiante(s) activo(s)
              </p>
              <span className="text-[11px] text-muted mt-0.5 block">Distribuidos en tus grupos</span>
            </div>
          </div>
        </div>

        {/* Notificaciones y Avisos */}
        {notice && (
          <div className="rounded-[8px] border border-success/25 bg-success/10 p-3.5 text-xs font-medium text-success flex items-center justify-between shadow-minimal">
            <div className="flex items-center gap-2">
              <IconCheck className="w-4 h-4 text-success shrink-0" />
              <span>{notice}</span>
            </div>
            <button
              type="button"
              onClick={() => setNotice(null)}
              className="text-xs text-muted hover:text-foreground"
            >
              <IconClose className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {error && (
          <div className="rounded-[8px] border border-danger/30 bg-danger/10 p-3.5 text-xs font-medium text-danger flex items-center justify-between shadow-minimal">
            <div className="flex items-center gap-2">
              <IconAlertTriangle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
            <button
              type="button"
              onClick={() => setError(null)}
              className="text-xs text-muted hover:text-foreground"
            >
              <IconClose className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* ========================================================================= */}
        {/* PESTAÑA 1: MIS ASIGNATURAS                                                */}
        {/* ========================================================================= */}
        {activeTab === 'materias' && (
          <div className="space-y-4">
            <div className="rounded-[10px] border border-border bg-surface p-5 shadow-minimal">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
                    <IconGroups className="w-5 h-5 text-primary" />
                    <span>Cursos Asignados para Impartir</span>
                  </h2>
                  <p className="text-xs text-muted mt-0.5">
                    Accede a las aulas de Moodle para editar materiales, configurar tareas y calificar actividades.
                  </p>
                </div>

                <div className="relative w-full sm:w-64">
                  <input
                    type="text"
                    placeholder="Filtrar por código o nombre..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full rounded-[6px] border border-border bg-surface-muted/40 px-3 py-1.5 text-xs text-foreground placeholder:text-muted focus:border-primary focus:bg-surface focus:outline-none transition-all"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      className="absolute right-2.5 top-2 text-xs text-muted hover:text-foreground"
                    >
                      <IconClose className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>
            </div>

            {filteredCourses.length === 0 ? (
              <div className="rounded-[10px] border border-dashed border-border bg-surface p-10 text-center">
                <IconGroups className="w-8 h-8 text-muted mx-auto mb-2 opacity-50" />
                <p className="text-xs font-medium text-foreground">
                  {searchQuery
                    ? 'No se encontraron materias que coincidan con la búsqueda.'
                    : 'No tienes cursos asignados actualmente.'}
                </p>
                <p className="text-[11px] text-muted mt-1 max-w-sm mx-auto">
                  Comunícate con la coordinación académica para vincular tus grupos asignados.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {filteredCourses.map((course, index) => {
                  const courseKey = course.course_mapping_id || `teacher-course-${index}`;
                  const studentCount = moodleCourseOverviews[course.moodle_course_id]?.total_students;

                  return (
                    <div
                      key={courseKey}
                      className="flex flex-col justify-between rounded-[10px] border border-border bg-surface p-5 shadow-minimal hover:border-primary/40 transition-all"
                    >
                      <div>
                        <div className="flex items-center justify-between">
                          <span className="rounded-[4px] bg-primary/10 px-2 py-0.5 font-mono text-[11px] font-semibold text-primary">
                            {(course.course_code || course.portal_course_code)}
                          </span>
                          <span className="rounded-[4px] bg-surface-muted px-2 py-0.5 text-[11px] font-medium text-muted border border-border">
                            {studentCount == null ? 'Alumnos sin consultar' : `${studentCount} alumno(s) Moodle`}
                          </span>
                        </div>

                        <h3 className="mt-3 text-base font-semibold text-foreground">
                          {course.course_name}
                        </h3>

                        <p className="mt-1 text-xs text-muted font-mono">
                          Moodle ID: #{course.moodle_course_id} • Rol: Docente Titular
                        </p>

                        {/* Indicadores en vivo de Moodle */}
                        {(() => {
                          const ov = moodleCourseOverviews[course.moodle_course_id];
                          if (!ov) return null;
                          return (
                            <div className="mt-3 grid grid-cols-2 gap-2 rounded-[6px] bg-surface-muted/30 p-2 text-[10px] text-muted border border-border/50 font-mono">
                              <div>
                                <span>Actividades: </span>
                                <strong className="text-foreground">{ov.total_activities ?? 0}</strong>
                              </div>
                              <div>
                                <span>Secciones: </span>
                                <strong className="text-foreground">{ov.total_sections ?? 0}</strong>
                              </div>
                            </div>
                          );
                        })()}

                        {/* Accesos rápidos docentes de Moodle */}
                        <div className="mt-4 flex flex-wrap gap-2 text-[11px]">
                          <a
                            href={`${process.env.NEXT_PUBLIC_MOODLE_URL || 'http://192.168.191.171/moodle'}/grade/report/grader/index.php?id=${course.moodle_course_id}`}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 rounded-[4px] border border-border bg-surface-muted/40 hover:bg-surface-muted px-2.5 py-1 text-muted hover:text-foreground transition-all"
                          >
                            <IconGrades className="w-3 h-3 text-primary" />
                            <span>Calificador Moodle ↗</span>
                          </a>
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedCourseFilter(course.course_mapping_id);
                              setActiveTab('estudiantes');
                            }}
                            className="inline-flex items-center gap-1 rounded-[4px] border border-border bg-surface-muted/40 hover:bg-surface-muted px-2.5 py-1 text-muted hover:text-foreground transition-all"
                          >
                            <IconStudents className="w-3 h-3 text-primary" />
                            <span>Ver Alumnos ({studentCount})</span>
                          </button>
                        </div>
                      </div>

                      <div className="mt-5 border-t border-border pt-3.5 flex items-center gap-2">
                        <LaunchCourseButton
                          courseMappingId={course.course_mapping_id}
                          courseName={course.course_name}
                          isAuthorized={true}
                          className="flex-1"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ========================================================================= */}
        {/* PESTAÑA 2: ALUMNOS Y GRUPOS (CON OPCIÓN DE DESASIGNAR / DAR DE BAJA)      */}
        {/* ========================================================================= */}
        {activeTab === 'estudiantes' && (
          <div className="space-y-4">
            <div className="rounded-[10px] border border-border bg-surface p-5 shadow-minimal">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
                    <IconStudents className="w-5 h-5 text-primary" />
                    <span>Directorio de Alumnos Inscritos</span>
                  </h2>
                  <p className="text-xs text-muted mt-0.5">
                    Estudiantes activos en tus materias. Puedes consultar sus expedientes o desasignarlos del grupo si cambiaron de materia o se dieron de baja.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2.5">
                  <select
                    value={selectedCourseFilter}
                    onChange={(e) => setSelectedCourseFilter(e.target.value)}
                    className="rounded-[6px] border border-border bg-surface-muted/40 px-3 py-1.5 text-xs text-foreground focus:border-primary focus:outline-none transition-all"
                  >
                    <option value="">Todas mis asignaturas</option>
                    {courses.map((c) => (
                      <option key={c.course_mapping_id} value={c.course_mapping_id}>
                        {(c.course_code || c.portal_course_code)} - {c.course_name}
                      </option>
                    ))}
                  </select>

                  <div className="relative w-full sm:w-56">
                    <input
                      type="text"
                      placeholder="Buscar por nombre o correo..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full rounded-[6px] border border-border bg-surface-muted/40 px-3 py-1.5 text-xs text-foreground placeholder:text-muted focus:border-primary focus:outline-none transition-all"
                    />
                    {searchQuery && (
                      <button
                        type="button"
                        onClick={() => setSearchQuery('')}
                        className="absolute right-2.5 top-2 text-xs text-muted hover:text-foreground"
                      >
                        <IconClose className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-[10px] border border-border bg-surface overflow-hidden shadow-minimal">
              {filteredStudents.length === 0 ? (
                <div className="p-8 text-center text-xs text-muted">
                  No se encontraron estudiantes registrados para los filtros seleccionados.
                </div>
              ) : (
                <table className="w-full text-left text-xs">
                  <thead className="bg-surface-muted/60 text-muted font-medium border-b border-border">
                    <tr>
                      <th className="px-5 py-3.5">Estudiante</th>
                      <th className="px-5 py-3.5">Asignatura</th>
                      <th className="px-5 py-3.5">Estado Moodle</th>

                      <th className="px-5 py-3.5 text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {filteredStudents.map(({ course, student }) => {
                      const studentName = student.fullname;
                      const studentEmail = student.email;
                      const courseName = course.course_name;

                      return (
                        <tr key={course.course_mapping_id + student.id} className="hover:bg-surface-muted/30 transition-colors">
                          <td className="px-5 py-3.5">
                            <span className="font-semibold text-foreground block">
                              {studentName}
                            </span>
                            <span className="font-mono text-[11px] text-muted">
                              {studentEmail}
                            </span>
                          </td>
                          <td className="px-5 py-3.5">
                            <span className="font-medium text-foreground block">
                              {courseName}
                            </span>
                            <span className="font-mono text-[11px] text-muted">
                              {course.portal_course_code}
                            </span>
                          </td>
                          <td className="px-5 py-3.5">
                            <MoodleSyncBadge status={"sincronizado"} />
                          </td>
                          <td className="px-5 py-3.5 text-right">
                            <div className="flex items-center justify-end gap-2">
                              {studentEmail && <a href={`mailto:${studentEmail}`} className="text-primary underline">Contactar</a>}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* PESTAÑA 3: ACTAS Y LIBRO DE CALIFICACIONES                                */}
        {/* ========================================================================= */}
        {activeTab === 'calificaciones' && (
          <div className="space-y-4">
            <div className="rounded-[10px] border border-border bg-surface p-5 shadow-minimal">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
                    <IconGrades className="w-5 h-5 text-primary" />
                    <span>Libro de Calificaciones y Evaluaciones</span>
                  </h2>
                  <p className="text-xs text-muted mt-0.5">
                    El libro de calificaciones oficial y las actas académicas se asientan directamente en Moodle LMS.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2.5">
                  <select
                    value={selectedCourseFilter}
                    onChange={(e) => setSelectedCourseFilter(e.target.value)}
                    className="rounded-[6px] border border-border bg-surface-muted/40 px-3 py-1.5 text-xs text-foreground focus:border-primary focus:outline-none transition-all"
                  >
                    <option value="">Todas mis asignaturas</option>
                    {courses.map((c) => (
                      <option key={c.course_mapping_id} value={c.course_mapping_id}>
                        {(c.course_code || c.portal_course_code)} - {c.course_name}
                      </option>
                    ))}
                  </select>

                  {courses.length > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        const target = selectedCourseFilter
                          ? courses.find((c) => c.course_mapping_id === selectedCourseFilter)
                          : courses[0];
                        if (target?.moodle_course_id) {
                          handleOpenGradebook(target.moodle_course_id);
                        }
                      }}
                      className="inline-flex items-center gap-1.5 rounded-[6px] bg-primary-action px-3 py-1.5 text-xs font-semibold text-white shadow-minimal hover:bg-primary-action/90 transition-all"
                    >
                      <IconExternalLink className="w-3.5 h-3.5 text-accent-sky" />
                      <span>Abrir Calificador en Moodle ↗</span>
                    </button>
                  )}
                </div>
              </div>

              <div className="mt-4 rounded-[8px] bg-surface-muted/50 border border-border/70 p-3 text-xs text-muted leading-relaxed">
                <p>
                  <strong className="text-foreground">Lineamiento académico oficial:</strong> Las calificaciones, ponderaciones de rúbricas y actas se administran en Moodle LMS. Desde aquí puedes consultar tus grupos y abrir el calificador oficial de cada asignatura.
                </p>
              </div>
            </div>

            <div className="rounded-[10px] border border-border bg-surface overflow-hidden shadow-minimal">
              {filteredStudents.length === 0 ? (
                <div className="p-8 text-center text-xs text-muted">
                  No hay estudiantes matriculados para calificar en esta asignatura.
                </div>
              ) : (
                <table className="w-full text-left text-xs">
                  <thead className="bg-surface-muted/60 text-muted font-medium border-b border-border">
                    <tr>
                      <th className="px-5 py-3.5">Estudiante</th>
                      <th className="px-5 py-3.5">Materia</th>
                      <th className="px-5 py-3.5">Estado Moodle</th>
                      <th className="px-5 py-3.5">Calificaciones oficiales</th>
                      <th className="px-5 py-3.5 text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {filteredStudents.map(({ course, student }) => {
                      const studentName = student.fullname;
                      const courseName = course.course_name;
                      const moodleCourseId = course.moodle_course_id;
                      const courseMappingId = course.course_mapping_id;

                      return (
                        <tr key={course.course_mapping_id + student.id} className="hover:bg-surface-muted/30 transition-colors">
                          <td className="px-5 py-3.5">
                            <span className="font-semibold text-foreground block">
                              {studentName}
                            </span>
                            <span className="font-mono text-[11px] text-muted">
                              {student.email}
                            </span>
                          </td>
                          <td className="px-5 py-3.5 font-medium text-foreground">
                            {courseName}
                          </td>
                          <td className="px-5 py-3.5">
                            <MoodleSyncBadge
                              status={"sincronizado"}
                              moodleId={student.id}
                            />
                          </td>
                          <td className="px-5 py-3.5 font-mono text-xs">
                            <span className="text-muted text-[11px]">Consulta el calificador de Moodle</span>
                          </td>
                          <td className="px-5 py-3.5 text-right">
                            <div className="inline-flex items-center gap-2">
                              {courseMappingId && (
                                <button
                                  type="button"
                                  onClick={() => handleLaunchCourseSSO(courseMappingId)}
                                  disabled={actionLoading === `launch-${courseMappingId}`}
                                  className="rounded-[4px] border border-border bg-surface-muted/40 hover:bg-surface-muted px-2 py-1 text-[11px] font-medium text-foreground transition-all"
                                >
                                  Aula SSO ↗
                                </button>
                              )}
                              {moodleCourseId && (
                                <button
                                  type="button"
                                  onClick={() => handleOpenGradebook(moodleCourseId)}
                                  className="rounded-[4px] border border-border bg-surface-muted/40 hover:bg-surface-muted px-2 py-1 text-[11px] font-medium text-primary transition-all"
                                >
                                  Calificador ↗
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* PESTAÑA 4: PERFIL INSTITUCIONAL DEL DOCENTE                                */}
        {/* ========================================================================= */}
        {activeTab === 'perfil' && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-[10px] border border-border bg-surface p-5 shadow-minimal">
              <div>
                <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
                  <IconSettings className="w-5 h-5 text-primary" />
                  <span>Perfil Institucional y Credenciales Docentes</span>
                </h2>
                <p className="text-xs text-muted mt-0.5">
                  Datos de identidad académica registrados en INICIA y vinculación con el campus virtual.
                </p>
              </div>
              <button
                type="button"
                onClick={handleOpenEditProfile}
                className="inline-flex items-center gap-1.5 self-start sm:self-auto rounded-[6px] border border-border bg-surface-muted/50 hover:bg-surface-muted px-3 py-1.5 text-xs font-semibold text-foreground transition-all"
              >
                <IconSettings className="w-3.5 h-3.5 text-primary" />
                <span>Editar Información</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="rounded-[10px] border border-border bg-surface p-5 space-y-3 shadow-minimal">
                <span className="text-[11px] font-mono uppercase tracking-wider text-muted">
                  Identidad en el Portal
                </span>
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between py-1 border-b border-border/50">
                    <span className="text-muted">Nombre Completo</span>
                    <span className="font-semibold text-foreground">
                      {user?.first_name} {user?.last_name}
                    </span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-border/50">
                    <span className="text-muted">Correo Institucional</span>
                    <span className="font-mono text-foreground">{user?.email}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-border/50">
                    <span className="text-muted">Teléfono de Contacto</span>
                    <span className="font-mono text-foreground">{user?.phone || 'No registrado'}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-border/50">
                    <span className="text-muted">Rol Académico</span>
                    <span className="font-medium text-primary">Docente Titular / Profesor</span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-muted">Estado en Portal</span>
                    <span className="capitalize text-success font-medium">
                      {user?.status || 'activo'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="rounded-[10px] border border-border bg-surface p-5 space-y-3 shadow-minimal">
                <span className="text-[11px] font-mono uppercase tracking-wider text-muted">
                  Enlace con Moodle LMS
                </span>
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between py-1 border-b border-border/50">
                    <span className="text-muted">Usuario en Moodle</span>
                    <span className="font-mono text-foreground">
                      {user?.moodle_username || user?.email?.split('@')[0] || 'docente'}
                    </span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-border/50">
                    <span className="text-muted">Moodle ID Numérico</span>
                    <span className="font-mono text-foreground">
                      {user?.moodle_user_id ? `#${user.moodle_user_id}` : 'Vinculado vía correo'}
                    </span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-border/50">
                    <span className="text-muted">Estado de Sincronización</span>
                    <MoodleSyncBadge
                      status={user?.moodle_sync_status}
                      moodleId={user?.moodle_user_id}
                    />
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-muted">Mecanismo de Salto SSO</span>
                    <span className="font-mono text-success font-medium">
                      auth_userkey (SSO Directo)
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* MODAL: CONFIRMACIÓN PARA DESASIGNAR ESTUDIANTE DE LA MATERIA */}
        {/* MODAL: EDITAR INFORMACIÓN DE PERFIL DOCENTE */}
        {editProfileOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="w-full max-w-md rounded-[14px] border border-border bg-surface p-6 shadow-xl space-y-4 animate-in fade-in zoom-in-95">
              <div className="flex items-center justify-between border-b border-border pb-3">
                <div className="flex items-center gap-2">
                  <IconSettings className="w-5 h-5 text-primary" />
                  <h3 className="text-base font-bold text-foreground">
                    Editar Datos del Docente
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setEditProfileOpen(false)}
                  className="text-muted hover:text-foreground"
                >
                  <IconClose className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleSaveProfile} className="space-y-3 text-xs">
                <div>
                  <label className="block text-muted font-medium mb-1">Nombre</label>
                  <input
                    type="text"
                    required
                    value={profileForm.first_name}
                    onChange={(e) => setProfileForm({ ...profileForm, first_name: e.target.value })}
                    className="w-full rounded-[6px] border border-border bg-surface-muted/40 px-3 py-2 text-foreground focus:border-primary focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-muted font-medium mb-1">Apellidos</label>
                  <input
                    type="text"
                    required
                    value={profileForm.last_name}
                    onChange={(e) => setProfileForm({ ...profileForm, last_name: e.target.value })}
                    className="w-full rounded-[6px] border border-border bg-surface-muted/40 px-3 py-2 text-foreground focus:border-primary focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-muted font-medium mb-1">Teléfono</label>
                  <input
                    type="tel"
                    placeholder="Ej. +52 55 1234 5678"
                    value={profileForm.phone}
                    onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value })}
                    className="w-full rounded-[6px] border border-border bg-surface-muted/40 px-3 py-2 text-foreground focus:border-primary focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-muted font-medium mb-1">Semblanza académica o síntesis curricular</label>
                  <textarea
                    rows={3}
                    placeholder="Grados académicos, líneas de investigación o áreas de especialidad..."
                    value={profileForm.bio}
                    onChange={(e) => setProfileForm({ ...profileForm, bio: e.target.value })}
                    className="w-full rounded-[6px] border border-border bg-surface-muted/40 px-3 py-2 text-foreground focus:border-primary focus:outline-none"
                  />
                </div>

                <div className="flex justify-end gap-2.5 pt-3 border-t border-border">
                  <button
                    type="button"
                    onClick={() => setEditProfileOpen(false)}
                    disabled={actionLoading === 'save-profile'}
                    className="rounded-[6px] border border-border bg-surface px-4 py-2 text-xs font-semibold text-foreground hover:bg-surface-muted transition-all"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={actionLoading === 'save-profile'}
                    className="inline-flex items-center gap-1.5 rounded-[6px] bg-primary-action px-4 py-2 text-xs font-semibold text-white hover:bg-primary-action/90 transition-all disabled:opacity-50"
                  >
                    {actionLoading === 'save-profile' ? (
                      <span>Guardando...</span>
                    ) : (
                      <>
                        <IconCheck className="w-3.5 h-3.5" />
                        <span>Guardar Cambios</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </CampusShell>
  );
}

```

### apps/web/src/app/dashboard/estudiante/page.tsx

<!-- archivo: apps/web/src/app/dashboard/estudiante/page.tsx -->
```tsx
// IINICIA Portal · panel estudiantil · page.tsx
/** Muestra cursos autorizados, avance y perfil del estudiante, y permite iniciar el acceso al campus. */
'use client';

import React, { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { coursesApi, enrollmentsApi, moodleApi, usersApi } from '@/lib/api';
import type { AuthorizedCourse, CourseOffering, EnrollmentRequest, MoodleCourseProgress, UserProgramMembership } from '@/types';
import { LaunchCourseButton } from '@/components/moodle/LaunchCourseButton';
import { MoodleSyncBadge } from '@/components/moodle/MoodleSyncBadge';
import { CampusShell } from '@/components/campus-tech/CampusShell';
import {
  closeMoodleLaunchWindow,
  navigateMoodleLaunchWindow,
  openMoodleLaunchWindow,
} from '@/lib/moodle-window';
import {
  IconStudents,
  IconGroups,
  IconCheck,
  IconAlertTriangle,
  IconPlus,
  IconExternalLink,
  IconClose,
  IconGrades,
  IconBookOpen,
  IconClock,
  IconSearch,
  IconRefresh,
  IconSettings,
} from '@/components/campus-tech/Icons';

type StudentTab = 'cursos' | 'inscripciones' | 'calificaciones' | 'moodle' | 'perfil';

interface CourseDropTarget {
  enrollmentId: string;
  courseName: string;
  courseCode: string;
}

/** Presenta cursos, solicitudes y avance de la cuenta estudiante, y permite abrir las rutas de Moodle asignadas. */
export default function EstudianteDashboardPage() {
  const router = useRouter();
  const { user, loading: authLoading, refreshUser } = useAuth();

  const [activeTab, setActiveTab] = useState<StudentTab>('cursos');
  const [courses, setCourses] = useState<AuthorizedCourse[]>([]);
  const [offerings, setOfferings] = useState<CourseOffering[]>([]);
  const [enrollments, setEnrollments] = useState<EnrollmentRequest[]>([]);
  const [programs, setPrograms] = useState<UserProgramMembership[] | null>(null);
  const [programsError, setProgramsError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Modales interactivos
  const [dropTarget, setDropTarget] = useState<CourseDropTarget | null>(null);
  const [syllabusTarget, setSyllabusTarget] = useState<AuthorizedCourse | null>(null);
  const [courseProgressMap, setCourseProgressMap] = useState<Record<number, MoodleCourseProgress>>({});
  const [moodleContents, setMoodleContents] = useState<any[]>([]);
  const [loadingContents, setLoadingContents] = useState(false);
  const [editProfileOpen, setEditProfileOpen] = useState(false);
  const [profileForm, setProfileForm] = useState({
    first_name: '',
    last_name: '',
    phone: '',
    bio: '',
  });

  const userId = user?.id;
  useEffect(() => {
    if (!userId) return;
    let current = true;
    usersApi.getUserById(userId).then(
      (profile) => { if (current) setPrograms(profile.programs ?? []); },
      () => { if (current) setProgramsError(true); },
    );
    return () => { current = false; };
  }, [userId]);

  // Reúne información de la matrícula, el programa y los cursos que consume el panel.
  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [courseResult, enrollmentResult, offeringResult] = await Promise.allSettled([
        coursesApi.getAuthorizedCourses(),
        enrollmentsApi.getMyEnrollments(),
        coursesApi.getOfferings(),
      ]);
      const userCourses = courseResult.status === 'fulfilled' ? courseResult.value : [];
      if (courseResult.status === 'fulfilled') setCourses(userCourses);
      if (enrollmentResult.status === 'fulfilled') setEnrollments(enrollmentResult.value);
      if (offeringResult.status === 'fulfilled') setOfferings(offeringResult.value);
      const failures = [
        courseResult.status === 'rejected' && 'tus cursos',
        enrollmentResult.status === 'rejected' && 'tus inscripciones',
        offeringResult.status === 'rejected' && 'la oferta',
      ].filter(Boolean);
      if (failures.length) setError(`No fue posible actualizar ${failures.join(', ')}. Pulsa Actualizar para reintentar.`);


    } catch (err: any) {
      setError(err.message || 'No fue posible cargar tus cursos.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.push('/login');
      return;
    }
    if (!user.roles.includes('estudiante') && !user.roles.includes('superadministrador')) {
      router.replace('/dashboard');
      return;
    }

    loadData();
  }, [user, authLoading, router]);

  useEffect(() => {
    let current = true;
    void Promise.all(courses.map(async (course) => {
      try {
        const progress = await moodleApi.getCourseProgress(course.moodle_course_id);
        return [course.moodle_course_id, progress] as const;
      } catch {
        return null;
      }
    })).then((results) => {
      if (!current) return;
      const progress: Record<number, MoodleCourseProgress> = {};
      for (const result of results) if (result) progress[result[0]] = result[1];
      setCourseProgressMap(progress);
    });
    return () => { current = false; };
  }, [courses]);

  // Obtiene el contenido académico del curso seleccionado antes de mostrar el temario.
  const handleOpenSyllabus = async (course: AuthorizedCourse) => {
    setSyllabusTarget(course);
    setMoodleContents([]);
    setLoadingContents(true);
    try {
      const contents = await moodleApi.getCourseContents(course.moodle_course_id);
      setMoodleContents(contents || []);
    } catch {
      setMoodleContents([]);
    } finally {
      setLoadingContents(false);
    }
  };

  const handleLaunchCampusSSO = async () => {
    const launchWindow = openMoodleLaunchWindow();
    if (!launchWindow) {
      setError('Permite las ventanas emergentes para abrir Moodle.');
      return;
    }
    setActionLoading('launch-campus');
    setNotice(null);
    setError(null);

    try {
      const res = await moodleApi.launchCampus();
      navigateMoodleLaunchWindow(launchWindow, res.access_url);
      setNotice('Sesión iniciada en el Campus Virtual Moodle vía SSO.');
    } catch (err: any) {
      closeMoodleLaunchWindow(launchWindow);
      setError(err.message || 'Error al iniciar sesión SSO en Moodle.');
    } finally {
      setActionLoading(null);
    }
  };

  // Solicita una sesión para el curso elegido y navega la ventana del aula.
  const handleLaunchCourseSSO = async (courseMappingId: string) => {
    const launchWindow = openMoodleLaunchWindow();
    if (!launchWindow) {
      setError('Permite las ventanas emergentes para abrir Moodle.');
      return;
    }
    setActionLoading(`launch-${courseMappingId}`);
    setNotice(null);
    setError(null);

    try {
      const res = await coursesApi.launchCourse(courseMappingId);
      navigateMoodleLaunchWindow(launchWindow, res.access_url);
    } catch (err: any) {
      closeMoodleLaunchWindow(launchWindow);
      setError(err.message || 'Error al acceder al aula virtual en Moodle vía SSO.');
    } finally {
      setActionLoading(null);
    }
  };

  // Inscripción rápida en un curso disponible
  const handleQuickEnroll = async (courseMappingId: string, courseName: string) => {
    setActionLoading(`enroll-${courseMappingId}`);
    setNotice(null);
    setError(null);

    try {
      await enrollmentsApi.requestEnrollment(courseMappingId);
      setNotice(
        `Tu solicitud para "${courseName}" quedó registrada. Un administrador debe autorizar la matrícula en Moodle.`,
      );
      await loadData();
    } catch (err: any) {
      setError(err.message || 'Error al inscribirse en el curso.');
    } finally {
      setActionLoading(null);
    }
  };

  // Dar de baja materia / desasignar curso
  // Confirma la baja del curso seleccionado antes de actualizar la vista.
  const handleConfirmDropCourse = async () => {
    if (!dropTarget) return;

    setActionLoading(`drop-${dropTarget.enrollmentId}`);
    setNotice(null);
    setError(null);

    try {
      await enrollmentsApi.deleteEnrollment(dropTarget.enrollmentId);
      setNotice(
        `La solicitud de baja de "${dropTarget.courseName}" se retiró del portal. Consulta con administración el estado del aula virtual.`,
      );
      setDropTarget(null);
      await loadData();
    } catch (err: any) {
      setError(err.message || 'Error al dar de baja la materia.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleOpenEditProfile = () => {
    setProfileForm({
      first_name: user?.first_name || '',
      last_name: user?.last_name || '',
      phone: user?.phone || '',
      bio: (user as any)?.bio || '',
    });
    setEditProfileOpen(true);
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionLoading('save-profile');
    setNotice(null);
    setError(null);

    try {
      await usersApi.updateOwnProfile({
        first_name: profileForm.first_name.trim(),
        last_name: profileForm.last_name.trim(),
        phone: profileForm.phone.trim(),
        bio: profileForm.bio.trim(),
      });
      await refreshUser();
      setNotice('Tu expediente y perfil han sido actualizados con éxito.');
      setEditProfileOpen(false);
    } catch (err: any) {
      setError(err.message || 'No fue posible actualizar tu perfil.');
    } finally {
      setActionLoading(null);
    }
  };

  const enrolledMappingIds = useMemo(
    () => new Set(courses.map((c) => c.course_mapping_id)),
    [courses],
  );

  const availableOfferings = useMemo(() => {
    let list = offerings.filter((off) => !enrolledMappingIds.has(off.course_mapping_id || off.id));
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (off) =>
          (off.name || '').toLowerCase().includes(q) ||
          (off.code || '').toLowerCase().includes(q) ||
          (off.program_name || '').toLowerCase().includes(q),
      );
    }
    return list;
  }, [offerings, enrolledMappingIds, searchQuery]);

  const filteredEnrolledCourses = useMemo(() => {
    if (!searchQuery.trim()) return courses;
    const q = searchQuery.toLowerCase().trim();
    return courses.filter(
      (c) =>
        (c.course_name || '').toLowerCase().includes(q) ||
        (c.course_code || '').toLowerCase().includes(q) ||
        (c.program_name || '').toLowerCase().includes(q),
    );
  }, [courses, searchQuery]);

  // Mapa de enrollment_id para cada curso autorizado
  const courseEnrollmentMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const enr of enrollments) {
      if (enr.course_mapping_id) {
        map.set(enr.course_mapping_id, enr.id);
      }
    }
    return map;
  }, [enrollments]);

  // Cálculos de avance curricular y kárdex consolidado
  const kardexSummary = useMemo(() => {
    let accreditedCount = 0;
    let gradedSum = 0;
    let gradedCount = 0;
    let totalCredits = 0;

    for (const c of courses) {
      const offering = offerings.find(
        (o) => o.course_mapping_id === c.course_mapping_id || o.id === c.course_mapping_id,
      );
      totalCredits += offering?.credits ?? 0;

      if (c.cached_final_grade != null) {
        const num = Number(c.cached_final_grade);
        gradedSum += num;
        gradedCount += 1;
        if (num >= 6) accreditedCount += 1;
      }
    }

    const average = gradedCount > 0 ? (gradedSum / gradedCount).toFixed(1) : null;
    return {
      totalCourses: courses.length,
      accreditedCount,
      average,
      totalCredits,
    };
  }, [courses, offerings]);

  const getBreadcrumbs = (tab: StudentTab) => {
    switch (tab) {
      case 'cursos':
        return ['INICIA', 'Portal Estudiante', 'Mis Materias Activas'];
      case 'inscripciones':
        return ['INICIA', 'Portal Estudiante', 'Catálogo e Inscripción'];
      case 'calificaciones':
        return ['INICIA', 'Portal Estudiante', 'Kárdex y Avance Curricular'];
      case 'perfil':
        return ['INICIA', 'Portal Estudiante', 'Expediente Escolar'];
      default:
        return ['INICIA', 'Portal Estudiante'];
    }
  };

  if (authLoading || loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <p className="text-xs font-medium text-muted">Cargando tu aula virtual...</p>
        </div>
      </div>
    );
  }

  return (
    <CampusShell
      searchItems={[...courses.map((course) => ({ id: course.course_mapping_id, title: course.course_name || '', detail: course.portal_course_code, section: 'Cursos', tab: 'cursos' })),]}
      currentTab={activeTab}
      onSelectTab={(tabId) => {
        if (tabId === 'moodle') {
          handleLaunchCampusSSO();
        } else {
          setActiveTab(tabId as StudentTab);
        }
      }}
      breadcrumbs={getBreadcrumbs(activeTab)}
      counts={{
        courses: courses.length,
        enrollments: enrollments.length,
      }}
      onLaunchCampusSSO={handleLaunchCampusSSO}
    >
      <div className="space-y-6">
        {/* Header Estudiante */}
        <div className="campus-heading">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-[4px] bg-primary/10 px-2 py-0.5 text-[11px] font-mono font-semibold text-primary border border-primary/20">
                  Estudiante Regular
                </span>
                <span className="rounded-[4px] bg-accent-sky/20 px-2 py-0.5 text-[11px] font-mono font-semibold text-foreground border border-accent-sky/40">
                  Campus Virtual Activo
                </span>
                <MoodleSyncBadge
                  status={user?.moodle_sync_status}
                  moodleId={user?.moodle_user_id}
                />
              </div>
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
                ¡Hola, {user?.first_name || 'Estudiante'}!
              </h1>
              <p className="text-xs sm:text-sm text-muted">
                Bienvenido a tu entorno de aprendizaje. Accede a tus materias, consulta calificaciones e interactúa en Moodle LMS.
              </p>
              {programsError && <p role="status" className="text-sm text-danger">No fue posible consultar tus programas.</p>}
              {programs !== null && (
                <div className="text-sm">
                  <h2 className="font-semibold">Mis programas</h2>
                  {programs.length ? (
                    <ul>{programs.map((program) => (
                      <li key={program.program_id}>{program.name} · {program.academic_status.replaceAll('_', ' ')}</li>
                    ))}</ul>
                  ) : <p className="text-muted">Aún no tienes un programa asignado.</p>}
                </div>
              )}
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={handleLaunchCampusSSO}
                disabled={actionLoading === 'launch-campus'}
                className="inline-flex items-center justify-center gap-1.5 rounded-[6px] bg-primary-action text-white font-medium px-3.5 py-2 text-xs shadow-minimal hover:bg-primary-action/90 active:scale-[0.98] transition-all disabled:opacity-50"
                title="Abrir Moodle con sesión iniciada al instante"
              >
                {actionLoading === 'launch-campus' ? (
                  <>
                    <span className="h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    <span>Iniciando SSO...</span>
                  </>
                ) : (
                  <>
                    <IconExternalLink className="w-3.5 h-3.5 text-accent-sky" />
                    <span>Campus Virtual Moodle</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={loadData}
                className="h-8 w-8 rounded-[6px] border border-border bg-surface hover:bg-surface-muted text-muted hover:text-foreground flex items-center justify-center transition-all"
                title="Actualizar datos"
              >
                <IconRefresh className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Tarjetas de Métricas Operativas del Alumno */}
          <div className="mt-5 grid grid-cols-1 gap-3 border-t border-border pt-4 sm:grid-cols-4">
            <div className="rounded-[8px] border border-border bg-surface-muted/30 p-3.5">
              <span className="text-[11px] font-mono uppercase tracking-wider text-muted">Usuario Moodle</span>
              <p className="mt-1 font-mono text-sm font-semibold text-foreground">
                {user?.moodle_username || 'estudiante'}
              </p>
              <span className="text-[11px] text-muted mt-0.5 block">Identificador de acceso</span>
            </div>

            <div className="rounded-[8px] border border-border bg-surface-muted/30 p-3.5">
              <span className="text-[11px] font-mono uppercase tracking-wider text-muted">Materias Activas</span>
              <p className="mt-1 text-sm font-semibold text-foreground">
                {courses.length} curso(s) cursando
              </p>
              <span className="text-[11px] text-muted mt-0.5 block">Con acceso a tareas y foros</span>
            </div>

            <div className="rounded-[8px] border border-border bg-surface-muted/30 p-3.5">
              <span className="text-[11px] font-mono uppercase tracking-wider text-muted">Créditos SATCA</span>
              <p className="mt-1 text-sm font-semibold text-foreground">
                {kardexSummary.totalCredits} créditos
              </p>
              <span className="text-[11px] text-muted mt-0.5 block">Valor curricular acumulado</span>
            </div>

            <div className="rounded-[8px] border border-border bg-surface-muted/30 p-3.5">
              <span className="text-[11px] font-mono uppercase tracking-wider text-muted">Estado Escolar</span>
              <p className="mt-1 text-sm font-semibold capitalize text-success">
                {user?.status || 'activo'}
              </p>
              <span className="text-[11px] text-muted mt-0.5 block">Inscripción regular vigente</span>
            </div>
          </div>
        </div>

        {/* Notificaciones y Avisos */}
        {notice && (
          <div className="rounded-[8px] border border-success/25 bg-success/10 p-3.5 text-xs font-medium text-success flex items-center justify-between shadow-minimal">
            <div className="flex items-center gap-2">
              <IconCheck className="w-4 h-4 text-success shrink-0" />
              <span>{notice}</span>
            </div>
            <button
              type="button"
              onClick={() => setNotice(null)}
              className="text-xs text-muted hover:text-foreground"
            >
              <IconClose className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {error && (
          <div className="rounded-[8px] border border-danger/30 bg-danger/10 p-3.5 text-xs font-medium text-danger flex items-center justify-between shadow-minimal">
            <div className="flex items-center gap-2">
              <IconAlertTriangle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
            <button
              type="button"
              onClick={() => setError(null)}
              className="text-xs text-muted hover:text-foreground"
            >
              <IconClose className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* ========================================================================= */}
        {/* PESTAÑA 1: MIS MATERIAS ACTIVAS (CON OPCIÓN DE DESASIGNAR / DAR DE BAJA)  */}
        {/* ========================================================================= */}
        {activeTab === 'cursos' && (
          <div className="space-y-4">
            <div className="rounded-[10px] border border-border bg-surface p-5 shadow-minimal">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
                    <IconGroups className="w-5 h-5 text-primary" />
                    <span>Mis Aulas y Asignaturas Activas</span>
                  </h2>
                  <p className="text-xs text-muted mt-0.5">
                    Entra a tus cursos en Moodle, consulta materiales de estudio o gestiona tu carga académica.
                  </p>
                </div>

                <div className="flex items-center gap-2.5">
                  <div className="relative w-full sm:w-64">
                    <input
                      type="text"
                      placeholder="Buscar en mis materias..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full rounded-[6px] border border-border bg-surface-muted/40 px-3 py-1.5 text-xs text-foreground placeholder:text-muted focus:border-primary focus:bg-surface focus:outline-none transition-all"
                    />
                    {searchQuery && (
                      <button
                        type="button"
                        onClick={() => setSearchQuery('')}
                        className="absolute right-2.5 top-2 text-xs text-muted hover:text-foreground"
                      >
                        <IconClose className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveTab('inscripciones')}
                    className="inline-flex items-center gap-1.5 rounded-[6px] bg-primary-action px-3 py-1.5 text-xs font-semibold text-white shadow-minimal hover:bg-primary-action/90 transition-all shrink-0"
                  >
                    <IconPlus className="w-3.5 h-3.5" />
                    <span>Inscribir más materias</span>
                  </button>
                </div>
              </div>
            </div>

            {filteredEnrolledCourses.length === 0 ? (
              <div className="rounded-[10px] border border-dashed border-border bg-surface p-10 text-center">
                <IconGroups className="w-8 h-8 text-muted mx-auto mb-2 opacity-50" />
                <p className="text-xs font-medium text-foreground">
                  {searchQuery
                    ? 'No se encontraron materias que coincidan con la búsqueda.'
                    : 'Aún no tienes cursos inscritos en tu aula virtual.'}
                </p>
                <p className="text-[11px] text-muted mt-1 max-w-sm mx-auto">
                  Explora las materias disponibles y solicita tu matrícula.
                </p>
                <div className="pt-3">
                  <button
                    type="button"
                    onClick={() => setActiveTab('inscripciones')}
                    className="rounded-[6px] bg-primary-action px-4 py-2 text-xs font-semibold text-white shadow-minimal hover:bg-primary-action/90 transition-all"
                  >
                    Ver catálogo disponible
                  </button>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {filteredEnrolledCourses.map((course, index) => {
                  const courseKey = course.course_mapping_id || `enrolled-${index}`;
                  const enrollmentId =
                    course.enrollment_id ||
                    courseEnrollmentMap.get(course.course_mapping_id) ||
                    '';

                  return (
                    <div
                      key={courseKey}
                      className="flex flex-col justify-between rounded-[10px] border border-border bg-surface p-5 shadow-minimal hover:border-primary/40 transition-all"
                    >
                      <div>
                        <div className="flex items-center justify-between">
                          <span className="rounded-[4px] bg-primary/10 px-2 py-0.5 font-mono text-[11px] font-semibold text-primary">
                            {course.course_code || course.portal_course_code}
                          </span>
                          <span className="rounded-[4px] bg-success/10 px-2 py-0.5 text-[11px] font-medium text-success border border-success/20">
                            {course.enrollment_status === 'sincronizada' ? 'Matrícula confirmada' : 'Pendiente de sincronización'}
                          </span>
                        </div>

                        <h3 className="mt-3 text-base font-semibold text-foreground">
                          {course.course_name}
                        </h3>

                        <p className="mt-1 text-xs text-muted">
                          {course.program_name ? `Programa: ${course.program_name} • ` : ''}
                          Moodle ID #{course.moodle_course_id}
                        </p>

                        {/* Barra de Progreso Didáctico enlazada con Moodle */}
                        {(() => {
                          const prog = courseProgressMap[course.moodle_course_id];
                          const rawProgress = prog?.progress_percentage;
                          const pct = typeof rawProgress === 'number' && Number.isFinite(rawProgress)
                            ? Math.min(100, Math.max(0, rawProgress))
                            : null;
                          return (
                            <div className="mt-4 space-y-1.5">
                              <div className="flex justify-between text-[11px] text-muted">
                                <span>Avance del Curso (Moodle)</span>
                                <span className="font-mono font-medium text-foreground">
                                  {pct === null ? 'Progreso no disponible' : `${pct}% completado`}
                                </span>
                              </div>
                              <div className="h-1.5 w-full rounded-full bg-surface-muted overflow-hidden">
                                {pct !== null && (
                                  <div
                                    className="h-full rounded-full bg-primary-action transition-all duration-300"
                                    style={{ width: `${pct}%` }}
                                  />
                                )}
                              </div>
                              {prog?.total_modules != null && (
                                <div className="flex justify-between text-[10px] text-muted font-mono pt-0.5">
                                  <span>
                                    {prog.total_tracked_activities > 0
                                      ? `${prog.completed_activities} de ${prog.total_tracked_activities} actividades completadas`
                                      : `${prog.total_modules} actividades / recursos sin seguimiento`}
                                  </span>
                                  {prog.grade_formatted && prog.grade_formatted !== '-' && (
                                    <span className="font-semibold text-primary">Nota: {prog.grade_formatted}</span>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })()}

                        {/* Accesos de Temario y Consulta */}
                        <div className="mt-3.5 flex items-center gap-2 text-[11px]">
                          <button
                            type="button"
                            onClick={() => handleOpenSyllabus(course)}
                            className="inline-flex items-center gap-1 text-muted hover:text-primary transition-colors py-1"
                          >
                            <IconBookOpen className="w-3.5 h-3.5" />
                            <span>Ver temario y contenidos Moodle</span>
                          </button>
                        </div>
                      </div>

                      <div className="mt-5 border-t border-border pt-3.5 flex items-center gap-2">
                        <LaunchCourseButton
                          courseMappingId={course.course_mapping_id}
                          courseName={course.course_name}
                          isAuthorized={course.enrollment_status === 'sincronizada'}
                          className="flex-1"
                        />

                        {enrollmentId && (
                          <button
                            type="button"
                            onClick={() =>
                              setDropTarget({
                                enrollmentId,
                                courseName: course.course_name,
                                courseCode: course.course_code || '',
                              })
                            }
                            className="rounded-[6px] border border-border bg-surface hover:border-danger/40 hover:bg-danger/10 hover:text-danger px-3 py-2 text-xs font-medium text-muted transition-all"
                            title="Dar de baja esta materia"
                          >
                            Dar de baja
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ========================================================================= */}
        {/* PESTAÑA 2: CATÁLOGO E INSCRIPCIÓN DE MATERIAS NUEVAS                      */}
        {/* ========================================================================= */}
        {activeTab === 'inscripciones' && (
          <div className="space-y-4">
            <div className="rounded-[10px] border border-border bg-surface p-5 shadow-minimal">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
                    <IconPlus className="w-5 h-5 text-primary" />
                    <span>Catálogo de Cursos Disponibles para Inscripción</span>
                  </h2>
                  <p className="text-xs text-muted mt-0.5">
                    Selecciona una materia para solicitarla. Verás el acceso a Moodle cuando se autorice y sincronice la matrícula.
                  </p>
                </div>

                <div className="relative w-full sm:w-64">
                  <input
                    type="text"
                    placeholder="Filtrar por curso o programa..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full rounded-[6px] border border-border bg-surface-muted/40 px-3 py-1.5 text-xs text-foreground placeholder:text-muted focus:border-primary focus:bg-surface focus:outline-none transition-all"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      className="absolute right-2.5 top-2 text-xs text-muted hover:text-foreground"
                    >
                      <IconClose className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>
            </div>

            {availableOfferings.length === 0 ? (
              <div className="rounded-[10px] border border-dashed border-border bg-surface p-10 text-center">
                <IconCheck className="w-8 h-8 text-success mx-auto mb-2 opacity-80" />
                <p className="text-xs font-semibold text-foreground">
                  {searchQuery
                    ? 'No se encontraron materias que coincidan con la búsqueda.'
                    : 'No hay más materias disponibles en el catálogo.'}
                </p>
                <p className="text-[11px] text-muted mt-1 max-w-sm mx-auto">
                  Pronto se abrirán nuevas convocatorias y módulos para tu periodo académico.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {availableOfferings.map((off, index) => {
                  const offeringId = off.course_mapping_id || off.id || `offering-${index}`;
                  const isSubmitting = actionLoading === `enroll-${offeringId}`;
                  const isPending = enrollments.some((request) =>
                    request.course_mapping_id === offeringId && request.status === 'pendiente');

                  return (
                    <div
                      key={offeringId}
                      className="flex flex-col justify-between rounded-[10px] border border-border bg-surface p-5 shadow-minimal hover:border-primary/40 transition-all"
                    >
                      <div>
                        <div className="flex items-center justify-between">
                          <span className="rounded-[4px] bg-surface-muted px-2 py-0.5 font-mono text-[11px] font-semibold text-foreground border border-border">
                            {off.code}
                          </span>
                          {off.credits != null && (
                            <span className="rounded-[4px] bg-primary/10 px-2 py-0.5 text-[11px] font-mono text-primary border border-primary/20">
                              {off.credits} créditos SATCA
                            </span>
                          )}
                        </div>

                        <h3 className="mt-3 text-base font-semibold text-foreground">
                          {off.name}
                        </h3>

                        <p className="mt-1 text-xs text-muted leading-relaxed">
                          Programa: <strong className="text-foreground">{off.program_name}</strong>
                          {off.hours_theory || off.hours_practice
                            ? ` • ${off.hours_theory || 0}h teoría / ${off.hours_practice || 0}h práctica`
                            : ''}
                        </p>
                        <p className="mt-2 text-xs text-muted font-mono">
                          Moodle Course ID #{off.moodle_course_id}
                        </p>
                      </div>

                      <div className="mt-5 border-t border-border pt-3.5">
                        <button
                          type="button"
                          onClick={() => handleQuickEnroll(offeringId, off.name)}
                          disabled={isSubmitting || isPending}
                          className="w-full rounded-[6px] bg-primary-action px-4 py-2 text-xs font-semibold text-white shadow-minimal hover:bg-primary-action/90 transition-all disabled:opacity-50 active:scale-[0.98] flex items-center justify-center gap-1.5"
                        >
                          {isPending ? (
                            <span>Solicitud pendiente de autorización</span>
                          ) : isSubmitting ? (
                            <>
                              <span className="h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" />
                              <span>Registrando solicitud...</span>
                            </>
                          ) : (
                            <>
                              <IconPlus className="w-3.5 h-3.5 text-accent-sky" />
                              <span>Solicitar inscripción</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ========================================================================= */}
        {/* PESTAÑA 3: KÁRDEX Y AVANCE CURRICULAR                                      */}
        {/* ========================================================================= */}
        {activeTab === 'calificaciones' && (
          <div className="space-y-4">
            <div className="rounded-[10px] border border-border bg-surface p-5 shadow-minimal">
              <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
                <IconGrades className="w-5 h-5 text-primary" />
                <span>Kárdex Académico y Calificaciones</span>
              </h2>
              <p className="text-xs text-muted mt-0.5">
                Historial de asignaturas cursadas, créditos acumulados y actas de evaluación consolidadas.
              </p>
            </div>

            {/* Tarjetas Bento de Resumen Académico */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="rounded-[10px] border border-border bg-surface p-4 shadow-minimal">
                <span className="text-[11px] font-medium text-muted block">Materias Inscritas</span>
                <span className="text-lg font-bold font-mono text-foreground mt-1 block">
                  {kardexSummary.totalCourses}
                </span>
                <span className="text-[10px] text-muted">En plan vigente</span>
              </div>
              <div className="rounded-[10px] border border-border bg-surface p-4 shadow-minimal">
                <span className="text-[11px] font-medium text-muted block">Acreditadas</span>
                <span className="text-lg font-bold font-mono text-success mt-1 block">
                  {kardexSummary.accreditedCount}
                </span>
                <span className="text-[10px] text-muted">Evaluaciones aprobadas</span>
              </div>
              <div className="rounded-[10px] border border-border bg-surface p-4 shadow-minimal">
                <span className="text-[11px] font-medium text-muted block">Promedio Parcial</span>
                <span className="text-lg font-bold font-mono text-primary mt-1 block">
                  {kardexSummary.average ? `${kardexSummary.average} / 10` : 'En curso'}
                </span>
                <span className="text-[10px] text-muted">Escala oficial 0 a 10</span>
              </div>
              <div className="rounded-[10px] border border-border bg-surface p-4 shadow-minimal">
                <span className="text-[11px] font-medium text-muted block">Créditos Cursados</span>
                <span className="text-lg font-bold font-mono text-foreground mt-1 block">
                  {kardexSummary.totalCredits}
                </span>
                <span className="text-[10px] text-muted">Sistema SATCA</span>
              </div>
            </div>

            <div className="rounded-[10px] border border-border bg-surface overflow-hidden shadow-minimal">
              {courses.length === 0 ? (
                <div className="p-8 text-center text-xs text-muted">
                  Aún no tienes historial de asignaturas cursadas para generar tu kárdex.
                </div>
              ) : (
                <table className="w-full text-left text-xs">
                  <thead className="bg-surface-muted/60 text-muted font-medium border-b border-border">
                    <tr>
                      <th className="px-5 py-3.5">Asignatura</th>
                      <th className="px-5 py-3.5">Créditos</th>
                      <th className="px-5 py-3.5">Calificación</th>
                      <th className="px-5 py-3.5">Estado</th>
                      <th className="px-5 py-3.5 text-right">Constancia</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {courses.map((course, index) => {
                      const courseKey = course.course_mapping_id || `kardex-${index}`;
                      const offering = offerings.find(
                        (o) => o.course_mapping_id === course.course_mapping_id || o.id === course.course_mapping_id,
                      );
                      const credits = offering?.credits;
                      const hasGrade = course.cached_final_grade != null;
                      const grade = hasGrade ? Number(course.cached_final_grade) : null;
                      const isPassing = grade != null ? grade >= 6 : null;

                      return (
                        <tr key={courseKey} className="hover:bg-surface-muted/30 transition-colors">
                          <td className="px-5 py-3.5">
                            <span className="font-semibold text-foreground block">
                              {course.course_name}
                            </span>
                            <span className="font-mono text-[11px] text-muted">
                              {course.course_code || course.portal_course_code}
                            </span>
                          </td>
                          <td className="px-5 py-3.5 font-mono text-xs">
                            {credits != null ? `${credits} SATCA` : 'Sin dato'}
                          </td>
                          <td className="px-5 py-3.5 font-mono text-xs">
                            {hasGrade ? (
                              <span className="font-bold text-foreground bg-surface-muted px-2 py-0.5 rounded-[4px] border border-border">
                                {grade} / 10
                              </span>
                            ) : (
                              <span className="text-muted">Evaluando en Moodle</span>
                            )}
                          </td>
                          <td className="px-5 py-3.5">
                            {isPassing === true ? (
                              <span className="rounded-[4px] bg-success/10 px-2 py-0.5 text-[10px] font-mono text-success font-semibold border border-success/20">
                                Acreditada
                              </span>
                            ) : isPassing === false ? (
                              <span className="rounded-[4px] bg-danger/10 px-2 py-0.5 text-[10px] font-mono text-danger font-semibold border border-danger/20">
                                No Acreditada
                              </span>
                            ) : (
                              <span className="rounded-[4px] bg-primary/10 px-2 py-0.5 text-[10px] font-mono text-primary font-semibold border border-primary/20">
                                En Curso
                              </span>
                            )}
                          </td>
                          <td className="px-5 py-3.5 text-right font-mono text-[11px]">
                            <button
                              type="button"
                              onClick={() => handleLaunchCourseSSO(course.course_mapping_id)}
                              disabled={actionLoading === `launch-${course.course_mapping_id}`}
                              className="text-primary hover:underline font-medium inline-flex items-center gap-1 disabled:opacity-50"
                            >
                              {actionLoading === `launch-${course.course_mapping_id}` ? (
                                <span>Abriendo...</span>
                              ) : (
                                <span>Ver Aula ↗</span>
                              )}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* PESTAÑA 4: EXPEDIENTE ESCOLAR Y PERFIL DEL ESTUDIANTE                      */}
        {/* ========================================================================= */}
        {activeTab === 'perfil' && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-[10px] border border-border bg-surface p-5 shadow-minimal">
              <div>
                <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
                  <IconSettings className="w-5 h-5 text-primary" />
                  <span>Expediente Escolar del Alumno</span>
                </h2>
                <p className="text-xs text-muted mt-0.5">
                  Datos de registro oficial ante la Dirección de Servicios Escolares de INICIA.
                </p>
              </div>
              <button
                type="button"
                onClick={handleOpenEditProfile}
                className="inline-flex items-center gap-1.5 self-start sm:self-auto rounded-[6px] border border-border bg-surface-muted/50 hover:bg-surface-muted px-3 py-1.5 text-xs font-semibold text-foreground transition-all"
              >
                <IconSettings className="w-3.5 h-3.5 text-primary" />
                <span>Editar Información</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="rounded-[10px] border border-border bg-surface p-5 space-y-3 shadow-minimal">
                <span className="text-[11px] font-mono uppercase tracking-wider text-muted">
                  Datos de Matrícula y Contacto
                </span>
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between py-1 border-b border-border/50">
                    <span className="text-muted">Nombre Completo</span>
                    <span className="font-semibold text-foreground">
                      {user?.first_name} {user?.last_name}
                    </span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-border/50">
                    <span className="text-muted">Correo Institucional</span>
                    <span className="font-mono text-foreground">{user?.email}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-border/50">
                    <span className="text-muted">Teléfono de Contacto</span>
                    <span className="font-mono text-foreground">{user?.phone || 'No registrado'}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-border/50">
                    <span className="text-muted">Matrícula Escolar</span>
                    <span className="font-mono font-bold text-primary">
                      {user?.id ? `AL-${user.id.slice(0, 8).toUpperCase()}` : 'AL-2026-REG'}
                    </span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-muted">Estatus Académico</span>
                    <span className="capitalize text-success font-medium">
                      {user?.status || 'activo'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="rounded-[10px] border border-border bg-surface p-5 space-y-3 shadow-minimal">
                <span className="text-[11px] font-mono uppercase tracking-wider text-muted">
                  Vinculación con Moodle LMS
                </span>
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between py-1 border-b border-border/50">
                    <span className="text-muted">Usuario en Moodle</span>
                    <span className="font-mono text-foreground">
                      {user?.moodle_username || user?.email?.split('@')[0] || 'estudiante'}
                    </span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-border/50">
                    <span className="text-muted">Moodle ID</span>
                    <span className="font-mono text-foreground">
                      {user?.moodle_user_id ? `#${user.moodle_user_id}` : 'Enlazado por correo'}
                    </span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-border/50">
                    <span className="text-muted">Estado de Sincronización</span>
                    <MoodleSyncBadge
                      status={user?.moodle_sync_status}
                      moodleId={user?.moodle_user_id}
                    />
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-muted">Acceso SSO Transparente</span>
                    <span className="font-mono text-success font-medium">
                      Activo (auth_userkey)
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* MODAL: CONFIRMACIÓN PARA DAR DE BAJA MATERIA (DESASIGNAR) */}
        {dropTarget && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="w-full max-w-md rounded-[14px] border border-border bg-surface p-6 shadow-xl space-y-4 animate-in fade-in zoom-in-95">
              <div className="flex items-center gap-3 text-danger">
                <div className="grid h-10 w-10 place-items-center rounded-full bg-danger/10 border border-danger/20">
                  <IconAlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-foreground">
                    Dar de baja materia
                  </h3>
                  <p className="text-xs text-muted">Confirmación de desasignación académica</p>
                </div>
              </div>

              <div className="rounded-[8px] bg-surface-muted/50 border border-border p-3.5 text-xs text-muted space-y-1">
                <p>
                  ¿Estás seguro de que deseas dar de baja la materia{' '}
                  <strong className="text-foreground">{dropTarget.courseName}</strong>?
                </p>
                <p className="text-[11px] text-danger/90 pt-1">
                  Se revocará tu matrícula y acceso al aula virtual en Moodle LMS. Podrás volver a inscribirla en el catálogo si decides retomarla más adelante.
                </p>
              </div>

              <div className="flex justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setDropTarget(null)}
                  disabled={actionLoading === `drop-${dropTarget.enrollmentId}`}
                  className="rounded-[6px] border border-border bg-surface px-4 py-2 text-xs font-semibold text-foreground hover:bg-surface-muted transition-all"
                >
                  Conservar Materia
                </button>
                <button
                  type="button"
                  onClick={handleConfirmDropCourse}
                  disabled={actionLoading === `drop-${dropTarget.enrollmentId}`}
                  className="rounded-[6px] bg-danger px-4 py-2 text-xs font-semibold text-white shadow-minimal hover:bg-danger/90 transition-all disabled:opacity-50"
                >
                  {actionLoading === `drop-${dropTarget.enrollmentId}`
                    ? 'Procesando baja...'
                    : 'Sí, dar de baja'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* MODAL: TEMARIO Y DETALLES DEL CURSO */}
        {syllabusTarget && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="w-full max-w-lg rounded-[14px] border border-border bg-surface p-6 shadow-xl space-y-4 animate-in fade-in zoom-in-95">
              <div className="flex items-center justify-between border-b border-border pb-3">
                <div className="flex items-center gap-2">
                  <IconBookOpen className="w-5 h-5 text-primary" />
                  <h3 className="text-base font-bold text-foreground">
                    Temario y Ficha Técnica
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setSyllabusTarget(null)}
                  className="text-muted hover:text-foreground"
                >
                  <IconClose className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-3 text-xs">
                <div>
                  <span className="font-mono text-primary font-bold text-[11px]">
                    {syllabusTarget.course_code || syllabusTarget.portal_course_code}
                  </span>
                  <h4 className="text-sm font-bold text-foreground mt-0.5">
                    {syllabusTarget.course_name}
                  </h4>
                  <p className="text-muted mt-1 leading-relaxed">
                    {syllabusTarget.course_description ||
                      'Asignatura oficial con créditos universitarios, evaluaciones prácticas y proyectos aplicados en el entorno Moodle LMS.'}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-2 rounded-[8px] bg-surface-muted/40 p-3 border border-border">
                  <div>
                    <span className="text-muted block text-[11px]">Créditos SATCA:</span>
                    <strong className="text-foreground">8 Créditos</strong>
                  </div>
                  <div>
                    <span className="text-muted block text-[11px]">Modalidad:</span>
                    <strong className="text-foreground">En línea 100%</strong>
                  </div>
                  <div>
                    <span className="text-muted block text-[11px]">Plataforma:</span>
                    <strong className="text-foreground font-mono">Moodle ID #{syllabusTarget.moodle_course_id}</strong>
                  </div>
                  <div>
                    <span className="text-muted block text-[11px]">Evaluación:</span>
                    <strong className="text-foreground">Sumativa / Práctica</strong>
                  </div>
                </div>

                <div className="space-y-1.5 pt-1">
                  <span className="font-semibold text-foreground text-xs flex items-center justify-between">
                    <span>Estructura y Contenidos de Moodle LMS:</span>
                    {loadingContents && (
                      <span className="text-[10px] text-muted flex items-center gap-1 font-normal">
                        <IconRefresh className="w-3 h-3 animate-spin text-primary" />
                        Cargando secciones...
                      </span>
                    )}
                  </span>
                  {moodleContents.length > 0 ? (
                    <div className="max-h-48 overflow-y-auto space-y-2 pr-1 divide-y divide-border/40">
                      {moodleContents.map((sec, idx) => (
                        <div key={idx} className="pt-1.5 first:pt-0">
                          <p className="font-semibold text-foreground text-[11px]">{sec.name || `Tema ${idx}`}</p>
                          {sec.modules && sec.modules.length > 0 ? (
                            <ul className="mt-1 space-y-0.5 pl-3 border-l border-border/60">
                              {sec.modules.map((m: any, mIdx: number) => (
                                <li key={mIdx} className="text-[11px] text-muted flex items-center gap-1.5">
                                  <span className="h-1 w-1 rounded-full bg-primary-action shrink-0" />
                                  <span className="truncate">{m.name}</span>
                                  {m.modplural && <span className="text-[9px] font-mono text-muted/70">({m.modplural})</span>}
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <p className="text-[10px] text-muted italic pl-3">Sin actividades en esta sección</p>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <ul className="list-disc pl-4 text-muted space-y-1 text-xs">
                      <li>Módulo 1: Fundamentos teóricos y principios aplicados</li>
                      <li>Módulo 2: Arquitectura metodológica y desarrollo práctico</li>
                      <li>Módulo 3: Casos de estudio y evaluación integradora en campus virtual</li>
                    </ul>
                  )}
                </div>
              </div>

              <div className="flex justify-end gap-2.5 pt-3 border-t border-border">
                <button
                  type="button"
                  onClick={() => setSyllabusTarget(null)}
                  className="rounded-[6px] border border-border bg-surface px-4 py-2 text-xs font-semibold text-foreground hover:bg-surface-muted transition-all"
                >
                  Cerrar
                </button>
                <LaunchCourseButton
                  courseMappingId={syllabusTarget.course_mapping_id}
                  courseName={syllabusTarget.course_name}
                  isAuthorized={true}
                />
              </div>
            </div>
          </div>
        )}

        {/* MODAL: EDITAR INFORMACIÓN DE PERFIL */}
        {editProfileOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="w-full max-w-md rounded-[14px] border border-border bg-surface p-6 shadow-xl space-y-4 animate-in fade-in zoom-in-95">
              <div className="flex items-center justify-between border-b border-border pb-3">
                <div className="flex items-center gap-2">
                  <IconSettings className="w-5 h-5 text-primary" />
                  <h3 className="text-base font-bold text-foreground">
                    Editar Datos del Expediente
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setEditProfileOpen(false)}
                  className="text-muted hover:text-foreground"
                >
                  <IconClose className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleSaveProfile} className="space-y-3 text-xs">
                <div>
                  <label className="block text-muted font-medium mb-1">Nombre</label>
                  <input
                    type="text"
                    required
                    value={profileForm.first_name}
                    onChange={(e) => setProfileForm({ ...profileForm, first_name: e.target.value })}
                    className="w-full rounded-[6px] border border-border bg-surface-muted/40 px-3 py-2 text-foreground focus:border-primary focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-muted font-medium mb-1">Apellidos</label>
                  <input
                    type="text"
                    required
                    value={profileForm.last_name}
                    onChange={(e) => setProfileForm({ ...profileForm, last_name: e.target.value })}
                    className="w-full rounded-[6px] border border-border bg-surface-muted/40 px-3 py-2 text-foreground focus:border-primary focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-muted font-medium mb-1">Teléfono</label>
                  <input
                    type="tel"
                    placeholder="Ej. +52 55 1234 5678"
                    value={profileForm.phone}
                    onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value })}
                    className="w-full rounded-[6px] border border-border bg-surface-muted/40 px-3 py-2 text-foreground focus:border-primary focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-muted font-medium mb-1">Biografía o notas de expediente</label>
                  <textarea
                    rows={3}
                    placeholder="Semblanza académica o intereses curriculares..."
                    value={profileForm.bio}
                    onChange={(e) => setProfileForm({ ...profileForm, bio: e.target.value })}
                    className="w-full rounded-[6px] border border-border bg-surface-muted/40 px-3 py-2 text-foreground focus:border-primary focus:outline-none"
                  />
                </div>

                <div className="flex justify-end gap-2.5 pt-3 border-t border-border">
                  <button
                    type="button"
                    onClick={() => setEditProfileOpen(false)}
                    disabled={actionLoading === 'save-profile'}
                    className="rounded-[6px] border border-border bg-surface px-4 py-2 text-xs font-semibold text-foreground hover:bg-surface-muted transition-all"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={actionLoading === 'save-profile'}
                    className="inline-flex items-center gap-1.5 rounded-[6px] bg-primary-action px-4 py-2 text-xs font-semibold text-white hover:bg-primary-action/90 transition-all disabled:opacity-50"
                  >
                    {actionLoading === 'save-profile' ? (
                      <span>Guardando...</span>
                    ) : (
                      <>
                        <IconCheck className="w-3.5 h-3.5" />
                        <span>Guardar Cambios</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </CampusShell>
  );
}

```

### apps/web/src/app/dashboard/page.tsx

<!-- archivo: apps/web/src/app/dashboard/page.tsx -->
```tsx
// IINICIA Portal · portal Next.js · page.tsx
/** Presenta los accesos disponibles para la sesión y redirige cuando corresponde a un panel específico. */
'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import {
  IconStudents,
  IconTeachers,
  IconShield,
  IconCourses,
  IconArrowRight,
} from '@/components/campus-tech/Icons';

/** Resuelve el destino del usuario después de cargar la sesión. Cuando corresponde, presenta las opciones del espacio personal. */
export default function MiIiniciaDashboardHub() {
  const router = useRouter();
  // El concentrador espera la resolución de la sesión antes de decidir qué panel corresponde al usuario.
  const { user, loading, getDefaultDashboardPath } = useAuth();

  useEffect(() => {
    if (!loading) {
      if (!user) {
        router.replace('/login');
      } else {
        const targetPath = getDefaultDashboardPath();
        router.replace(targetPath);
      }
    }
  }, [user, loading, router, getDefaultDashboardPath]);

  return (
    <div className="flex min-h-[calc(100vh-140px)] items-center justify-center px-4 py-12">
      <div className="w-full max-w-lg space-y-6 rounded-[14px] border border-border bg-surface p-8 text-center shadow-minimal">
        <div className="mx-auto grid h-12 w-12 place-items-center rounded-[8px] bg-primary-action text-white shadow-minimal">
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M12 2l8 4.5v9L12 20l-8-4.5v-9L12 2z" />
            <path d="M12 2v9l8 4.5M12 11l-8 4.5" />
          </svg>
        </div>

        <div>
          <div className="inline-flex items-center gap-1.5 rounded-[4px] bg-primary/10 px-2.5 py-1 text-[11px] font-mono font-semibold text-primary border border-primary/20">
            <span className="h-1.5 w-1.5 rounded-full bg-accent-sky" />
            <span>Mi INICIA • Portal Institucional</span>
          </div>
          <h1 className="mt-3 text-2xl font-bold tracking-tight text-foreground">
            Redirigiendo a tu espacio de trabajo
          </h1>
          <p className="mt-1 text-xs text-muted">
            {loading
              ? 'Verificando sesión activa y perfil académico...'
              : user
              ? `Bienvenido, ${user.first_name || user.email}. Ingresando a tu panel...`
              : 'Sesión no detectada. Redirigiendo a inicio de sesión...'}
          </p>
        </div>

        <div className="flex justify-center py-2">
          <span className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>

        {/* Fallback en caso de demora */}
        <div className="border-t border-border pt-4 text-left">
          <p className="text-[11px] font-mono uppercase tracking-wider text-muted mb-2 text-center">
            Accesos directos por rol:
          </p>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <Link
              href="/dashboard/admin"
              className="rounded-[6px] border border-border bg-surface-muted/40 p-2.5 hover:border-primary/40 transition-all flex items-center justify-between"
            >
              <div className="flex items-center gap-2">
                <IconShield className="w-3.5 h-3.5 text-primary" />
                <span className="font-medium text-foreground">Administración</span>
              </div>
              <IconArrowRight className="w-3 h-3 text-muted" />
            </Link>

            <Link
              href="/dashboard/docente"
              className="rounded-[6px] border border-border bg-surface-muted/40 p-2.5 hover:border-primary/40 transition-all flex items-center justify-between"
            >
              <div className="flex items-center gap-2">
                <IconTeachers className="w-3.5 h-3.5 text-primary" />
                <span className="font-medium text-foreground">Docentes</span>
              </div>
              <IconArrowRight className="w-3 h-3 text-muted" />
            </Link>

            <Link
              href="/dashboard/estudiante"
              className="rounded-[6px] border border-border bg-surface-muted/40 p-2.5 hover:border-primary/40 transition-all flex items-center justify-between"
            >
              <div className="flex items-center gap-2">
                <IconStudents className="w-3.5 h-3.5 text-primary" />
                <span className="font-medium text-foreground">Estudiantes</span>
              </div>
              <IconArrowRight className="w-3 h-3 text-muted" />
            </Link>

            <Link
              href="/dashboard/aspirante"
              className="rounded-[6px] border border-border bg-surface-muted/40 p-2.5 hover:border-primary/40 transition-all flex items-center justify-between"
            >
              <div className="flex items-center gap-2">
                <IconCourses className="w-3.5 h-3.5 text-primary" />
                <span className="font-medium text-foreground">Aspirantes</span>
              </div>
              <IconArrowRight className="w-3 h-3 text-muted" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

```

### apps/web/src/app/dashboard/soporte/page.tsx

<!-- archivo: apps/web/src/app/dashboard/soporte/page.tsx -->
```tsx
// IINICIA Portal · soporte · page.tsx
/** Carga el espacio de trabajo de soporte con las opciones permitidas para ese rol. */
import { RoleWorkspace } from '@/components/RoleWorkspace';

/** Selecciona las herramientas de soporte en el panel compartido en función de los permisos disponibles. */
export default function SoporteDashboardPage() {
  return <RoleWorkspace role="soporte" />;
}

```

### apps/web/src/app/diplomados/page.tsx

<!-- archivo: apps/web/src/app/diplomados/page.tsx -->
```tsx
// IINICIA Portal · portal Next.js · page.tsx
/** Conserva el acceso desde enlaces anteriores y dirige a la oferta principal. */
import { redirect } from 'next/navigation';

/** Mantiene accesible la ruta de diplomados y la dirige a su bloque de la página pública. */
export default function DiplomadosPage() {
  redirect('/#cursos');
}

```

### apps/web/src/app/globals.css

<!-- archivo: apps/web/src/app/globals.css -->
```css
/* IINICIA Portal · portal Next.js · globals.css */
/** Define las variables de color y las utilidades de movimiento y presentación compartidas por el portal. */
@import "tailwindcss";
@custom-variant dark (&:where(.dark, .dark *));

/* Paleta institucional para la portada, la autenticación y el campus. */
:root {
  --brand-navy: #102a42;
  --brand-blue: #125a99;
  --brand-blue-hover: #0b467b;
  --brand-sky: #b8e8fb;
  --brand-wash: #e6f4fa;

  --primary: var(--brand-blue);
  --primary-action: var(--brand-blue);
  --accent-sky: var(--brand-sky);
  --accent: var(--primary);
  --accent-strong: var(--brand-blue-hover);
  --accent-soft: var(--brand-wash);
  --welcome-panel: var(--brand-navy);

  --background: #f7fbfe;
  --surface: #ffffff;
  --surface-muted: #eef5fb;
  --surface-elevated: #ffffff;
  --foreground: #142838;
  --text-secondary: #415b6d;
  --muted: var(--text-secondary);
  --border: #cedeea;
  --border-subtle: #e0ebf3;

  /* Semantics Light */
  --success: #18794E;
  --success-bg: rgba(24, 121, 78, 0.08);
  --warning: #996000;
  --warning-bg: rgba(153, 96, 0, 0.08);
  --danger: #C43F48;
  --danger-bg: rgba(196, 63, 72, 0.08);

  /* System Radii */
  --radius-sm: 6px;
  --radius-md: 10px;
  --radius-lg: 14px;
  --radius-xl: 18px;

  /* Elevation */
  --shadow-minimal: 0 1px 2px 0 rgba(0, 0, 0, 0.04);
  --shadow-panel: 0 4px 12px -2px rgba(0, 0, 0, 0.05), 0 2px 4px -2px rgba(0, 0, 0, 0.03);
  --shadow-soft: 0 8px 24px -4px rgba(16, 42, 66, 0.10);
}

.dark {
  /* Dark Theme */
  --brand-wash: #142e42;
  --primary: #8ed8f5;

  --background: #0b1724;
  --surface: #142536;
  --surface-muted: #102030;
  --surface-elevated: #142536;
  --foreground: #ecf6fc;
  --text-secondary: #b1c7d7;
  --border: #304a60;
  --border-subtle: #263e53;

  /* Semantics Dark */
  --success: #63D9A0;
  --success-bg: rgba(99, 217, 160, 0.12);
  --warning: #F5C56B;
  --warning-bg: rgba(245, 197, 107, 0.12);
  --danger: #FF858B;
  --danger-bg: rgba(255, 133, 139, 0.12);

  --shadow-minimal: 0 1px 2px 0 rgba(0, 0, 0, 0.3);
  --shadow-panel: 0 4px 12px -2px rgba(0, 0, 0, 0.35), 0 2px 4px -2px rgba(0, 0, 0, 0.2);
  --shadow-soft: 0 8px 24px -4px rgba(0, 0, 0, 0.45);
}

/* Aplica la preferencia del sistema cuando el documento todavía no tiene un tema elegido. */
/* La preferencia del sistema se usa como base para el tema cuando no hay una selección explícita. */
@media (prefers-color-scheme: dark) {
  :root:not(.light) {
    --brand-wash: #142e42;
    --primary: #8ed8f5;

    --background: #0b1724;
    --surface: #142536;
    --surface-muted: #102030;
    --surface-elevated: #142536;
    --foreground: #ecf6fc;
    --text-secondary: #b1c7d7;
    --border: #304a60;
    --border-subtle: #263e53;

    --success: #63D9A0;
    --success-bg: rgba(99, 217, 160, 0.12);
    --warning: #F5C56B;
    --warning-bg: rgba(245, 197, 107, 0.12);
    --danger: #FF858B;
    --danger-bg: rgba(255, 133, 139, 0.12);

    --shadow-minimal: 0 1px 2px 0 rgba(0, 0, 0, 0.3);
    --shadow-panel: 0 4px 12px -2px rgba(0, 0, 0, 0.35), 0 2px 4px -2px rgba(0, 0, 0, 0.2);
    --shadow-soft: 0 8px 24px -4px rgba(0, 0, 0, 0.45);
  }
}

/* Publica las variables del portal como tokens que consumen las clases de Tailwind. */
@theme inline {
  --color-primary: var(--primary);
  --color-primary-action: var(--primary-action);
  --color-accent-sky: var(--accent-sky);
  --color-accent: var(--accent);
  --color-accent-strong: var(--accent-strong);
  --color-accent-soft: var(--accent-soft);
  --color-welcome-panel: var(--welcome-panel);

  --color-background: var(--background);
  --color-surface: var(--surface);
  --color-surface-muted: var(--surface-muted);
  --color-surface-elevated: var(--surface-elevated);
  --color-foreground: var(--foreground);
  --color-text-secondary: var(--text-secondary);
  --color-muted: var(--muted);
  --color-border: var(--border);
  --color-border-subtle: var(--border-subtle);

  --color-success: var(--success);
  --color-warning: var(--warning);
  --color-danger: var(--danger);

  --font-sans: "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  --font-mono: ui-monospace, "SF Mono", "Cascadia Code", Menlo, monospace;
}

* {
  border-color: var(--border);
}

html {
  -webkit-font-smoothing: antialiased;
  text-rendering: optimizeLegibility;
}

html {
  scroll-behavior: smooth;
  scroll-padding-top: 4rem;
}

body {
  background: var(--background);
  color: var(--foreground);
  font-family: var(--font-sans);
  letter-spacing: -0.01em;
}

.campus-backdrop {
  background: linear-gradient(180deg, var(--brand-wash), var(--background) 27rem);
}

.campus-heading {
  border: 1px solid var(--border);
  border-radius: 1.25rem;
  border-start-start-radius: 0.5rem;
  border-block-start: 3px solid var(--primary);
  background: linear-gradient(115deg, var(--brand-wash), var(--surface) 70%);
  padding: clamp(1rem, 3vw, 2rem);
  box-shadow: var(--shadow-panel);
}

.campus-heading h1 {
  font-size: clamp(1.5rem, 3vw, 2.5rem);
  letter-spacing: -0.035em;
  line-height: 1.12;
  overflow-wrap: anywhere;
}

/* Frosted glass surface (Apple-style translucency) */
.glass {
  background: var(--surface-elevated);
  backdrop-filter: saturate(180%) blur(20px);
  -webkit-backdrop-filter: saturate(180%) blur(20px);
}

/* Very soft diffuse shadow */
.shadow-apple {
  box-shadow: var(--shadow-soft);
}

/* Subtle luminous gradient used in hero */
.bg-aurora {
  background:
    radial-gradient(60% 55% at 50% 0%, color-mix(in srgb, var(--primary-action) 16%, transparent) 0%, transparent 70%),
    radial-gradient(50% 40% at 85% 20%, color-mix(in srgb, var(--accent-sky) 20%, transparent) 0%, transparent 70%),
    radial-gradient(50% 40% at 15% 30%, color-mix(in srgb, var(--accent-strong) 12%, transparent) 0%, transparent 70%);
}

/* Apple-like dot texture */
.bg-dot-grid {
  background-image: radial-gradient(var(--border) 1px, transparent 1px);
  background-size: 22px 22px;
  mask-image: radial-gradient(ellipse at center, #000 20%, transparent 75%);
  -webkit-mask-image: radial-gradient(ellipse at center, #000 20%, transparent 75%);
}

/* Text balance utilities */
.text-balance {
  text-wrap: balance;
}
.text-pretty {
  text-wrap: pretty;
}

/* Expandable double underline on hover (menu / footer links) */
.hover-underline {
  position: relative;
  display: inline-block;
}

.hover-underline::after,
.hover-underline::before {
  content: "";
  position: absolute;
  width: 100%;
  height: 1.5px;
  background: linear-gradient(
    to right,
    var(--accent) 0%,
    var(--accent-strong) 60%,
    color-mix(in srgb, var(--accent) 50%, transparent) 100%
  );
  bottom: -4px;
  left: 0;
  border-radius: 9999px;
  transform: scaleX(0);
  transform-origin: right;
  transition: transform 0.4s cubic-bezier(0.22, 1, 0.36, 1);
}

.hover-underline::before {
  top: -4px;
  transform-origin: left;
}

.hover-underline:hover::after,
.hover-underline:hover::before,
.hover-underline:focus-visible::after,
.hover-underline:focus-visible::before {
  transform: scaleX(1);
}

/* ---------------------------------------------------------------
   Skewed "glass panel" program cards
   --------------------------------------------------------------- */
.program-card {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  height: 320px;
  margin: 16px 20px;
  transition: transform 0.5s cubic-bezier(0.22, 1, 0.36, 1);
}

.program-card::before {
  content: "";
  position: absolute;
  top: 0;
  left: 50px;
  width: 50%;
  height: 100%;
  border-radius: 12px;
  transform: skewX(15deg);
  transition: transform 0.5s cubic-bezier(0.22, 1, 0.36, 1),
    left 0.5s cubic-bezier(0.22, 1, 0.36, 1),
    width 0.5s cubic-bezier(0.22, 1, 0.36, 1);
}

.program-card::after {
  content: "";
  position: absolute;
  top: 0;
  left: 50px;
  width: 50%;
  height: 100%;
  border-radius: 12px;
  transform: skewX(15deg);
  filter: blur(30px);
  transition: transform 0.5s cubic-bezier(0.22, 1, 0.36, 1),
    left 0.5s cubic-bezier(0.22, 1, 0.36, 1),
    width 0.5s cubic-bezier(0.22, 1, 0.36, 1);
  opacity: 0.55;
}

.program-card--blue::before,
.program-card--blue::after {
  background: linear-gradient(315deg, #0a84ff, #5ac8fa);
}
.program-card--violet::before,
.program-card--violet::after {
  background: linear-gradient(315deg, #bf5af2, #0a84ff);
}
.program-card--cyan::before,
.program-card--cyan::after {
  background: linear-gradient(315deg, #64d2ff, #0a84ff);
}

.program-card:hover::before,
.program-card:hover::after,
.program-card:focus-within::before,
.program-card:focus-within::after {
  transform: skewX(0deg);
  left: 20px;
  width: calc(100% - 90px);
}

.program-card .card-glow {
  display: block;
  position: absolute;
  inset: 0;
  z-index: 5;
  pointer-events: none;
}

.program-card .card-glow::before {
  content: "";
  position: absolute;
  top: 0;
  left: 0;
  width: 60px;
  height: 60px;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.18);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  opacity: 0;
  transition: top 0.4s ease, left 0.4s ease, opacity 0.4s ease;
  box-shadow: 0 5px 15px rgba(0, 0, 0, 0.08);
  animation: program-glow 2s ease-in-out infinite;
}

.program-card .card-glow::after {
  content: "";
  position: absolute;
  bottom: 0;
  right: 0;
  width: 60px;
  height: 60px;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.18);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  opacity: 0;
  transition: bottom 0.4s ease, right 0.4s ease, opacity 0.4s ease;
  box-shadow: 0 5px 15px rgba(0, 0, 0, 0.08);
  animation: program-glow 2s ease-in-out infinite;
  animation-delay: -1s;
}

.program-card:hover .card-glow::before,
.program-card:focus-within .card-glow::before {
  top: -24px;
  left: 24px;
  opacity: 1;
}

.program-card:hover .card-glow::after,
.program-card:focus-within .card-glow::after {
  bottom: -24px;
  right: 24px;
  opacity: 1;
}

@keyframes program-glow {
  0%,
  100% {
    transform: translateY(4px);
  }
  50% {
    transform: translateX(-4px);
  }
}

.program-card .card-content {
  position: relative;
  z-index: 1;
  padding: 24px 28px;
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.08);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  box-shadow: 0 5px 20px rgba(0, 0, 0, 0.12);
  color: #fff;
  transition: padding 0.4s ease;
}

.program-card:hover .card-content,
.program-card:focus-within .card-content {
  padding: 32px 28px;
}

@media (hover: none) {
  .program-card::before,
  .program-card::after {
    transform: skewX(0deg);
    left: 20px;
    width: calc(100% - 90px);
  }
  .program-card .card-glow::before {
    top: -24px;
    left: 24px;
    opacity: 1;
  }
  .program-card .card-glow::after {
    bottom: -24px;
    right: 24px;
    opacity: 1;
  }
}

/* ---------------------------------------------------------------
   Scroll-reveal text (Apple-style sticky reveal, PER SECTION)
   `--reveal` goes 0% -> 100% as the section enters -> leaves view.
   --------------------------------------------------------------- */
.scroll-reveal-text {
  --reveal: 100%;
  background: linear-gradient(
    -60deg,
    color-mix(in srgb, var(--foreground) 15%, transparent) 30%,
    var(--foreground) 60%
  );
  background-size: 300% 100%;
  background-position-x: calc(100% - var(--reveal));
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
  color: transparent;
  /* Ensure it looks solid if JS never runs (progressive enhancement). */
  transition: background-position-x 0.05s linear;
}

/* On no-JS, show the text fully. */
.no-js .scroll-reveal-text {
  background: none;
  -webkit-text-fill-color: var(--foreground);
  color: var(--foreground);
}

/* Respeta la preferencia de movimiento reducido en la animación del texto. */
/* El contenido conserva su acceso y reduce las transiciones cuando el usuario solicita menos movimiento. */
@media (prefers-reduced-motion: reduce) {
  .scroll-reveal-text {
    background: none;
    -webkit-text-fill-color: var(--foreground);
    color: var(--foreground);
    transition: none;
  }
}

```

### apps/web/src/app/icon.svg

<!-- archivo: apps/web/src/app/icon.svg -->
```xml
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" role="img" aria-label="INICIA">
  <rect width="64" height="64" rx="14" fill="#102a42"/>
  <rect x="26" y="22" width="12" height="30" fill="#ecf6fc"/>
  <text x="25" y="21" fill="#b8e8fb" font-family="Arial, sans-serif" font-size="18" font-weight="800">2</text>
</svg>

```

### apps/web/src/app/landing.module.css

<!-- archivo: apps/web/src/app/landing.module.css -->
```css
/* IINICIA Portal · portal Next.js · landing.module.css */
/** La página de inicio comparte tiempos de transición entre la portada, el catálogo y las secciones. Las reglas de movimiento reducido adaptan los efectos a la preferencia del navegador. */
.heroFrame,
.catalog,
.section {
  --landing-ease: cubic-bezier(0.22, 1, 0.36, 1);
}

.heroFrame,
.catalog {
  background: var(--brand-wash);
}

.hero {
  position: relative;
  isolation: isolate;
  overflow: hidden;
  border-end-end-radius: clamp(3.5rem, 10vw, 10rem);
  background: var(--brand-navy);
  color: #fff;
}

.heroImage {
  object-fit: cover;
  object-position: center 52%;
}

.heroShade {
  position: absolute;
  inset: 0;
  background: linear-gradient(90deg, rgb(8 22 34 / 96%) 0%, rgb(8 22 34 / 85%) 37%, rgb(8 22 34 / 33%) 100%);
}

.heroContent {
  position: relative;
  max-width: 72rem;
  margin-inline: auto;
  padding: clamp(3.5rem, 7vw, 7rem) clamp(1rem, 3vw, 2rem) clamp(3.5rem, 7vw, 7rem);
}

.institute {
  margin-block-end: 1.25rem;
  color: var(--brand-sky);
  font-size: 0.875rem;
  font-weight: 650;
}

.heroTitle {
  max-width: min(100%, 14ch);
  font-size: clamp(2.25rem, 6vw, 5rem);
  font-weight: 750;
  letter-spacing: -0.055em;
  line-height: 1.02;
  overflow-wrap: anywhere;
}

.heroTitle span {
  color: var(--brand-sky);
}

.heroDescription {
  max-width: 29rem;
  margin-block-start: 1.5rem;
  color: #e4eff6;
  font-size: clamp(1rem, 2vw, 1.1875rem);
  line-height: 1.6;
  text-wrap: pretty;
}

.heroActions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  margin-block-start: 1.75rem;
}

.heroPrimary,
.heroSecondary {
  display: inline-flex;
  min-height: 2.75rem;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  border: 1px solid transparent;
  border-radius: 999px;
  padding: 0.625rem 1.25rem;
  font-size: 0.875rem;
  font-weight: 650;
}

.heroPrimary {
  background: var(--brand-sky);
  color: var(--brand-navy);
}

.heroPrimary:hover {
  background: color-mix(in srgb, var(--brand-sky), white 35%);
}

.heroSecondary {
  border-color: rgb(255 255 255 / 55%);
  background: rgb(8 22 34 / 35%);
  color: #fff;
}

.heroSecondary:hover {
  background: rgb(255 255 255 / 16%);
}

.heroActions a:focus-visible {
  outline: 2px solid #fff;
  outline-offset: 4px;
}

.catalog {
  padding-block: clamp(3rem, 7vw, 6rem);
}

.catalogIntro {
  display: grid;
  align-items: center;
  gap: 1rem 2rem;
  margin-block-end: clamp(1.5rem, 4vw, 3rem);
  color: var(--foreground);
}

.catalogTitle {
  font-size: clamp(2rem, 4vw, 3.5rem);
  font-weight: 740;
  letter-spacing: -0.045em;
  line-height: 1.04;
  text-wrap: balance;
}

.courseCard {
  display: flex;
  flex-direction: column;
  min-inline-size: 0;
  overflow: hidden;
  border: 1px solid var(--border);
  border-radius: 1.125rem;
  background: var(--surface);
  box-shadow: var(--shadow-panel);
  overflow-wrap: anywhere;
}

.courseCard:focus-within {
  border-color: var(--primary);
}

.courseCover {
  position: relative;
  aspect-ratio: 2 / 1;
  flex-shrink: 0;
  overflow: hidden;
  background: var(--brand-wash);
}

.courseCoverImage {
  object-fit: cover;
}

@media (min-width: 48rem) {
  .catalogIntro {
    grid-template-columns: minmax(0, 0.9fr) minmax(0, 1fr);
  }

  .catalogIntro p {
    border-inline-start: 2px solid var(--primary);
    padding: 0.5rem 0 0.5rem 2rem;
  }
}

@media (max-width: 47.999rem) {
  .heroImage {
    object-position: 66% center;
  }

  .heroShade {
    background: linear-gradient(90deg, rgb(8 22 34 / 92%), rgb(8 22 34 / 70%));
  }
}

.section {
  padding-block: clamp(3.25rem, 7.5vw, 7rem);
  border-block-end: 1px solid var(--border);
}

.sectionTint {
  background: var(--brand-wash);
}

.sectionHeading {
  display: grid;
  gap: 0.75rem 2.5rem;
  align-items: end;
}

.sectionTitle {
  font-size: clamp(2rem, 4.1vw, 3.5rem);
  font-weight: 740;
  letter-spacing: -0.045em;
  line-height: 1.06;
  text-wrap: balance;
}

.subheading {
  color: var(--foreground);
  font-size: clamp(1.25rem, 2vw, 1.625rem);
  font-weight: 680;
  letter-spacing: -0.025em;
  line-height: 1.2;
}

.sectionDescription {
  max-width: 34rem;
  border-inline-start: 2px solid var(--primary);
  padding-inline-start: 1rem;
  color: var(--muted);
  line-height: 1.65;
  text-wrap: pretty;
}

.universityIntro {
  padding: clamp(1.5rem, 4.5vw, 3.5rem);
  border-radius: 1.25rem 1.25rem clamp(2rem, 8vw, 5rem) 1.25rem;
  background: radial-gradient(ellipse at 90% 0%, var(--brand-blue), transparent 72%), var(--brand-navy);
  color: white;
}

.detailCard {
  min-inline-size: 0;
  border: 1px solid var(--border);
  border-radius: 1.125rem;
  background: var(--surface);
  box-shadow: var(--shadow-minimal);
  overflow-wrap: anywhere;
}

.detailCard:focus-within {
  border-color: var(--primary);
  box-shadow: var(--shadow-panel);
}

.programCard {
  display: flex;
  height: 100%;
  flex-direction: column;
  gap: 0.75rem;
  padding: clamp(1.25rem, 2.25vw, 1.75rem);
}

.programTitle {
  color: var(--foreground);
  font-size: 1.25rem;
  font-weight: 680;
  line-height: 1.25;
  text-wrap: balance;
}

.emptyState {
  border-block-start: 1px solid var(--border);
  padding-block-start: 1rem;
  color: var(--muted);
}

.disclosure {
  border: 1px solid var(--border);
  border-radius: 1.125rem;
  background: var(--surface);
}

.disclosureSummary {
  display: flex;
  min-block-size: 3.25rem;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  border-radius: inherit;
  padding: 0.75rem 1.25rem;
  cursor: pointer;
  font-weight: 650;
}

.disclosureSummary::-webkit-details-marker {
  display: none;
}

.disclosureSummary span {
  color: var(--primary);
  font-size: 1.25rem;
  line-height: 1;
}

.disclosure[open] .disclosureSummary span {
  transform: rotate(180deg);
}

.stepCard {
  min-inline-size: 0;
  border-block-start: 1px solid var(--border);
  padding: 1rem 1rem 0.5rem 0;
}

.stepNumber {
  display: grid;
  inline-size: 2.5rem;
  block-size: 2.5rem;
  place-items: center;
  border-radius: 50%;
  background: var(--accent-soft);
  color: var(--primary);
  font-weight: 700;
}

.programLink {
  display: inline-flex;
  min-block-size: 2.75rem;
  align-items: center;
  gap: 0.5rem;
  color: var(--primary);
  font-weight: 650;
  text-decoration: underline;
  text-underline-offset: 0.2em;
}

.primaryAction {
  display: inline-flex;
  min-block-size: 2.75rem;
  max-inline-size: 100%;
  align-items: center;
  justify-content: center;
  border-radius: 999px;
  background: var(--primary-action);
  padding: 0.625rem 1.25rem;
  color: white;
  font-weight: 650;
  text-align: center;
}

.primaryAction:disabled {
  opacity: 0.65;
}

.section :is(a, button, input, select, textarea, summary):focus-visible {
  outline: 2px solid var(--primary);
  outline-offset: 3px;
}

.contactField {
  min-block-size: 2.75rem;
  inline-size: 100%;
  border: 1px solid color-mix(in srgb, var(--muted) 75%, var(--surface));
  border-radius: 0.625rem;
  background: var(--surface-muted);
  padding: 0.625rem 0.75rem;
  color: var(--foreground);
  font-size: 1rem;
}

@media (min-width: 48rem) {
  .sectionHeading {
    grid-template-columns: minmax(0, 1.15fr) minmax(0, 1fr);
  }
}

@media (hover: hover) and (pointer: fine) {
  .programCard:hover,
  .courseCard:hover {
    border-color: var(--primary);
    box-shadow: var(--shadow-panel);
  }

  .programCard:hover .programTitle {
    color: var(--primary);
  }

  .disclosureSummary:hover {
    background: var(--surface-muted);
  }

  .primaryAction:not(:disabled):hover {
    background: var(--accent-strong);
  }
}

@media (prefers-reduced-motion: no-preference) {
  .heroContent:not(:focus-within) > * {
    animation: landingEntrance 640ms var(--landing-ease) both;
  }

  .heroContent > .heroTitle {
    animation-delay: 45ms;
  }

  .heroContent > .heroDescription {
    animation-delay: 90ms;
  }

  .heroContent > .heroActions {
    animation-delay: 135ms;
  }

  .heroActions a,
  .primaryAction {
    transition: background-color 180ms ease;
  }

  .disclosureSummary span,
  .programCard .programLink span,
  .courseCoverImage {
    transition: transform 240ms var(--landing-ease);
  }

  :is(.programCard, .courseCard) {
    transition: border-color 220ms ease, box-shadow 220ms ease,
      transform 300ms var(--landing-ease);
  }

  .programCard:focus-visible .programLink span {
    transform: translateX(4px);
  }

  @media (hover: hover) and (pointer: fine) {
    :is(.programCard, .courseCard):hover {
      transform: translateY(-4px);
    }

    .programCard:hover .programLink span {
      transform: translateX(4px);
    }

    .courseCard:hover .courseCoverImage {
      transform: scale(1.04);
    }
  }

  @supports (animation-timeline: view()) and (animation-range: entry 0% entry 100%) {
    :is(.catalogIntro, .universityIntro, .sectionTitle, .admissionSteps):not(:focus-within) {
      animation: landingSection linear both;
      animation-timeline: view();
      animation-range: entry 0% entry 100%;
    }
  }
}

@keyframes landingEntrance {
  from {
    opacity: 0;
    transform: translateY(10px);
  }

  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes landingSection {
  from {
    opacity: 0.7;
    transform: translateY(8px);
  }

  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@media (prefers-reduced-motion: reduce) {
  :global(html):has(.heroFrame) {
    scroll-behavior: auto;
  }
}

```

### apps/web/src/app/layout.tsx

<!-- archivo: apps/web/src/app/layout.tsx -->
```tsx
// IINICIA Portal · portal Next.js · layout.tsx
/** Define el documento común y monta los proveedores, la cabecera y el pie del portal. */
import type { Metadata } from "next";
import { Suspense } from "react";
import "./globals.css";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { PortalHelpChat } from "@/components/PortalHelpChat";
import { AuthProvider } from "@/contexts/AuthContext";
import { ThemeProvider } from "@/contexts/ThemeContext";

export const metadata: Metadata = {
  title: {
    default: "INICIA — Instituto de Innovación",
    template: "%s | INICIA",
  },
  description:
    "Plataforma de gestión universitaria y académica para estudiantes, docentes y administradores de INICIA.",
  icons: { icon: '/icon.svg' },
};

/** Monta los proveedores de sesión y tema, junto con la navegación y los elementos comunes a las páginas. */
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className="h-full antialiased" suppressHydrationWarning>
      <body className="flex min-h-full flex-col bg-background text-foreground transition-colors duration-150">
        <ThemeProvider>
          <AuthProvider>
            <Suspense fallback={<div aria-hidden="true" className="h-16 border-b border-border bg-surface" />}>
              <SiteHeader />
            </Suspense>
            <main className="flex flex-1 flex-col">{children}</main>
            <Suspense fallback={null}>
              <SiteFooter />
            </Suspense>
            <PortalHelpChat />
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}

```

### apps/web/src/app/login/page.tsx

<!-- archivo: apps/web/src/app/login/page.tsx -->
```tsx
// IINICIA Portal · portal Next.js · page.tsx
/** Presenta las credenciales, el desafío CAPTCHA y el paso TOTP que completa la sesión. */
'use client';

import { AuthCaptcha, captchaEnabled } from '@/components/AuthCaptcha';

import React, { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { IconAlertTriangle } from '@/components/campus-tech/Icons';
import { ApiError } from '@/lib/api';
import type { LoginResponse } from '@/types';

type DemoAccount = { label: string; email: string; password: string };

/** Lee las cuentas demostrativas configuradas y descarta una carga que no cumple la estructura esperada. */
function readDemoAccounts(value: string | undefined): DemoAccount[] {
  if (!value) return [];
  try {
    const accounts: unknown = JSON.parse(value);
    if (!Array.isArray(accounts)) return [];
    return accounts.filter((account: unknown): account is DemoAccount => {
      if (typeof account !== 'object' || account === null) return false;
      const { label, email, password } = account as Partial<DemoAccount>;
      return typeof label === 'string' && !!label.trim() &&
        typeof email === 'string' && !!email.trim() &&
        typeof password === 'string' && !!password;
    });
  } catch {
    return [];
  }
}

const demoAccounts = process.env.NODE_ENV === 'development'
  ? readDemoAccounts(process.env.NEXT_PUBLIC_DEMO_ACCOUNTS)
  : [];

/** Administra el formulario de credenciales, CAPTCHA y segundo factor. Cuando termina la verificación, dirige al panel asociado al rol. */
export default function LoginPage() {
  const router = useRouter();
  const { login, verifyLoginMfa, getDefaultDashboardPath } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [captchaToken, setCaptchaToken] = useState<string>();
  const [captchaAttempt, setCaptchaAttempt] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [mfa, setMfa] = useState<LoginResponse | null>(null);
  const [factorId, setFactorId] = useState('');
  const [code, setCode] = useState('');

  // Una verificación caducada vuelve al paso de credenciales y descarta el factor y el código anteriores.
  const resetMfa = () => {
    setMfa(null);
    setFactorId('');
    setCode('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading || (!mfa && captchaEnabled && !captchaToken)) return;
    setError(null);
    setLoading(true);

    try {
      // El primer envío obtiene el paso de MFA. El segundo completa la sesión y elige el panel.
      if (mfa) {
        const user = await verifyLoginMfa(mfa.mfa_token, factorId, code);
        resetMfa();
        router.replace(getDefaultDashboardPath(user.roles));
      } else {
        const nextStep = await login(email, password, captchaToken);
        setPassword('');
        setFactorId(nextStep.step === 'setup' ? nextStep.factor_id : nextStep.factors[0]?.id ?? '');
        setMfa(nextStep);
      }
    } catch (err) {
      if (mfa && err instanceof ApiError && (err.statusCode === 401 || err.statusCode === 403)) {
        resetMfa();
      }
      setCode('');
      setError(err instanceof Error ? err.message : 'No fue posible iniciar sesión.');
    } finally {
      // Solo el envío de credenciales consume el desafío CAPTCHA.
      if (!mfa) {
        setCaptchaToken(undefined);
        setCaptchaAttempt((attempt) => attempt + 1);
      }
      setLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-[calc(100vh-140px)] bg-aurora items-center justify-center px-4 py-12 sm:px-6 lg:px-8">
      <div className="w-full max-w-md space-y-6 rounded-3xl border border-border bg-surface p-7 shadow-panel sm:p-9">
        <div className="text-center">
          <div className="inline-flex items-center gap-1.5 rounded-[4px] bg-primary/10 px-2.5 py-1 text-[11px] font-mono font-semibold text-primary border border-primary/20">
            <span className="h-1.5 w-1.5 rounded-full bg-accent-sky" />
            <span>Campus Virtual • Autenticación</span>
          </div>
          <h1 className="mt-3 text-2xl font-bold tracking-tight text-foreground">
            {mfa ? 'Verificación en dos pasos' : 'Iniciar sesión'}
          </h1>
          <p className="mt-1 text-xs text-muted">
            {mfa?.step === 'setup'
              ? 'Vincula una app autenticadora para proteger tu cuenta.'
              : mfa
                ? 'Ingresa el código de seis dígitos de tu app autenticadora.'
                : 'Ingresa tus credenciales para acceder al portal universitario y aulas virtuales.'}
          </p>
        </div>

        {error && (
          <div role="alert" className="rounded-[8px] border border-danger/30 bg-danger/10 p-3.5 text-xs font-medium text-danger flex items-center gap-2">
            <IconAlertTriangle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {mfa ? (
          <form onSubmit={handleSubmit} className="space-y-4">
            {mfa.step === 'setup' && (
              <div className="space-y-2 rounded-md border border-border p-3 text-xs text-foreground">
                <p>Escanea el código QR o introduce la clave manualmente en tu app.</p>
                {mfa.qr_code && (
                  <Image src={mfa.qr_code} alt="Código QR para configurar el autenticador de IINICIA" width={160} height={160} unoptimized className="mx-auto rounded bg-white p-2" />
                )}
                <p>Clave de configuración</p>
                <code className="block break-all select-all font-mono">{mfa.secret}</code>
              </div>
            )}
            {mfa.step === 'verify' && mfa.factors.length > 1 && (
              <div className="space-y-1">
                <label htmlFor="mfa-factor" className="block text-xs font-medium">Autenticador</label>
                <select id="mfa-factor" value={factorId} onChange={(e) => setFactorId(e.target.value)} disabled={loading} className="w-full rounded-md border border-border bg-surface p-2 text-sm">
                  {mfa.factors.map((factor, index) => (
                    <option key={factor.id} value={factor.id}>{factor.name || `Autenticador ${index + 1}`}</option>
                  ))}
                </select>
              </div>
            )}
            <div className="space-y-1">
              <label htmlFor="mfa-code" className="block text-xs font-medium">Código del autenticador</label>
              <input id="mfa-code" type="text" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} className="w-full rounded-md border border-border bg-surface-muted/40 px-3.5 py-2.5 text-sm focus:border-primary" />
            </div>
            <button type="submit" disabled={loading || code.length !== 6 || !factorId} className="w-full rounded-md bg-primary-action py-2.5 text-xs font-semibold text-white disabled:opacity-50">
              {loading ? 'Verificando…' : 'Verificar código'}
            </button>
            <button type="button" disabled={loading} onClick={() => { resetMfa(); setError(null); }} className="w-full text-xs font-medium text-muted hover:text-primary disabled:opacity-50">
              Volver al inicio de sesión
            </button>
          </form>
        ) : <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-foreground mb-1.5">
              Correo Electrónico
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="tu.correo@iinicia.org"
              className="w-full rounded-[6px] border border-border bg-surface-muted/40 px-3.5 py-2.5 text-xs text-foreground placeholder:text-muted focus:border-primary focus:bg-surface focus:outline-none transition-all"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-medium text-foreground">
                Contraseña
              </label>
              <Link
                href="/recuperar-password"
                className="text-[11px] text-muted hover:text-primary transition-colors"
              >
                ¿Olvidaste tu contraseña?
              </Link>
            </div>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full rounded-[6px] border border-border bg-surface-muted/40 px-3.5 py-2.5 text-xs text-foreground placeholder:text-muted focus:border-primary focus:bg-surface focus:outline-none transition-all"
            />
          </div>

          <AuthCaptcha attempt={captchaAttempt} onToken={setCaptchaToken} />
          <button
            type="submit"
            disabled={loading || (captchaEnabled && !captchaToken)}
            className="w-full rounded-[6px] bg-primary-action py-2.5 text-xs font-semibold text-white shadow-minimal hover:bg-primary-action/90 transition-all disabled:cursor-not-allowed disabled:opacity-50 active:scale-[0.98]"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                <span>Validando credenciales...</span>
              </span>
            ) : (
              'Continuar'
            )}
          </button>
        </form>}

        {!mfa && demoAccounts.length > 0 && (
          <section aria-label="Accesos rápidos de prueba" className="space-y-2 border-t border-border pt-4">
            <p className="text-center text-xs text-muted">Accesos rápidos de prueba</p>
            <div className="flex flex-wrap justify-center gap-2">
              {demoAccounts.map(({ label, email: demoEmail, password: demoPassword }) => (
                <button
                  key={demoEmail}
                  type="button"
                  disabled={loading}
                  onClick={() => {
                    setEmail(demoEmail);
                    setPassword(demoPassword);
                    setError(null);
                  }}
                  className="rounded-md border border-border bg-surface-muted px-3 py-2 text-xs font-medium hover:border-primary hover:text-primary disabled:opacity-50"
                >
                  {label}
                </button>
              ))}
            </div>
          </section>
        )}

        {!mfa && <div className="text-center text-xs text-muted">
          ¿No tienes una cuenta aún?{' '}
          <Link href="/registro" className="font-semibold text-primary hover:underline">
            Crear cuenta de aspirante
          </Link>
        </div>}
      </div>
    </div>
  );
}

```

### apps/web/src/app/page.tsx

<!-- archivo: apps/web/src/app/page.tsx -->
```tsx
// IINICIA Portal · portal Next.js · page.tsx
/** Reúne el portal público, carga la oferta desde la API y conecta el catálogo con admisiones y contacto. */
'use client';

import React, { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { contactApi, coursesApi, enrollmentsApi, programsApi } from '@/lib/api';
import type { CourseOffering, AuthorizedCourse, EnrollmentRequest, Program } from '@/types';
import styles from './landing.module.css';
import {
  IconCheck,
  IconSearch,
  IconRefresh,
  IconAlertTriangle,
} from '@/components/campus-tech/Icons';

const courseCovers = [
  '/course-covers/notebook.webp',
  '/course-covers/laptop.webp',
  '/course-covers/books.webp',
  '/course-covers/tablet.webp',
];

/** Selecciona una imagen local por posición del curso para dar variedad visual al catálogo. */
function CourseCover({ index }: { index: number }) {
  return (
    <div className={styles.courseCover} aria-hidden="true">
      <Image
        src={courseCovers[index % courseCovers.length]}
        alt=""
        fill
        sizes="(min-width: 72rem) 22rem, (min-width: 64rem) 33vw, (min-width: 40rem) 50vw, 100vw"
        className={styles.courseCoverImage}
      />
    </div>
  );
}

/** Presenta la oferta de certificaciones como una sección reutilizable de la página institucional. */
function CertificationSection({ programs, loading, loadError }: {
  programs: Program[];
  loading: boolean;
  loadError: boolean;
}) {
  const status = loadError ? 'No pudimos cargar la oferta. Recarga la página para reintentar.' : 'Aún no hay certificaciones publicadas.';
  return (
    <section id="certificaciones" aria-labelledby="certificaciones-titulo" className={`${styles.section} ${styles.sectionTint} px-4 sm:px-6 lg:px-8`}>
      <div className="mx-auto max-w-6xl space-y-6 sm:space-y-8">
        <h2 id="certificaciones-titulo" className={styles.sectionTitle}>Certificaciones</h2>
        {programs.length > 0 ? (
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" role="list">
            {programs.map((program) => {
              const description = program.short_description || program.description;
              const programTitleId = `certificacion-${program.id}-nombre`;
              const programActionId = `certificacion-${program.id}-accion`;
              const duration = program.duration_text || (program.duration_hours > 0 ? `${program.duration_hours} horas` : '');
              return (
                <li key={program.id}>
                  <Link href={`/programas/${program.slug}`} aria-labelledby={`${programActionId} ${programTitleId}`} className={`${styles.detailCard} ${styles.programCard}`}>
                    <h3 id={programTitleId} className={styles.programTitle}>{program.name}</h3>
                    {description && <p className="line-clamp-3 text-sm leading-relaxed text-muted">{description}</p>}
                    <div className="mt-auto pt-2">
                      {duration && <p className="text-sm font-medium text-muted">{duration}</p>}
                      <span id={programActionId} className={styles.programLink}>
                        Ver programa <span aria-hidden="true">→</span>
                      </span>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        ) : (
          <p role="status" className={styles.emptyState}>{loading ? 'Cargando la oferta académica…' : status}</p>
        )}
      </div>
    </section>
  );
}

/** Reúne presentación institucional, catálogo y contacto. La sesión determina si se muestran acciones académicas de la cuenta. */
export default function HomePage() {
  const { user } = useAuth();
  const router = useRouter();

  // Courses state
  const [offerings, setOfferings] = useState<CourseOffering[]>([]);
  const [myCourses, setMyCourses] = useState<AuthorizedCourse[]>([]);
  const [myEnrollments, setMyEnrollments] = useState<EnrollmentRequest[]>([]);
  const [publicCourses, setPublicCourses] = useState<Program[]>([]);
  const [coursesLoading, setCoursesLoading] = useState(true);
  const [courseLoadError, setCourseLoadError] = useState(false);
  const [programLoadError, setProgramLoadError] = useState(false);
  const [courseSearch, setCourseSearch] = useState('');
  const [enrollingId, setEnrollingId] = useState<string | null>(null);
  const [enrollMessage, setEnrollMessage] = useState<string | null>(null);
  const [enrollError, setEnrollError] = useState<string | null>(null);

  const [certificaciones, setCertificaciones] = useState<Program[]>([]);

  // Contact form state
  const [contactName, setContactName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [contactArea, setContactArea] = useState('admisiones');
  const [contactMessage, setContactMessage] = useState('');
  const [contactSubmitting, setContactSubmitting] = useState(false);
  const [contactSuccess, setContactSuccess] = useState(false);
  const [contactError, setContactError] = useState<string | null>(null);

  // Initial Hash scroll handler
  useEffect(() => {
    if (typeof window !== 'undefined' && window.location.hash) {
      const id = window.location.hash.replace('#', '');
      const timer = setTimeout(() => {
        const el = document.getElementById(id);
        if (el) {
          const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
          el.scrollIntoView({ behavior: reduceMotion ? 'instant' : 'smooth' });
        }
      }, 200);
      return () => clearTimeout(timer);
    }
  }, []);

  // Load dynamic course data
  useEffect(() => {
    /** Carga los datos que utiliza la portada para presentar el catálogo y adaptar sus acciones según la sesión. */
    async function loadData() {
      try {
        setCoursesLoading(true);
        setCourseLoadError(false);
        setProgramLoadError(false);
        const [offeringsData, authorized, enrollments, programs] = await Promise.all([
          user ? coursesApi.getOfferings().catch(() => { setCourseLoadError(true); return []; }) : Promise.resolve([]),
          user ? coursesApi.getAuthorizedCourses().catch(() => []) : Promise.resolve([]),
          user ? enrollmentsApi.getMyEnrollments().catch(() => []) : Promise.resolve([]),
          programsApi.getPrograms().catch(() => {
            setProgramLoadError(true);
            if (!user) setCourseLoadError(true);
            return [];
          }),
        ]);

        setOfferings(offeringsData);

        setMyCourses(authorized || []);
        setMyEnrollments(enrollments);
        setPublicCourses(programs.filter((program) => program.type === 'curso'));

        setCertificaciones(programs.filter((program) => program.type === 'certificacion'));
      } catch {
        setCourseLoadError(true);
        setOfferings([]);
        setPublicCourses([]);
        setCertificaciones([]);
      } finally {
        setCoursesLoading(false);
      }
    }

    loadData();
  }, [user]);

  const isEnrolled = (courseMappingId: string) => {
    return myCourses.some((c) => c.course_mapping_id === courseMappingId);
  };

  // Conecta la acción del catálogo con la solicitud de matrícula de la sesión.
  const handleEnroll = async (courseMappingId: string, courseName: string) => {
    if (!user) {
      router.push('/login');
      return;
    }

    try {
      setEnrollingId(courseMappingId);
      setEnrollMessage(null);
      setEnrollError(null);

      const enrollment = await enrollmentsApi.requestEnrollment(courseMappingId);
      setMyEnrollments((current) => [...current, enrollment]);
      setEnrollMessage(`Solicitud para "${courseName}" registrada. Un administrador revisará tu inscripción.`);
      
      const authorized = await coursesApi.getAuthorizedCourses().catch(() => []);
      setMyCourses(authorized);
    } catch (err: unknown) {
      setEnrollError(
        err instanceof Error
          ? err.message
          : 'No fue posible completar la inscripción.',
      );
    } finally {
      setEnrollingId(null);
    }
  };

  // Envía el formulario al servicio institucional y presenta el resultado del envío.
  const handleContactSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setContactError(null);

    if (!contactName.trim() || !contactEmail.trim() || !contactMessage.trim()) {
      setContactError('Por favor completa todos los campos requeridos (*).');
      return;
    }

    setContactSubmitting(true);
    const contactDepartments: Record<string, string> = {
      admisiones: 'Admisiones y Convocatorias',
      soporte: 'Soporte Campus Virtual Moodle',
      escolar: 'Servicios Escolares y Certificados',
      vinculacion: 'Rectoría y Vinculación',
    };

    try {
      await contactApi.submitMessage({
        full_name: contactName.trim(),
        email: contactEmail.trim(),
        phone: contactPhone.trim() || undefined,
        subject: `Contacto web: ${contactDepartments[contactArea] ?? 'INICIA'}`,
        message: contactMessage.trim(),
      });
      setContactSuccess(true);
      setContactName('');
      setContactEmail('');
      setContactPhone('');
      setContactMessage('');
    } catch (err: unknown) {
      setContactError(
        err instanceof Error
          ? err.message
          : 'No fue posible enviar tu mensaje. Inténtalo de nuevo.',
      );
    } finally {
      setContactSubmitting(false);
    }
  };

  const filteredCourses = offerings.filter((c) =>
    c.name.toLowerCase().includes(courseSearch.toLowerCase()) ||
    c.code.toLowerCase().includes(courseSearch.toLowerCase())
  );
  const filteredPublicCourses = publicCourses.filter((course) =>
    course.name.toLowerCase().includes(courseSearch.toLowerCase()) ||
    course.code.toLowerCase().includes(courseSearch.toLowerCase())
  );

  return (
    <div className="flex-1 bg-background text-foreground">
      <div className={styles.heroFrame}>
        <section id="inicio" aria-labelledby="inicio-titulo" className={styles.hero}>
          <Image
            src="/iinicia-landing-hero.webp"
            alt=""
            fill
            preload
            sizes="100vw"
            className={styles.heroImage}
          />
          <div className={styles.heroShade} />
          <div className={styles.heroContent}>
            <p className={styles.institute}>Instituto de Innovación y Ciencias Aplicadas</p>
            <h1 id="inicio-titulo" className={styles.heroTitle}>
              Tu educación comienza hoy, <span>estés donde estés.</span>
            </h1>
            <p className={styles.heroDescription}>
              Estudia a tu ritmo con cursos y certificaciones en el Campus Virtual de IINICIA.
            </p>
            <div className={styles.heroActions}>
              <Link href="/registro" className={styles.heroPrimary}>Comienza ahora</Link>
              <a href="#cursos" className={styles.heroSecondary}>Explorar cursos <span aria-hidden="true">↓</span></a>
            </div>
          </div>
        </section>
      </div>

      <section id="cursos" aria-labelledby="cursos-titulo" className={styles.catalog}>
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className={styles.catalogIntro}>
            <h2 id="cursos-titulo" className={styles.catalogTitle}>Todos nuestros cursos</h2>
            <p className="max-w-xl text-pretty text-base leading-relaxed">
              Explora la oferta de formación de IINICIA y encuentra un curso que se adapte a tus metas.
            </p>
          </div>

          <div className="space-y-6">
            <div className="flex justify-end">
              <label className="relative block w-full max-w-sm">
                <span className="sr-only">Buscar cursos por código o nombre</span>
                <input
                  type="search"
                  placeholder="Buscar por código o nombre"
                  value={courseSearch}
                  onChange={(e) => setCourseSearch(e.target.value)}
                  className="h-11 w-full rounded-full border border-border bg-surface px-4 ps-10 text-sm text-foreground placeholder:text-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                />
                <IconSearch aria-hidden="true" className="pointer-events-none absolute start-3.5 top-3.5 size-4 text-muted" />
              </label>
            </div>

            {/* Feedback banners */}
            {enrollMessage && (
              <div className="rounded-2xl border border-success/30 bg-success/10 backdrop-blur-md p-4 text-xs text-foreground flex items-center justify-between gap-3 shadow-xs">
                <div className="flex items-center gap-2.5">
                  <div className="h-6 w-6 rounded-full bg-success/20 grid place-items-center shrink-0">
                    <IconCheck className="w-3.5 h-3.5 text-success" />
                  </div>
                  <span className="font-medium">{enrollMessage}</span>
                </div>
                <Link
                  href="/dashboard"
                  className="rounded-full bg-success text-white px-3 py-1.5 text-xs font-semibold shrink-0 shadow-xs hover:opacity-90 transition-opacity"
                >
                  Ver mi panel
                </Link>
              </div>
            )}

            {enrollError && (
              <div className="rounded-2xl border border-danger/30 bg-danger/10 backdrop-blur-md p-4 text-xs text-danger flex items-center gap-2.5 shadow-xs">
                <div className="h-6 w-6 rounded-full bg-danger/20 grid place-items-center shrink-0">
                  <IconAlertTriangle className="w-3.5 h-3.5 text-danger" />
                </div>
                <span className="font-medium">{enrollError}</span>
              </div>
            )}

            {/* Lista de cursos en Grid con estética Apple Card */}
            {coursesLoading ? (
              <div className="flex min-h-[220px] items-center justify-center rounded-3xl border border-border/60 bg-surface/40 backdrop-blur-md">
                <div className="flex items-center gap-3 text-xs text-muted font-medium">
                  <IconRefresh className="w-4 h-4 animate-spin text-primary" />
                  <span>Cargando catálogo curricular desde el servidor...</span>
                </div>
              </div>
            ) : !user && filteredPublicCourses.length > 0 ? (
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {filteredPublicCourses.map((course, index) => (
                  <div
                    key={course.id}
                    className={styles.courseCard}
                  >
                    <CourseCover index={index} />
                    <div className="flex-1 space-y-3 px-5 pt-5">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="rounded-md bg-surface-muted px-2.5 py-0.5 text-[11px] font-mono font-medium text-foreground border border-border/40">
                          {course.code}
                        </span>
                        {course.duration_text && (
                          <span className="text-[11px] font-medium text-muted">
                            {course.duration_text}
                          </span>
                        )}
                      </div>
                      <h3 className="text-xl font-bold leading-snug text-foreground">
                        {course.name}
                      </h3>
                      {(course.short_description || course.description) && (
                        <p className="line-clamp-3 text-sm leading-relaxed text-muted">
                          {course.short_description || course.description}
                        </p>
                      )}
                    </div>

                    <div className="mx-5 my-4 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
                      <Link
                        href={`/programas/${course.slug}`}
                        className="text-xs font-semibold text-primary hover:opacity-80 transition-opacity"
                      >
                        Ver detalles →
                      </Link>
                      <Link
                        href="/login"
                        className="rounded-full bg-primary-action px-3.5 py-1.5 text-xs font-semibold text-white shadow-xs hover:opacity-95 motion-safe:active:scale-95 motion-safe:transition"
                      >
                        Iniciar sesión
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            ) : filteredCourses.length === 0 ? (
              <div className="rounded-3xl border border-border/70 bg-surface/70 backdrop-blur-md p-12 text-center space-y-3 shadow-xs">
                <div className="h-10 w-10 mx-auto rounded-full bg-surface-muted grid place-items-center text-muted">
                  <IconSearch className="w-5 h-5" />
                </div>
                <p className="text-sm font-semibold text-foreground">
                  {courseLoadError
                    ? 'No fue posible cargar los cursos'
                    : (user ? offerings : publicCourses).length === 0
                      ? 'Aún no hay cursos publicados'
                      : 'No se encontraron cursos coincidentes'}
                </p>
                <p className="text-xs text-muted max-w-sm mx-auto">
                  {courseLoadError
                    ? 'Recarga la página para intentar de nuevo.'
                    : (user ? offerings : publicCourses).length === 0
                      ? 'Consulta el catálogo más tarde.'
                      : 'Intenta con otro término de búsqueda.'}
                </p>
                {!user && (
                  <Link
                    href="/login"
                    className="inline-block rounded-full bg-primary-action px-5 py-2 text-xs font-semibold text-white shadow-xs hover:opacity-95"
                  >
                    Iniciar sesión
                  </Link>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {filteredCourses.map((course, index) => {
                  const enrolled = isEnrolled(course.course_mapping_id);
                  const pending = myEnrollments.some(
                    (request) =>
                      request.course_mapping_id === course.course_mapping_id &&
                      request.status === 'pendiente',
                  );

                  return (
                    <div
                      key={course.id}
                      className={styles.courseCard}
                    >
                      <CourseCover index={index} />
                      <div className="flex-1 space-y-3 px-5 pt-5">
                        <div className="flex items-center justify-between gap-2">
                          <span className="rounded-md bg-surface-muted px-2.5 py-0.5 text-[11px] font-mono font-medium text-foreground border border-border/40">
                            {course.code}
                          </span>
                          {course.credits != null && (
                            <span className="text-[11px] font-medium text-muted">
                              {course.credits} créditos
                            </span>
                          )}
                        </div>
                        <h3 className="text-xl font-bold leading-snug text-foreground">
                          {course.name}
                        </h3>
                        <p className="line-clamp-3 text-sm leading-relaxed text-muted">
                          {course.course_description || 'Curso disponible en el catálogo de INICIA.'}
                        </p>
                      </div>

                      <div className="mx-5 my-4 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
                        {course.programs?.slug ? (
                          <Link
                            href={`/programas/${course.programs.slug}`}
                            className="text-xs font-semibold text-primary hover:opacity-80 transition-opacity"
                          >
                            Detalles →
                          </Link>
                        ) : (
                          <span className="text-[11px] font-medium text-muted">Moodle LMS</span>
                        )}

                        {enrolled ? (
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="rounded-full bg-success/10 px-2.5 py-0.5 text-[11px] font-semibold text-success border border-success/20">
                              Matriculado
                            </span>
                            <Link
                              href="/dashboard/estudiante"
                              className="rounded-full bg-primary-action text-white px-3 py-1 text-xs font-semibold hover:opacity-95 shadow-xs transition-opacity"
                            >
                              Entrar
                            </Link>
                          </div>
                        ) : pending ? (
                          <span className="rounded-full bg-primary/10 px-3 py-1 text-[11px] font-semibold text-primary border border-primary/20">
                            Solicitud pendiente
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() =>
                              handleEnroll(
                                course.course_mapping_id || course.id,
                                course.name,
                              )
                            }
                            disabled={
                              enrollingId ===
                              (course.course_mapping_id || course.id)
                            }
                            className="rounded-full bg-primary-action px-3.5 py-1.5 text-xs font-semibold text-white hover:opacity-95 motion-safe:transition shadow-xs disabled:opacity-50 motion-safe:active:scale-95"
                          >
                            {enrollingId === (course.course_mapping_id || course.id)
                              ? 'Solicitando...'
                              : user
                              ? 'Solicitar inscripción'
                              : 'Iniciar sesión'}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </section>

      <section id="universidad" aria-labelledby="universidad-titulo" className={`${styles.section} px-4 sm:px-6 lg:px-8`}>
        <div className="mx-auto max-w-6xl space-y-10 sm:space-y-14">
          <div className={`${styles.universityIntro} grid items-center gap-6 md:grid-cols-[1.2fr_1fr]`}>
            <div className="space-y-4">
              <h2 id="universidad-titulo" className={styles.sectionTitle}>Universidad IINICIA</h2>
              <p className="max-w-md text-base leading-relaxed text-white/90">
                Formación universitaria en computación, tecnología y gestión académica.
              </p>
            </div>
            <Image
              src="/universidad-inicia-wordmark.png"
              alt=""
              width={1024}
              height={100}
              className="h-auto w-full max-w-xs md:justify-self-end"
            />
          </div>

          <div className="grid gap-8 md:grid-cols-2 md:gap-14">
            <div>
              <h3 className={styles.subheading}>Misión</h3>
              <p className="mt-2 max-w-md text-base leading-relaxed text-muted">
                Ampliar el acceso a la educación superior y a la formación tecnológica mediante la enseñanza en línea.
              </p>
            </div>
            <div>
              <h3 className={styles.subheading}>Visión</h3>
              <p className="mt-2 max-w-md text-base leading-relaxed text-muted">
                Ser un referente en educación virtual e innovación tecnológica en América Latina.
              </p>
            </div>
          </div>

          <div className="space-y-5">
            <h3 className={styles.subheading}>Cómo se estudia en IINICIA</h3>
            <ul className="grid gap-x-10 sm:grid-cols-2">
              {pilaresModelo.map((pilar) => (
                <li key={pilar.titulo} className="border-t border-border py-4">
                  <h4 className="font-semibold text-foreground">{pilar.titulo}</h4>
                  <p className="mt-1 text-sm leading-relaxed text-muted">{pilar.descripcion}</p>
                </li>
              ))}
            </ul>
          </div>

          <details className={styles.disclosure}>
            <summary className={styles.disclosureSummary}>
              Autoridades y equipo académico <span aria-hidden="true">⌄</span>
            </summary>
            <ul className="grid gap-x-8 gap-y-5 border-t border-border px-5 py-6 sm:grid-cols-2 sm:px-6">
              {autoridades.map((persona) => (
                <li key={persona.nombre}>
                  <p className="font-semibold text-foreground">{persona.nombre}</p>
                  <p className="mt-1 text-sm text-muted">{persona.cargo}</p>
                  <p className="mt-2 text-sm leading-relaxed text-muted">{persona.semblanza}</p>
                </li>
              ))}
            </ul>
          </details>
        </div>
      </section>

      <CertificationSection
        programs={certificaciones}
        loading={coursesLoading}
        loadError={programLoadError}
      />

      <section id="admisiones" aria-labelledby="admisiones-titulo" className={`${styles.section} px-4 sm:px-6 lg:px-8`}>
        <div className="mx-auto max-w-6xl space-y-10 sm:space-y-14">
          <div className="flex flex-wrap items-end justify-between gap-5">
            <h2 id="admisiones-titulo" className={styles.sectionTitle}>Admisiones</h2>
            <Link href="/registro" className={styles.primaryAction}>Crear cuenta de aspirante</Link>
          </div>

          <ol className={`${styles.admissionSteps} grid gap-y-5 sm:grid-cols-2 lg:grid-cols-4`} role="list">
            {pasosAdmision.map((paso, indice) => (
              <li key={paso.titulo} className={styles.stepCard}>
                <span className={styles.stepNumber} aria-hidden="true">{indice + 1}</span>
                <h3 className="mt-3 font-semibold text-foreground">{paso.titulo}</h3>
                <p className="mt-1 text-sm leading-relaxed text-muted">{paso.descripcion}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section id="contacto" aria-labelledby="contacto-titulo" className={`${styles.section} ${styles.sectionTint} px-4 sm:px-6 lg:px-8`}>
        <div className="mx-auto max-w-6xl space-y-12">
          <div className={styles.sectionHeading}>
            <h2 id="contacto-titulo" className={styles.sectionTitle}>Contacto</h2>
            <p className={styles.sectionDescription}>Envía una consulta o contacta directamente al departamento que necesitas.</p>
          </div>

          <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
            {/* Interactive Message Form */}
            <div className="lg:col-span-7">
              <div className={`${styles.detailCard} space-y-5 p-6 sm:p-8`}>
                <div className="border-b border-border pb-3">
                  <h3 className={styles.subheading}>Enviar un mensaje</h3>
                </div>

                {contactSuccess ? (
                  <div role="status" className="rounded-[8px] border border-success/30 bg-success/10 p-6 text-center space-y-3">
                    <div className="mx-auto h-10 w-10 rounded-full bg-success/20 flex items-center justify-center text-success">
                      <IconCheck className="w-5 h-5 text-success" />
                    </div>
                    <h4 className="text-sm font-bold text-foreground">Mensaje recibido</h4>
                    <p className="text-xs text-muted max-w-sm mx-auto">
                      Te responderemos al correo que proporcionaste.
                    </p>
                    <button
                      type="button"
                      onClick={() => setContactSuccess(false)}
                      className="min-h-11 rounded-full border border-border bg-surface px-4 text-sm font-semibold text-primary hover:bg-surface-muted"
                    >
                      Enviar otro mensaje
                    </button>
                  </div>
                ) : (
                  <form onSubmit={handleContactSubmit} className="space-y-4">
                    {contactError && (
                      <div role="alert" className="rounded-[6px] border border-danger/30 bg-danger/10 p-2.5 text-sm text-danger">
                        {contactError}
                      </div>
                    )}

                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <div className="space-y-1">
                        <label htmlFor="contacto-nombre" className="text-sm font-medium text-foreground">Nombre completo *</label>
                        <input
                          id="contacto-nombre"
                          autoComplete="name"
                          type="text"
                          required
                          value={contactName}
                          onChange={(e) => setContactName(e.target.value)}
                          className={styles.contactField}
                        />
                      </div>
                      <div className="space-y-1">
                        <label htmlFor="contacto-correo" className="text-sm font-medium text-foreground">Correo electrónico *</label>
                        <input
                          id="contacto-correo"
                          autoComplete="email"
                          type="email"
                          required
                          value={contactEmail}
                          onChange={(e) => setContactEmail(e.target.value)}
                          className={styles.contactField}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <div className="space-y-1">
                        <label htmlFor="contacto-telefono" className="text-sm font-medium text-foreground">Teléfono (opcional)</label>
                        <input
                          id="contacto-telefono"
                          autoComplete="tel"
                          type="tel"
                          value={contactPhone}
                          onChange={(e) => setContactPhone(e.target.value)}
                          className={styles.contactField}
                        />
                      </div>
                      <div className="space-y-1">
                        <label htmlFor="contacto-departamento" className="text-sm font-medium text-foreground">Departamento *</label>
                        <select
                          id="contacto-departamento"
                          required
                          value={contactArea}
                          onChange={(e) => setContactArea(e.target.value)}
                          className={styles.contactField}
                        >
                          <option value="admisiones">Admisiones y Convocatorias</option>
                          <option value="soporte">Soporte Campus Virtual Moodle</option>
                          <option value="escolar">Servicios Escolares y Certificados</option>
                          <option value="vinculacion">Rectoría y Vinculación</option>
                        </select>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label htmlFor="contacto-mensaje" className="text-sm font-medium text-foreground">Mensaje *</label>
                      <textarea
                        id="contacto-mensaje"
                        required
                        rows={4}
                        value={contactMessage}
                        onChange={(e) => setContactMessage(e.target.value)}
                        className={styles.contactField}
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={contactSubmitting}
                      className={styles.primaryAction}
                    >
                      {contactSubmitting ? 'Enviando...' : 'Enviar mensaje'}
                    </button>
                  </form>
                )}
              </div>
            </div>
            <aside aria-labelledby="contacto-directorio" className="lg:col-span-5 lg:ps-4">
              <h3 id="contacto-directorio" className={styles.subheading}>Directorio</h3>
              <ul className="mt-4">
                {canalesAtencion.map((canal) => (
                  <li key={canal.email} className="border-t border-border py-4">
                    <h4 className="font-semibold text-foreground">{canal.departamento}</h4>
                    <p className="mt-1 text-sm leading-relaxed text-muted">{canal.descripcion}</p>
                    <a href={`mailto:${canal.email}`} className={`${styles.programLink} text-sm`}>{canal.email}</a>
                    <p className="text-sm text-muted">{canal.horario}</p>
                  </li>
                ))}
              </ul>
            </aside>
          </div>
        </div>
      </section>
    </div>
  );
}

// ============================================================================
// DATA & CONSTANTS
// ============================================================================

const pilaresModelo = [
  {
    titulo: 'Aprendizaje práctico',
    descripcion: 'Aplica lo aprendido en proyectos y laboratorios virtuales.',
  },
  {
    titulo: 'Campus virtual',
    descripcion: 'Consulta materiales y evaluaciones en Moodle.',
  },
  {
    titulo: 'Acompañamiento docente',
    descripcion: 'Aprende con profesores que tienen experiencia en la industria.',
  },
  {
    titulo: 'Formación por módulos',
    descripcion: 'Organiza el estudio junto con tus demás actividades.',
  },
];

const autoridades = [
  {
    nombre: 'Dra. Elena Santillán Mora',
    cargo: 'Rectora Institucional',
    semblanza: 'Doctora en Innovación Educativa con más de 20 años de liderazgo en transformación universitaria.',
  },
  {
    nombre: 'Mtro. Roberto Vaca Elizondo',
    cargo: 'Director Académico y de Posgrados',
    semblanza: 'Especialista en diseño curricular por competencias, acreditaciones nacionales y tecnología educativa.',
  },
  {
    nombre: 'Dra. Claudia Rivas Téllez',
    cargo: 'Coordinadora de Campus Virtual',
    semblanza: 'Investigadora en analítica del aprendizaje, entornos virtuales Moodle LMS y educación distribuida.',
  },
  {
    nombre: 'Mtro. Héctor Domínguez Garza',
    cargo: 'Secretario General y Escolar',
    semblanza: 'Responsable de normatividad universitaria, admisiones, control escolar y convenios oficiales.',
  },
];

const pasosAdmision = [
  { titulo: 'Crea tu cuenta', descripcion: 'Regístrate como aspirante y confirma tu correo.' },
  { titulo: 'Envía tu postulación', descripcion: 'Elige un programa en tu panel de aspirante.' },
  { titulo: 'Consulta el dictamen', descripcion: 'Revisa el estado de tu solicitud en el portal.' },
  { titulo: 'Entra al aula', descripcion: 'Accede desde tu panel cuando se confirme tu matrícula en Moodle.' },
];

const canalesAtencion = [
  {
    departamento: 'Admisiones',
    email: 'admisiones@iinicia.org',
    horario: 'Lunes a viernes, 8:00–19:00',
    descripcion: 'Orientación vocacional, convocatorias abiertas y requisitos de ingreso.',
  },
  {
    departamento: 'Soporte de Moodle',
    email: 'soporte@iinicia.org',
    horario: 'Ticket y correo disponibles 24/7',
    descripcion: 'Incidencias con accesos, matriculación o navegación en el aula virtual.',
  },
  {
    departamento: 'Servicios escolares',
    email: 'escolar@iinicia.org',
    horario: 'Lunes a viernes, 9:00–17:00',
    descripcion: 'Constancias oficiales y actas de calificación.',
  },
];

```

### apps/web/src/app/recuperar-password/page.tsx

<!-- archivo: apps/web/src/app/recuperar-password/page.tsx -->
```tsx
// IINICIA Portal · portal Next.js · page.tsx
/** Solicita un enlace de recuperación vinculado al navegador mediante PKCE. */
'use client';

import { AuthCaptcha, captchaEnabled } from '@/components/AuthCaptcha';

import React, { useState } from 'react';
import Link from 'next/link';
import { authApi } from '@/lib/api';
import { clearRecoveryVerifier, startRecoveryProof } from '@/lib/recovery-pkce';
import {
  IconCheck,
  IconAlertTriangle,
} from '@/components/campus-tech/Icons';

/** Inicia la recuperación de contraseña con CAPTCHA, un reto PKCE y una confirmación que no depende de revelar si existe la cuenta. */
export default function RecuperarPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [captchaToken, setCaptchaToken] = useState<string>();
  const [captchaAttempt, setCaptchaAttempt] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // Vincula la solicitud de correo con la prueba PKCE generada en este navegador.
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading || (captchaEnabled && !captchaToken)) return;
    setError(null);

    if (!email.trim() || !email.includes('@')) {
      setError('Ingresa una dirección de correo electrónico válida.');
      return;
    }

    setLoading(true);

    let verifier: string | undefined;
    try {
      // El navegador conserva el verificador. La API recibe el desafío para vincularlo al enlace de correo.
      const proof = await startRecoveryProof();
      verifier = proof.verifier;
      await authApi.recoverPassword(email.trim(), proof.challenge, captchaToken);
      setSubmitted(true);
    } catch (err: unknown) {
      if (verifier) clearRecoveryVerifier(verifier);
      setError(err instanceof Error ? err.message : 'No fue posible procesar la solicitud.');
    } finally {
      setCaptchaToken(undefined);
      setCaptchaAttempt((attempt) => attempt + 1);
      setLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-[calc(100vh-140px)] bg-aurora items-center justify-center px-4 py-12 sm:px-6 lg:px-8">
      <div className="w-full max-w-md space-y-6 rounded-3xl border border-border bg-surface p-7 shadow-panel sm:p-9">
        <div className="text-center">
          <div className="inline-flex items-center gap-1.5 rounded-[4px] bg-primary/10 px-2.5 py-1 text-[11px] font-mono font-semibold text-primary border border-primary/20">
            <span className="h-1.5 w-1.5 rounded-full bg-accent-sky" />
            <span>Seguridad Institucional</span>
          </div>
          <h1 className="mt-3 text-2xl font-bold tracking-tight text-foreground">
            Recuperar contraseña
          </h1>
          <p className="mt-1 text-xs text-muted leading-relaxed">
            Ingresa el correo institucional o personal con el que estás registrado para restablecer tu clave de acceso.
          </p>
        </div>

        {submitted ? (
          <div className="space-y-4">
            <div className="rounded-[10px] border border-success/30 bg-success/10 p-5 text-center space-y-2">
              <div className="mx-auto grid h-10 w-10 place-items-center rounded-full bg-success/20 text-success">
                <IconCheck className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-bold text-foreground">
                Solicitud recibida
              </h3>
              <p className="text-xs text-muted leading-relaxed">
                Si podemos enviar un enlace de recuperación a <strong className="text-foreground">{email}</strong>, lo recibirás por correo.
              </p>
            </div>

            <div className="rounded-[8px] bg-surface-muted/50 border border-border p-3 text-[11px] text-muted space-y-1">
              <p>Revisa tu bandeja de entrada y la carpeta de correo no deseado (spam). Abre el enlace en este mismo navegador.</p>
              <p>Si no llega el correo, espera antes de solicitar otro. Si el enlace caduca, puedes pedir uno nuevo desde aquí.</p>
            </div>

            <div className="pt-2 flex flex-col gap-2">
              <Link
                href="/login"
                className="w-full rounded-[6px] bg-primary-action py-2.5 text-center text-xs font-semibold text-white shadow-minimal hover:bg-primary-action/90 transition-all"
              >
                Volver a Iniciar Sesión
              </Link>
              <button
                type="button"
                onClick={() => setSubmitted(false)}
                className="text-center text-xs text-muted hover:text-foreground transition-colors py-1"
              >
                Probar con otra dirección de correo
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="rounded-[8px] border border-danger/30 bg-danger/10 p-3.5 text-xs font-medium text-danger flex items-center gap-2">
                <IconAlertTriangle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-foreground mb-1.5">
                Correo Electrónico Registrado
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="ejemplo@iinicia.org"
                className="w-full rounded-[6px] border border-border bg-surface-muted/40 px-3.5 py-2.5 text-xs text-foreground placeholder:text-muted focus:border-primary focus:bg-surface focus:outline-none transition-all"
              />
            </div>

            <AuthCaptcha attempt={captchaAttempt} onToken={setCaptchaToken} />
            <button
              type="submit"
              disabled={loading || (captchaEnabled && !captchaToken)}
              className="w-full rounded-[6px] bg-primary-action py-2.5 text-xs font-semibold text-white shadow-minimal hover:bg-primary-action/90 transition-all disabled:opacity-50"
            >
              {loading ? 'Enviando solicitud...' : 'Enviar instrucciones de recuperación'}
            </button>

            <div className="border-t border-border pt-4 text-center text-xs text-muted">
              ¿Recordaste tu contraseña?{' '}
              <Link href="/login" className="font-semibold text-primary hover:underline">
                Iniciar sesión
              </Link>
            </div>
          </form>
        )}

        <div className="rounded-[8px] border border-border bg-surface-muted/30 p-3 text-center text-[11px] text-muted">
          ¿Problemas con tu cuenta? Escríbenos a{' '}
          <a
            href="mailto:soporte@iinicia.org"
            className="font-medium text-foreground hover:underline"
          >
            soporte@iinicia.org
          </a>
        </div>
      </div>
    </div>
  );
}

```

### apps/web/src/app/registro/page.tsx

<!-- archivo: apps/web/src/app/registro/page.tsx -->
```tsx
// IINICIA Portal · portal Next.js · page.tsx
/** Recoge los datos del aspirante y muestra el resultado del registro y la confirmación por correo. */
'use client';

import { AuthCaptcha, captchaEnabled } from '@/components/AuthCaptcha';

import React, { useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { IconAlertTriangle } from '@/components/campus-tech/Icons';

/** Recoge los datos del aspirante y el desafío CAPTCHA. La API valida el alta y devuelve el resultado del inicio de confirmación por correo. */
export default function RegistroPage() {
  const { register } = useAuth();

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [captchaToken, setCaptchaToken] = useState<string>();
  const [captchaAttempt, setCaptchaAttempt] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // Envía los datos del aspirante y muestra el resultado antes de que se inicie la sesión.
  // El formulario usa un desafío por intento. La API valida los datos e inicia la confirmación de correo.
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading || (captchaEnabled && !captchaToken)) return;
    setError(null);
    setLoading(true);

    try {
      const { message } = await register({
        first_name: firstName,
        last_name: lastName,
        phone: phone || undefined,
        email,
        password,
        captcha_token: captchaToken,
      });

      setPassword('');
      setNotice(message);
    } catch (err: any) {
      setError(err.message || 'No fue posible completar el registro. Verifica los datos.');
    } finally {
      setCaptchaToken(undefined);
      setCaptchaAttempt((attempt) => attempt + 1);
      setLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-[calc(100vh-140px)] bg-aurora items-center justify-center px-4 py-12 sm:px-6 lg:px-8">
      <div className="w-full max-w-lg space-y-6 rounded-3xl border border-border bg-surface p-7 shadow-panel sm:p-9">
        <div className="text-center">
          <div className="inline-flex items-center gap-1.5 rounded-[4px] bg-primary/10 px-2.5 py-1 text-[11px] font-mono font-semibold text-primary border border-primary/20">
            <span className="h-1.5 w-1.5 rounded-full bg-accent-sky" />
            <span>Admisiones • Registro de Aspirante</span>
          </div>
          <h1 className="mt-3 text-2xl font-bold tracking-tight text-foreground">
            Crear cuenta de aspirante
          </h1>
          <p className="mt-1 text-xs text-muted">
            Crea tu cuenta para postularte y consultar el estado de tu solicitud.
          </p>
        </div>

        {error && (
          <div className="rounded-[8px] border border-danger/30 bg-danger/10 p-3.5 text-xs font-medium text-danger flex items-center gap-2">
            <IconAlertTriangle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {notice ? (
          <div className="space-y-3" role="status">
            <p className="text-sm text-foreground">{notice}</p>
            <Link href="/login" className="text-sm font-semibold text-primary hover:underline">
              Ir a iniciar sesión
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-medium text-foreground mb-1.5">
                  Nombre(s)
                </label>
                <input
                  type="text"
                  required
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="Juan Carlos"
                  className="w-full rounded-[6px] border border-border bg-surface-muted/40 px-3.5 py-2.5 text-xs text-foreground placeholder:text-muted focus:border-primary focus:bg-surface focus:outline-none transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-foreground mb-1.5">
                  Apellido(s)
                </label>
                <input
                  type="text"
                  required
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="Pérez López"
                  className="w-full rounded-[6px] border border-border bg-surface-muted/40 px-3.5 py-2.5 text-xs text-foreground placeholder:text-muted focus:border-primary focus:bg-surface focus:outline-none transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-foreground mb-1.5">
                Teléfono / WhatsApp (Opcional)
              </label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="5512345678"
                className="w-full rounded-[6px] border border-border bg-surface-muted/40 px-3.5 py-2.5 text-xs text-foreground placeholder:text-muted focus:border-primary focus:bg-surface focus:outline-none transition-all"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-foreground mb-1.5">
                Correo Electrónico
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="tu.correo@ejemplo.com"
                className="w-full rounded-[6px] border border-border bg-surface-muted/40 px-3.5 py-2.5 text-xs text-foreground placeholder:text-muted focus:border-primary focus:bg-surface focus:outline-none transition-all"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-foreground mb-1.5">
                Contraseña
              </label>
              <input
                type="password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Mínimo 8 caracteres"
                className="w-full rounded-[6px] border border-border bg-surface-muted/40 px-3.5 py-2.5 text-xs text-foreground placeholder:text-muted focus:border-primary focus:bg-surface focus:outline-none transition-all"
              />
              <p className="mt-1 text-[11px] text-muted">
                Debe contener al menos 8 caracteres para proteger tu cuenta.
              </p>
            </div>

            <AuthCaptcha attempt={captchaAttempt} onToken={setCaptchaToken} />
            <button
              type="submit"
              disabled={loading || (captchaEnabled && !captchaToken)}
              className="w-full rounded-[6px] bg-primary-action py-2.5 text-xs font-semibold text-white shadow-minimal hover:bg-primary-action/90 transition-all disabled:cursor-not-allowed disabled:opacity-50 active:scale-[0.98]"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  <span>Registrando aspirante...</span>
                </span>
              ) : (
                'Solicitar registro'
              )}
            </button>
          </form>
        )}

        <div className="text-center text-xs text-muted">
          ¿Ya tienes cuenta en INICIA?{' '}
          <Link href="/login" className="font-semibold text-primary hover:underline">
            Inicia sesión aquí
          </Link>
        </div>
      </div>
    </div>
  );
}

```

### apps/web/src/app/restablecer-password/page.tsx

<!-- archivo: apps/web/src/app/restablecer-password/page.tsx -->
```tsx
// IINICIA Portal · portal Next.js · page.tsx
/** Completa la recuperación a partir del enlace por correo y solicita TOTP cuando la API lo exige. */
'use client';

import { useEffect, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { ApiError, authApi } from '@/lib/api';
import { clearRecoveryVerifier, readRecoveryVerifier } from '@/lib/recovery-pkce';
import type { LoginResponse } from '@/types';

type RecoveryProof = { token_hash: string } | { auth_code: string; code_verifier: string };

/** Interpreta la prueba de recuperación recibida, permite definir la contraseña y completa un segundo factor cuando la API lo solicita. */
export default function RestablecerPasswordPage() {
  const [proof, setProof] = useState<RecoveryProof | null>(null);
  const [missingVerifier, setMissingVerifier] = useState(false);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mfa, setMfa] = useState<Extract<LoginResponse, { step: 'verify' }> | null>(null);
  const [factorId, setFactorId] = useState('');
  const [code, setCode] = useState('');

  // Lee la prueba de recuperación de la URL y la prepara antes de mostrar el formulario.
  useEffect(() => {
    const timer = window.setTimeout(() => {
      const url = new URL(window.location.href);
      const fragment = new URLSearchParams(url.hash.slice(1));
      const code = url.searchParams.get('code');
      const tokenHash = fragment.get('token_hash');
      if (code) {
        const verifier = readRecoveryVerifier();
        if (verifier) setProof({ auth_code: code, code_verifier: verifier });
        else setMissingVerifier(true);
      } else if (fragment.get('type') === 'recovery' && tokenHash) {
        setProof({ token_hash: tokenHash });
      }
      // Una vez preparada en memoria, la prueba se elimina de la barra de direcciones y de la entrada activa del historial.
      if (url.search || url.hash) {
        window.history.replaceState(null, '', url.pathname);
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  // Envía la contraseña nueva dentro del flujo de recuperación, incluyendo el factor TOTP si quedó pendiente.
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!proof && !mfa) return;
    if (password !== confirm) { setError('Las contraseñas no coinciden.'); return; }
    setLoading(true);
    setError(null);
    try {
      if (mfa) {
        await authApi.verifyRecoveryMfa(mfa.mfa_token, factorId, code, password);
      } else if (proof) {
        const result = await authApi.resetPassword(proof, password);
        if ('code_verifier' in proof) clearRecoveryVerifier(proof.code_verifier);
        setProof(null);
        if ('step' in result) {
          setMfa(result);
          setFactorId(result.factors[0]?.id ?? '');
          return;
        }
      }
      setMfa(null);
      setCode('');
      setPassword('');
      setConfirm('');
      setDone(true);
    } catch (err: unknown) {
      if (mfa && err instanceof ApiError && (err.statusCode === 401 || err.statusCode === 403)) {
        setMfa(null);
        setPassword('');
        setConfirm('');
      }
      setCode('');
      setError(err instanceof Error ? err.message : 'No fue posible cambiar la contraseña.');
    } finally { setLoading(false); }
  };

  return (
    <div className="grid min-h-[70vh] place-items-center bg-aurora px-4 py-12 text-foreground">
      <div className="w-full max-w-md rounded-3xl border border-border bg-surface p-7 shadow-panel">
        <h1 className="text-2xl font-bold">Restablecer contraseña</h1>
        {done ? (
          <div className="mt-5 space-y-4 text-sm"><p>Tu contraseña se actualizó. Ya puedes iniciar sesión.</p><Link className="font-semibold text-primary underline" href="/login">Ir al inicio de sesión</Link></div>
        ) : mfa ? (
          <form onSubmit={submit} className="mt-5 space-y-4">
            <p className="text-sm">Ingresa el código de tu app autenticadora para guardar la nueva contraseña.</p>
            {mfa.factors.length > 1 && (
              <label className="block text-sm">Autenticador
                <select value={factorId} onChange={(e) => setFactorId(e.target.value)} disabled={loading} className="mt-1 w-full rounded-md border border-border bg-surface px-3 py-2">
                  {mfa.factors.map((factor, index) => (
                    <option key={factor.id} value={factor.id}>{factor.name || `Autenticador ${index + 1}`}</option>
                  ))}
                </select>
              </label>
            )}
            <label className="block text-sm">Código del autenticador
              <input type="text" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} className="mt-1 w-full rounded-md border border-border bg-surface px-3 py-2" />
            </label>
            {error && <p role="alert" className="text-sm text-danger">{error}</p>}
            <button disabled={loading || code.length !== 6 || !factorId} className="w-full rounded-md bg-primary-action px-4 py-2 font-semibold text-white disabled:opacity-50">{loading ? 'Verificando…' : 'Verificar y guardar contraseña'}</button>
            <Link className="text-sm font-semibold text-primary underline" href="/recuperar-password">Solicitar otro enlace</Link>
          </form>
        ) : proof ? (
          <form onSubmit={submit} className="mt-5 space-y-4">
            <label className="block text-sm">Nueva contraseña<input type="password" autoComplete="new-password" minLength={8} required value={password} onChange={(e) => setPassword(e.target.value)} className="mt-1 w-full rounded-md border border-border bg-surface px-3 py-2" /></label>
            <label className="block text-sm">Confirmar contraseña<input type="password" autoComplete="new-password" minLength={8} required value={confirm} onChange={(e) => setConfirm(e.target.value)} className="mt-1 w-full rounded-md border border-border bg-surface px-3 py-2" /></label>
            {error && <p role="alert" className="text-sm text-danger">{error}</p>}
            <button disabled={loading} className="w-full rounded-md bg-primary-action px-4 py-2 font-semibold text-white disabled:opacity-50">{loading ? 'Guardando...' : 'Guardar contraseña'}</button>
          </form>
        ) : (
          <p className="mt-5 text-sm text-muted">{missingVerifier ? 'Abre el enlace en el navegador donde pediste la recuperación.' : 'El enlace es inválido o ya caducó.'} <Link className="font-semibold text-primary underline" href="/recuperar-password">Solicita uno nuevo</Link>.</p>
        )}
      </div>
    </div>
  );
}

```

### apps/web/src/app/universidad/page.tsx

<!-- archivo: apps/web/src/app/universidad/page.tsx -->
```tsx
// IINICIA Portal · portal Next.js · page.tsx
/** Dirige a la sección institucional de la portada. */
import { redirect } from 'next/navigation';

/** Conserva la ruta pública de la universidad y dirige a la sección institucional de la portada. */
export default function UniversidadPage() {
  redirect('/#universidad');
}

```

## apps/web/src/components

Los componentes construyen formularios, navegación y paneles a partir de las respuestas del portal.

### apps/web/src/components/AuthCaptcha.tsx

<!-- archivo: apps/web/src/components/AuthCaptcha.tsx -->
```tsx
// IINICIA Portal · portal Next.js · AuthCaptcha.tsx
/** Monta Turnstile en el navegador y entrega al formulario un token vigente para cada intento. */
'use client';

import Script from 'next/script';
import { useEffect, useRef, useState } from 'react';

type Turnstile = {
  render: (container: HTMLElement, options: {
    sitekey: string;
    size: 'flexible';
    callback: (token: string) => void;
    'expired-callback': () => void;
    'error-callback': () => void;
  }) => string;
  remove: (id: string) => void;
};

// La clave pública habilita el widget. La API y Supabase Auth deciden qué solicitudes requieren un token válido.
const sitekey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim();
export const captchaEnabled = Boolean(sitekey);

/** Monta el desafío en el navegador, entrega el token al formulario y limpia la instancia al renovar el intento o desmontar el componente. */
export function AuthCaptcha({ attempt, onToken }: {
  attempt: number;
  onToken: (token: string | undefined) => void;
}) {
  const container = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [retry, setRetry] = useState(0);

  // Monta un desafío para el intento vigente y retira el widget anterior al desmontar el efecto.
  useEffect(() => {
    const provider = (window as Window & { turnstile?: Turnstile }).turnstile;
    if (!sitekey || !ready || !provider || !container.current) return;
    let active = true;
    const id = provider.render(container.current, {
      sitekey,
      size: 'flexible',
      callback: (token) => { if (active) onToken(token); },
      'expired-callback': () => { if (active) onToken(undefined); },
      'error-callback': () => {
        if (active) {
          onToken(undefined);
          setFailed(true);
        }
      },
    });
    return () => {
      active = false;
      provider.remove(id);
    };
  }, [attempt, ready, retry, onToken]);

  if (!sitekey) return null;
  return (
    <div>
      <Script
        src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
        onReady={() => setReady(true)}
        onError={() => setFailed(true)}
      />
      <div ref={container} />
      {failed && (
        <p role="status" className="text-sm text-muted">
          No se pudo cargar la verificación.{' '}
          {ready ? (
            <button type="button" className="underline" onClick={() => {
              setFailed(false);
              setRetry((value) => value + 1);
            }}>Reintentar</button>
          ) : 'Recarga la página para reintentar.'}
        </p>
      )}
    </div>
  );
}

```

### apps/web/src/components/BrandWordmark.tsx

<!-- archivo: apps/web/src/components/BrandWordmark.tsx -->
```tsx
// IINICIA Portal · portal Next.js · BrandWordmark.tsx
/** Dibuja la marca textual que se reutiliza en la navegación del portal. */
type BrandWordmarkProps = {
  className?: string;
};

/** Nombre institucional: una sola I, con el 2 en lugar del punto. */
export function BrandWordmark({ className = '' }: BrandWordmarkProps) {
  return (
    <span
      aria-label="INICIA"
      className={`inline-flex items-end whitespace-nowrap pt-[0.35em] font-extrabold leading-none tracking-[-0.055em] ${className}`}
    >
      <span aria-hidden="true" className="relative inline-block">
        I
        <span className="absolute -top-[0.72em] left-[0.08em] text-[0.42em] leading-none tracking-normal">
          2
        </span>
      </span>
      <span aria-hidden="true">NICIA</span>
    </span>
  );
}

```

### apps/web/src/components/ComingSoon.tsx

<!-- archivo: apps/web/src/components/ComingSoon.tsx -->
```tsx
// IINICIA Portal · portal Next.js · ComingSoon.tsx
/** Presenta un estado temporal para secciones que todavía no ofrecen una acción. */
import Link from "next/link";

type ComingSoonProps = {
  eyebrow: string;
  title: string;
  description: string;
};

/** Presenta el estado temporal de una sección pública que aún no ofrece su flujo completo. */
export function ComingSoon({ eyebrow, title, description }: ComingSoonProps) {
  return (
    <section className="relative overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 bg-aurora"
      />

      <div className="mx-auto flex max-w-4xl flex-col items-center px-6 py-28 text-center sm:py-32">
        <p className="text-[15px] font-semibold tracking-tight text-accent">
          {eyebrow}
        </p>

        <h1 className="mt-3 text-balance text-[40px] font-semibold leading-[1.05] tracking-[-0.03em] text-foreground sm:text-[64px]">
          {title}
        </h1>

        <p className="mx-auto mt-5 max-w-xl text-pretty text-[19px] leading-snug text-muted sm:text-[24px]">
          {description}
        </p>

        <div className="mt-12 w-full max-w-md rounded-[32px] glass p-10 shadow-apple ring-1 ring-border">
          <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-accent-soft text-accent">
            <svg
              width="26"
              height="26"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.7"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M9 3h6M10 3v5.5L5.5 17a2 2 0 0 0 1.8 3h9.4a2 2 0 0 0 1.8-3L14 8.5V3" />
              <path d="M7.5 14h9" />
            </svg>
          </span>
          <p className="mt-5 text-[21px] font-semibold tracking-tight text-foreground">
            Estamos trabajando para traerlo
          </p>
          <p className="mt-2 text-[15px] leading-relaxed text-muted">
            Estamos preparando esta sección con todo lo que necesitas. Vuelve
            pronto para descubrir las novedades de INICIA.
          </p>
        </div>

        <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row">
          <Link
            href="/"
            className="rounded-full bg-accent px-6 py-3 text-[17px] font-medium text-white transition-transform active:scale-[0.97] hover:bg-accent-strong"
          >
            Volver al inicio
          </Link>
          <Link
            href="/registro"
            className="inline-flex items-center gap-1 text-[17px] font-medium text-accent hover:underline"
          >
            Registrarme
            <svg
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M9 6l6 6-6 6" />
            </svg>
          </Link>
        </div>
      </div>
    </section>
  );
}
```

### apps/web/src/components/CoordinatorRequests.tsx

<!-- archivo: apps/web/src/components/CoordinatorRequests.tsx -->
```tsx
'use client';
// IINICIA Portal · portal Next.js · CoordinatorRequests.tsx

import { useEffect, useState } from 'react';
import { admissionsApi, enrollmentsApi } from '@/lib/api';
// El panel muestra las solicitudes que la API autorizó para el ámbito de la coordinación.
import type { AdmissionApplication, EnrollmentRequest } from '@/types';

const buttonClass = 'rounded-md border border-border px-3 py-1.5 text-sm hover:border-primary disabled:opacity-50';

type Props = { canReview: boolean; canAuthorize: boolean };

/** Carga por separado las postulaciones y solicitudes de matrícula. Después de una decisión vuelve a consultar sus estados. */
export function CoordinatorRequests({ canReview, canAuthorize }: Props) {
  const [admissions, setAdmissions] = useState<AdmissionApplication[]>([]);
  const [enrollments, setEnrollments] = useState<EnrollmentRequest[]>([]);
  const [admissionsError, setAdmissionsError] = useState(false);
  const [enrollmentsError, setEnrollmentsError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);

  // Admisiones y matrículas se consultan por separado. Un fallo de lectura conserva el resultado disponible de la otra lista.
  useEffect(() => {
    let current = true;
    void Promise.allSettled([
      canReview ? admissionsApi.getMyApplications() : Promise.resolve([]),
      canAuthorize ? enrollmentsApi.getMyEnrollments() : Promise.resolve([]),
    ]).then(([applications, requests]) => {
      if (!current) return;
      setAdmissionsError(applications.status === 'rejected');
      setEnrollmentsError(requests.status === 'rejected');
      setAdmissions(applications.status === 'fulfilled' ? applications.value : []);
      setEnrollments(requests.status === 'fulfilled' ? requests.value : []);
      setLoading(false);
    });
    return () => { current = false; };
  }, [canReview, canAuthorize, revision]);

  // Después de registrar una decisión, la revisión invalida las listas para volver a consultar su estado en el servidor.
  /** Controla el estado de escritura de una decisión de coordinación, publica el resultado y solicita actualizar las listas si tiene éxito. */
  async function run(action: () => Promise<string>) {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      setNotice(await action());
      setLoading(true);
      setRevision((value) => value + 1);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'No fue posible guardar el cambio.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section id="solicitudes" className="scroll-mt-20 space-y-4 rounded-xl border border-border bg-surface p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">Solicitudes académicas</h2>
        <button type="button" className={buttonClass} disabled={busy || loading} onClick={() => {
          setLoading(true);
          setRevision((value) => value + 1);
        }}>Actualizar</button>
      </div>
      {notice && <p role="status" className="text-sm">{notice}</p>}
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
      {loading && <p role="status" className="text-sm text-muted">Cargando solicitudes…</p>}
      {canReview && (
        <div>
          <h3 className="mb-2 font-medium">Postulaciones</h3>
          {admissionsError ? <p className="text-sm text-danger">No se pudieron cargar las postulaciones.</p> :
            !loading && admissions.length === 0 && <p className="text-sm text-muted">Sin postulaciones en tus programas.</p>}
          <ul className="divide-y divide-border">
            {admissions.map((item) => (
              <li key={item.id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm">
                <div>
                  <p className="font-medium">{item.profiles?.first_name} {item.profiles?.last_name} · {item.programs?.name || 'Programa'}</p>
                  <p className="text-muted">{item.profiles?.email} · {item.status.replaceAll('_', ' ')}</p>
                </div>
                {(item.status === 'postulado' || item.status === 'en_revision') && (
                  <div className="flex gap-2">
                    {(['admitido', 'rechazado'] as const).map((status) => (
                      <button key={status} type="button" className={buttonClass} disabled={busy || loading} onClick={() => void run(async () => {
                        const result = await admissionsApi.reviewApplication(item.id, status, item.reviewer_notes ?? undefined);
                        if (result.enrollment_summary?.state === 'incomplete') return 'Dictamen guardado. Hay matrículas pendientes de sincronizar con Moodle.';
                        return 'Dictamen guardado.';
                      })}>{status === 'admitido' ? 'Admitir' : 'Rechazar'}</button>
                    ))}
                  </div>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
      {canAuthorize && (
        <div>
          <h3 className="mb-2 font-medium">Matrículas</h3>
          {enrollmentsError ? <p className="text-sm text-danger">No se pudieron cargar las matrículas.</p> :
            !loading && enrollments.length === 0 && <p className="text-sm text-muted">Sin matrículas en tus programas.</p>}
          <ul className="divide-y divide-border">
            {enrollments.map((item) => (
              <li key={item.id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm">
                <div>
                  <p className="font-medium">{item.profiles?.first_name} {item.profiles?.last_name} · {item.course_mappings?.course_name || 'Curso'}</p>
                  <p className="text-muted">{item.profiles?.email} · {item.status.replaceAll('_', ' ')}</p>
                </div>
                {item.status === 'pendiente' && item.course_mappings && (
                  <div className="flex gap-2">
                    {(['autorizada', 'rechazada'] as const).map((status) => (
                      <button key={status} type="button" className={buttonClass} disabled={busy || loading} onClick={() => void run(async () => {
                        const result = await enrollmentsApi.authorizeEnrollment(item.id, { status, sync_to_moodle: status === 'autorizada' });
                        return result.enrollment?.status === 'error_sincronizacion'
                          ? 'Matrícula autorizada. Moodle no confirmó la sincronización.'
                          : 'Decisión de matrícula guardada.';
                      })}>{status === 'autorizada' ? 'Autorizar' : 'Rechazar'}</button>
                    ))}
                  </div>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

```

### apps/web/src/components/PortalHelpChat.tsx

<!-- archivo: apps/web/src/components/PortalHelpChat.tsx -->
```tsx
'use client';
// IINICIA Portal · portal Next.js · PortalHelpChat.tsx

import Link from 'next/link';
// El diálogo conserva los turnos en memoria para dar contexto a la siguiente pregunta.
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { IconClose, IconHelp } from '@/components/campus-tech/Icons';
import { askPortalHelp, helpTopics, type HelpAnswer } from '@/lib/portal-help';

const maximumLength = 300;

type Turn = {
  question: string;
  answer: HelpAnswer;
};

/** Abre el diálogo de ayuda y conserva el historial en memoria. Las preguntas recientes se envían como contexto y las respuestas se presentan en el mismo diálogo. */
export function PortalHelpChat() {
  const dialog = useRef<HTMLDialogElement>(null);
  const log = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const [question, setQuestion] = useState('');
  const [turns, setTurns] = useState<Turn[]>([]);
  const [pendingQuestion, setPendingQuestion] = useState<string | null>(null);

  useEffect(() => {
    if (log.current) log.current.scrollTop = log.current.scrollHeight;
  }, [turns, pendingQuestion]);

  // Una pregunta pendiente bloquea otro envío mientras la respuesta incorpora el contexto reciente.
  const ask = async (message: string) => {
    const cleaned = message.trim();
    if (!cleaned || pendingQuestion) return;
    setPendingQuestion(cleaned);
    let answer: HelpAnswer;
    try {
      answer = await askPortalHelp(cleaned, turns.slice(-3).map((turn) => turn.question));
    } catch (error) {
      answer = {
        text: error instanceof Error && !(error instanceof TypeError)
          ? error.message
          : 'No se pudo conectar con el asistente de IA.',
        action: { href: '/#contacto', label: 'Abrir Contacto' },
      };
    }
    setTurns((current) => [...current, { question: cleaned, answer }]);
    setPendingQuestion(null);
  };

  // El formulario devuelve el foco al campo para que se pueda enviar otra consulta con el teclado.
  const send = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!question.trim() || pendingQuestion) return;
    void ask(question);
    setQuestion('');
    input.current?.focus();
  };

  return (
    <>
      <button
        type="button"
        aria-haspopup="dialog"
        aria-controls="iinicia-help-chat"
        onClick={() => dialog.current?.showModal()}
        className="fixed end-4 bottom-[max(1rem,env(safe-area-inset-bottom))] z-40 flex min-h-12 items-center gap-2 rounded-full bg-primary-action px-4 text-sm font-semibold text-white shadow-soft hover:bg-accent-strong focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-primary sm:end-6 sm:bottom-6"
      >
        <span aria-hidden="true"><IconHelp className="size-5" /></span>
        Ayuda IINICIA
      </button>

      <dialog
        ref={dialog}
        id="iinicia-help-chat"
        aria-labelledby="iinicia-help-title"
        aria-describedby="iinicia-help-description"
        className="fixed inset-auto end-3 bottom-[max(.75rem,env(safe-area-inset-bottom))] m-0 h-[min(38rem,calc(100dvh-1.5rem))] max-h-none w-[min(26rem,calc(100vw-1.5rem))] max-w-none overflow-hidden rounded-3xl border border-border bg-surface p-0 text-foreground shadow-xl backdrop:bg-black/35 sm:end-6 sm:bottom-6 sm:max-h-[calc(100dvh-3rem)]"
      >
        <div className="flex h-full min-h-0 flex-col">
          <header className="flex shrink-0 items-center justify-between gap-3 border-b border-border bg-accent-soft px-4 py-2.5">
            <div>
              <h2 id="iinicia-help-title" className="text-base font-semibold">Ayuda IINICIA</h2>
              <p id="iinicia-help-description" className="text-xs text-muted">Asistente de IA sobre el portal</p>
            </div>
            <button
              type="button"
              aria-label="Cerrar chat de ayuda"
              onClick={() => dialog.current?.close()}
              className="grid size-11 shrink-0 place-items-center rounded-full border border-border bg-surface text-primary hover:bg-surface-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              <span aria-hidden="true"><IconClose className="size-5" /></span>
            </button>
          </header>

          <div ref={log} className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain px-4 py-4">
            <div className="space-y-3">
              <p className="max-w-[95%] rounded-2xl rounded-ss-sm bg-surface-muted p-3 text-sm leading-relaxed">
                Hola. ¿Necesitas ayuda con tu cuenta, una postulación o el aula virtual?
              </p>
              <div className="flex flex-wrap gap-2" role="group" aria-label="Preguntas sugeridas">
                {helpTopics.map((suggestion) => (
                  <button
                    key={suggestion}
                    type="button"
                    onClick={() => void ask(suggestion)}
                    disabled={pendingQuestion !== null}
                    className="min-h-11 rounded-xl border border-border px-3 py-1.5 text-start text-sm font-medium text-primary hover:bg-accent-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:opacity-60"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>

            <div role="log" aria-label="Conversación de ayuda" aria-relevant="additions" className="space-y-4">
              {turns.map(({ question: asked, answer }, index) => (
                <div key={index} className="flex flex-col gap-2">
                  <p className="max-w-[90%] self-end rounded-2xl rounded-se-sm bg-accent-soft px-3 py-2 text-sm wrap-anywhere">
                    <span className="sr-only">Tú: </span>{asked}
                  </p>
                  <div className="max-w-[95%] self-start rounded-2xl rounded-ss-sm bg-surface-muted p-3 text-sm leading-relaxed">
                    <p className="whitespace-pre-line wrap-anywhere"><span className="sr-only">Ayuda IINICIA: </span>{answer.text}</p>
                    {answer.sources?.length ? <p className="mt-3 text-xs font-semibold text-muted">Referencias del portal</p> : null}
                    <ul className="mt-1">
                      {(answer.sources?.length ? answer.sources : [answer.action]).map((link) => (
                        <li key={link.href}>
                          <Link
                            href={link.href}
                            prefetch={false}
                            onClick={() => dialog.current?.close()}
                            className="inline-flex min-h-11 items-center gap-2 font-semibold text-primary underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                          >
                            {link.label} <span aria-hidden="true">→</span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              ))}
              {pendingQuestion && (
                <div className="flex flex-col gap-2">
                  <p className="max-w-[90%] self-end rounded-2xl rounded-se-sm bg-accent-soft px-3 py-2 text-sm wrap-anywhere">{pendingQuestion}</p>
                  <p className="px-1 text-sm text-muted">Buscando en la guía de IINICIA…</p>
                </div>
              )}
            </div>
          </div>

          <form onSubmit={send} className="shrink-0 space-y-2 border-t border-border px-4 py-3">
            <div className="flex items-stretch gap-2">
              <label htmlFor="iinicia-help-question" className="sr-only">Escribe tu pregunta</label>
              <input
                ref={input}
                id="iinicia-help-question"
                value={question}
                maxLength={maximumLength}
                autoComplete="off"
                aria-describedby="iinicia-help-input-hint"
                onChange={(event) => setQuestion(event.target.value)}
                placeholder="Escribe tu pregunta"
                className="min-h-11 min-w-0 flex-1 rounded-xl border border-primary/55 bg-background px-3 text-base placeholder:text-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              />
              <button
                type="submit"
                disabled={!question.trim() || pendingQuestion !== null}
                className="min-h-11 shrink-0 rounded-xl bg-primary-action px-3 text-sm font-semibold text-white hover:bg-accent-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:opacity-50"
              >
                Enviar
              </button>
            </div>
            <p id="iinicia-help-input-hint" className="text-xs text-muted">Tus preguntas se envían a DeepSeek. Evita incluir datos personales, contraseñas o códigos.</p>
          </form>
        </div>
      </dialog>
    </>
  );
}

```

### apps/web/src/components/RoleWorkspace.tsx

<!-- archivo: apps/web/src/components/RoleWorkspace.tsx -->
```tsx
// IINICIA Portal · portal Next.js · RoleWorkspace.tsx
/** Comparte el espacio de coordinación y soporte, con datos y opciones ajustados al rol. */
'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { coursesApi, moodleApi, usersApi } from '@/lib/api';
import type { CourseOffering, RoleSlug, UserProfile, UserStatus } from '@/types';
import { CoordinatorRequests } from './CoordinatorRequests';
import { CampusShell } from '@/components/campus-tech/CampusShell';
import type { SidebarSection } from '@/components/campus-tech/CampusSidebar';
import { IconDashboard, IconGroups, IconSettings } from '@/components/campus-tech/Icons';

type Props = { role: Extract<RoleSlug, 'coordinador' | 'soporte'> };

const roleLabels: Record<string, string> = {
  superadministrador: 'Superadministrador',
  administrador: 'Administrador',
  coordinador: 'Coordinador',
  profesor: 'Profesor',
  estudiante: 'Estudiante',
  aspirante: 'Aspirante',
  soporte: 'Soporte',
};

const statusLabels: Record<UserStatus, string> = {
  activo: 'Activo',
  inactivo: 'Inactivo',
  suspendido: 'Suspendido',
  pendiente: 'Pendiente',
  baja: 'Baja',
};

/** Comparte la estructura de soporte y coordinación. Deriva las consultas y las acciones visibles de la sesión y del rol del panel. */
export function RoleWorkspace({ role }: Props) {
  const router = useRouter();
  const { user, loading, hasPermission } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [courses, setCourses] = useState<CourseOffering[]>([]);
  const [coursesError, setCoursesError] = useState<string | null>(null);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [usersError, setUsersError] = useState<string | null>(null);
  const [hasMoreUsers, setHasMoreUsers] = useState(false);
  const [moodleStatus, setMoodleStatus] = useState<{ ok: boolean; message: string } | null>(null);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const isCoordinator = role === 'coordinador';
  const title = isCoordinator ? 'Coordinación académica' : 'Soporte';
  // Los permisos de la sesión determinan qué consultas y acciones ofrece el panel. La API aplica el alcance a los resultados.
  const canReadUsers = hasPermission('users.read');
  const canReview = isCoordinator && hasPermission('admissions.review');
  const canAuthorize = isCoordinator && hasPermission('enrollments.authorize');
  const userPrograms = profile?.programs ?? [];

  useEffect(() => {
    if (loading) return;
    if (!user) { router.replace('/login'); return; }
    if (!user.roles.includes(role) && !user.roles.includes('superadministrador')) {
      router.replace('/dashboard');
      return;
    }

    usersApi.getUserById(user.id).then(setProfile).catch(() => setProfile(null));

    if (isCoordinator) {
      coursesApi.getCatalog()
        .then(setCourses)
        .catch(() => setCoursesError('No fue posible cargar el catálogo de cursos.'));
    } else {
      moodleApi.getStatus().then(setMoodleStatus).catch(() => setMoodleStatus({ ok: false, message: 'No fue posible consultar Moodle.' }));
    }
  }, [loading, user, role, isCoordinator, router]);

  useEffect(() => {
    if (loading || !user || !canReadUsers || (!user.roles.includes(role) && !user.roles.includes('superadministrador'))) return;
    let current = true;
    const timer = setTimeout(() => void usersApi.getUsers({
      search: search.trim() || undefined,
      role: roleFilter || undefined,
      status: statusFilter || undefined,
      limit: 50,
    })
      .then((result) => {
        if (!current) return;
        setUsers(result.data);
        setHasMoreUsers(Boolean(result.meta?.hasMore));
        setUsersError(null);
      })
      .catch(() => {
        if (current) setUsersError('No fue posible consultar el directorio autorizado para tu cuenta.');
      }), 250);
    return () => { current = false; clearTimeout(timer); };
  }, [loading, user, role, canReadUsers, search, roleFilter, statusFilter]);

  // Prepara los cursos de la vista de coordinación a partir de las adscripciones del perfil.
  // En coordinación, el panel agrupa la oferta accesible según los programas del perfil.
  const scopedCourses = useMemo(() => {
    if (!isCoordinator || userPrograms.length === 0) return [];
    const programIds = new Set(userPrograms.map((program) => program.program_id));
    return courses.filter((course) => course.program_id && programIds.has(course.program_id));
  }, [courses, isCoordinator, userPrograms]);

  if (loading || !user || (!user.roles.includes(role) && !user.roles.includes('superadministrador'))) {
    return <div className="grid min-h-[60vh] place-items-center text-sm text-muted">Verificando acceso…</div>;
  }

  const directoryId = isCoordinator ? 'usuarios' : 'directorio';
  const sections: SidebarSection[] = [{
    title,
    items: [
      { id: 'resumen', label: 'Resumen', icon: <IconDashboard className="h-4 w-4" /> },
      ...(isCoordinator ? [
        { id: 'programas', label: 'Mis programas', icon: <IconGroups className="h-4 w-4" /> },
        { id: 'cursos', label: 'Cursos asignados', icon: <IconGroups className="h-4 w-4" /> },
        ...(canReview || canAuthorize ? [{ id: 'solicitudes', label: 'Solicitudes académicas', icon: <IconGroups className="h-4 w-4" /> }] : []),
      ] : [
        { id: 'moodle', label: 'Estado de Moodle', icon: <IconDashboard className="h-4 w-4" /> },
      ]),
      ...(canReadUsers ? [{ id: directoryId, label: isCoordinator ? 'Usuarios del ámbito' : 'Directorio y cuentas', icon: <IconGroups className="h-4 w-4" /> }] : []),
      { id: 'perfil', label: 'Mi perfil', icon: <IconSettings className="h-4 w-4" /> },
    ],
  }];

  const directorySection = (
    <section id={directoryId} className="scroll-mt-20 rounded-xl border border-border bg-surface p-5 shadow-minimal sm:p-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-primary">{isCoordinator ? 'Consulta académica' : 'Atención de cuentas'}</p>
        <h2 className="mt-1 text-lg font-semibold text-foreground">{isCoordinator ? 'Usuarios del ámbito autorizado' : 'Directorio y estado de cuenta'}</h2>
        <p className="mt-1 text-sm text-muted">La API determina qué registros puede consultar tu cuenta. Esta vista no asigna roles ni cambia estados.</p>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_12rem_12rem]">
        <label className="text-xs font-medium text-muted">Buscar usuario
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Nombre o correo" className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground" />
        </label>
        <label className="text-xs font-medium text-muted">Rol
          <select value={roleFilter} onChange={(event) => setRoleFilter(event.target.value)} className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground">
            <option value="">Todos</option>
            <option value="estudiante">Estudiante</option>
            <option value="profesor">Profesor</option>
            <option value="aspirante">Aspirante</option>
            <option value="coordinador">Coordinador</option>
          </select>
        </label>
        <label className="text-xs font-medium text-muted">Estado
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground">
            <option value="">Todos</option>
            {Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
      </div>
      {usersError ? <p className="mt-4 text-sm text-danger">{usersError}</p> : (
        <div className="mt-4 overflow-x-auto rounded-lg border border-border">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="bg-surface-muted text-xs uppercase text-muted"><tr><th className="px-3 py-3">Usuario</th><th className="px-3 py-3">Rol</th><th className="px-3 py-3">Programa</th><th className="px-3 py-3">Estado</th><th className="px-3 py-3">Moodle</th><th className="px-3 py-3">Alta</th></tr></thead>
            <tbody className="divide-y divide-border">
              {users.map((person) => (
                <tr key={person.id} className="align-top">
                  <td className="px-3 py-3"><span className="font-medium text-foreground">{person.first_name} {person.last_name}</span><span className="block text-xs text-muted">{person.email}</span></td>
                  <td className="px-3 py-3 text-foreground">{(person.active_roles || person.roles).map((item) => roleLabels[item] || item).join(', ') || 'Sin rol'}</td>
                  <td className="px-3 py-3 text-foreground">{person.programs?.map((program) => program.name).join(', ') || 'Sin programa'}</td>
                  <td className="px-3 py-3"><span className="rounded-full bg-surface-muted px-2 py-1 text-xs text-foreground">{statusLabels[person.status] || person.status}</span></td>
                  <td className="px-3 py-3"><span className={`rounded-full px-2 py-1 text-xs ${person.moodle_sync_status === 'sincronizado' ? 'bg-success/10 text-success' : 'bg-warning/10 text-warning'}`}>{person.moodle_sync_status || 'No vinculado'}</span>{person.moodle_last_sync_at && <span className="mt-1 block text-[11px] text-muted">{new Date(person.moodle_last_sync_at).toLocaleDateString('es-MX')}</span>}</td>
                  <td className="px-3 py-3 text-muted">{person.created_at ? new Date(person.created_at).toLocaleDateString('es-MX') : '—'}</td>
                </tr>
              ))}
              {users.length === 0 && <tr><td colSpan={6} className="px-3 py-8 text-center text-sm text-muted">No se encontraron usuarios para esos filtros.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
      {hasMoreUsers && <p className="mt-3 text-xs text-muted">Se muestran los primeros 50 resultados. Refina la búsqueda para encontrar otra cuenta.</p>}
    </section>
  );

  return (
    <CampusShell
      searchItems={scopedCourses.map((course) => ({ id: course.id, title: course.name || course.course_name || '', detail: course.code, section: 'Cursos' }))} currentTab="resumen" onSelectTab={(tab) => document.getElementById(tab)?.scrollIntoView({ behavior: 'smooth' })} breadcrumbs={['INICIA', title]} customSections={sections}>
      <div className="mx-auto max-w-6xl space-y-6">
        <header id="resumen" className="campus-heading scroll-mt-20">
          <p className="text-xs font-semibold uppercase tracking-wide text-primary">Panel de {title.toLowerCase()}</p>
          <h1 className="mt-2 text-2xl font-bold text-foreground">Hola, {user.first_name}</h1>
          <p className="mt-2 max-w-3xl text-sm text-muted">{isCoordinator ? 'Consulta los programas, cursos y usuarios que la API habilita para tu cuenta.' : 'Revisa la vinculación de cuentas y el estado del campus con las herramientas de consulta disponibles para soporte.'}</p>
        </header>

        {isCoordinator ? (
          <>
            <section id="programas" className="scroll-mt-20 rounded-xl border border-border bg-surface p-5 shadow-minimal sm:p-6">
              <h2 className="text-lg font-semibold text-foreground">Programas asociados a tu perfil</h2>
              {userPrograms.length ? <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{userPrograms.map((program) => <article key={program.program_id} className="rounded-lg border border-border bg-surface-muted/30 p-4"><p className="font-mono text-xs text-primary">{program.code} · {program.academic_status}</p><h3 className="mt-2 font-semibold text-foreground">{program.name}</h3><p className="mt-1 text-xs text-muted">Cohorte: {program.cohort || 'No especificada'}</p></article>)}</div> : <p className="mt-3 rounded-lg bg-surface-muted/40 p-4 text-sm text-muted">Tu perfil no contiene asociaciones a programas. Solicita al administrador que revise la asignación de ámbito.</p>}
            </section>

            <section id="cursos" className="scroll-mt-20 rounded-xl border border-border bg-surface p-5 shadow-minimal sm:p-6">
              <h2 className="text-lg font-semibold text-foreground">Cursos vinculados a tus programas</h2>
              {coursesError ? <p className="mt-3 text-sm text-danger">{coursesError}</p> : scopedCourses.length ? <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{scopedCourses.map((course) => <li key={course.course_mapping_id} className="rounded-lg border border-border bg-surface-muted/30 p-4"><p className="font-mono text-xs text-primary">{course.code}</p><p className="mt-1 font-medium text-foreground">{course.name}</p><p className="mt-1 text-xs text-muted">{course.program_name} · Moodle #{course.moodle_course_id}</p></li>)}</ul> : <p className="mt-3 rounded-lg bg-surface-muted/40 p-4 text-sm text-muted">No hay cursos visibles dentro de los programas asociados a tu perfil.</p>}
            </section>
          </>
        ) : (
          <section id="moodle" className="scroll-mt-20 rounded-xl border border-border bg-surface p-5 shadow-minimal sm:p-6">
            <p className="text-xs font-semibold uppercase tracking-wide text-primary">Integración del campus</p>
            <h2 className="mt-1 text-lg font-semibold text-foreground">Estado de Moodle</h2>
            <div className="mt-4 flex flex-wrap items-center gap-3 rounded-lg bg-surface-muted/40 p-4">
              <span className={`h-3 w-3 rounded-full ${moodleStatus?.ok ? 'bg-success' : 'bg-danger'}`} />
              <span className="font-medium text-foreground">{moodleStatus ? (moodleStatus.ok ? 'Conectado' : 'No disponible') : 'Consultando…'}</span>
              {moodleStatus?.message && <span className="text-sm text-muted">{moodleStatus.message}</span>}
            </div>
          </section>
        )}

        {(canReview || canAuthorize) && <CoordinatorRequests key={user.id} canReview={canReview} canAuthorize={canAuthorize} />}
        {canReadUsers ? directorySection : <section className="rounded-xl border border-border bg-surface p-5"><h2 className="font-semibold text-foreground">Directorio no habilitado</h2><p className="mt-2 text-sm text-muted">Tu cuenta no tiene el permiso `users.read`; el portal no consultará ni mostrará datos de otros usuarios.</p></section>}

        <section id="perfil" className="scroll-mt-20 rounded-xl border border-border bg-surface p-5 shadow-minimal sm:p-6">
          <h2 className="text-lg font-semibold text-foreground">Mi perfil</h2>
          <dl className="mt-4 grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
            <div><dt className="text-muted">Nombre</dt><dd className="font-medium text-foreground">{user.first_name} {user.last_name}</dd></div>
            <div><dt className="text-muted">Correo</dt><dd className="font-medium text-foreground">{user.email}</dd></div>
            <div><dt className="text-muted">Estado</dt><dd className="font-medium capitalize text-foreground">{statusLabels[user.status] || user.status}</dd></div>
            <div><dt className="text-muted">Programas asociados</dt><dd className="font-medium text-foreground">{userPrograms.map((program) => program.name).join(', ') || 'Sin programa'}</dd></div>
          </dl>
        </section>
      </div>
    </CampusShell>
  );
}

```

### apps/web/src/components/ScrollRevealText.tsx

<!-- archivo: apps/web/src/components/ScrollRevealText.tsx -->
```tsx
// IINICIA Portal · portal Next.js · ScrollRevealText.tsx
/** Aplica una transición de lectura al entrar en la zona visible de la página. */
"use client";

import { useEffect, useRef, type ElementType, type ReactNode } from "react";

type ScrollRevealTextProps = {
  children: ReactNode;
  /** Element used to render the text. Defaults to <span>. */
  as?: ElementType;
  /** Extra classes (typography, color, alignment…). */
  className?: string;
  /**
   * Progress (0..1) into this element's on-screen life at which the text
   * is fully revealed. 0.5 = fully solid when the element is halfway
   * through the viewport. Defaults to 0.6.
   */
  completeAt?: number;
};

/** Organiza un texto que se revela al llegar a su sección y contempla la preferencia de movimiento reducido. */
export function ScrollRevealText({
  children,
  as: Tag = "span",
  className = "",
  completeAt = 0.6,
}: ScrollRevealTextProps) {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    if (reduced) {
      el.style.setProperty("--reveal", "100%");
      return;
    }

    let raf = 0;

    const update = () => {
      raf = 0;
      const rect = el.getBoundingClientRect();
      const vh = window.innerHeight || 1;

      // 0 when the element top hits the bottom of the viewport,
      // 1 when the element bottom leaves the top of the viewport.
      const span = rect.height + vh;
      const scrolled = vh - rect.top;
      const raw = Math.min(1, Math.max(0, scrolled / span));

      const scaled = Math.min(1, raw / Math.max(completeAt, 0.01));
      el.style.setProperty("--reveal", `${(scaled * 100).toFixed(2)}%`);
    };

    const onScroll = () => {
      if (raf) return;
      raf = window.requestAnimationFrame(update);
    };

    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });

    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (raf) window.cancelAnimationFrame(raf);
    };
  }, [completeAt]);

  return (
    <Tag ref={ref} className={`scroll-reveal-text ${className}`}>
      {children}
    </Tag>
  );
}
```

### apps/web/src/components/SiteFooter.tsx

<!-- archivo: apps/web/src/components/SiteFooter.tsx -->
```tsx
// IINICIA Portal · portal Next.js · SiteFooter.tsx
/** Agrupa la navegación secundaria del portal y los enlaces institucionales. */
"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";

const linkGroups = [
  {
    title: "Programas",
    links: [
      { label: "Cursos", href: "/#cursos", id: "cursos" },
      { label: "Certificaciones", href: "/#certificaciones", id: "certificaciones" },
    ],
  },
  {
    title: "Admisiones",
    links: [
      { label: "Proceso de admisión", href: "/#admisiones", id: "admisiones" },
      { label: "Registro de aspirante", href: "/registro" },
    ],
  },
  {
    title: "Institución y Campus",
    links: [
      { label: "Universidad INICIA", href: "/#universidad", id: "universidad" },
      { label: "Canales de contacto", href: "/#contacto", id: "contacto" },
      { label: "Portal de Alumnos", href: "/dashboard/estudiante" },
      { label: "Portal de Docentes", href: "/dashboard/docente" },
    ],
  },
];

/** Mantiene enlaces institucionales y aplica la navegación a las secciones de la portada según la ubicación actual. */
export function SiteFooter() {
  const pathname = usePathname();
  const isHome = pathname === "/";

  // Las anclas se desplazan dentro de la portada cuando ya estamos en ella. En otras páginas, el enlace lleva a la portada y su sección.
  const handleLinkClick = (e: React.MouseEvent<HTMLAnchorElement>, href: string, id?: string) => {
    if (isHome && id) {
      e.preventDefault();
      const el = document.getElementById(id);
      if (el) {
        el.scrollIntoView({ behavior: "smooth" });
        window.history.pushState(null, "", href);
      }
    }
  };

  return (
    <footer className="mt-20 border-t border-border bg-surface/50">
      <div className="mx-auto max-w-6xl px-6 py-16">
        <div className="grid gap-12 sm:grid-cols-2 lg:grid-cols-[1.5fr_1fr_1fr_1fr]">
          <div>
            <div className="flex items-center gap-2">
              <span className="grid h-20 w-20 shrink-0 place-items-center rounded-xl bg-welcome-panel p-2 shadow-minimal ring-1 ring-primary/20">
                <Image
                  src="/inicia-nav-wordmark.png"
                  alt="Logotipo INICIA: Instituto de Innovación y Ciencias Aplicadas"
                  width={1563}
                  height={1563}
                  className="h-full w-full object-contain"
                />
              </span>
            </div>
            <p className="mt-2.5 max-w-xs text-[13px] leading-relaxed text-muted">
              Instituto de Innovación y Ciencias Aplicadas. Formación universitaria y continua en línea con integración transparente al Campus Virtual Moodle LMS.
            </p>
            <div className="mt-4 flex items-center gap-2 text-xs font-mono text-muted">
              <span className="h-2 w-2 rounded-full bg-accent-sky" />
              <span>Campus Virtual Activo • Ciclo 2026</span>
            </div>
          </div>

          {linkGroups.map((group) => (
            <div key={group.title}>
              <p className="text-[12px] font-semibold uppercase tracking-wide text-muted">
                {group.title}
              </p>
              <ul className="mt-4 space-y-3">
                {group.links.map((link) => (
                  <li key={link.href + link.label}>
                    <Link
                      href={link.href}
                      onClick={(e) => handleLinkClick(e, link.href, link.id)}
                      className="hover-underline text-[13px] text-foreground/80 hover:text-primary transition-colors"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-14 flex flex-col gap-2 border-t border-border pt-6 text-[12px] text-muted sm:flex-row sm:items-center sm:justify-between">
          <p>
            © 2026 Instituto de Innovación y Ciencias Aplicadas. Todos los derechos reservados.
          </p>
        </div>
      </div>
    </footer>
  );
}

```

### apps/web/src/components/SiteHeader.tsx

<!-- archivo: apps/web/src/components/SiteHeader.tsx -->
```tsx
// IINICIA Portal · portal Next.js · SiteHeader.tsx
/** Coordina la navegación pública, la búsqueda, el tema y los accesos de sesión. */
"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { IconSun, IconMoon } from "@/components/campus-tech/Icons";

const navItems = [
  { label: "Inicio", href: "/#inicio", id: "inicio" },
  { label: "Cursos", href: "/#cursos", id: "cursos" },
  { label: "Universidad", href: "/#universidad", id: "universidad" },
  { label: "Certificaciones", href: "/#certificaciones", id: "certificaciones" },
  { label: "Admisiones", href: "/#admisiones", id: "admisiones" },
  { label: "Contacto", href: "/#contacto", id: "contacto" },
];

/** Ofrece navegación pública y contexto de sesión en las variantes de escritorio y móvil. */
export function SiteHeader() {
  const [open, setOpen] = useState(false);
  const [activeSection, setActiveSection] = useState<string>("inicio");
  const [isScrolled, setIsScrolled] = useState(false);
  const pathname = usePathname();
  const { user, logout, getDefaultDashboardPath } = useAuth();
  const { theme, toggleTheme } = useTheme();

  const isHome = pathname === "/";
  const dashboardPath = user ? getDefaultDashboardPath() : "/login";
  const primaryRole =
    user?.roles?.find((r) => r === "superadministrador") ||
    user?.roles?.find((r) => r === "administrador") ||
    user?.roles?.find((r) => r === "coordinador") ||
    user?.roles?.find((r) => r === "profesor") ||
    user?.roles?.find((r) => r === "estudiante") ||
    user?.roles?.[0] ||
    "aspirante";

  // Intersection observer & scroll detection according to Apple HIG Functional Layer
  useEffect(() => {
    const handleScroll = () => {
      const scrollY = window.scrollY;
      setIsScrolled(scrollY > 16);

      if (!isHome) return;

      const sectionIds = navItems.map((item) => item.id);
      const offset = 120;

      for (let i = sectionIds.length - 1; i >= 0; i--) {
        const section = document.getElementById(sectionIds[i]);
        if (section) {
          if (section.getBoundingClientRect().top <= offset) {
            setActiveSection(sectionIds[i]);
            break;
          }
        }
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener("scroll", handleScroll);
  }, [isHome]);

  // Cierra menú móvil al cambiar de tamaño a desktop
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 1024) {
        setOpen(false);
      }
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const handleNavClick = (e: React.MouseEvent<HTMLAnchorElement>, id: string) => {
    if (isHome) {
      e.preventDefault();
      setOpen(false);
      const element = document.getElementById(id);
      if (element) {
        // Offset suave para compensar la barra de navegación flotante
        const yOffset = -76;
        const y = element.getBoundingClientRect().top + window.scrollY + yOffset;
        window.scrollTo({ top: y, behavior: "smooth" });
        window.history.pushState(null, "", `/#${id}`);
        setActiveSection(id);
      }
    } else {
      setOpen(false);
    }
  };

  return (
    <>
      {/* Backdrop para cerrar menú móvil con clic afuera */}
      {open && (
        <div
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-40 bg-black/25 dark:bg-black/60 backdrop-blur-xs lg:hidden transition-opacity"
          aria-hidden="true"
        />
      )}

      <header className="sticky top-0 z-50 transition-all duration-300 px-3 sm:px-6 pt-2 pb-1.5 pointer-events-none">
        <nav
          className={`mx-auto flex h-14 max-w-6xl items-center justify-between gap-2.5 sm:gap-3 px-3.5 sm:px-5 pointer-events-auto rounded-2xl transition-all duration-300 ${
            isScrolled
              ? "bg-surface/85 backdrop-blur-xl border border-border/80 shadow-[0_8px_30px_rgb(0,0,0,0.06)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.35)]"
              : isHome
                ? "bg-surface/95 backdrop-blur-md border border-border/60 shadow-sm"
                : "bg-surface/50 backdrop-blur-md border border-border/40 shadow-none"
          }`}
        >
          {/* Brand / Logo */}
          <Link
            href="/#inicio"
            onClick={(e) => handleNavClick(e, "inicio")}
            className="group flex items-center gap-2.5 shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 rounded-xl"
          >
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-welcome-panel p-1.5 shadow-sm ring-1 ring-white/15 transition-transform duration-200 group-hover:scale-[1.03] active:scale-[0.98]">
              <Image
                src="/inicia-nav-wordmark.png"
                alt="Logotipo INICIA"
                width={1563}
                height={1563}
                priority
                className="h-full w-full object-contain"
              />
            </span>
            <div className="hidden sm:flex flex-col">
              <span className="text-xs font-bold tracking-tight text-foreground group-hover:text-primary transition-colors">
                IINICIA
              </span>
              <span className="text-[10px] text-muted tracking-tight font-medium">
                Campus Digital
              </span>
            </div>
          </Link>

          {/* Desktop Navigation - Pill Segmented Capsule (Apple HIG Tab / Segmented Bar) */}
          <div className="hidden items-center p-1 rounded-full bg-surface-muted/60 dark:bg-surface-muted/40 border border-border/60 backdrop-blur-md lg:flex shadow-inner">
            <ul className="flex items-center gap-0.5">
              {navItems.map((item) => {
                const isActive = isHome && activeSection === item.id;
                return (
                  <li key={item.id}>
                    <Link
                      href={item.href}
                      onClick={(e) => handleNavClick(e, item.id)}
                      className={`relative px-2.5 xl:px-3 py-1.5 text-[12px] xl:text-[12.5px] tracking-tight font-medium transition-all duration-200 rounded-full flex items-center justify-center ${
                        isActive
                          ? "text-primary dark:text-foreground font-semibold bg-surface shadow-xs ring-1 ring-border/80 dark:bg-surface-elevated"
                          : "text-foreground/75 hover:text-foreground hover:bg-surface/50 active:scale-[0.97]"
                      }`}
                    >
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>

          {/* Right Actions / Profile / Theme Switcher */}
          <div className="hidden items-center gap-2 lg:flex shrink-0">
            {/* Theme switcher */}
            <button
              type="button"
              onClick={toggleTheme}
              className="h-9 w-9 rounded-full border border-border/60 bg-surface/60 hover:bg-surface text-foreground flex items-center justify-center transition-all duration-200 shadow-sm active:scale-95"
              title={theme === "dark" ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
            >
              {theme === "dark" ? (
                <IconSun className="w-4 h-4 text-accent-sky" />
              ) : (
                <IconMoon className="w-4 h-4 text-primary" />
              )}
            </button>

            {user ? (
              <div className="flex items-center gap-2">
                <Link
                  href={dashboardPath}
                  className="flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 hover:bg-primary/20 px-3.5 py-1.5 text-xs font-semibold text-primary transition-all duration-200 shadow-sm active:scale-95"
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-accent-sky animate-pulse" />
                  <span className="capitalize">{primaryRole}</span>
                </Link>
                <button
                  type="button"
                  onClick={logout}
                  className="text-xs font-medium text-muted hover:text-danger px-2 py-1.5 transition-colors rounded-lg"
                >
                  Salir
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-1.5">
                <Link
                  href="/login"
                  className="text-xs font-medium text-foreground/80 hover:text-foreground transition-colors px-3 py-1.5 rounded-full hover:bg-surface/50"
                >
                  Iniciar sesión
                </Link>
                <Link
                  href="/registro"
                  className="rounded-full bg-primary-action px-4 py-1.5 text-xs font-semibold text-white transition-all duration-200 hover:opacity-95 hover:shadow-md active:scale-95 shadow-sm"
                >
                  Registrarse
                </Link>
              </div>
            )}
          </div>

          {/* Mobile controls */}
          <div className="flex items-center gap-2 lg:hidden">
            <button
              type="button"
              onClick={toggleTheme}
              className="h-8 w-8 rounded-full border border-border/60 bg-surface/70 text-foreground flex items-center justify-center shadow-sm"
              title="Cambiar tema"
            >
              {theme === "dark" ? (
                <IconSun className="w-4 h-4 text-accent-sky" />
              ) : (
                <IconMoon className="w-4 h-4 text-primary" />
              )}
            </button>
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              aria-label="Abrir menú"
              aria-expanded={open}
              className="grid h-8 w-8 place-items-center rounded-full border border-border/60 bg-surface/70 text-foreground hover:bg-surface shadow-sm active:scale-95"
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              >
                {open ? (
                  <path d="M6 6l12 12M18 6L6 18" />
                ) : (
                  <path d="M4 7h16M4 12h16M4 17h16" />
                )}
              </svg>
            </button>
          </div>
        </nav>

        {/* El menú se abre sobre la página para que no cambie la posición de las secciones. */}
        {open && (
          <div className="absolute inset-x-3 top-full z-50 mt-2 max-h-[calc(100dvh-5rem)] overflow-y-auto rounded-2xl border border-border/80 bg-surface/95 backdrop-blur-2xl p-4 shadow-xl pointer-events-auto sm:inset-x-6 lg:hidden">
            <ul className="flex flex-col gap-1">
              {navItems.map((item) => {
                const isActive = isHome && activeSection === item.id;
                return (
                  <li key={item.id}>
                    <Link
                      href={item.href}
                      onClick={(e) => handleNavClick(e, item.id)}
                      className={`block px-3.5 py-2 text-sm font-medium rounded-xl transition-all ${
                        isActive
                          ? "text-primary font-semibold bg-primary/10"
                          : "text-foreground/80 hover:text-foreground hover:bg-surface-muted/60"
                      }`}
                    >
                      {item.label}
                    </Link>
                  </li>
                );
              })}
              <li className="mt-2 flex flex-col gap-2 border-t border-border/60 pt-3">
                {user ? (
                  <>
                    <Link
                      href={dashboardPath}
                      onClick={() => setOpen(false)}
                      className="rounded-xl bg-primary-action px-4 py-2 text-center text-xs font-semibold text-white shadow-sm"
                    >
                      Ir al Panel ({primaryRole})
                    </Link>
                    <button
                      type="button"
                      onClick={() => {
                        setOpen(false);
                        logout();
                      }}
                      className="rounded-xl border border-danger/30 px-4 py-2 text-center text-xs font-medium text-danger hover:bg-danger/10"
                    >
                      Cerrar sesión
                    </button>
                  </>
                ) : (
                  <>
                    <Link
                      href="/login"
                      onClick={() => setOpen(false)}
                      className="rounded-xl border border-border px-4 py-2 text-center text-xs font-medium text-foreground"
                    >
                      Iniciar sesión
                    </Link>
                    <Link
                      href="/registro"
                      onClick={() => setOpen(false)}
                      className="rounded-xl bg-primary-action px-4 py-2 text-center text-xs font-semibold text-white shadow-sm"
                    >
                      Registrarse
                    </Link>
                  </>
                )}
              </li>
            </ul>
          </div>
        )}
      </header>
    </>
  );
}

```

### apps/web/src/components/campus-tech/CampusSearch.tsx

<!-- archivo: apps/web/src/components/campus-tech/CampusSearch.tsx -->
```tsx
// IINICIA Portal · interfaz del campus · CampusSearch.tsx
/** Filtra las acciones del panel suministradas por la vista y permite saltar a la pestaña elegida. */
'use client';

import { useEffect, useRef, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { usersApi } from '@/lib/api';

export interface CampusSearchItem {
  id: string;
  title: string;
  detail?: string;
  section: string;
  tab?: string;
}

/** Permite encontrar y elegir destinos de la lista de navegación que proporciona el panel. */
export function CampusSearch({ open, onClose, items, onSelectTab }: {
  open: boolean;
  onClose: () => void;
  items: CampusSearchItem[];
  onSelectTab: (tab: string) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const { hasPermission } = useAuth();
  // La consulta de usuarios solo se habilita en la interfaz para sesiones con el permiso correspondiente.
  const canReadUsers = hasPermission('users.read');
  const [query, setQuery] = useState('');
  const [users, setUsers] = useState<CampusSearchItem[]>([]);
  const [status, setStatus] = useState('');
  useEffect(() => {
    if (open) dialog.current?.showModal();
    else dialog.current?.close();
  }, [open]);
  useEffect(() => {
    if (!open || !canReadUsers || !query.trim()) return;
    let current = true;
    const timer = setTimeout(() => {
      setStatus('Buscando usuarios…');
      setUsers([]);
      usersApi.getUsers({ search: query.trim(), limit: 20 }).then((result) => {
        if (!current) return;
        setUsers(result.data.map((person) => ({
          id: person.id, title: [person.first_name, person.last_name].join(' '),
          detail: person.email + ' · ' + person.status, section: 'Usuarios',
        })));
        setStatus(result.meta?.hasMore ? 'Hay más usuarios. Escribe un nombre o correo más específico.' : '');
      }).catch(() => { if (current) setStatus('No fue posible buscar usuarios. Cambia la consulta para reintentar.'); });
    }, 300);
    return () => { current = false; clearTimeout(timer); };
  }, [query, open, canReadUsers]);
  // Compara términos sin distinguir mayúsculas ni acentos.
  const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const words = normalize(query).trim().split(/\s+/);
  const matches = query.trim() ? items.filter((item) => words.every((word) =>
    normalize([item.title, item.detail, item.id].join(' ')).includes(word))) : [];
  const results = [...matches, ...(query.trim() ? users : [])];
  return (
    <dialog ref={dialog} onCancel={onClose} onClose={onClose} aria-labelledby="campus-search-title"
      className="m-auto w-[min(95vw,42rem)] rounded-3xl border border-border bg-surface p-5 text-foreground shadow-xl backdrop:bg-black/50">
      <div className="flex items-center justify-between gap-4">
        <h2 id="campus-search-title" className="font-semibold">Buscar en mi panel</h2>
        <button type="button" onClick={onClose} className="min-h-10 rounded-full border border-border px-4 text-sm text-primary hover:bg-accent-soft">Cerrar</button>
      </div>
      <label className="mt-4 block text-sm">Nombre, correo, programa o código
        <input autoFocus type="search" value={query} onChange={(event) => {
          setQuery(event.target.value); setUsers([]); setStatus('');
        }} className="mt-2 w-full rounded-xl border border-border bg-surface-muted p-3" />
      </label>
      <p className="mt-2 text-xs text-muted">Cursos y solicitudes cargados en tu panel{canReadUsers ? ', y usuarios consultados en el directorio autorizado' : ''}.</p>
      <div aria-live="polite" className="mt-3 text-sm">{status}</div>
      <div className="mt-3 max-h-[55vh] overflow-y-auto">
        {!query.trim() ? <p>Escribe para buscar.</p> : results.length === 0 && !status ? <p>Sin coincidencias.</p> : null}
        <ul className="space-y-2">
          {results.slice(0, 50).map((item) => (
            <li key={item.section + item.id} className="rounded border border-border p-3">
              <p className="text-xs text-muted">{item.section}</p>
              <p className="font-medium">{item.title}</p>
              <p className="break-words text-sm text-muted">{item.detail}</p>
              {item.tab && <button type="button" onClick={() => { onSelectTab(item.tab!); onClose(); }}
                className="mt-2 text-sm text-primary underline">Ver sección</button>}
            </li>
          ))}
        </ul>
        {results.length > 50 && <p className="mt-2 text-sm">Mostrando 50 coincidencias. Afina tu búsqueda.</p>}
      </div>
    </dialog>
  );
}

```

### apps/web/src/components/campus-tech/CampusShell.tsx

<!-- archivo: apps/web/src/components/campus-tech/CampusShell.tsx -->
```tsx
// IINICIA Portal · interfaz del campus · CampusShell.tsx
/** Organiza los paneles del campus alrededor de una barra superior y un menú adaptable. */
'use client';

import React, { useState, useEffect } from 'react';
import { CampusTopBar } from './CampusTopBar';
import { CampusSidebar, type SidebarSection } from './CampusSidebar';
import { CampusSearch, type CampusSearchItem } from './CampusSearch';

interface CampusShellProps {
  searchItems?: CampusSearchItem[];
  currentTab: string;
  onSelectTab: (tabId: string) => void;
  breadcrumbs?: string[];
  counts?: {
    users?: number;
    courses?: number;
    enrollments?: number;
    programs?: number;
    audit?: number;
  };
  onLaunchCampusSSO?: () => void;
  customSections?: SidebarSection[];
  children: React.ReactNode;
}

/** Reúne la barra lateral, cabecera y contenido de un panel con la estructura común del campus. */
export function CampusShell({
  searchItems = [],
  currentTab,
  onSelectTab,
  breadcrumbs = ['INICIA', 'Control Maestro'],
  counts,
  onLaunchCampusSSO,
  customSections,
  children,
}: CampusShellProps) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  const [searchOpen, setSearchOpen] = useState(false);
  useEffect(() => {
    const shortcut = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener('keydown', shortcut);
    return () => window.removeEventListener('keydown', shortcut);
  }, []);

  return (
    <div className="campus-backdrop min-h-screen bg-background text-foreground flex flex-col font-sans transition-colors duration-150">
      {/* TopBar with Global Search, Theme Switch */}
      <CampusTopBar
        breadcrumbs={breadcrumbs}
        onOpenNavigation={() => setMobileSidebarOpen(true)}
        navigationOpen={mobileSidebarOpen}
        onOpenSearch={() => setSearchOpen(true)}
        onLaunchMoodleSSO={onLaunchCampusSSO}
      />

      <CampusSearch open={searchOpen} onClose={() => setSearchOpen(false)} items={searchItems} onSelectTab={onSelectTab} />
      <div className="mx-auto flex w-full max-w-[112rem] flex-1 items-start gap-4 lg:px-4 lg:pt-3">
        {/* Persistent Collapsible Sidebar */}
        <CampusSidebar
          currentTab={currentTab}
          onSelectTab={onSelectTab}
          collapsed={sidebarCollapsed}
          onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
          mobileOpen={mobileSidebarOpen}
          onCloseMobile={() => setMobileSidebarOpen(false)}
          counts={counts}
          onLaunchCampusSSO={onLaunchCampusSSO}
          customSections={customSections}
        />

        <div className="mx-auto w-full min-w-0 flex-1 p-4 sm:p-6 lg:pt-0">
          {children}
        </div>
      </div>
    </div>
  );
}

```

### apps/web/src/components/campus-tech/CampusSidebar.tsx

<!-- archivo: apps/web/src/components/campus-tech/CampusSidebar.tsx -->
```tsx
// IINICIA Portal · interfaz del campus · CampusSidebar.tsx
/** Renderiza secciones y opciones del menú lateral según la configuración del panel. */
'use client';

import React from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import {
  IconDashboard,
  IconStudents,
  IconTeachers,
  IconGroups,
  IconSchedule,
  IconAttendance,
  IconGrades,
  IconReports,
  IconAnnouncements,
  IconSettings,
  IconMoodle,
  IconAudit,
  IconMenu,
  IconClose,
  IconChevronLeft,
  IconChevronRight,
} from './Icons';

export interface SidebarItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  badge?: number | string;
  href?: string;
  onClick?: () => void;
}

export interface SidebarSection {
  title: string;
  items: SidebarItem[];
}

interface CampusSidebarProps {
  currentTab: string;
  onSelectTab: (tabId: string) => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
  counts?: {
    users?: number;
    courses?: number;
    enrollments?: number;
    programs?: number;
    audit?: number;
  };
  onLaunchCampusSSO?: () => void;
  customSections?: SidebarSection[];
}

/** Organiza secciones y destinos de navegación para el rol actual. Admite menús específicos suministrados por un panel. */
export function CampusSidebar({
  currentTab,
  onSelectTab,
  collapsed,
  onToggleCollapse,
  mobileOpen,
  onCloseMobile,
  counts = {},
  onLaunchCampusSSO,
  customSections,
}: CampusSidebarProps) {
  const { user, logout } = useAuth();
  const router = useRouter();

  // El menú reconoce los nombres históricos de los roles para mantener la navegación de las cuentas existentes.
  const userRoles = (user?.roles || []) as string[];
  const isSuperOrAdmin = userRoles.some((r) =>
    ['superadministrador', 'superadmin', 'administrador', 'admin', 'coordinador', 'coordinator'].includes(r)
  );
  const isTeacher = !isSuperOrAdmin && userRoles.some((r) => ['profesor', 'teacher', 'docente'].includes(r));
  const isStudent = !isSuperOrAdmin && userRoles.some((r) => ['estudiante', 'student', 'alumno'].includes(r));
  const isApplicant = !isSuperOrAdmin && !isStudent && userRoles.some((r) => ['aspirante', 'applicant'].includes(r));

  const defaultRoleSections: SidebarSection[] = isTeacher
    ? [
        {
          title: 'Docencia',
          items: [
            {
              id: 'materias',
              label: 'Mis Asignaturas',
              icon: <IconGroups className="w-4 h-4 shrink-0" />,
              badge: counts.courses,
            },
            {
              id: 'estudiantes',
              label: 'Alumnos y Grupos',
              icon: <IconStudents className="w-4 h-4 shrink-0" />,
            },
            {
              id: 'calificaciones',
              label: 'Actas y Evaluaciones',
              icon: <IconGrades className="w-4 h-4 shrink-0" />,
            },
          ],
        },
        {
          title: 'Plataforma',
          items: [
            {
              id: 'moodle',
              label: 'Aula Virtual Moodle',
              icon: <IconMoodle className="w-4 h-4 shrink-0" />,
              onClick: onLaunchCampusSSO,
            },
            {
              id: 'perfil',
              label: 'Perfil y Credenciales',
              icon: <IconSettings className="w-4 h-4 shrink-0" />,
            },
          ],
        },
      ]
    : isStudent
    ? [
        {
          title: 'Mi Aula',
          items: [
            {
              id: 'cursos',
              label: 'Materias Activas',
              icon: <IconGroups className="w-4 h-4 shrink-0" />,
              href: '/dashboard/estudiante',
              badge: counts.courses,
            },
            {
              id: 'inscripciones',
              label: 'Catálogo e Inscripción',
              icon: <IconStudents className="w-4 h-4 shrink-0" />,
            },
            {
              id: 'calificaciones',
              label: 'Kárdex y Avance',
              icon: <IconGrades className="w-4 h-4 shrink-0" />,
            },
          ],
        },
        {
          title: 'Campus Virtual',
          items: [
            {
              id: 'moodle',
              label: 'Aula Virtual Moodle',
              icon: <IconMoodle className="w-4 h-4 shrink-0" />,
              onClick: onLaunchCampusSSO,
            },
            {
              id: 'perfil',
              label: 'Expediente y Perfil',
              icon: <IconSettings className="w-4 h-4 shrink-0" />,
            },
          ],
        },
      ]
    : isApplicant
    ? [
        {
          title: 'Admisiones',
          items: [
            {
              id: 'ofertas',
              label: 'Oferta Académica',
              icon: <IconGroups className="w-4 h-4 shrink-0" />,
              href: '/dashboard/aspirante',
            },
            {
              id: 'solicitudes',
              label: 'Mis Trámites',
              icon: <IconAttendance className="w-4 h-4 shrink-0" />,
              badge: counts.enrollments,
            },
          ],
        },
      ]
    : [
        {
          title: 'Academia & Operación',
          items: [
            {
              id: 'asignaciones',
              label: 'Asignaciones & Cursos',
              icon: <IconDashboard className="w-4 h-4 shrink-0" />,
              badge: counts.users,
            },
            {
              id: 'usuarios',
              label: 'Directorio Estudiantes',
              icon: <IconStudents className="w-4 h-4 shrink-0" />,
              badge: counts.users,
            },
            {
              id: 'docentes',
              label: 'Cuerpo Docente',
              icon: <IconTeachers className="w-4 h-4 shrink-0" />,
            },
            {
              id: 'cursos',
              label: 'Grupos y Asignaturas',
              icon: <IconGroups className="w-4 h-4 shrink-0" />,
              badge: counts.courses,
            },
            {
              id: 'matriculas',
              label: 'Solicitudes y Matrículas',
              icon: <IconAttendance className="w-4 h-4 shrink-0" />,
              badge: counts.enrollments,
            },
            {
              id: 'admisiones',
              label: 'Postulaciones',
              icon: <IconAttendance className="w-4 h-4 shrink-0" />,
            },
            {
              id: 'programas',
              label: 'Programas Académicos',
              icon: <IconGrades className="w-4 h-4 shrink-0" />,
              badge: counts.programs,
            },
          ],
        },
        {
          title: 'Sistemas & Gestión',
          items: [
            {
              id: 'moodle',
              label: 'Integración Moodle LMS',
              icon: <IconMoodle className="w-4 h-4 shrink-0" />,
            },
            {
              id: 'auditoria',
              label: 'Bitácora & Reportes',
              icon: <IconAudit className="w-4 h-4 shrink-0" />,
              badge: counts.audit,
            },
            ...(userRoles.includes('superadministrador') ? [{
              id: 'configuracion',
              label: 'Configuración OS',
              icon: <IconSettings className="w-4 h-4 shrink-0" />,
            }] : []),
          ],
        },
      ];

  // Un panel puede proporcionar su propio menú. Los demás usan la estructura predeterminada de su rol.
  const navigationSections = customSections || defaultRoleSections;

  const renderNavList = () => (
    <div className="space-y-4 py-2">
      {navigationSections.map((sec, secIdx) => (
        <div key={secIdx} className="space-y-1">
          {!collapsed && (
            <p className="px-3 text-[10px] font-semibold uppercase tracking-wider text-muted/70">
              {sec.title}
            </p>
          )}
          {sec.items.map((item) => {
            const isActive = currentTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  if (item.href) router.push(item.href);
                  else if (item.onClick) item.onClick();
                  else onSelectTab(item.id);
                  onCloseMobile();
                }}
                className={`relative flex min-h-10 w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-accent-soft text-primary font-semibold ring-1 ring-primary/20'
                    : 'text-foreground/80 hover:bg-surface-muted hover:text-foreground'
                } ${collapsed ? 'justify-center px-0' : ''}`}
                title={item.label}
              >
                {/* Active Indicator Accent Line */}
                {isActive && (
                  <span className="absolute start-0 top-1/2 h-4 w-0.5 -translate-y-1/2 rounded-e bg-primary" />
                )}
                <span>{item.icon}</span>
                {!collapsed && (
                  <>
                    <span className="truncate flex-1">{item.label}</span>
                    {item.badge !== undefined && item.badge !== 0 && (
                      <span
                        className={`rounded-[4px] px-1.5 py-0.5 text-[10px] font-mono font-semibold ${
                          isActive
                            ? 'bg-surface text-primary'
                            : 'bg-surface-muted text-muted'
                        }`}
                      >
                        {item.badge}
                      </span>
                    )}
                  </>
                )}
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );

  return (
    <>
      {/* DESKTOP SIDEBAR */}
      <aside
        className={`sticky top-[8.625rem] z-30 hidden h-[calc(100dvh-9.375rem)] shrink-0 flex-col rounded-2xl border border-border bg-surface shadow-panel transition-[width] duration-200 lg:flex ${
          collapsed ? 'w-16' : 'w-64'
        }`}
      >
        {/* Sidebar Header Brand */}
        <div className={`flex h-14 shrink-0 items-center justify-between gap-1 border-b border-border ${collapsed ? 'px-1.5' : 'px-2.5'}`}>
          {!collapsed ? (
            <div className="flex items-center gap-2 min-w-0">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[7px] bg-welcome-panel p-1 shadow-minimal ring-1 ring-primary/20">
                <Image
                  src="/inicia-nav-wordmark.png"
                  alt="Logotipo INICIA: Instituto de Innovación y Ciencias Aplicadas"
                  width={1563}
                  height={1563}
                  className="h-full w-full object-contain"
                />
              </span>
              <div className="min-w-0 leading-none">
                <span className="text-xs font-semibold text-foreground">
                  Portal Académico
                </span>
              </div>
            </div>
          ) : (
            <div className="grid size-6 shrink-0 place-items-center rounded-lg bg-primary-action text-accent-sky">
              <span className="relative pt-1 text-[16px] font-black leading-none">I<sup className="absolute -top-1 left-0 text-[8px]">2</sup></span>
            </div>
          )}

          <button
            type="button"
            onClick={onToggleCollapse}
            className="grid size-5 shrink-0 place-items-center rounded-lg border border-border bg-surface-muted text-primary transition-colors hover:bg-accent-soft"
            title={collapsed ? 'Expandir menú lateral' : 'Colapsar menú lateral'}
          >
            {collapsed ? (
              <IconChevronRight className="w-3.5 h-3.5" />
            ) : (
              <IconChevronLeft className="w-3.5 h-3.5" />
            )}
          </button>
        </div>

        {/* Navigation list */}
        <div className="flex-1 overflow-y-auto px-2 pt-2">
          {renderNavList()}
        </div>

        {/* Sidebar Footer User & SSO shortcut */}
        <div className="border-t border-border p-2.5 shrink-0 space-y-2">
          {!collapsed && onLaunchCampusSSO && (
            <button
              type="button"
              onClick={onLaunchCampusSSO}
              className="w-full flex items-center justify-center gap-1.5 rounded-[6px] border border-primary/30 bg-primary/5 hover:bg-primary/10 text-primary px-3 py-1.5 text-xs font-semibold transition-all"
            >
              <IconMoodle className="w-3.5 h-3.5" />
              <span>Campus Virtual SSO</span>
            </button>
          )}

          <div
            className={`flex items-center justify-between rounded-[6px] border border-border/80 bg-surface-muted/40 p-2 ${
              collapsed ? 'justify-center p-1' : ''
            }`}
          >
            {!collapsed ? (
              <>
                <div className="flex items-center gap-2 min-w-0">
                  <div className="h-6 w-6 rounded-[4px] bg-primary/15 text-primary text-[11px] font-bold flex items-center justify-center shrink-0">
                    {(user?.first_name || 'U')[0]}
                  </div>
                  <div className="truncate text-[11px] leading-tight">
                    <p className="font-semibold text-foreground truncate">
                      {user?.first_name} {user?.last_name}
                    </p>
                    <p className="text-[10px] text-muted truncate">{user?.email}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={logout}
                  className="text-xs text-muted hover:text-danger p-1"
                  title="Cerrar sesión"
                >
                  <IconClose className="w-3.5 h-3.5" />
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={logout}
                className="h-6 w-6 text-muted hover:text-danger text-xs flex items-center justify-center"
                title="Cerrar sesión"
              >
                <IconClose className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </aside>

      {/* MOBILE DRAWER */}
      {mobileOpen && (
        <div className="fixed inset-0 z-[60] lg:hidden">
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-xs transition-opacity"
            onClick={onCloseMobile}
          />
          <aside aria-label="Navegación del campus" className="fixed inset-y-2 left-2 z-50 flex w-[min(18rem,calc(100vw-1rem))] flex-col justify-between overflow-y-auto rounded-2xl border border-border bg-surface p-4 shadow-2xl">
            <div className="space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-border">
                <div className="flex items-center gap-2">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[7px] bg-welcome-panel p-1 shadow-minimal ring-1 ring-primary/20">
                    <Image
                      src="/inicia-nav-wordmark.png"
                      alt="Logotipo INICIA: Instituto de Innovación y Ciencias Aplicadas"
                      width={1563}
                      height={1563}
                      className="h-full w-full object-contain"
                    />
                  </span>
                  <span className="text-xs font-medium text-muted">Portal Académico</span>
                </div>
                <button
                  type="button"
                  onClick={onCloseMobile}
                  aria-label="Cerrar menú del campus"
                  className="grid size-10 place-items-center rounded-full border border-border text-primary hover:bg-accent-soft"
                >
                  <IconClose className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="overflow-y-auto max-h-[70vh]">
                {renderNavList()}
              </div>
            </div>

            <div className="pt-3 border-t border-border">
              {onLaunchCampusSSO && (
                <button
                  type="button"
                  onClick={() => {
                    onCloseMobile();
                    onLaunchCampusSSO();
                  }}
                  className="w-full flex items-center justify-center gap-1.5 rounded-[6px] bg-primary-action text-white px-3 py-2 text-xs font-semibold mb-2"
                >
                  <IconMoodle className="w-4 h-4 text-accent-sky" />
                  <span>Entrar al Aula Moodle SSO</span>
                </button>
              )}
              <button
                type="button"
                onClick={logout}
                className="w-full rounded-[6px] border border-border bg-surface-muted text-foreground px-3 py-1.5 text-xs font-medium"
              >
                Cerrar Sesión
              </button>
            </div>
          </aside>
        </div>
      )}
    </>
  );
}

```

### apps/web/src/components/campus-tech/CampusTopBar.tsx

<!-- archivo: apps/web/src/components/campus-tech/CampusTopBar.tsx -->
```tsx
// IINICIA Portal · interfaz del campus · CampusTopBar.tsx
/** Muestra el encabezado de la sesión, los controles de tema y el acceso a la búsqueda. */
'use client';

import React from 'react';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import {
  IconSearch,
  IconSun,
  IconMoon,
  IconMenu,
  IconMoodle,
} from './Icons';

interface CampusTopBarProps {
  breadcrumbs?: string[];
  onOpenSearch?: () => void;
  onOpenNavigation: () => void;
  navigationOpen: boolean;
  onLaunchMoodleSSO?: () => void;
}

/** Muestra el contexto del panel, la cuenta y las acciones de navegación, búsqueda o cambio de tema que corresponden a la vista. */
export function CampusTopBar({
  breadcrumbs = ['INICIA', 'Panel de Control'],
  onOpenSearch,
  onOpenNavigation,
  navigationOpen,
  onLaunchMoodleSSO,
}: CampusTopBarProps) {
  // La barra reúne el aspecto de la interfaz y los datos de sesión compartidos con el resto del panel.
  const { theme, toggleTheme } = useTheme();
  const { user } = useAuth();

  return (
    <header className="sticky top-[4.375rem] z-40 flex h-14 w-full items-center justify-between gap-2 border-b border-border bg-surface/95 px-3 backdrop-blur-md transition-colors sm:gap-4 sm:px-6">
      {/* Context Breadcrumbs */}
      <div className="flex min-w-0 items-center gap-2 text-xs font-medium">
        <button
          type="button"
          onClick={onOpenNavigation}
          aria-label="Abrir menú del campus"
          aria-expanded={navigationOpen}
          className="grid size-10 shrink-0 place-items-center rounded-full border border-border bg-surface-muted text-primary lg:hidden"
        >
          <IconMenu className="size-4" />
        </button>
        <div className="flex items-center gap-1.5 shrink-0">
          <span className="h-2 w-2 rounded-sm bg-accent-sky ring-2 ring-primary/20" />
          <span className="font-semibold tracking-tight text-foreground">
            {breadcrumbs[0]}
          </span>
        </div>
        {breadcrumbs.slice(1).map((crumb, idx) => (
          <React.Fragment key={idx}>
            <span className="text-muted/60">/</span>
            <span className="text-muted truncate hover:text-foreground transition-colors cursor-default">
              {crumb}
            </span>
          </React.Fragment>
        ))}
      </div>

      {/* Global Actions */}
      <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
        {/* Search Input Bar Shortcut */}
        <button
          type="button"
          onClick={onOpenSearch}
          aria-label="Buscar en mi panel"
          className="flex h-10 min-w-10 items-center justify-center gap-2.5 rounded-full border border-border bg-surface-muted/60 text-xs text-primary transition-colors hover:border-primary/50 sm:px-3"
        >
          <IconSearch className="w-3.5 h-3.5 text-muted" />
          <span className="hidden sm:inline">Buscar en mi panel</span>
          <kbd className="hidden rounded border border-border bg-surface px-1.5 py-0.5 font-mono text-[10px] text-muted lg:inline">
            Ctrl/⌘ K
          </kbd>
        </button>

        {/* Moodle Quick SSO Action */}
        {onLaunchMoodleSSO && (
          <button
            type="button"
            onClick={onLaunchMoodleSSO}
            aria-label="Abrir aula Moodle"
            className="flex h-10 min-w-10 items-center justify-center gap-1.5 rounded-full bg-primary-action text-xs font-semibold text-white shadow-minimal transition-colors hover:bg-accent-strong sm:px-3"
            title="Abrir Moodle LMS con sesión iniciada (auth_userkey)"
          >
            <IconMoodle className="w-3.5 h-3.5 text-accent-sky" />
            <span className="hidden sm:inline">Aula Moodle</span>
          </button>
        )}

        {/* Theme Switcher Button */}
        <button
          type="button"
          onClick={toggleTheme}
          className="grid size-10 place-items-center rounded-full border border-border bg-surface text-foreground transition-colors hover:bg-surface-muted"
          title={theme === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
          aria-label="Alternar tema"
        >
          {theme === 'dark' ? (
            <IconSun className="w-4 h-4 text-warning" />
          ) : (
            <IconMoon className="w-4 h-4 text-primary" />
          )}
        </button>

        {/* User Avatar Chip */}
        {user && (
          <div className="hidden items-center gap-2 border-l border-border pl-2 sm:flex">
            <div className="h-7 w-7 rounded-[6px] bg-primary/10 border border-primary/20 flex items-center justify-center font-semibold text-primary text-xs">
              {(user.first_name || 'U')[0]}
            </div>
            <div className="hidden lg:block text-left text-xs leading-none">
              <p className="font-semibold text-foreground truncate max-w-[110px]">
                {user.first_name} {user.last_name}
              </p>
              <p className="text-[10px] text-muted capitalize mt-0.5">
                {user.roles?.[0] || 'Usuario'}
              </p>
            </div>
          </div>
        )}
      </div>
    </header>
  );
}

```

### apps/web/src/components/campus-tech/Icons.tsx

<!-- archivo: apps/web/src/components/campus-tech/Icons.tsx -->
```tsx
// IINICIA Portal · interfaz del campus · Icons.tsx
/** Define los SVG reutilizados por la navegación y los estados de los paneles. */
import React from 'react';

interface IconProps {
  className?: string;
  size?: number;
}

/** Representa panel general con el tamaño y el estilo que el panel indica para este icono. */
export function IconDashboard({ className = 'w-4 h-4', size = 16 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <rect width="7" height="9" x="3" y="3" rx="1.5" />
      <rect width="7" height="5" x="14" y="3" rx="1.5" />
      <rect width="7" height="9" x="14" y="12" rx="1.5" />
      <rect width="7" height="5" x="3" y="16" rx="1.5" />
    </svg>
  );
}

/** Representa estudiantes con el tamaño y el estilo que el panel indica para este icono. */
export function IconStudents({ className = 'w-4 h-4', size = 16 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

/** Representa docentes con el tamaño y el estilo que el panel indica para este icono. */
export function IconTeachers({ className = 'w-4 h-4', size = 16 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M2 3h20" />
      <path d="M21 3v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V3" />
      <path d="m7 21 5-5 5 5" />
    </svg>
  );
}

/** Representa grupos académicos con el tamaño y el estilo que el panel indica para este icono. */
export function IconGroups({ className = 'w-4 h-4', size = 16 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-2.5-2.5Z" />
      <path d="M6 6h10" />
      <path d="M6 10h10" />
    </svg>
  );
}

/** Representa horarios con el tamaño y el estilo que el panel indica para este icono. */
export function IconSchedule({ className = 'w-4 h-4', size = 16 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <rect width="18" height="18" x="3" y="4" rx="2" />
      <line x1="16" x2="16" y1="2" y2="6" />
      <line x1="8" x2="8" y1="2" y2="6" />
      <line x1="3" x2="21" y1="10" y2="10" />
      <path d="m9 16 2 2 4-4" />
    </svg>
  );
}

/** Representa asistencia con el tamaño y el estilo que el panel indica para este icono. */
export function IconAttendance({ className = 'w-4 h-4', size = 16 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
      <rect width="8" height="4" x="8" y="2" rx="1" />
      <path d="m9 14 2 2 4-4" />
    </svg>
  );
}

/** Representa calificaciones con el tamaño y el estilo que el panel indica para este icono. */
export function IconGrades({ className = 'w-4 h-4', size = 16 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <circle cx="12" cy="8" r="6" />
      <path d="M15.477 12.89 17 22l-5-3-5 3 1.523-9.11" />
    </svg>
  );
}

/** Representa reportes con el tamaño y el estilo que el panel indica para este icono. */
export function IconReports({ className = 'w-4 h-4', size = 16 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M3 3v18h18" />
      <path d="m19 9-5 5-4-4-3 3" />
    </svg>
  );
}

/** Representa avisos con el tamaño y el estilo que el panel indica para este icono. */
export function IconAnnouncements({ className = 'w-4 h-4', size = 16 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
      <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
    </svg>
  );
}

/** Representa configuración con el tamaño y el estilo que el panel indica para este icono. */
export function IconSettings({ className = 'w-4 h-4', size = 16 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" />
    </svg>
  );
}

/** Representa integración con Moodle con el tamaño y el estilo que el panel indica para este icono. */
export function IconMoodle({ className = 'w-4 h-4', size = 16 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z" />
    </svg>
  );
}

/** Representa auditoría con el tamaño y el estilo que el panel indica para este icono. */
export function IconAudit({ className = 'w-4 h-4', size = 16 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}

/** Representa búsqueda con el tamaño y el estilo que el panel indica para este icono. */
export function IconSearch({ className = 'w-4 h-4', size = 16 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  );
}

/** Representa tema claro con el tamaño y el estilo que el panel indica para este icono. */
export function IconSun({ className = 'w-4 h-4', size = 16 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
    </svg>
  );
}

/** Representa tema oscuro con el tamaño y el estilo que el panel indica para este icono. */
export function IconMoon({ className = 'w-4 h-4', size = 16 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
    </svg>
  );
}

/** Representa menú con el tamaño y el estilo que el panel indica para este icono. */
export function IconMenu({ className = 'w-4 h-4', size = 16 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <line x1="4" x2="20" y1="12" y2="12" />
      <line x1="4" x2="20" y1="6" y2="6" />
      <line x1="4" x2="20" y1="18" y2="18" />
    </svg>
  );
}

/** Representa cierre con el tamaño y el estilo que el panel indica para este icono. */
export function IconClose({ className = 'w-4 h-4', size = 16 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  );
}

/** Representa alta de elementos con el tamaño y el estilo que el panel indica para este icono. */
export function IconPlus({ className = 'w-4 h-4', size = 16 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

/** Representa confirmación con el tamaño y el estilo que el panel indica para este icono. */
export function IconCheck({ className = 'w-4 h-4', size = 16 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

/** Representa enlace externo con el tamaño y el estilo que el panel indica para este icono. */
export function IconExternalLink({ className = 'w-4 h-4', size = 16 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M15 3h6v6M10 14 21 3M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
    </svg>
  );
}

/** Representa recarga con el tamaño y el estilo que el panel indica para este icono. */
export function IconRefresh({ className = 'w-4 h-4', size = 16 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
      <path d="M21 3v5h-5" />
      <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
      <path d="M3 21v-5h5" />
    </svg>
  );
}

/** Representa filtros con el tamaño y el estilo que el panel indica para este icono. */
export function IconFilter({ className = 'w-4 h-4', size = 16 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
    </svg>
  );
}

/** Representa ayuda con el tamaño y el estilo que el panel indica para este icono. */
export function IconHelp({ className = 'w-4 h-4', size = 16 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <circle cx="12" cy="12" r="10" />
      <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
      <path d="M12 17h.01" />
    </svg>
  );
}

/** Representa advertencia con el tamaño y el estilo que el panel indica para este icono. */
export function IconAlertTriangle({ className = 'w-4 h-4', size = 16 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
      <line x1="12" x2="12" y1="9" y2="13" />
      <line x1="12" x2="12.01" y1="17" y2="17" />
    </svg>
  );
}

/** Representa perfil con el tamaño y el estilo que el panel indica para este icono. */
export function IconUser({ className = 'w-4 h-4', size = 16 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}

/** Representa seguridad con el tamaño y el estilo que el panel indica para este icono. */
export function IconShield({ className = 'w-4 h-4', size = 16 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  );
}

/** Representa material de lectura con el tamaño y el estilo que el panel indica para este icono. */
export function IconBookOpen({ className = 'w-4 h-4', size = 16 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
      <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
    </svg>
  );
}

/** Representa navegación hacia la izquierda con el tamaño y el estilo que el panel indica para este icono. */
export function IconChevronLeft({ className = 'w-4 h-4', size = 16 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="m15 18-6-6 6-6" />
    </svg>
  );
}

/** Representa navegación hacia la derecha con el tamaño y el estilo que el panel indica para este icono. */
export function IconChevronRight({ className = 'w-4 h-4', size = 16 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="m9 18 6-6-6-6" />
    </svg>
  );
}

/** Representa tiempos y estados pendientes con el tamaño y el estilo que el panel indica para este icono. */
export function IconClock({ className = 'w-4 h-4', size = 16 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}

/** Representa avance con el tamaño y el estilo que el panel indica para este icono. */
export function IconArrowRight({ className = 'w-4 h-4', size = 16 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <line x1="5" y1="12" x2="19" y2="12" />
      <polyline points="12 5 19 12 12 19" />
    </svg>
  );
}

/** Representa documento con el tamaño y el estilo que el panel indica para este icono. */
export function IconFileText({ className = 'w-4 h-4', size = 16 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
      <polyline points="10 9 9 9 8 9" />
    </svg>
  );
}

/** Representa cursos con el tamaño y el estilo que el panel indica para este icono. */
export function IconCourses({ className = 'w-4 h-4', size = 16 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-2.5-2.5Z" />
      <path d="M6 6h10" />
      <path d="M6 10h10" />
    </svg>
  );
}

```

### apps/web/src/components/moodle/LaunchCourseButton.tsx

<!-- archivo: apps/web/src/components/moodle/LaunchCourseButton.tsx -->
```tsx
// IINICIA Portal · integración con Moodle · LaunchCourseButton.tsx
/** Solicita el enlace de sesión del curso y lo abre en una ventana del campus. */
'use client';

import React, { useState } from 'react';
import { coursesApi } from '@/lib/api';
import { IconExternalLink } from '@/components/campus-tech/Icons';
import {
  closeMoodleLaunchWindow,
  navigateMoodleLaunchWindow,
  openMoodleLaunchWindow,
} from '@/lib/moodle-window';

interface LaunchCourseButtonProps {
  courseMappingId: string;
  courseName: string;
  isAuthorized?: boolean;
  className?: string;
}

/** Abre la ventana durante la interacción, pide al servidor el enlace de acceso y maneja el cierre si el flujo falla. */
export function LaunchCourseButton({
  courseMappingId,
  courseName,
  isAuthorized = true,
  className = '',
}: LaunchCourseButtonProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reserva la ventana antes de pedir el enlace y la cierra si la solicitud falla.
  const handleLaunch = async () => {
    if (!isAuthorized) {
      setError('Aún no tienes matrícula autorizada para este curso.');
      return;
    }

    // Abrir la pestaña durante el gesto del usuario evita que el navegador
    // bloquee la ventana cuando la respuesta de la API llega de forma asíncrona.
    const launchWindow = openMoodleLaunchWindow();
    if (!launchWindow) {
      setError('Permite las ventanas emergentes para abrir el aula virtual.');
      return;
    }
    try {
      setLoading(true);
      setError(null);

      const data = await coursesApi.launchCourse(courseMappingId);
      navigateMoodleLaunchWindow(launchWindow, data.access_url);
    } catch (err: unknown) {
      closeMoodleLaunchWindow(launchWindow);
      setError(err instanceof Error ? err.message : 'No fue posible acceder al aula virtual.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-1.5">
      <button
        type="button"
        onClick={handleLaunch}
        disabled={loading || !isAuthorized}
        className={`inline-flex items-center justify-center gap-2 rounded-[6px] px-3.5 py-2 text-xs font-semibold text-white shadow-minimal transition-all ${
          isAuthorized
            ? 'bg-primary-action hover:bg-primary-action/90 active:scale-[0.98]'
            : 'bg-surface-muted text-muted cursor-not-allowed opacity-60'
        } ${className}`}
      >
        {loading ? (
          <>
            <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
            <span>Abriendo Aula Moodle...</span>
          </>
        ) : (
          <>
            <IconExternalLink className="w-3.5 h-3.5" />
            <span>Entrar al Aula: {courseName}</span>
          </>
        )}
      </button>

      {error && (
        <span className="text-[11px] font-medium text-danger">
          {error}
        </span>
      )}
    </div>
  );
}

```

### apps/web/src/components/moodle/MoodleSyncBadge.tsx

<!-- archivo: apps/web/src/components/moodle/MoodleSyncBadge.tsx -->
```tsx
// IINICIA Portal · integración con Moodle · MoodleSyncBadge.tsx
/** Traduce el estado de sincronización de Moodle a una etiqueta visible. */
'use client';

import React from 'react';
import type { MoodleSyncStatus } from '@/types';

interface MoodleSyncBadgeProps {
  status?: MoodleSyncStatus | string | null;
  moodleId?: number | null;
  className?: string;
}

/** Traduce un estado de sincronización a un indicador visual reutilizable con su etiqueta. */
export function MoodleSyncBadge({ status, moodleId, className = '' }: MoodleSyncBadgeProps) {
  let label = 'No vinculado';
  let badgeStyle = 'bg-surface-muted text-muted border-border';

  switch (status) {
    case 'sincronizado':
      label = moodleId ? `Moodle ID #${moodleId}` : 'Sincronizado';
      badgeStyle = 'bg-success/10 text-success border-success/20';
      break;
    case 'pendiente':
      label = 'Sincronización pendiente';
      badgeStyle = 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20';
      break;
    case 'error':
      label = 'Error Moodle';
      badgeStyle = 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20';
      break;
    case 'suspendido_en_moodle':
      label = 'Suspendido en Moodle';
      badgeStyle = 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20';
      break;
    default:
      label = 'Sin vincular';
      badgeStyle = 'bg-surface-muted text-muted border-border';
      break;
  }

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-[4px] border px-2 py-0.5 text-[11px] font-mono font-medium tracking-tight ${badgeStyle} ${className}`}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${
          status === 'sincronizado'
            ? 'bg-success'
            : status === 'pendiente'
            ? 'bg-amber-500 animate-pulse'
            : status === 'error' || status === 'suspendido_en_moodle'
            ? 'bg-rose-500'
            : 'bg-muted'
        }`}
      />
      {label}
    </span>
  );
}

```

### apps/web/src/components/programs/ProgramDetail.tsx

<!-- archivo: apps/web/src/components/programs/ProgramDetail.tsx -->
```tsx
// IINICIA Portal · programas académicos · ProgramDetail.tsx
/** Carga el programa identificado por su slug y distingue carga, error y programa inexistente. */
'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { programsApi } from '@/lib/api';
import type { Program } from '@/types';

const programTypeLabels: Record<Program['type'], string> = {
  licenciatura: 'Licenciatura',
  maestria: 'Maestría',
  diplomado: 'Diplomado',
  curso: 'Curso',
  certificacion: 'Certificación',
};

const modalityLabels: Record<Program['modality'], string> = {
  en_linea: 'En línea',
  presencial: 'Presencial',
  hibrido: 'Híbrida',
  autogestivo: 'Autogestiva',
};

/** Pide el programa por su identificador y prepara la vista de carga, detalle o ausencia. La acción siguiente depende de la sesión. */
export default function ProgramDetail({ slug }: { slug: string }) {
  const { user } = useAuth();
  const [program, setProgram] = useState<Program | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  // Descarta respuestas de una consulta anterior si se cambia de programa o se abandona la vista.
  useEffect(() => {
    let active = true;
    programsApi.getProgramBySlugOrId(slug)
      .then((result) => {
        if (!active) return;
        if (!result.is_active) {
          setProgram(null);
          setLoadError(true);
          return;
        }
        setProgram(result);
      })
      .catch(() => {
        if (active) setLoadError(true);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => { active = false; };
  }, [slug]);

  if (loading) {
    return <div className="grid min-h-[60vh] place-items-center text-sm text-muted">Cargando información del programa…</div>;
  }

  if (loadError || !program) {
    return (
      <section className="mx-auto grid min-h-[60vh] w-full max-w-3xl place-items-center px-4 py-16 text-center">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-primary">Oferta académica INICIA</p>
          <h1 className="mt-3 text-3xl font-bold text-foreground">No encontramos este programa</h1>
          <p className="mt-3 text-sm text-muted">Puede que ya no esté publicado o que el enlace haya cambiado.</p>
          <Link href="/#cursos" className="mt-6 inline-flex rounded-lg bg-primary-action px-4 py-2 text-sm font-semibold text-white hover:bg-accent-strong">Volver a la oferta académica</Link>
        </div>
      </section>
    );
  }

  // El detalle público dirige a la sesión existente o al registro antes de iniciar una solicitud.
  const nextStepHref = user ? '/dashboard' : '/registro';
  const nextStepLabel = user ? 'Ir a Mi IINICIA' : 'Crear cuenta para solicitar admisión';
  const catalogHref = program.type === 'certificacion' ? '/#certificaciones' : '/#cursos';

  return (
    <article className="flex-1 bg-background text-foreground">
      <section className="border-b border-border bg-surface px-4 py-14 sm:py-20">
        <div className="mx-auto max-w-5xl">
          <Link href={catalogHref} className="text-sm font-medium text-primary hover:underline">← Oferta académica</Link>
          <div className="mt-8 rounded-2xl border border-white/15 bg-welcome-panel p-6 text-white shadow-soft sm:p-10">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide">{programTypeLabels[program.type]}</span>
              <span className="rounded-full bg-white/10 px-3 py-1 text-xs">{program.code}</span>
            </div>
            <h1 className="mt-5 max-w-4xl text-3xl font-bold tracking-tight sm:text-5xl">{program.name}</h1>
            {program.short_description && <p className="mt-4 max-w-3xl text-base leading-relaxed text-white/80">{program.short_description}</p>}
          </div>
        </div>
      </section>

      <section className="mx-auto grid w-full max-w-5xl gap-8 px-4 py-12 sm:grid-cols-[minmax(0,1fr)_18rem] sm:px-6 sm:py-16">
        <div>
          <h2 className="text-xl font-semibold text-foreground">Acerca del programa</h2>
          <p className="mt-4 whitespace-pre-line text-sm leading-7 text-muted">{program.description || 'La descripción completa de este programa todavía no está publicada.'}</p>
        </div>

        <aside className="h-fit rounded-xl border border-border bg-surface p-5 shadow-minimal">
          <h2 className="text-base font-semibold text-foreground">Información académica</h2>
          <dl className="mt-4 divide-y divide-border text-sm">
            <div className="flex justify-between gap-3 py-3"><dt className="text-muted">Modalidad</dt><dd className="text-right font-medium text-foreground">{modalityLabels[program.modality]}</dd></div>
            <div className="flex justify-between gap-3 py-3"><dt className="text-muted">Duración</dt><dd className="text-right font-medium text-foreground">{program.duration_text || `${program.duration_hours} horas`}</dd></div>
          </dl>
          <Link href={nextStepHref} className="mt-4 flex justify-center rounded-lg bg-primary-action px-4 py-2.5 text-center text-sm font-semibold text-white transition-colors hover:bg-accent-strong">{nextStepLabel}</Link>
          <Link href="/#admisiones" className="mt-3 flex justify-center rounded-lg border border-border px-4 py-2.5 text-center text-sm font-medium text-foreground hover:bg-surface-muted">Ver proceso de admisión</Link>
        </aside>
      </section>
    </article>
  );
}

```

## apps/web/src/contexts

Los contextos comparten sesión y preferencias de interfaz entre las páginas.

### apps/web/src/contexts/AuthContext.tsx

<!-- archivo: apps/web/src/contexts/AuthContext.tsx -->
```tsx
// IINICIA Portal · portal Next.js · AuthContext.tsx
/** Mantiene el perfil autenticado y las acciones de sesión que comparten las pantallas. */
'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { ApiError, authApi, getToken, removeToken, setToken } from '@/lib/api';
import type { LoginResponse, RegisterResponse, RoleSlug, UserProfile } from '@/types';

interface AuthContextType {
  user: UserProfile | null;
  loading: boolean;
  login: (email: string, password: string, captchaToken?: string) => Promise<LoginResponse>;
  verifyLoginMfa: (mfaToken: string, factorId: string, code: string) => Promise<UserProfile>;
  register: (payload: {
    email: string;
    password: string;
    first_name: string;
    last_name: string;
    phone?: string;
    captcha_token?: string;
  }) => Promise<RegisterResponse>;
  logout: () => void;
  refreshUser: () => Promise<void>;
  hasRole: (role: RoleSlug) => boolean;
  hasPermission: (permission: string) => boolean;
  getDefaultDashboardPath: (roles?: RoleSlug[]) => string;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

/** Restaura la sesión del portal y comparte el perfil, los roles y las operaciones de identidad con los componentes descendientes. */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  // Recupera el perfil desde la API y descarta el token cuando la sesión es rechazada.
  const fetchProfile = useCallback(async () => {
    const token = getToken();
    if (!token) {
      setUser(null);
      setLoading(false);
      return;
    }

    try {
      const profile = await authApi.getMe();
      setUser(profile);
    } catch (error) {
      if (error instanceof ApiError && [401, 403].includes(error.statusCode)) {
        removeToken();
        setUser(null);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  // Reconsulta el perfil al volver a la pestaña para recoger cambios de acceso.
  useEffect(() => {
    fetchProfile();
    const refreshOnFocus = () => { if (getToken()) void fetchProfile(); };
    window.addEventListener('focus', refreshOnFocus);
    return () => window.removeEventListener('focus', refreshOnFocus);
  }, [fetchProfile]);

  /** Inicia el primer paso y descarta la sesión anterior antes de pedir la siguiente acción al servidor. */
  const login = (email: string, password: string, captchaToken?: string): Promise<LoginResponse> => {
    removeToken();
    setUser(null);
    return authApi.login({ email, password, captcha_token: captchaToken });
  };

  // La sesión se guarda tras verificar TOTP y confirmar que la API acepta el token para consultar el perfil.
  const verifyLoginMfa = async (mfaToken: string, factorId: string, code: string): Promise<UserProfile> => {
    setLoading(true);
    try {
      const { access_token } = await authApi.verifyLoginMfa(mfaToken, factorId, code);
      const profile = await authApi.getMe(access_token);
      setToken(access_token);
      setUser(profile);
      return profile;
    } finally {
      setLoading(false);
    }
  };

  /** Mantiene pendiente el formulario mientras se registra la solicitud de confirmación de correo. */
  const register = async (payload: {
    email: string;
    password: string;
    first_name: string;
    last_name: string;
    phone?: string;
    captcha_token?: string;
  }): Promise<RegisterResponse> => {
    setLoading(true);
    try {
      return await authApi.register(payload);
    } finally {
      setLoading(false);
    }
  };

  /** Limpia el token y el perfil del navegador antes de volver a la página de ingreso. */
  const logout = () => {
    authApi.logout();
    setUser(null);
    window.location.href = '/login';
  };

  /** Vuelve a leer el perfil cuando el panel necesita reflejar cambios recientes de la cuenta. */
  const refreshUser = async () => {
    await fetchProfile();
  };

  /** Expone los roles del perfil para elegir qué elementos de interfaz se muestran. */
  const hasRole = (role: RoleSlug): boolean => {
    if (!user) return false;
    return user.roles.includes(role);
  };

  /** Controla la disponibilidad visual de una acción. La API vuelve a verificar el permiso al procesarla. */
  const hasPermission = (permission: string): boolean => {
    if (!user) return false;
    if (user.roles.includes('superadministrador')) return true;
    return Boolean(user.permissions && user.permissions.includes(permission));
  };

  // Resuelve el panel de entrada cuando una cuenta tiene varios roles.
  const getDefaultDashboardPath = (customRoles?: RoleSlug[]): string => {
    const r = customRoles || user?.roles || [];
    if (r.includes('superadministrador') || r.includes('administrador')) {
      return '/dashboard/admin';
    }
    if (r.includes('coordinador')) return '/dashboard/coordinador';
    if (r.includes('profesor')) {
      return '/dashboard/docente';
    }
    if (r.includes('estudiante')) {
      return '/dashboard/estudiante';
    }
    if (r.includes('soporte')) return '/dashboard/soporte';
    return '/dashboard/aspirante';
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        login,
        verifyLoginMfa,
        register,
        logout,
        refreshUser,
        hasRole,
        hasPermission,
        getDefaultDashboardPath,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

/** Entrega el contexto que los componentes usan para consultar la sesión y ejecutar las operaciones de identidad. */
export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

```

### apps/web/src/contexts/ThemeContext.tsx

<!-- archivo: apps/web/src/contexts/ThemeContext.tsx -->
```tsx
// IINICIA Portal · portal Next.js · ThemeContext.tsx
/** Aplica el tema elegido al documento y conserva la preferencia en el navegador. */
'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';

type Theme = 'light' | 'dark';

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

/** Mantiene la preferencia visual y sincroniza el tema elegido con el estado y la clase aplicada al documento. */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>('light');
  const [mounted, setMounted] = useState(false);

  // Recupera la preferencia guardada después de montar y usa la del sistema cuando falta.
  useEffect(() => {
    // 1. Check local storage preference
    const saved = localStorage.getItem('campus-tech-theme') as Theme | null;
    if (saved === 'light' || saved === 'dark') {
      setThemeState(saved);
      applyTheme(saved);
    } else {
      // 2. Check system preference
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      const initial = prefersDark ? 'dark' : 'light';
      setThemeState(initial);
      applyTheme(initial);
    }
    setMounted(true);
  }, []);

  const applyTheme = (t: Theme) => {
    const root = document.documentElement;
    if (t === 'dark') {
      root.classList.add('dark');
      root.classList.remove('light');
      root.setAttribute('data-theme', 'dark');
    } else {
      root.classList.remove('dark');
      root.classList.add('light');
      root.setAttribute('data-theme', 'light');
    }
  };

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme);
    localStorage.setItem('campus-tech-theme', newTheme);
    applyTheme(newTheme);
  };

  const toggleTheme = () => {
    const next = theme === 'light' ? 'dark' : 'light';
    setTheme(next);
  };

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

/** Da acceso al tema y a la operación de alternancia desde un componente envuelto por el proveedor. */
export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}

```

## apps/web/src/lib

Las bibliotecas centralizan solicitudes y reglas de navegación, incluyendo la validación del destino de Moodle.

### apps/web/src/lib/api.ts

<!-- archivo: apps/web/src/lib/api.ts -->
```typescript
// IINICIA Portal · portal Next.js · api.ts
/** Centraliza el transporte HTTP y separa las operaciones del portal en clientes por recurso. */
import type {
  AdmissionApplication,
  AuthorizedCourse,
  CourseOffering,
  EnrollmentRequest,
  LoginResponse,
  MoodleCourseProgress,
  MoodleLaunchResponse,
  MoodleStatusResponse,
  PasswordResetResponse,
  Program,
  RegisterResponse,
  UserProfile,
  VerifiedLoginResponse,
} from '@/types';

export const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1';

export class ApiError extends Error {
  statusCode: number;
  details?: any;

  /** Conserva el código HTTP junto al mensaje para que la interfaz distinga la causa del error. */
  constructor(message: string, statusCode: number, details?: any) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.details = details;
  }
}

/** Lee el token de sesión que el navegador usa para identificar peticiones protegidas. */
export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('iinicia_access_token');
}

/** Guarda el token devuelto por un flujo de autenticación aceptado para futuras peticiones en el navegador. */
export function setToken(token: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem('iinicia_access_token', token);
}

/** Elimina la referencia de sesión local que se adjuntaría a peticiones posteriores. */
export function removeToken(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem('iinicia_access_token');
}

// Unifica la URL base, el token de sesión y la traducción de errores para los clientes del portal.
/** Centraliza el envío a la API, adjunta el token cuando corresponde y representa los fallos como errores que entiende el formulario o panel. */
export async function apiFetch<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const token = getToken();
  const headers = new Headers(options.headers || {});

  headers.set('Content-Type', 'application/json');
  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  const response = await fetch(`${API_URL}${normalizedPath}`, {
    ...options,
    headers,
  });

  const contentType = response.headers.get('content-type');
  const isJson = contentType && contentType.includes('application/json');
  const data = isJson ? await response.json() : await response.text();

  if (!response.ok) {
    let errorMessage = 'Ocurrió un error en la solicitud.';
    if (isJson && data) {
      if (Array.isArray(data.message)) {
        errorMessage = data.message.join(', ');
      } else if (typeof data.message === 'string') {
        errorMessage = data.message;
      }
    }
    throw new ApiError(errorMessage, response.status, data);
  }

  return data as T;
}

// ----------------- Auth API -----------------
export const authApi = {
  recoverPassword: async (email: string, challenge: string, captchaToken?: string): Promise<{ message: string }> =>
    apiFetch<{ message: string }>('/auth/recover', {
      method: 'POST',
      body: JSON.stringify({ email, code_challenge: challenge, captcha_token: captchaToken }),
    }),

  resetPassword: async (
    proof: { token_hash: string } | { auth_code: string; code_verifier: string },
    password: string,
  ): Promise<PasswordResetResponse> =>
    apiFetch<PasswordResetResponse>('/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ ...proof, password }),
    }),

  verifyRecoveryMfa: (mfaToken: string, factorId: string, code: string, password: string) =>
    apiFetch<{ message: string }>('/auth/mfa/recover', {
      method: 'POST',
      headers: { Authorization: `Bearer ${mfaToken}` },
      body: JSON.stringify({ factor_id: factorId, code, password }),
    }),

  login: (credentials: { email: string; password: string; captcha_token?: string }): Promise<LoginResponse> =>
    apiFetch<LoginResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials),
    }),

  verifyLoginMfa: (mfaToken: string, factorId: string, code: string): Promise<VerifiedLoginResponse> =>
    apiFetch<VerifiedLoginResponse>('/auth/mfa/verify', {
      method: 'POST',
      headers: { Authorization: `Bearer ${mfaToken}` },
      body: JSON.stringify({ factor_id: factorId, code }),
    }),

  register: async (payload: {
    email: string;
    password: string;
    first_name: string;
    last_name: string;
    phone?: string;
    captcha_token?: string;
  }): Promise<RegisterResponse> => {
    return apiFetch<RegisterResponse>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  getMe: async (accessToken?: string): Promise<UserProfile> => {
    return apiFetch<UserProfile>('/auth/me', {
      headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
    });
  },

  logout: () => {
    removeToken();
  },
};

// ----------------- Courses & Offerings API -----------------
type CourseMappingResponse = Omit<CourseOffering, 'course_mapping_id' | 'code' | 'name' | 'program_name'> & {
  course_mapping_id?: string;
  code?: string;
  name?: string;
  program_name?: string;
};

/** Adapta la identificación de un curso para que los componentes consuman una estructura uniforme. */
function normalizeCourseOffering(course: CourseMappingResponse): CourseOffering {
  return {
    ...course,
    course_mapping_id: course.course_mapping_id || course.id,
    code: course.code || course.portal_course_code || course.moodle_shortname || '',
    name: course.name || course.course_name || '',
    program_name: course.program_name || course.programs?.name || '',
  };
}

export const coursesApi = {
  getCatalog: async (): Promise<CourseOffering[]> => {
    const courses = await apiFetch<CourseMappingResponse[]>('/courses');
    return courses.map(normalizeCourseOffering);
  },

  getAuthorizedCourses: async (): Promise<AuthorizedCourse[]> => {
    return apiFetch<AuthorizedCourse[]>('/courses');
  },

  getOfferings: async (): Promise<CourseOffering[]> => {
    const offerings = await apiFetch<CourseMappingResponse[]>('/courses/offerings');
    return offerings.map(normalizeCourseOffering);
  },

  createCourse: async (payload: any): Promise<CourseOffering> => {
    return apiFetch<CourseOffering>('/courses', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  updateCourse: async (id: string, payload: any): Promise<CourseOffering> => {
    return apiFetch<CourseOffering>(`/courses/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  },

  launchCourse: async (courseMappingId: string, destination: 'launch' | 'launch-gradebook' = 'launch'): Promise<MoodleLaunchResponse> => {
    return apiFetch<MoodleLaunchResponse>(`/moodle/courses/${courseMappingId}/${destination}`, {
      method: 'POST',
    });
  },
};

// ----------------- Enrollments API -----------------
export const enrollmentsApi = {
  requestEnrollment: async (
    courseMappingId: string,
    options?: { user_id?: string; moodle_role?: string; notes?: string },
  ): Promise<EnrollmentRequest> => {
    return apiFetch<EnrollmentRequest>('/enrollments', {
      method: 'POST',
      body: JSON.stringify({
        course_mapping_id: courseMappingId,
        user_id: options?.user_id,
        moodle_role: options?.moodle_role || 'student',
        notes: options?.notes,
      }),
    });
  },

  getMyEnrollments: async (): Promise<EnrollmentRequest[]> => {
    // La API filtra las solicitudes del usuario autenticado en GET /enrollments.
    return apiFetch<EnrollmentRequest[]>('/enrollments');
  },

  getAllEnrollments: async (status?: string): Promise<EnrollmentRequest[]> => {
    const query = status ? `?status=${status}` : '';
    const res = await apiFetch<any>(`/enrollments${query}`);
    return Array.isArray(res) ? res : res?.data || [];
  },

  authorizeEnrollment: async (
    enrollmentId: string,
    decision: { status: 'autorizada' | 'rechazada'; rejection_reason?: string; sync_to_moodle?: boolean },
  ): Promise<any> => {
    return apiFetch(`/enrollments/${enrollmentId}/status`, {
      method: 'PATCH',
      body: JSON.stringify(decision),
    });
  },

  retrySync: async (enrollmentId: string): Promise<any> => {
    return apiFetch(`/enrollments/${enrollmentId}/sync`, {
      method: 'POST',
    });
  },

  deleteEnrollment: async (enrollmentId: string): Promise<any> => {
    return apiFetch(`/enrollments/${enrollmentId}`, {
      method: 'DELETE',
    });
  },
};

export const admissionsApi = {
  getMyApplications: (): Promise<AdmissionApplication[]> =>
    apiFetch<AdmissionApplication[]>('/admissions'),
  createApplication: (payload: {
    program_id: string;
    motivation_letter?: string;
  }): Promise<AdmissionApplication> =>
    apiFetch<AdmissionApplication>('/admissions', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  reviewApplication: (id: string, status: 'en_revision' | 'admitido' | 'rechazado', reviewerNotes?: string): Promise<AdmissionApplication> =>
    apiFetch<AdmissionApplication>(`/admissions/${id}/review`, {
      method: 'PATCH',
      body: JSON.stringify({ status, reviewer_notes: reviewerNotes }),
    }),
};

export interface ContactMessagePayload {
  full_name: string;
  email: string;
  phone?: string;
  subject: string;
  message: string;
}

export interface ContactMessageResponse {
  success: boolean;
  message_id: string;
  submitted_at: string;
}

export const contactApi = {
  submitMessage: (payload: ContactMessagePayload): Promise<ContactMessageResponse> =>
    apiFetch<ContactMessageResponse>('/contact', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
};

// ----------------- Roles API -----------------
export const rolesApi = {
  getRoles: async (): Promise<any[]> => {
    return apiFetch<any[]>('/roles');
  },

  assignRole: async (userId: string, roleId: number): Promise<any> => {
    return apiFetch(`/roles/users/${userId}`, {
      method: 'POST',
      body: JSON.stringify({ role_id: roleId }),
    });
  },

  revokeRole: async (userId: string, roleId: number): Promise<any> => {
    return apiFetch(`/roles/users/${userId}/${roleId}`, {
      method: 'DELETE',
    });
  },
};

// ----------------- Audit API -----------------
export const auditApi = {
  getLogs: async (params?: { limit?: number; offset?: number; action?: string }): Promise<any> => {
    const sp = new URLSearchParams();
    if (params?.limit) sp.set('limit', String(params.limit));
    if (params?.offset) sp.set('offset', String(params.offset));
    if (params?.action) sp.set('action', params.action);
    const qs = sp.toString();
    return apiFetch<any>(`/audit${qs ? `?${qs}` : ''}`);
  },
};

// ----------------- Moodle API -----------------
export const moodleApi = {
  getStatus: async (): Promise<MoodleStatusResponse> => {
    return apiFetch<MoodleStatusResponse>('/moodle/status');
  },

  launchCampus: async (): Promise<{ access_url: string }> => {
    return apiFetch<{ access_url: string }>('/moodle/launch', {
      method: 'POST',
    });
  },

  syncAllUsers: async (): Promise<{ total: number; synced: number; failed: number; results: any[] }> => {
    return apiFetch('/moodle/sync/users', {
      method: 'POST',
    });
  },

  syncUser: async (userId: string): Promise<any> => {
    return apiFetch(`/moodle/sync/user/${userId}`, {
      method: 'POST',
    });
  },

  getCourseContents: async (courseId: number): Promise<any[]> => {
    return apiFetch<any[]>(`/moodle/courses/${courseId}/contents`);
  },

  getCourseParticipants: async (courseId: number): Promise<any[]> => {
    return apiFetch<any[]>(`/moodle/courses/${courseId}/participants`);
  },

  getCourseProgress: async (courseId: number, moodleUserId?: number): Promise<MoodleCourseProgress> => {
    const qs = moodleUserId ? `?moodle_user_id=${moodleUserId}` : '';
    return apiFetch<MoodleCourseProgress>(`/moodle/courses/${courseId}/progress${qs}`);
  },

  getCourseTeacherOverview: async (courseId: number): Promise<any> => {
    return apiFetch<any>(`/moodle/courses/${courseId}/teacher-overview`);
  },
};

// ----------------- Programs API -----------------
export const programsApi = {
  getPrograms: async (type?: string): Promise<Program[]> => {
    const programs = await apiFetch<Program[]>('/programs');
    return type ? programs.filter((program) => program.type === type) : programs;
  },

  getProgramBySlugOrId: async (slugOrId: string): Promise<Program> => {
    return apiFetch<Program>(`/programs/${slugOrId}`);
  },

  createProgram: async (payload: any): Promise<Program> => {
    return apiFetch<Program>('/programs', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  updateProgram: async (id: string, payload: any): Promise<Program> => {
    return apiFetch<Program>(`/programs/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  },

  enrollUserInProgram: (programId: string, payload: { user_id: string; status: 'inscrito' }) => {
    return apiFetch<{ id: string; status: string }>(`/programs/${programId}/enroll-user`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },
};

// ----------------- Users API -----------------
export const usersApi = {
  getUsers: async (params?: { role?: string; status?: string; search?: string; limit?: number; offset?: number }): Promise<{ data: UserProfile[]; meta: any }> => {
    const sp = new URLSearchParams();
    if (params?.role) sp.set('role', params.role);
    if (params?.status) sp.set('status', params.status);
    if (params?.search) sp.set('search', params.search);
    if (params?.limit) sp.set('limit', String(params.limit));
    if (params?.offset) sp.set('offset', String(params.offset));
    const qs = sp.toString();
    return apiFetch<{ data: UserProfile[]; meta: any }>(`/users${qs ? `?${qs}` : ''}`);
  },

  getUserById: async (userId: string): Promise<UserProfile> => {
    return apiFetch<UserProfile>(`/users/${userId}`);
  },

  updateStatus: async (userId: string, payload: { status: string; reason?: string }): Promise<any> => {
    return apiFetch(`/users/${userId}/status`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  },

  updateOwnProfile: async (payload: {
    first_name?: string;
    last_name?: string;
    phone?: string;
    avatar_url?: string;
    bio?: string;
  }): Promise<{ message: string; profile: UserProfile }> => {
    return apiFetch<{ message: string; profile: UserProfile }>('/users/me/profile', {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  },

  createUser: async (payload: {
    email: string;
    password: string;
    first_name: string;
    last_name: string;
    phone?: string;
    role_id: number;
  }): Promise<UserProfile> => {
    return apiFetch<UserProfile>('/users', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },
};

```

### apps/web/src/lib/moodle-window.ts

<!-- archivo: apps/web/src/lib/moodle-window.ts -->
```typescript
// IINICIA Portal · portal Next.js · moodle-window.ts
/** Administra la apertura, navegación y cierre de la ventana usada para los saltos SSO a Moodle. */
const MOODLE_BASE_URL =
  process.env.NEXT_PUBLIC_MOODLE_URL || 'http://192.168.191.171/moodle';

// Abre la ventana durante el clic, antes de esperar la respuesta del servidor.
/** Reserva una ventana durante la interacción y separa su referencia al origen antes de recibir el enlace de la API. */
export function openMoodleLaunchWindow(): Window | null {
  const popup = window.open('about:blank', '_blank');
  if (popup) popup.opener = null;
  return popup;
}

/** Solo navega la ventana reservada después de que el enlace supera la validación del campus configurado. */
export function navigateMoodleLaunchWindow(popup: Window, accessUrl: string): void {
  popup.location.replace(validateMoodleLaunchUrl(accessUrl, MOODLE_BASE_URL));
}

/** Verifica el origen, la ruta de SSO, la clave y el destino posterior. Devuelve el enlace validado o interrumpe la apertura con un error. */
export function validateMoodleLaunchUrl(accessUrl: string, campusUrl: string): string {
  const baseUrl = new URL(campusUrl);
  const targetUrl = new URL(accessUrl);
  const moodlePath = baseUrl.pathname.replace(/\/+$/, '');
  // Restringe el salto a la ruta de SSO en el origen Moodle configurado.
  const expectedLoginPath = `${moodlePath}/auth/userkey/login.php`;

  if (
    (targetUrl.protocol !== 'http:' && targetUrl.protocol !== 'https:') ||
    targetUrl.origin !== baseUrl.origin ||
    targetUrl.pathname !== expectedLoginPath ||
    targetUrl.username || targetUrl.password || targetUrl.hash ||
    targetUrl.searchParams.getAll('key').length !== 1 ||
    !targetUrl.searchParams.get('key')
  ) {
    throw new Error('La API devolvió un enlace SSO de Moodle no válido.');
  }

  // Moodle interpreta wantsurl tras iniciar sesión. Se verifica ese segundo salto antes de navegar.
  const destinations = targetUrl.searchParams.getAll('wantsurl');
  if (destinations.length > 1) throw new Error('El enlace SSO contiene varios destinos.');
  if (destinations.length === 1) {
    const destination = new URL(destinations[0]);
    const allowedPaths = [
      moodlePath || '/',
      `${moodlePath}/`,
      `${moodlePath}/course/view.php`,
      `${moodlePath}/grade/report/grader/index.php`,
    ];
    if (
      destination.protocol !== baseUrl.protocol || destination.origin !== baseUrl.origin ||
      destination.username || destination.password || !allowedPaths.includes(destination.pathname)
    ) {
      throw new Error('El destino del enlace SSO está fuera del campus Moodle.');
    }
  }
  return targetUrl.href;
}

/** Cierra la ventana que el portal reservó si sigue abierta cuando debe cancelar el salto. */
export function closeMoodleLaunchWindow(popup: Window): void {
  if (!popup.closed) popup.close();
}

```

### apps/web/src/lib/portal-help.ts

<!-- archivo: apps/web/src/lib/portal-help.ts -->
```typescript
// IINICIA Portal · portal Next.js · portal-help.ts
/** La ayuda es pública. El navegador envía solo la pregunta y hasta tres preguntas anteriores sin adjuntar credenciales de sesión. */
import { API_URL } from './api';

export type HelpAnswer = {
  text: string;
  action: { href: string; label: string };
  sources?: { href: string; label: string }[];
};

export const helpTopics = [
  '¿Cómo me postulo?',
  'Olvidé mi contraseña',
  '¿Cómo entro a Moodle?',
  'Ya me admitieron, ¿por qué no veo mi curso en Moodle?',
];

/** Envía la pregunta y hasta tres antecedentes sin credenciales. Traduce el límite de frecuencia y los fallos del proveedor a mensajes del diálogo. */
export async function askPortalHelp(question: string, previousQuestions: string[] = []): Promise<HelpAnswer> {
  const response = await fetch(`${API_URL}/help-chat`, {
    method: 'POST',
    credentials: 'omit',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question, previous_questions: previousQuestions.slice(-3) }),
  });

  if (!response.ok) {
    const message = response.status === 429
      ? 'Llegaste al límite temporal de consultas. Intenta de nuevo en un minuto.'
      : 'El asistente de IA no está disponible en este momento.';
    throw new Error(message);
  }

  return response.json() as Promise<HelpAnswer>;
}

```

### apps/web/src/lib/recovery-pkce.ts

<!-- archivo: apps/web/src/lib/recovery-pkce.ts -->
```typescript
// IINICIA Portal · portal Next.js · recovery-pkce.ts
/** Genera la prueba PKCE y conserva temporalmente el verificador necesario para canjear el enlace de recuperación. */
const STORAGE_KEY = 'iinicia_recovery_verifier';
const LIFETIME_MS = 30 * 60 * 1000;

/** Convierte bytes al alfabeto URL seguro que necesitan el verificador y su reto PKCE. */
function base64Url(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// Comparte el reto derivado con la API y conserva el verificador para el intercambio posterior.
/** Genera el verificador criptográfico, almacena su vigencia en el navegador y retorna el reto que usará la API. */
export async function startRecoveryProof() {
  const verifier = base64Url(crypto.getRandomValues(new Uint8Array(32)));
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ verifier, expiresAt: Date.now() + LIFETIME_MS }));
  return { verifier, challenge: base64Url(new Uint8Array(digest)) };
}

/** Recupera un verificador de recuperación vigente y descarta un registro caducado. */
export function readRecoveryVerifier(): string | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const value = JSON.parse(raw) as { verifier?: string; expiresAt?: number };
    if (value.verifier && typeof value.expiresAt === 'number' && value.expiresAt > Date.now()) {
      return value.verifier;
    }
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    return null;
  }
  return null;
}

// Evita eliminar el verificador de una solicitud más reciente.
/** Elimina solo la prueba utilizada para conservar una solicitud más reciente si las operaciones se cruzan. */
export function clearRecoveryVerifier(verifier: string): void {
  if (readRecoveryVerifier() === verifier) localStorage.removeItem(STORAGE_KEY);
}

```

## apps/web/src/types

Archivos de este componente y su configuración.

### apps/web/src/types/index.ts

<!-- archivo: apps/web/src/types/index.ts -->
```typescript
// IINICIA Portal · portal Next.js · index.ts
/** Representa los contratos de identidad, catálogo, admisión y Moodle que consume la web. */
export type RoleSlug =
  | 'superadministrador'
  | 'administrador'
  | 'coordinador'
  | 'profesor'
  | 'estudiante'
  | 'aspirante'
  | 'soporte';

export type MoodleSyncStatus =
  | 'no_vinculado'
  | 'pendiente'
  | 'sincronizado'
  | 'error'
  | 'suspendido_en_moodle';

export type UserStatus = 'activo' | 'inactivo' | 'suspendido' | 'pendiente' | 'baja';

export interface UserProgramMembership {
  program_id: string;
  code: string;
  name: string;
  type: Program['type'];
  academic_status: string;
  cohort: string | null;
}

export interface UserProfile {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  phone?: string | null;
  avatar_url?: string | null;
  status: UserStatus;
  roles: RoleSlug[];
  active_roles?: RoleSlug[];
  permissions?: string[];
  moodle_user_id?: number | null;
  moodle_username?: string | null;
  moodle_sync_status?: MoodleSyncStatus;
  moodle_last_sync_at?: string | null;
  programs?: UserProgramMembership[] | null;
  created_at?: string;
}

export interface AuthSession {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
  expires_at?: number;
}

// Una respuesta de contraseña indica si hay que configurar un factor o verificar uno existente.
export type LoginResponse =
  | { step: 'setup'; mfa_token: string; factor_id: string; secret: string; qr_code?: string }
  | { step: 'verify'; mfa_token: string; factors: { id: string; name?: string }[] };

export interface VerifiedLoginResponse extends AuthSession {
  user: {
    id: string;
    email?: string;
  };
}

export interface RegisterResponse {
  message: string;
}

export type PasswordResetResponse =
  | { message: string }
  | Extract<LoginResponse, { step: 'verify' }>;

export interface CourseOffering {
  id: string;
  course_mapping_id: string;
  code: string;
  name: string;
  portal_course_code?: string;
  slug?: string;
  course_name?: string;
  course_description?: string;
  program_name: string;
  program_id?: string;
  moodle_course_id: number;
  moodle_shortname?: string;
  moodle_course_url?: string;
  is_active?: boolean;
  term_or_module?: number;
  is_mandatory?: boolean;
  credits?: number | null;
  hours_theory?: number | null;
  hours_practice?: number | null;
  programs?: {
    code: string;
    name: string;
    slug: string;
  };
}

export interface RoleItem {
  id: number;
  slug: string;
  name: string;
  description: string;
  hierarchy_level: number;
  default_moodle_archetype: string | null;
  is_system: boolean;
}

export interface AuditLog {
  id: string;
  actor_id: string;
  target_user_id?: string | null;
  action: string;
  entity_name: string;
  entity_id?: string | null;
  ip_address?: string | null;
  user_agent?: string | null;
  details?: any;
  created_at: string;
}

export interface CreateCoursePayload {
  program_id?: string;
  portal_course_code: string;
  slug: string;
  course_name: string;
  course_description?: string;
  term_or_module?: number;
  is_mandatory?: boolean;
  moodle_course_id: number;
  moodle_shortname: string;
  is_active?: boolean;
}

// Representa el curso al que la sesión ya tiene acceso mediante su matrícula.
export interface AuthorizedCourse {
  course_mapping_id: string;
  course_code: string;
  course_name: string;
  moodle_course_id: number;
  enrollment_status: 'autorizada' | 'sincronizada';
  role_in_course: 'student' | 'teacher';
  enrollment_id?: string;
  moodle_role?: string;
  course_description?: string;
  thumbnail_url?: string;
  portal_course_code?: string;
  program_name?: string;
  program_slug?: string;
  cached_progress?: number | null;
  cached_final_grade?: number | null;
  cached_completed?: boolean | null;
  synced_to_moodle_at?: string | null;
}

export interface EnrollmentRequest {
  id: string;
  user_id: string;
  course_mapping_id: string;
  moodle_role?: string;
  status: 'pendiente' | 'autorizada' | 'rechazada' | 'sincronizada' | 'error_sincronizacion';
  moodle_sync_status: MoodleSyncStatus;
  moodle_enrolled_at?: string | null;
  created_at: string;
  course_mappings?: {
    code?: string;
    portal_course_code?: string;
    course_name?: string;
    moodle_course_id: number;
    moodle_shortname: string;
    courses?: {
      name: string;
      code: string;
    };
  };
  profiles?: {
    email: string;
    first_name: string;
    last_name: string;
    moodle_user_id?: number | null;
  };
}

export interface AdmissionApplication {
  enrollment_summary?: { total: number; synced: number; state: 'synced' | 'incomplete' | 'no_courses' };
  id: string;
  applicant_id: string;
  program_id: string;
  status: 'postulado' | 'en_revision' | 'admitido' | 'rechazado';
  reviewer_notes?: string | null;
  submitted_at?: string;
  programs?: { code: string; name: string; slug: string } | null;
  profiles?: { id: string; email: string; first_name: string; last_name: string; phone?: string | null } | null;
}

export interface MoodleLaunchResponse {
  course_mapping_id: string;
  course_name: string;
  moodle_course_id: number;
  access_url: string;
}

// Mantiene separados la nota, el porcentaje de avance y el resultado de finalización.
export interface MoodleCourseProgress {
  course_id: number;
  moodle_user_id: number;
  total_modules: number;
  grade_raw: number | null;
  grade_formatted: string;
  /** @deprecated Use grade_percentage or progress_percentage explicitly. */
  percentage: number;
  grade_percentage: number | null;
  progress_percentage: number | null;
  completed_activities: number;
  total_tracked_activities: number;
  is_completed: boolean;
  completion_status: Record<string, unknown> | null;
  grade_items: Record<string, unknown>[];
}

export interface MoodleStatusResponse {
  ok: boolean;
  message: string;
}

export interface Program {
  id: string;
  code: string;
  slug: string;
  name: string;
  short_description?: string;
  description: string;
  type: 'licenciatura' | 'maestria' | 'diplomado' | 'curso' | 'certificacion';
  modality: 'en_linea' | 'presencial' | 'hibrido' | 'autogestivo';
  duration_text: string;
  duration_hours: number;
  is_featured?: boolean;
  is_active: boolean;
}

```

## apps/web/test

Las pruebas unitarias llaman directamente a las funciones de la aplicación y ejercitan las decisiones de navegación con datos de prueba.

### apps/web/test/moodle-window.test.mjs

<!-- archivo: apps/web/test/moodle-window.test.mjs -->
```javascript
// IINICIA Portal · pruebas de integración · moodle-window.test.mjs
/** Comprueba la función que usa el navegador antes de abrir el campus con enlaces locales de prueba, sin depender del Moodle de producción. */
import assert from 'node:assert/strict';
import test from 'node:test';
import { validateMoodleLaunchUrl } from '../src/lib/moodle-window.ts';

const campus = 'https://campus.example/moodle';
const login = campus + '/auth/userkey/login.php';
/** Compone un enlace de ensayo con una clave temporal y el destino que evaluará la validación. */
const destination = (value) => login + '?key=test&' + new URLSearchParams({ wantsurl: value });

test('retains valid SSO links to campus, course and gradebook', () => {
  for (const path of ['/', '/course/view.php?id=2', '/grade/report/grader/index.php?id=2']) {
    const target = destination(campus + path);
    assert.equal(validateMoodleLaunchUrl(target, campus), target);
  }
});

test('rejects SSO redirects outside the configured campus', () => {
  assert.throws(() => validateMoodleLaunchUrl(destination('https://otro.example/'), campus));
  assert.throws(() => validateMoodleLaunchUrl(destination(campus + '-otro/'), campus));
  assert.throws(() => validateMoodleLaunchUrl(destination(campus + '/otro.php'), campus));
});

test('requires a single SSO key and an unambiguous destination', () => {
  assert.throws(() => validateMoodleLaunchUrl(login, campus));
  assert.throws(() => validateMoodleLaunchUrl(login + '?key=test&key=otro', campus));
  const target = destination(campus + '/') + '&' + new URLSearchParams({ wantsurl: campus + '/' });
  assert.throws(() => validateMoodleLaunchUrl(target, campus));
});

```
