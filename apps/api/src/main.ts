import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module.js';
import { SupabaseService } from './common/supabase/supabase.service.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.get(SupabaseService).assertConfiguration();
  app.setGlobalPrefix('api/v1');

  app.enableCors({
    origin: process.env.CORS_ORIGIN?.split(',') || [
      'http://localhost:3000',
      'http://localhost:3001',
      'http://192.168.191.171:3000'
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
