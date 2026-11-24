// IINICIA Portal · bitácora · audit.controller.ts
/** Expone por HTTP la lectura paginada de eventos administrativos. */
import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { SupabaseAuthGuard } from '../../common/auth/supabase-auth.guard.js';
import type { AuthenticatedRequest } from '../../common/auth/supabase-auth.guard.js';
import { RolesGuard } from '../../common/auth/roles.guard.js';
import { PermissionsGuard } from '../../common/auth/permissions.guard.js';
import { Roles } from '../../common/auth/roles.decorator.js';
import { RequirePermissions } from '../../common/auth/permissions.decorator.js';
import { AuditService } from './audit.service.js';
import { QueryAuditDto } from './dto/query-audit.dto.js';

@Controller('audit')
export class AuditController {
  /** Recibe auditService como dependencias del módulo de bitácora. NestJS proporciona esas instancias para las operaciones del componente. */
  constructor(private readonly auditService: AuditService) {}

  /** Recibe filtros y paginación para consultar la bitácora con los permisos de la sesión. */
  @Get()
  @UseGuards(SupabaseAuthGuard, RolesGuard, PermissionsGuard)
  @Roles('superadministrador', 'administrador')
  @RequirePermissions('audit.logs.read')
  findAll(
    @Query() query: QueryAuditDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.auditService.findAll(query, req.accessToken);
  }
}
