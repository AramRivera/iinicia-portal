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
  constructor(private readonly admissionsService: AdmissionsService) {}

  @Get()
  @UseGuards(SupabaseAuthGuard)
  findApplications(@Req() req: AuthenticatedRequest) {
    const userRoles = (req as any).userRoles || [];
    const isStaff =
      userRoles.includes('superadministrador') ||
      userRoles.includes('administrador') ||
      userRoles.includes('coordinador');

    return this.admissionsService.findApplications(
      req.user.id,
      isStaff,
      req.accessToken,
    );
  }

  @Post()
  @HttpCode(201)
  @UseGuards(SupabaseAuthGuard)
  createApplication(
    @Body() dto: CreateAdmissionDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.admissionsService.createApplication(req.user.id, dto);
  }

  @Patch(':id/review')
  @HttpCode(200)
  @UseGuards(SupabaseAuthGuard, RolesGuard, PermissionsGuard)
  @Roles('superadministrador', 'administrador', 'coordinador')
  @RequirePermissions('admissions.review')
  reviewApplication(
    @Param('id') id: string,
    @Body() dto: ReviewAdmissionDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.admissionsService.reviewApplication(id, dto, req.user.id);
  }
}
