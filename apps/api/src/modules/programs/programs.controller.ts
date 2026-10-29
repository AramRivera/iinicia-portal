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
  constructor(private readonly programsService: ProgramsService) {}

  @Get()
  findAll(@Req() req: Request) {
    const authHeader = req.headers.authorization;
    const token = authHeader?.match(/^Bearer\s+(\S+)$/i)?.[1];
    return this.programsService.findAll(token, false);
  }

  @Get(':idOrSlug')
  findByIdOrSlug(
    @Param('idOrSlug') idOrSlug: string,
    @Req() req: Request,
  ) {
    const authHeader = req.headers.authorization;
    const token = authHeader?.match(/^Bearer\s+(\S+)$/i)?.[1];
    return this.programsService.findByIdOrSlug(idOrSlug, token);
  }

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

  @Post(':id/enroll-user')
  @HttpCode(200)
  @UseGuards(SupabaseAuthGuard, RolesGuard)
  @Roles('superadministrador', 'administrador')
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
