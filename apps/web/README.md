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

```powershell
npm.cmd run build
npm.cmd run lint
```

No coloques claves privadas de Supabase ni tokens de Web Services Moodle en variables `NEXT_PUBLIC_*`.
