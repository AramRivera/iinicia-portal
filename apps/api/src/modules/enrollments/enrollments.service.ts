import {
  ConflictException,
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

    if (existing) {
      throw new ConflictException(
        `Ya cuentas con una inscripción en este curso (estado: ${existing.status}).`,
      );
    }

    const programId = dto.program_id || course.program_id;

    const { data, error } = await admin
      .from('enrollment_requests')
      .insert({
        user_id: userId,
        course_mapping_id: dto.course_mapping_id,
        program_id: programId,
        moodle_role: dto.moodle_role || 'student',
        status: 'pendiente',
        requested_by: userId,
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
      actor_id: userId,
      target_user_id: userId,
      action: 'ENROLLMENT_REQUESTED',
      entity_name: 'enrollment_requests',
      entity_id: data.id,
      new_values: {
        course_mapping_id: dto.course_mapping_id,
        course_name: course.course_name,
        moodle_role: dto.moodle_role || 'student',
      },
    });

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
}
