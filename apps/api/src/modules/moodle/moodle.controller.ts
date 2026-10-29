import {
  Controller,
  Get,
  Headers,
  HttpCode,
  Ip,
  Param,
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
import { MoodleService } from './moodle.service.js';

@Controller('moodle')
export class MoodleController {
  constructor(private readonly moodleService: MoodleService) {}

  @Get('status')
  checkStatus() {
    return this.moodleService.checkStatus();
  }

  @Post('sync/user/:userId')
  @HttpCode(200)
  @UseGuards(SupabaseAuthGuard, RolesGuard, PermissionsGuard)
  @Roles('superadministrador', 'administrador')
  @RequirePermissions('moodle.sync.execute')
  syncUser(@Param('userId') userId: string) {
    return this.moodleService.syncUser(userId);
  }

  @Post('sync/users')
  @HttpCode(200)
  @UseGuards(SupabaseAuthGuard, RolesGuard, PermissionsGuard)
  @Roles('superadministrador', 'administrador')
  @RequirePermissions('moodle.sync.execute')
  syncAllUsers() {
    return this.moodleService.syncAllUsers();
  }

  @Post('sync/enrollment/:enrollmentId')
  @HttpCode(200)
  @UseGuards(SupabaseAuthGuard, RolesGuard, PermissionsGuard)
  @Roles('superadministrador', 'administrador')
  @RequirePermissions('moodle.sync.execute')
  syncEnrollment(@Param('enrollmentId') enrollmentId: string) {
    return this.moodleService.syncEnrollment(enrollmentId);
  }

  /**
   * Genera el enlace de salto seguro SSO al campus principal de Moodle.
   */
  @Post('launch')
  @HttpCode(200)
  @UseGuards(SupabaseAuthGuard)
  launchCampus(
    @Req() req: AuthenticatedRequest,
    @Ip() ipAddress: string,
    @Headers('user-agent') userAgent: string,
  ) {
    return this.moodleService.getCampusAccessUrl({
      userId: req.user.id,
      ipAddress,
      userAgent,
    });
  }

  /**
   * Genera el enlace de salto seguro al curso de Moodle si el usuario
   * autenticado tiene una matrícula activa autorizada.
   * Registra cada salto en `campus_access_logs`.
   */
  @Post('courses/:courseMappingId/launch')
  @HttpCode(200)
  @UseGuards(SupabaseAuthGuard)
  launchCourse(
    @Param('courseMappingId') courseMappingId: string,
    @Req() req: AuthenticatedRequest,
    @Ip() ipAddress: string,
    @Headers('user-agent') userAgent: string,
  ) {
    return this.moodleService.getCourseAccessUrl({
      userId: req.user.id,
      courseMappingId,
      ipAddress,
      userAgent,
    });
  }

  /**
   * Obtiene la estructura de temas y módulos de un curso en Moodle.
   */
  @Get('courses/:courseId/contents')
  @UseGuards(SupabaseAuthGuard)
  async getCourseContents(
    @Param('courseId') courseId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    await this.moodleService.authorizeCourseRead(req.accessToken, req.user.id, Number(courseId), 'contents');
    return this.moodleService.getCourseContents(Number(courseId));
  }

  /**
   * Lista los participantes matriculados en un curso de Moodle.
   */
  @Get('courses/:courseId/participants')
  @UseGuards(SupabaseAuthGuard)
  async getCourseParticipants(
    @Param('courseId') courseId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    await this.moodleService.authorizeCourseRead(req.accessToken, req.user.id, Number(courseId), 'participants');
    return this.moodleService.getCourseParticipants(Number(courseId));
  }

  /**
   * Obtiene el progreso y calificaciones de un usuario en un curso de Moodle.
   */
  @Get('courses/:courseId/progress')
  @UseGuards(SupabaseAuthGuard)
  async getCourseProgress(
    @Param('courseId') courseId: string,
    @Req() req: AuthenticatedRequest,
    @Query('moodle_user_id') moodleUserId?: string,
  ) {
    const targetMoodleUserId = await this.moodleService.authorizeCourseRead(
      req.accessToken,
      req.user.id,
      Number(courseId),
      'progress',
      moodleUserId ? Number(moodleUserId) : undefined,
    );
    return this.moodleService.getUserCourseProgress(
      Number(courseId),
      targetMoodleUserId!,
    );
  }

  /**
   * Resumen analítico global de un curso (docentes y administradores).
   */
  @Get('courses/:courseId/teacher-overview')
  @UseGuards(SupabaseAuthGuard)
  async getCourseTeacherOverview(
    @Param('courseId') courseId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    await this.moodleService.authorizeCourseRead(req.accessToken, req.user.id, Number(courseId), 'teacher-overview');
    return this.moodleService.getCourseTeacherOverview(Number(courseId));
  }
}
