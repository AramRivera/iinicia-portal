import {
  ConflictException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  hasGlobalAcademicAccess,
  isScopedCoordinator,
  listAssignedProgramIds,
  loadActiveRoleSlugs,
  requireProgramScope,
} from '../../common/auth/program-scope.js';
import { SupabaseService } from '../../common/supabase/supabase.service.js';
import type { Database } from '../../common/supabase/database.types.js';
import { MoodleService } from '../moodle/moodle.service.js';
import { CreateEnrollmentRequestDto } from './dto/create-enrollment-request.dto.js';
import { UpdateEnrollmentStatusDto } from './dto/update-enrollment-status.dto.js';

@Injectable()
export class EnrollmentsService {
  private readonly logger = new Logger(EnrollmentsService.name);

  constructor(
    private readonly supabase: SupabaseService,
    private readonly moodleService: MoodleService,
  ) {}

  async findEnrollments(userId: string, accessToken: string) {
    const admin = this.supabase.getAdminClient();
    const roles = await loadActiveRoleSlugs(admin, userId);
    const coordinator = isScopedCoordinator(roles);
    const client = this.supabase.getResilientClient(accessToken);
    let query = client
      .from('enrollment_requests')
      .select('*, course_mappings!course_mapping_id (*), profiles!user_id ( id, email, first_name, last_name )')
      .order('created_at', { ascending: false });

    if (!coordinator && !hasGlobalAcademicAccess(roles)) {
      query = query.eq('user_id', userId);
    }

    const { data, error } = await query;
    if (error) {
      this.logger.error(`Error al consultar solicitudes de matrícula: ${error.message}`);
      throw new InternalServerErrorException(
        'No fue posible consultar las solicitudes de inscripción.',
      );
    }

    const enrollments = data ?? [];
    if (!coordinator) return enrollments;

    const programs = new Set(await listAssignedProgramIds(admin, userId));
    return enrollments.filter(({ user_id, course_mappings }) =>
      user_id === userId || (course_mappings?.program_id && programs.has(course_mappings.program_id)),
    );
  }

  async createEnrollmentRequest(
    userId: string,
    dto: CreateEnrollmentRequestDto,
    actorId = userId,
    assignmentToken?: string,
  ) {
    const admin = this.supabase.getAdminClient();
    const isAssignment = actorId !== userId;
    const role = dto.moodle_role ?? 'student';

    if (
      (!isAssignment && role !== 'student') ||
      !['student', 'editingteacher', 'teacher'].includes(role)
    ) {
      throw new ForbiddenException('No se permite asignar ese rol de Moodle.');
    }

    const { data: course, error: courseError } = await admin
      .from('course_mappings')
      .select('id, program_id, course_name, is_active')
      .eq('id', dto.course_mapping_id)
      .maybeSingle();

    if (courseError) {
      throw new InternalServerErrorException('No fue posible consultar el curso.');
    }
    if (!course || !course.is_active) {
      throw new NotFoundException('El curso solicitado no existe o no está activo.');
    }
    if (dto.program_id && dto.program_id !== course.program_id) {
      throw new ForbiddenException('El programa no corresponde al curso.');
    }
    if (isAssignment) {
      if (!assignmentToken) {
        throw new ForbiddenException('Se requiere autorización para asignar cursos.');
      }
      const client = this.supabase.getClient(assignmentToken);
      const { data: canAssign } = await client.rpc('has_permission', {
        required_permission_code: 'enrollments.authorize',
      });
      if (!canAssign) {
        throw new ForbiddenException('No tienes permiso para asignar cursos.');
      }
      const { data: isAdmin } = await client.rpc('is_admin', {});
      if (!isAdmin) {
        const { data: isCoordinator } = await client.rpc('has_role', {
          required_role_slug: 'coordinador',
        });
        if (!isCoordinator || !course.program_id) {
          throw new ForbiddenException('El curso está fuera de tu ámbito.');
        }
        await requireProgramScope(admin, actorId, course.program_id);
      }
    }

    const { data: existing, error: lookupError } = await admin
      .from('enrollment_requests')
      .select('*')
      .eq('user_id', userId)
      .eq('course_mapping_id', course.id)
      .maybeSingle();

    if (lookupError) {
      throw new InternalServerErrorException('No fue posible consultar la matrícula.');
    }
    if (existing?.status === 'pendiente' && !isAssignment) return existing;
    if (existing && !['pendiente', 'rechazada', 'desmatriculada'].includes(existing.status)) {
      throw new ConflictException('El usuario ya cuenta con una matrícula activa o en sincronización.');
    }

    const status = isAssignment ? 'autorizada' : 'pendiente';
    const values = {
      user_id: userId,
      course_mapping_id: course.id,
      program_id: course.program_id,
      moodle_role: role,
      status,
      requested_by: actorId,
      authorized_by: isAssignment ? actorId : null,
      authorized_at: isAssignment ? new Date().toISOString() : null,
      notes: dto.notes ?? null,
    } as const;
    const enrollments = admin.from('enrollment_requests');
    const mutation = existing
      ? enrollments.update(values).eq('id', existing.id).eq('status', existing.status)
      : enrollments.insert(values);
    const { data, error } = await mutation.select().maybeSingle();

    if (error?.code === '23505' || (!error && !data)) {
      throw new ConflictException('La matrícula cambió. Actualiza la lista e inténtalo de nuevo.');
    }
    if (error || !data) {
      throw new InternalServerErrorException('No fue posible registrar la solicitud de inscripción.');
    }

    await admin.from('audit_logs').insert({
      actor_id: actorId,
      target_user_id: userId,
      action: isAssignment ? 'ENROLLMENT_ASSIGNED_BY_ADMIN' : 'ENROLLMENT_REQUESTED',
      entity_name: 'enrollment_requests',
      entity_id: data.id,
      new_values: { course_mapping_id: course.id, moodle_role: role, status },
    });

    if (isAssignment) {
      try {
        const result = await this.moodleService.syncEnrollment(data.id);
        if (role === 'student') await this.ensureStudentRole(userId, actorId);
        return { ...data, status: result.status };
      } catch {
        this.logger.warn('La asignación se autorizó, pero no se confirmó la matrícula en Moodle.');
      }
    }
    return data;
  }

