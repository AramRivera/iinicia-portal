import { NestFactory } from '@nestjs/core';
import { RequestMethod, ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module.js';
import { SupabaseService } from './common/supabase/supabase.service.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.get(SupabaseService).assertConfiguration();
  app.setGlobalPrefix('api/v1', {
    exclude: [
      { path: 'docs', method: RequestMethod.GET },
      { path: 'swagger', method: RequestMethod.GET },
      { path: 'openapi.yaml', method: RequestMethod.GET },
      { path: 'openapi.json', method: RequestMethod.GET },
      { path: '', method: RequestMethod.GET },
    ],
  });

  const expressApp = app.getHttpAdapter().getInstance();
  expressApp.get('/api/v1/docs', (_req: any, res: any) => res.redirect('/docs'));
  expressApp.get('/api/v1/swagger', (_req: any, res: any) => res.redirect('/swagger'));
  expressApp.get('/api/v1/openapi.yaml', (_req: any, res: any) => res.redirect('/openapi.yaml'));
  expressApp.get('/api/v1/openapi.json', (_req: any, res: any) => res.redirect('/openapi.json'));

  app.enableCors({
    origin: process.env.CORS_ORIGIN?.split(',') || [
      'http://localhost:3000',
      'http://localhost:3001',
      'http://localhost:4000',
      'http://127.0.0.1:4000',
      'http://192.168.191.171:3000',
      'http://192.168.191.171:4000',
    ],
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  );

  const port = process.env.PORT ?? 3000;
  await app.listen(port);
}

await bootstrap();
