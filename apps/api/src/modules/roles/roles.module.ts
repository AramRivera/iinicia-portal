// IINICIA Portal · roles · roles.module.ts
/** Registra el controlador y los proveedores de catálogo y asignación de roles en NestJS. */
import { Module } from '@nestjs/common';
import { SupabaseModule } from '../../common/supabase/supabase.module.js';
import { RolesService } from './roles.service.js';
import { RolesController } from './roles.controller.js';

@Module({
  imports: [SupabaseModule],
  controllers: [RolesController],
  providers: [RolesService],
  exports: [RolesService],
})
export class RolesModule {}