  /**
   * Autoriza o rechaza administrativamente una inscripción.
   * Si se autoriza y `sync_to_moodle` es true, ejecuta la sincronización oficial con Moodle.
   */
  async updateEnrollmentStatus(
    enrollmentId: string,
    dto: UpdateEnrollmentStatusDto,
    actorId: string,
    actorRoles: string[] = [],
  ) {
    const admin = this.supabase.getAdminClient();

    const { data: current, error: findError } = await admin
      .from('enrollment_requests')
      .select('*, course_mappings!course_mapping_id (program_id)')
      .eq('id', enrollmentId)
      .maybeSingle();

    if (findError || !current) {
      throw new NotFoundException('Solicitud de inscripción no encontrada.');
    }

    if (isScopedCoordinator(actorRoles)) {
      await requireProgramScope(admin, actorId, current.course_mappings?.program_id);
    }

    const now = new Date().toISOString();
    const updatePayload: Database['public']['Tables']['enrollment_requests']['Update'] = {
      status: dto.status,
      notes: dto.notes ?? current.notes,
    };

    if (dto.status === 'autorizada') {
      updatePayload.authorized_by = actorId;
      updatePayload.authorized_at = now;
    }

    const { data, error } = await admin
      .from('enrollment_requests')
      .update(updatePayload)
      .eq('id', enrollmentId)
      .select()
      .maybeSingle();

    if (error) {
      this.logger.error(`Error al actualizar estado de matrícula: ${error.message}`);
      throw new InternalServerErrorException(
        'No fue posible actualizar el estado de la inscripción.',
      );
    }

    await admin.from('audit_logs').insert({
      actor_id: actorId,
      target_user_id: current.user_id,
      action: 'ENROLLMENT_STATUS_UPDATED',
      entity_name: 'enrollment_requests',
      entity_id: enrollmentId,
      old_values: { status: current.status },
      new_values: { status: dto.status },
    });

    let syncResult = null;
    if (dto.status === 'autorizada' && dto.sync_to_moodle) {
      try {
        syncResult = await this.moodleService.syncEnrollment(enrollmentId);
        if (current.moodle_role === 'student') {
          await this.ensureStudentRole(current.user_id, actorId);
        }
      } catch (err: any) {
        this.logger.warn(
          `Matrícula autorizada pero falló sincronización inmediata con Moodle: ${err.message}`,
        );
      }
    }

    return {
      enrollment: data,
      moodle_sync: syncResult,
    };
  }

