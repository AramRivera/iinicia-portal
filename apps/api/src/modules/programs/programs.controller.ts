// IINICIA Portal · programas académicos · programs.controller.ts
/** Expone por HTTP catálogo, edición y asignación de usuarios a programas. */
import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { SupabaseAuthGuard } from '../../common/auth/supabase-auth.guard.js';
import type { AuthenticatedRequest } from '../../common/auth/supabase-auth.guard.js';
import { RolesGuard } from '../../common/auth/roles.guard.js';
import { PermissionsGuard } from '../../common/auth/permissions.guard.js';
import { Roles } from '../../common/auth/roles.decorator.js';
import { RequirePermissions } from '../../common/auth/permissions.decorator.js';
import { ProgramsService } from './programs.service.js';
import { CreateProgramDto } from './dto/create-program.dto.js';
import { UpdateProgramDto } from './dto/update-program.dto.js';
import { AssignUserProgramDto } from './dto/assign-user-program.dto.js';

@Controller('programs')
export class ProgramsController {
  /** Recibe programsService como dependencias del módulo de programas académicos. NestJS proporciona esas instancias para las operaciones del componente. */
  constructor(private readonly programsService: ProgramsService) {}

  /** Entrega el listado público de programas con los filtros que admite el catálogo. */
  @Get()
  findAll(@Req() req: Request) {
    const authHeader = req.headers.authorization;
    const token = authHeader?.match(/^Bearer\s+(\S+)$/i)?.[1];
    return this.programsService.findAll(token, false);
  }

  /** Resuelve el programa a partir de su UUID o su identificador legible para servir el detalle. */
  @Get(':idOrSlug')
  findByIdOrSlug(
    @Param('idOrSlug') idOrSlug: string,
    @Req() req: Request,
  ) {
    const authHeader = req.headers.authorization;
    const token = authHeader?.match(/^Bearer\s+(\S+)$/i)?.[1];
    return this.programsService.findByIdOrSlug(idOrSlug, token);
  }

  /** Recibe la definición de un programa de una sesión autorizada y delega su alta al servicio. */
  @Post()
  @HttpCode(201)
  @UseGuards(SupabaseAuthGuard, RolesGuard, PermissionsGuard)
  @Roles('superadministrador', 'administrador')
  @RequirePermissions('programs.manage')
  create(
    @Body() dto: CreateProgramDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.programsService.create(dto, req.user.id);
  }

  /** Entrega el programa y los campos de actualización al servicio después de verificar el permiso administrativo. */
  @Patch(':id')
  @HttpCode(200)
  @UseGuards(SupabaseAuthGuard, RolesGuard, PermissionsGuard)
  @Roles('superadministrador', 'administrador')
  @RequirePermissions('programs.manage')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateProgramDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.programsService.update(id, dto, req.user.id);
  }

  /** Solicita vincular una cuenta a un programa y delega al servicio la comprobación de autorización y alcance. */
  @Post(':id/enroll-user')
  @HttpCode(200)
  @UseGuards(SupabaseAuthGuard, RolesGuard)
  @Roles('superadministrador', 'administrador', 'coordinador')
  assignUser(
    @Param('id') programId: string,
    @Body() dto: AssignUserProgramDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.programsService.assignUserToProgram(
      programId,
      dto,
      req.user.id,
    );
  }
}
