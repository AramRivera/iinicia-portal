// IINICIA Portal · permisos · permissions.controller.ts
/** Expone por HTTP el catálogo paginado de permisos. */
// apps/api/src/modules/permissions/permissions.controller.ts
import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { SupabaseAuthGuard } from '../../common/auth/supabase-auth.guard.js';
import type { AuthenticatedRequest } from '../../common/auth/supabase-auth.guard.js';
import { PermissionsService } from './permissions.service.js';
import { QueryPermissionsDto } from './dto/query-permissions.dto.js';

@Controller('permissions')
@UseGuards(SupabaseAuthGuard)
export class PermissionsController {
  /** Recibe permissionsService como dependencias del módulo de permisos. NestJS proporciona esas instancias para las operaciones del componente. */
  constructor(private readonly permissionsService: PermissionsService) {}

  /** Entrega el catálogo de permisos mediante el servicio que interpreta la consulta y su paginación. */
  @Get()
  findAll(
    @Query() query: QueryPermissionsDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.permissionsService.findAll(query, request.accessToken);
  }
}
