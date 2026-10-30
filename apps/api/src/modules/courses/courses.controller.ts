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
import { CoursesService } from './courses.service.js';
import { CreateCourseMappingDto } from './dto/create-course-mapping.dto.js';
import { UpdateCourseMappingDto } from './dto/update-course-mapping.dto.js';

@Controller('courses')
export class CoursesController {
  constructor(private readonly coursesService: CoursesService) {}

  @Get('offerings')
  @UseGuards(SupabaseAuthGuard)
  findOfferings(@Req() req: AuthenticatedRequest) {
    return this.coursesService.findCourses(req.user.id, true, req.accessToken);
  }

  /**
   * Sincroniza bajo demanda todos los cursos creados en Moodle hacia la plataforma.
   */
  @Post('sync-moodle')
  @HttpCode(200)
  @UseGuards(SupabaseAuthGuard, RolesGuard, PermissionsGuard)
  @Roles('superadministrador', 'administrador', 'coordinador')
  @RequirePermissions('courses.manage')
  syncMoodleCourses() {
    return this.coursesService.syncCoursesFromMoodle();
  }

  /**
   * Consulta cursos.
   * - Para Estudiantes y Profesores: solo devuelve sus cursos autorizados (`v_user_authorized_courses`).
   * - Para Administradores y Coordinadores: devuelve el catálogo completo de cursos mapeados.
   */
  @Get()
  @UseGuards(SupabaseAuthGuard, RolesGuard)
  findCourses(@Req() req: AuthenticatedRequest) {
    const userRoles = req.userRoles || [];
    const isStaff =
      userRoles.includes('superadministrador') ||
      userRoles.includes('administrador') ||
      userRoles.includes('coordinador');

    return this.coursesService.findCourses(
      req.user.id,
      isStaff,
      req.accessToken,
    );
  }

  @Get(':id')
  @UseGuards(SupabaseAuthGuard)
  findById(
    @Param('id') id: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.coursesService.findById(id, req.accessToken);
  }

  @Post()
  @HttpCode(201)
  @UseGuards(SupabaseAuthGuard, RolesGuard, PermissionsGuard)
  @Roles('superadministrador', 'administrador')
  @RequirePermissions('courses.manage')
  create(
    @Body() dto: CreateCourseMappingDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.coursesService.create(dto, req.user.id);
  }

  @Patch(':id')
  @HttpCode(200)
  @UseGuards(SupabaseAuthGuard, RolesGuard, PermissionsGuard)
  @Roles('superadministrador', 'administrador')
  @RequirePermissions('courses.manage')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateCourseMappingDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.coursesService.update(id, dto, req.user.id);
  }
}
