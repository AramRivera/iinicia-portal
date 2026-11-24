// IINICIA Portal · contenido institucional · cms.module.ts
/** Registra el controlador y los proveedores de contenido institucional y migración de WordPress en NestJS. */
import { Module } from '@nestjs/common';
import { SupabaseModule } from '../../common/supabase/supabase.module.js';
import { CmsService } from './cms.service.js';
import { CmsController } from './cms.controller.js';

@Module({
  imports: [SupabaseModule],
  controllers: [CmsController],
  providers: [CmsService],
  exports: [CmsService],
})
export class CmsModule {}
