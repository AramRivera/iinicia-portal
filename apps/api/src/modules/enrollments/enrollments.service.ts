import {
  ConflictException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
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

  /**
   * Verifica si un usuario posee rol administrativo para operar matrículas globales.
   */
  async checkIsStaff(userId: string, accessToken: string): Promise<boolean> {
    const client = this.supabase.getResilientClient(accessToken);
    const { data: roles, error } = await client
      .from('user_roles')
      .select('expires_at, roles!role_id ( slug )')
      .eq('user_id', userId)
      .eq('is_active', true);

    if (error || !roles || !Array.isArray(roles)) {
      throw new ForbiddenException('No fue posible comprobar los roles de tu cuenta.');
    }
    const now = new Date().toISOString();
    const slugs = roles
      .filter((role) => !role.expires_at || role.expires_at >= now)
      .map((role) => {
        const embedded = role.roles as unknown as { slug: string } | { slug: string }[] | null;
        return Array.isArray(embedded) ? embedded[0]?.slug : embedded?.slug;
      })
      .filter(Boolean);

    return (
      slugs.includes('superadministrador') ||
      slugs.includes('administrador')
    );
  }

  /**
   * Consulta de inscripciones y solicitudes:
   * - Personal administrativo (staff): puede consultar todas las solicitudes.
   * - Alumnos / aspirantes: únicamente consultan sus propias solicitudes.
   */
  async findEnrollments(
    userId: string,
    isStaff: boolean,
    accessToken: string,
  ) {
    const client = this.supabase.getResilientClient(accessToken);
    let query = client
      .from('enrollment_requests')
      .select('*, course_mappings!course_mapping_id (*), profiles!user_id ( id, email, first_name, last_name )')
      .order('created_at', { ascending: false });

    if (!isStaff) {
      query = query.eq('user_id', userId);
    }

    const { data, error } = await query;
    if (error) {
      this.logger.error(`Error al consultar solicitudes de matrícula: ${error.message}`);
      throw new InternalServerErrorException(
        'No fue posible consultar las solicitudes de inscripción.',
      );
    }

    return data || [];
  }

  /**
   * Crea una nueva solicitud de inscripción a un curso.
   * Estado inicial: 'pendiente'.
   */
  async createEnrollmentRequest(
    userId: string,
    dto: CreateEnrollmentRequestDto,
    actorId?: string,
    isStaffAssignment: boolean = false,
  ) {
    const admin = this.supabase.getAdminClient();

    // Validar curso
    const { data: course } = await admin
      .from('course_mappings')
      .select('id, program_id, course_name, is_active')
      .eq('id', dto.course_mapping_id)
      .maybeSingle();

    if (!course || !course.is_active) {
      throw new NotFoundException('El curso solicitado no existe o no está activo.');
    }

    // Comprobar si ya existe una solicitud para este usuario y curso
    const { data: existing } = await admin
      .from('enrollment_requests')
      .select('id, status')
      .eq('user_id', userId)
      .eq('course_mapping_id', dto.course_mapping_id)
      .maybeSingle();

    const nowIso = new Date().toISOString();
    const effectiveActor = actorId || userId;

    if (existing) {
      if (existing.status === 'sincronizada' || existing.status === 'autorizada') {
        throw new ConflictException(
          `El usuario ya cuenta con una matrícula activa en este curso.`,
        );
      }

      if (existing.status === 'pendiente' && !isStaffAssignment) {
        throw new ConflictException('Ya tienes una solicitud pendiente para este curso.');
      }

      // Una solicitud personal vuelve a revisión; solo personal autorizado puede aprobarla.
      const { data: updated, error: updError } = await admin
        .from('enrollment_requests')
        .update({
          status: isStaffAssignment ? 'autorizada' : 'pendiente',
          moodle_role: isStaffAssignment ? dto.moodle_role || 'student' : 'student',
          authorized_by: isStaffAssignment ? effectiveActor : null,
          authorized_at: isStaffAssignment ? nowIso : null,
          requested_by: effectiveActor,
          notes: dto.notes ?? (isStaffAssignment ? 'Asignado directamente por administrador' : null),
        })
        .eq('id', existing.id)
        .select()
        .maybeSingle();

      if (updError || !updated) {
        throw new InternalServerErrorException('Error al reactivar solicitud de inscripción.');
      }

      if (isStaffAssignment) {
        try {
          await this.moodleService.syncEnrollment(updated.id);
        } catch (err: any) {
          this.logger.warn(`Error al sincronizar matrícula existente con Moodle: ${err?.message}`);
        }
      }

      return updated;
    }

    const programId = isStaffAssignment ? dto.program_id || course.program_id : course.program_id;
    const initialStatus = isStaffAssignment ? 'autorizada' : 'pendiente';

    const { data, error } = await admin
      .from('enrollment_requests')
      .insert({
        user_id: userId,
        course_mapping_id: dto.course_mapping_id,
        program_id: programId,
        moodle_role: isStaffAssignment ? dto.moodle_role || 'student' : 'student',
        status: initialStatus,
        requested_by: effectiveActor,
        authorized_by: isStaffAssignment ? effectiveActor : null,
        authorized_at: isStaffAssignment ? nowIso : null,
        notes: dto.notes ?? null,
      })
      .select()
      .maybeSingle();

    if (error || !data) {
      this.logger.error(`Error al registrar matrícula: ${error?.message}`);
      throw new InternalServerErrorException(
        'No fue posible registrar la solicitud de inscripción.',
      );
    }

    await admin.from('audit_logs').insert({
      actor_id: effectiveActor,
      target_user_id: userId,
      action: isStaffAssignment
        ? 'ENROLLMENT_ASSIGNED_BY_ADMIN'
        : 'ENROLLMENT_REQUESTED',
      entity_name: 'enrollment_requests',
      entity_id: data.id,
      new_values: {
        course_mapping_id: dto.course_mapping_id,
        course_name: course.course_name,
        moodle_role: isStaffAssignment ? dto.moodle_role || 'student' : 'student',
        status: initialStatus,
      },
    });

    if (isStaffAssignment) {
      try {
        await this.moodleService.syncEnrollment(data.id);
      } catch (err: any) {
        this.logger.warn(
          `Matrícula autorizada pero falló sincronización inmediata a Moodle: ${err?.message}`,
        );
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
  ) {
    const admin = this.supabase.getAdminClient();

    const { data: current, error: findError } = await admin
      .from('enrollment_requests')
      .select('*')
      .eq('id', enrollmentId)
      .maybeSingle();

    if (findError || !current) {
      throw new NotFoundException('Solicitud de inscripción no encontrada.');
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

  /**
   * Reintenta o ejecuta la sincronización con Moodle de forma manual.
   */
  async syncToMoodle(enrollmentId: string) {
    return this.moodleService.syncEnrollment(enrollmentId);
  }

  /**
   * Elimina / desasigna una matrícula de un curso:
   * - Si es administrador, puede desasignar cualquier curso a cualquier usuario.
   * - Si es alumno o profesor, puede dar de baja su propio curso.
   * - Llama a Moodle unenrolStudent para desmatricular en el aula virtual.
   * - Elimina el registro de enrollment_requests y registra la acción en audit_logs.
   */
  async deleteEnrollment(enrollmentId: string, actorId: string, isStaff: boolean) {
    const admin = this.supabase.getAdminClient();

    const { data: enrollment, error } = await admin
      .from('enrollment_requests')
      .select('*, course_mappings!course_mapping_id (*), profiles!user_id (*)')
      .eq('id', enrollmentId)
      .maybeSingle();

    if (error || !enrollment) {
      throw new NotFoundException('Matrícula o solicitud no encontrada.');
    }

    if (!isStaff && enrollment.user_id !== actorId) {
      throw new ForbiddenException(
        'No posees autorización para desasignar esta matrícula.',
      );
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
    const courseMapping = (enrollment as any).course_mappings;
    await admin.from('audit_logs').insert({
      actor_id: actorId,
      target_user_id: enrollment.user_id,
      action: isStaff ? 'ENROLLMENT_UNASSIGNED_BY_ADMIN' : 'ENROLLMENT_DROPPED_BY_STUDENT',
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
