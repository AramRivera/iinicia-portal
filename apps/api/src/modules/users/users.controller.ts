import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { SupabaseAuthGuard } from '../../common/auth/supabase-auth.guard.js';
import type { AuthenticatedRequest } from '../../common/auth/supabase-auth.guard.js';
import { RolesGuard } from '../../common/auth/roles.guard.js';
import { PermissionsGuard } from '../../common/auth/permissions.guard.js';
import { Roles } from '../../common/auth/roles.decorator.js';
import { RequirePermissions } from '../../common/auth/permissions.decorator.js';
import { UsersService } from './users.service.js';
import { QueryUsersDto } from './dto/query-users.dto.js';
import { UpdateUserStatusDto } from './dto/update-user-status.dto.js';
import { UpdateOwnProfileDto } from './dto/update-own-profile.dto.js';
import { CreateUserAdminDto } from './dto/create-user-admin.dto.js';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  /**
   * Listado paginado de usuarios con filtros y búsqueda.
   * Reservado para personal administrativo y de soporte.
   */
  @Get()
  @UseGuards(SupabaseAuthGuard, RolesGuard, PermissionsGuard)
  @Roles('superadministrador', 'administrador', 'coordinador', 'soporte')
  @RequirePermissions('users.read')
  findUsers(
    @Query() query: QueryUsersDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.usersService.findUsers(query, req.accessToken);
  }

  /**
   * Creación administrativa de usuario con asignación directa de rol.
   * No altera ni suplanta la sesión del administrador.
   */
  @Post()
  @HttpCode(201)
  @UseGuards(SupabaseAuthGuard, RolesGuard, PermissionsGuard)
  @Roles('superadministrador', 'administrador')
  @RequirePermissions('users.manage')
  createUser(
    @Body() dto: CreateUserAdminDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.usersService.createUserByAdmin(dto, req.user.id);
  }

  /**
   * Actualización del propio perfil del usuario autenticado.
   */
  @Patch('me/profile')
  @HttpCode(200)
  @UseGuards(SupabaseAuthGuard)
  updateOwnProfile(
    @Body() dto: UpdateOwnProfileDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.usersService.updateOwnProfile(req.user.id, dto, req.accessToken);
  }

  /**
   * Detalle consolidado de un usuario por su ID.
   * Un estudiante/profesor solo puede consultar su propio ID; administradores pueden consultar cualquiera.
   */
  @Get(':id')
  @UseGuards(SupabaseAuthGuard)
  async findUserById(
    @Param('id') id: string,
    @Req() req: AuthenticatedRequest,
  ) {
    const userRoles = (req as any).userRoles || [];
    const isStaff =
      userRoles.includes('superadministrador') ||
      userRoles.includes('administrador') ||
      userRoles.includes('coordinador') ||
      userRoles.includes('soporte');

    return this.usersService.findUserById(
      id,
      req.user.id,
      isStaff,
      req.accessToken,
    );
  }

  /**
   * Cambia el estado administrativo de un usuario (activar, suspender, dar de baja).
   * Requiere permiso 'users.manage'.
   */
  @Patch(':id/status')
  @HttpCode(200)
  @UseGuards(SupabaseAuthGuard, RolesGuard, PermissionsGuard)
  @Roles('superadministrador', 'administrador')
  @RequirePermissions('users.manage')
  updateUserStatus(
    @Param('id') id: string,
    @Body() dto: UpdateUserStatusDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.usersService.updateUserStatus(id, dto, req.user.id);
  }
}
