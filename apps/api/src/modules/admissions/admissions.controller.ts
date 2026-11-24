// IINICIA Portal · admisiones · admissions.controller.ts
/** Expone por HTTP la bandeja por rol, la creación de postulaciones y el dictamen con matrícula inicial. */
import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
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
import { AdmissionsService } from './admissions.service.js';
import { CreateAdmissionDto } from './dto/create-admission.dto.js';
import { ReviewAdmissionDto } from './dto/review-admission.dto.js';

@Controller('admissions')
export class AdmissionsController {
  /** Recibe admissionsService como dependencias del módulo de admisiones. NestJS proporciona esas instancias para las operaciones del componente. */
  constructor(private readonly admissionsService: AdmissionsService) {}

  /** Entrega las postulaciones visibles para la sesión de acuerdo con el ámbito que aplica el servicio. */
  @Get()
  @UseGuards(SupabaseAuthGuard)
  findApplications(@Req() req: AuthenticatedRequest) {
    return this.admissionsService.findApplications(
      req.user.id,
      req.accessToken,
    );
  }

  /** Recibe una postulación del titular de la sesión y delega al servicio la validación del programa y el registro. */
  @Post()
  @HttpCode(201)
  @UseGuards(SupabaseAuthGuard)
  createApplication(
    @Body() dto: CreateAdmissionDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.admissionsService.createApplication(req.user.id, dto);
  }

  /** Recibe el dictamen de una cuenta autorizada y delega la validación del ámbito y el cambio de estado. */
  @Patch(':id/review')
  @HttpCode(200)
  @UseGuards(SupabaseAuthGuard, RolesGuard, PermissionsGuard)
  @Roles('superadministrador', 'administrador', 'coordinador')
  @RequirePermissions('admissions.review')
  reviewApplication(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReviewAdmissionDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.admissionsService.reviewApplication(id, dto, req.user.id);
  }
}
