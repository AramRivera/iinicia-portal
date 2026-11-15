/** Registra el controlador y los proveedores de catálogo de permisos en NestJS. */
// apps/api/src/modules/permissions/permissions.module.ts
import { Module } from '@nestjs/common';
import { SupabaseAuthGuard } from '../../common/auth/supabase-auth.guard.js';
import { SupabaseModule } from '../../common/supabase/supabase.module.js';
import { PermissionsController } from './permissions.controller.js';
import { PermissionsService } from './permissions.service.js';
import { PermissionsRepository } from './permissions.repository.js';

@Module({
  imports: [SupabaseModule],
  controllers: [PermissionsController],
  providers: [PermissionsService, PermissionsRepository, SupabaseAuthGuard],
  exports: [PermissionsService],
})
export class PermissionsModule {}
