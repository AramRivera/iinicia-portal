# Frontend INICIA

Portal institucional y paneles por rol con Next.js 16, React 19, TypeScript y Tailwind CSS 4. Consulta la [guía técnica y funcional](../../docs/frontend.md) y el [contrato de API](../../docs/openapi.yaml).

## Ejecutar en PowerShell

```powershell
cd .\apps\web
npm.cmd ci
Copy-Item .env.example .env.local
npm.cmd run dev
```

Configura `.env.local` antes de iniciar. `NEXT_PUBLIC_API_URL` debe incluir `/api/v1`; por ejemplo `http://192.168.191.171:3000/api/v1`. `NEXT_PUBLIC_MOODLE_URL` debe apuntar al campus accesible desde tu navegador. Abre <http://localhost:4000>. Detén el servidor con `Ctrl+C` y reinícialo después de cambiar variables de entorno.

Para accesos rápidos locales, crea `apps/web/.env.demo.local` con `NEXT_PUBLIC_DEMO_ACCOUNTS` y ejecuta `npm run dev:demo`. El archivo se ignora en Git. Los botones solo rellenan el formulario: el login real usa NestJS y pide el TOTP configurado para la cuenta. Consulta [guía de demo](../../docs/frontend.md#accesos-rápidos-de-prueba) y [verificación en dos pasos](../../docs/autenticacion-dos-factores.md).

Para trabajar con compañeros por ZeroTier, usa localhost en puerto 4000 y la IP del host ZeroTier en 4007. Consulta la guía para iniciar los dos servidores y configurar CORS de la API.

```powershell
npm.cmd run build
npm.cmd run lint
```

No coloques claves privadas de Supabase ni tokens de Web Services Moodle en variables `NEXT_PUBLIC_*`.
