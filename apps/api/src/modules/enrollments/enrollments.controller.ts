import {
  Body,
  Controller,
  Delete,
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
    return this.enrollmentsService.findEnrollments(req.user.id, req.accessToken);
  }

  @Post()
  @HttpCode(201)
  @UseGuards(SupabaseAuthGuard)
  async createEnrollmentRequest(
    @Body() dto: CreateEnrollmentRequestDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.enrollmentsService.createEnrollmentRequest(
      dto.user_id ?? req.user.id,
      dto,
      req.user.id,
      req.accessToken,
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
    return this.enrollmentsService.updateEnrollmentStatus(id, dto, req.user.id, req.userRoles);
  }

  @Post(':id/sync')
  @HttpCode(200)
  @UseGuards(SupabaseAuthGuard, RolesGuard, PermissionsGuard)
  @Roles('superadministrador', 'administrador', 'coordinador')
  @RequirePermissions('moodle.sync.execute')
  syncToMoodle(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.enrollmentsService.syncToMoodle(id, req.user.id, req.userRoles);
  }

  @Delete(':id')
  @HttpCode(200)
  @UseGuards(SupabaseAuthGuard)
  deleteEnrollment(
    @Param('id') id: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.enrollmentsService.deleteEnrollment(id, req.user.id);
  }
}
