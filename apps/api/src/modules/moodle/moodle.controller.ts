import {
  BadRequestException,
  Controller,
  ForbiddenException,
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
  @Roles('superadministrador', 'administrador', 'coordinador')
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
   * Requiere matrícula activa en el curso o perfil de gestión (staff).
   */
  @Get('courses/:courseId/contents')
  @UseGuards(SupabaseAuthGuard)
  async getCourseContents(
    @Param('courseId') courseId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    await this.moodleService.validateCourseAccess(req.user.id, Number(courseId));
    return this.moodleService.getCourseContents(Number(courseId));
  }

  /**
   * Lista los participantes matriculados en un curso de Moodle.
   * Reservado para docentes asignados al curso o personal administrativo.
   */
  @Get('courses/:courseId/participants')
  @UseGuards(SupabaseAuthGuard)
  async getCourseParticipants(
    @Param('courseId') courseId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    await this.moodleService.validateCourseAccess(req.user.id, Number(courseId), {
      requireTeacher: true,
    });
    return this.moodleService.getCourseParticipants(Number(courseId));
  }

  /**
   * Obtiene el progreso y calificaciones de un usuario en un curso de Moodle.
   * Los estudiantes solo pueden consultar su propio progreso.
   * Docentes y administradores pueden auditar el progreso de otros alumnos.
   */
  @Get('courses/:courseId/progress')
  @UseGuards(SupabaseAuthGuard)
  async getCourseProgress(
    @Param('courseId') courseId: string,
    @Req() req: AuthenticatedRequest,
    @Query('moodle_user_id') queryMoodleUserId?: string,
  ) {
    const access = await this.moodleService.validateCourseAccess(
      req.user.id,
      Number(courseId),
    );

    let targetMoodleUserId = queryMoodleUserId
      ? Number(queryMoodleUserId)
      : access.moodleUserId;

    // Si es estudiante (no es profesor ni staff), forzar estrictamente su propio id
    if (!access.isTeacher && !access.isStaff) {
      if (
        queryMoodleUserId &&
        access.moodleUserId != null &&
        Number(queryMoodleUserId) !== access.moodleUserId
      ) {
        throw new ForbiddenException(
          'No posees autorización para consultar el progreso de otro estudiante.',
        );
      }
      targetMoodleUserId = access.moodleUserId;
    }

    if (!targetMoodleUserId) {
      throw new BadRequestException(
        'El perfil no cuenta con un identificador de Moodle sincronizado.',
      );
    }

    return this.moodleService.getUserCourseProgress(
      Number(courseId),
      targetMoodleUserId,
    );
  }

  /**
   * Resumen analítico global de un curso (docentes asignados y administradores).
   */
  @Get('courses/:courseId/teacher-overview')
  @UseGuards(SupabaseAuthGuard)
  async getCourseTeacherOverview(
    @Param('courseId') courseId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    await this.moodleService.validateCourseAccess(req.user.id, Number(courseId), {
      requireTeacher: true,
    });
    return this.moodleService.getCourseTeacherOverview(Number(courseId));
  }
}