  async syncToMoodle(enrollmentId: string, actorId: string, actorRoles: string[] = []) {
    const admin = this.supabase.getAdminClient();
    const { data: enrollment, error } = await admin
      .from('enrollment_requests')
      .select('user_id, moodle_role, course_mappings!course_mapping_id (program_id)')
      .eq('id', enrollmentId)
      .maybeSingle();
    if (error || !enrollment) {
      throw new NotFoundException('Solicitud de inscripción no encontrada.');
    }
    if (isScopedCoordinator(actorRoles)) {
      await requireProgramScope(admin, actorId, enrollment.course_mappings?.program_id);
    }

    const result = await this.moodleService.syncEnrollment(enrollmentId);
    if (enrollment.moodle_role === 'student') {
      await this.ensureStudentRole(enrollment.user_id, actorId);
    }
    return result;
  }

  private async ensureStudentRole(userId: string, actorId: string) {
    const admin = this.supabase.getAdminClient();
    const { data: role, error: roleError } = await admin.from('roles')
      .select('id')
      .eq('slug', 'estudiante')
      .maybeSingle();
    if (roleError || !role) {
      this.logger.warn('No fue posible consultar el rol de estudiante.');
      return;
    }

    const { error } = await admin.from('user_roles').upsert(
      { user_id: userId, role_id: role.id, assigned_by: actorId },
      { onConflict: 'user_id,role_id', ignoreDuplicates: true },
    );
    if (error) this.logger.warn('No fue posible asignar el rol de estudiante.');
  }

  /**
   * Elimina / desasigna una matrícula de un curso:
   * - Coordinación puede desasignar matrículas de sus programas. Administración tiene alcance global.
   * - Si es alumno o profesor, puede dar de baja su propio curso.
   * - Llama a Moodle unenrolStudent para desmatricular en el aula virtual.
   * - Elimina el registro de enrollment_requests y registra la acción en audit_logs.
   */
  async deleteEnrollment(enrollmentId: string, actorId: string) {
    const admin = this.supabase.getAdminClient();

    const { data: enrollment, error } = await admin
      .from('enrollment_requests')
      .select('*, course_mappings!course_mapping_id (*), profiles!user_id (*)')
      .eq('id', enrollmentId)
      .maybeSingle();

    if (error || !enrollment) {
      throw new NotFoundException('Matrícula o solicitud no encontrada.');
    }

    const isOwnEnrollment = enrollment.user_id === actorId;
    if (!isOwnEnrollment) {
      const roles = await loadActiveRoleSlugs(admin, actorId);
      if (isScopedCoordinator(roles)) {
        await requireProgramScope(admin, actorId, enrollment.course_mappings?.program_id);
      } else if (!hasGlobalAcademicAccess(roles)) {
        throw new ForbiddenException('No posees autorización para desasignar esta matrícula.');
      }
    }

    // Desmatricular en Moodle LMS
    try {
      await this.moodleService.unenrolStudent(enrollmentId);
    } catch (err: any) {
      this.logger.warn(`Error al desmatricular en Moodle: ${err?.message}`);
    }

    // Eliminar de enrollment_requests
    const { error: deleteError } = await admin
      .from('enrollment_requests')
      .delete()
      .eq('id', enrollmentId);

    if (deleteError) {
      this.logger.error(`Error al eliminar matrícula: ${deleteError.message}`);
      throw new InternalServerErrorException('No fue posible desasignar la matrícula.');
    }

    // Registrar en auditoría
    const courseMapping = enrollment.course_mappings;
    await admin.from('audit_logs').insert({
      actor_id: actorId,
      target_user_id: enrollment.user_id,
      action: isOwnEnrollment ? 'ENROLLMENT_DROPPED_BY_STUDENT' : 'ENROLLMENT_UNASSIGNED_BY_ADMIN',
      entity_name: 'enrollment_requests',
      entity_id: enrollmentId,
      old_values: {
        course_mapping_id: enrollment.course_mapping_id,
        course_name: courseMapping?.course_name,
        moodle_role: enrollment.moodle_role,
        status: enrollment.status,
      },
    });

    return {
      success: true,
      message: 'Matrícula desasignada y dada de baja exitosamente.',
    };
  }
}
