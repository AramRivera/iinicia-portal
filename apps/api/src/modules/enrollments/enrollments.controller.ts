import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
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
  async findEnrollments(@Req() req: AuthenticatedRequest) {
    const isStaff = await this.enrollmentsService.checkIsStaff(req.user.id);

    return this.enrollmentsService.findEnrollments(
      req.user.id,
      isStaff,
      req.accessToken,
    );
  }

  @Post()
  @HttpCode(201)
  @UseGuards(SupabaseAuthGuard)
  async createEnrollmentRequest(
    @Body() dto: CreateEnrollmentRequestDto,
    @Req() req: AuthenticatedRequest,
  ) {
    const isAssigningOther = Boolean(dto.user_id && dto.user_id !== req.user.id);
    const isStaff = await this.enrollmentsService.checkIsStaff(req.user.id);

    if (isAssigningOther && !isStaff) {
      throw new ForbiddenException(
        'No posees privilegios de administración para asignar cursos a otros usuarios.',
      );
    }

    const targetUserId = isAssigningOther ? dto.user_id! : req.user.id;
    return this.enrollmentsService.createEnrollmentRequest(
      targetUserId,
      dto,
      req.user.id,
      isStaff,
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

  @Delete(':id')
  @HttpCode(200)
  @UseGuards(SupabaseAuthGuard)
  async deleteEnrollment(
    @Param('id') id: string,
    @Req() req: AuthenticatedRequest,
  ) {
    const isStaff = await this.enrollmentsService.checkIsStaff(req.user.id);
    return this.enrollmentsService.deleteEnrollment(id, req.user.id, isStaff);
  }
}
