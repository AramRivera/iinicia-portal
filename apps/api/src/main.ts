import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module.js';
import { SupabaseService } from './common/supabase/supabase.service.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.get(SupabaseService).assertConfiguration();
  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  );

  await app.listen(process.env.PORT ?? 3000);
}
await bootstrap();
