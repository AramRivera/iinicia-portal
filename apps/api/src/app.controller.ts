import { Controller, Get, Header, Res } from '@nestjs/common';
import type { Response } from 'express';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { AppService } from './app.service.js';

function getDocFile(filename: 'openapi.yaml' | 'openapi.json'): string | null {
  const candidatePaths = [
    resolve(process.cwd(), `../../docs/${filename}`),
    resolve(process.cwd(), `../docs/${filename}`),
    resolve(process.cwd(), `docs/${filename}`),
  ];
  const found = candidatePaths.find((p) => existsSync(p));
  return found ? readFileSync(found, 'utf8') : null;
}

function buildScalarHtml(specJson: string): string {
  return `<!doctype html>
<html lang="es">
<head>
  <title>IINICIA API - Documentación Oficial</title>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <style>
    body {
      margin: 0;
      padding: 0;
      background-color: #0b0f19;
    }
  </style>
</head>
<body>
  <script
    id="api-reference"
    type="application/json"
    data-configuration='{"theme":"deepSpace","darkMode":true,"layout":"modern","searchHotKey":"k","showSidebar":true}'>
    ${specJson}
  </script>
  <script src="https://cdn.jsdelivr.net/npm/@scalar/api-reference"></script>
</body>
</html>`;
}

function buildSwaggerHtml(specJson: string): string {
  return `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <title>IINICIA API - Documentación OpenAPI / Swagger</title>
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/5.18.2/swagger-ui.min.css" />
  <link rel="icon" type="image/png" href="https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/5.18.2/favicon-32x32.png" />
  <style>
    body { margin: 0; padding: 0; background: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
    .swagger-ui .topbar { display: none; }
    .iinicia-header {
      background: #0f172a;
      color: #ffffff;
      padding: 14px 24px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 2px solid #3b82f6;
    }
    .iinicia-header h1 {
      margin: 0;
      font-size: 18px;
      font-weight: 700;
      letter-spacing: -0.025em;
      color: #f8fafc;
    }
    .iinicia-header .badge {
      background: #1e293b;
      color: #38bdf8;
      padding: 4px 10px;
      border-radius: 9999px;
      font-size: 12px;
      font-weight: 600;
      margin-left: 10px;
      border: 1px solid #334155;
    }
    .iinicia-header .actions {
      display: flex;
      gap: 10px;
    }
    .iinicia-header .btn {
      color: #e2e8f0;
      text-decoration: none;
      font-size: 13px;
      font-weight: 500;
      padding: 6px 12px;
      background: #1e293b;
      border: 1px solid #334155;
      border-radius: 6px;
      transition: all 0.15s ease;
    }
    .iinicia-header .btn:hover {
      background: #334155;
      color: #ffffff;
      border-color: #475569;
    }
  </style>
</head>
<body>
  <div class="iinicia-header">
    <div style="display: flex; align-items: center;">
      <h1>IINICIA API</h1>
      <span class="badge">OpenAPI 3.0.3</span>
    </div>
    <div class="actions">
      <a class="btn" href="/openapi.yaml" target="_blank" download>Descargar openapi.yaml</a>
      <a class="btn" href="/openapi.json" target="_blank" download>Descargar openapi.json</a>
    </div>
  </div>
  <div id="swagger-ui"></div>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/5.18.2/swagger-ui-bundle.min.js"></script>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/5.18.2/swagger-ui-standalone-preset.min.js"></script>
  <script>
    window.onload = function() {
      const spec = ${specJson};
      window.ui = SwaggerUIBundle({
        spec: spec,
        dom_id: '#swagger-ui',
        deepLinking: true,
        presets: [
          SwaggerUIBundle.presets.apis,
          SwaggerUIStandalonePreset
        ],
        layout: "BaseLayout",
        defaultModelsExpandDepth: 1,
        defaultModelExpandDepth: 1,
        docExpansion: "list"
      });
    };
  </script>
</body>
</html>`;
}

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Get('openapi.yaml')
  @Header('Content-Type', 'text/yaml; charset=utf-8')
  getYamlRoot(@Res() res: Response) {
    const content = getDocFile('openapi.yaml');
    if (!content) return res.status(404).send('openapi.yaml no encontrado.');
    return res.send(content);
  }

  @Get('openapi.json')
  @Header('Content-Type', 'application/json; charset=utf-8')
  getJsonRoot(@Res() res: Response) {
    const content = getDocFile('openapi.json');
    if (!content) return res.status(404).json({ error: 'openapi.json no encontrado.' });
    return res.send(content);
  }

  @Get('docs')
  @Header('Content-Type', 'text/html; charset=utf-8')
  getDocsScalar(@Res() res: Response) {
    const json = getDocFile('openapi.json') || '{}';
    return res.send(buildScalarHtml(json));
  }

  @Get('swagger')
  @Header('Content-Type', 'text/html; charset=utf-8')
  getDocsSwagger(@Res() res: Response) {
    const json = getDocFile('openapi.json') || '{}';
    return res.send(buildSwaggerHtml(json));
  }
}
