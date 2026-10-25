import { Controller, Get, Header, Res } from '@nestjs/common';
import type { Response } from 'express';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { AppService } from './app.service.js';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Get('openapi.yaml')
  @Header('Content-Type', 'text/yaml; charset=utf-8')
  getOpenApiYaml(@Res() res: Response) {
    const candidatePaths = [
      resolve(process.cwd(), '../../docs/openapi.yaml'),
      resolve(process.cwd(), '../docs/openapi.yaml'),
      resolve(process.cwd(), 'docs/openapi.yaml'),
    ];
    const path = candidatePaths.find((p) => existsSync(p));
    if (!path) {
      return res.status(404).send('openapi.yaml no encontrado.');
    }
    const content = readFileSync(path, 'utf8');
    return res.send(content);
  }

  @Get('docs')
  @Header('Content-Type', 'text/html; charset=utf-8')
  getInteractiveDocs(@Res() res: Response) {
    const html = `<!doctype html>
<html>
  <head>
    <title>IINICIA API - Documentación Interactiva</title>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style>body { margin: 0; padding: 0; }</style>
  </head>
  <body>
    <script
      id="api-reference"
      data-url="/api/v1/openapi.yaml">
    </script>
    <script src="https://cdn.jsdelivr.net/npm/@scalar/api-reference"></script>
  </body>
</html>`;
    return res.send(html);
  }
}
