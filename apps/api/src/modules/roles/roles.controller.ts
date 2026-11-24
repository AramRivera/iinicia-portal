// IINICIA Portal · roles · roles.controller.ts
/** Expone por HTTP consulta, asignación y revocación de roles. */
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseIntPipe,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { SupabaseAuthGuard } from '../../common/auth/supabase-auth.guard.js';
import type { AuthenticatedRequest } from '../../common/auth/supabase-auth.guard.js';
import { RolesGuard } from '../../common/auth/roles.guard.js';
import { PermissionsGuard } from '../../common/auth/permissions.guard.js';
import { Roles } from '../../common/auth/roles.decorator.js';
import { RequirePermissions } from '../../common/auth/permissions.decorator.js';
import { RolesService } from './roles.service.js';
import { AssignRoleDto } from './dto/assign-role.dto.js';

@Controller('roles')
export class RolesController {
  /** Recibe rolesService como dependencias del módulo de roles. NestJS proporciona esas instancias para las operaciones del componente. */
  constructor(private readonly rolesService: RolesService) {}

  /** Devuelve los roles disponibles a través del servicio que consulta el catálogo con la sesión. */
  @Get()
  @UseGuards(SupabaseAuthGuard)
  findAll(@Req() req: AuthenticatedRequest) {
    return this.rolesService.findAll(req.accessToken);
  }

  /** Recibe el rol que se asignará a la cuenta objetivo y delega sus límites jerárquicos y de vigencia. */
  @Post('users/:userId')
  @HttpCode(201)
  @UseGuards(SupabaseAuthGuard, RolesGuard, PermissionsGuard)
  @Roles('superadministrador', 'administrador')
  @RequirePermissions('roles.assign')
  assignRole(
    @Param('userId') userId: string,
    @Body() dto: AssignRoleDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.rolesService.assignRole(userId, dto, req.user.id, req.userRoles ?? []);
  }

  /** Solicita retirar una asignación de rol y deja al servicio la comprobación de las restricciones de administración. */
  @Delete('users/:userId/:roleId')
  @HttpCode(200)
  @UseGuards(SupabaseAuthGuard, RolesGuard, PermissionsGuard)
  @Roles('superadministrador', 'administrador')
  @RequirePermissions('roles.assign')
  revokeRole(
    @Param('userId') userId: string,
    @Param('roleId', ParseIntPipe) roleId: number,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.rolesService.revokeRole(userId, roleId, req.user.id, req.userRoles ?? []);
  }
}
