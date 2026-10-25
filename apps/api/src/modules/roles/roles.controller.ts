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
  constructor(private readonly rolesService: RolesService) {}

  @Get()
  @UseGuards(SupabaseAuthGuard)
  findAll(@Req() req: AuthenticatedRequest) {
    return this.rolesService.findAll(req.accessToken);
  }

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
    return this.rolesService.assignRole(userId, dto, req.user.id);
  }

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
    return this.rolesService.revokeRole(userId, roleId, req.user.id);
  }
}
