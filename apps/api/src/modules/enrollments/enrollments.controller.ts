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
import { EnrollmentsService } from './enrollments.service.js';
import { CreateEnrollmentRequestDto } from './dto/create-enrollment-request.dto.js';
import { UpdateEnrollmentStatusDto } from './dto/update-enrollment-status.dto.js';

@Controller('enrollments')
export class EnrollmentsController {
  constructor(private readonly enrollmentsService: EnrollmentsService) {}

  @Get()
  @UseGuards(SupabaseAuthGuard)
  findEnrollments(@Req() req: AuthenticatedRequest) {
    const userRoles = (req as any).userRoles || [];
    const isStaff =
      userRoles.includes('superadministrador') ||
      userRoles.includes('administrador') ||
      userRoles.includes('coordinador') ||
      userRoles.includes('soporte');

    return this.enrollmentsService.findEnrollments(
      req.user.id,
      isStaff,
      req.accessToken,
    );
  }

  @Post()
  @HttpCode(201)
  @UseGuards(SupabaseAuthGuard, RolesGuard)
  createEnrollmentRequest(
    @Body() dto: CreateEnrollmentRequestDto,
    @Req() req: AuthenticatedRequest,
  ) {
    const isStaff =
      req.userRoles?.includes('superadministrador') ||
      req.userRoles?.includes('administrador') ||
      req.userRoles?.includes('coordinador');
    const targetUserId = isStaff && dto.user_id ? dto.user_id : req.user.id;
    return this.enrollmentsService.createEnrollmentRequest(
      targetUserId,
      dto,
      req.user.id,
      Boolean(isStaff && dto.user_id),
    );
  }

  @Patch(':id/status')
  @HttpCode(200)
  @UseGuards(SupabaseAuthGuard, RolesGuard, PermissionsGuard)
  @Roles('superadministrador', 'administrador', 'coordinador')
  @RequirePermissions('enrollments.authorize')
  updateEnrollmentStatus(
    @Param('id') id: string,
    @Body() dto: UpdateEnrollmentStatusDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.enrollmentsService.updateEnrollmentStatus(id, dto, req.user.id);
  }

  @Post(':id/sync')
  @HttpCode(200)
  @UseGuards(SupabaseAuthGuard, RolesGuard, PermissionsGuard)
  @Roles('superadministrador', 'administrador', 'coordinador')
  @RequirePermissions('moodle.sync.execute')
  syncToMoodle(@Param('id') id: string) {
    return this.enrollmentsService.syncToMoodle(id);
  }
}
