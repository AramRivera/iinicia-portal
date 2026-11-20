/** Implementa las reglas para filtrar postulaciones por ámbito y promover al aspirante después del dictamen. */
import { EnrollmentsService } from '../enrollments/enrollments.service.js';
import {
  ConflictException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import {
  hasGlobalAcademicAccess,
  isScopedCoordinator,
  listAssignedProgramIds,
  loadActiveRoleSlugs,
} from '../../common/auth/program-scope.js';
import { SupabaseService } from '../../common/supabase/supabase.service.js';
import { CreateAdmissionDto } from './dto/create-admission.dto.js';
import { ReviewAdmissionDto } from './dto/review-admission.dto.js';

@Injectable()
export class AdmissionsService {
  private readonly logger = new Logger(AdmissionsService.name);

  constructor(private readonly supabase: SupabaseService, private readonly enrollments: EnrollmentsService) {}

  /**
   * Consulta solicitudes de admisión.
   */
  async findApplications(userId: string, accessToken: string) {
    const client = this.supabase.getResilientClient(accessToken);
    const roles = await loadActiveRoleSlugs(client, userId);
    let query = client
      .from('admission_applications')
      .select('*, programs!program_id ( code, name, slug ), profiles!applicant_id ( id, email, first_name, last_name, phone )')
      .order('submitted_at', { ascending: false });

    // Acota la bandeja de coordinación a sus programas y la consulta de un aspirante a sus propios registros.
    if (isScopedCoordinator(roles)) {
      const programIds = await listAssignedProgramIds(client, userId);
      if (!programIds.length) return [];
      query = query.in('program_id', programIds);
    } else if (!hasGlobalAcademicAccess(roles)) {
      query = query.eq('applicant_id', userId);
    }

    const { data, error } = await query;
    if (error) {
      this.logger.error(`Error al consultar admisiones: ${error.message}`);
      throw new InternalServerErrorException('No fue posible consultar las solicitudes de admisión.');
    }

    return data || [];
  }

  /**
   * Crea una solicitud de admisión para un aspirante.
   */
  async createApplication(userId: string, dto: CreateAdmissionDto) {
    const admin = this.supabase.getAdminClient();

    const { data: program, error: programError } = await admin
      .from('programs')
      .select('id, name')
      .eq('id', dto.program_id)
      .eq('is_active', true)
      .maybeSingle();

    if (programError) {
      throw new InternalServerErrorException('No fue posible consultar el programa.');
    }
    if (!program) {
      throw new NotFoundException('El programa académico no existe.');
    }

    const { data, error } = await admin
      .from('admission_applications')
      .insert({
        applicant_id: userId,
        program_id: dto.program_id,
        status: 'postulado',
        previous_education_level: dto.previous_education_level ?? null,
        previous_institution: dto.previous_institution ?? null,
        average_grade: dto.average_grade ?? null,
        motivation_letter: dto.motivation_letter ?? null,
      })
      .select()
      .maybeSingle();

    if (error?.code === '23505') {
      throw new ConflictException('Ya cuentas con una postulación a este programa.');
    }
    if (error || !data) {
      this.logger.error(`Error al registrar admisión: ${error?.message}`);
      throw new InternalServerErrorException('No fue posible registrar la postulación.');
    }

    await admin.from('audit_logs').insert({
      actor_id: userId,
      target_user_id: userId,
      action: 'ADMISSION_SUBMITTED',
      entity_name: 'admission_applications',
      entity_id: data.id,
      new_values: {
        program_id: dto.program_id,
        program_name: program.name,
      },
    });

    return data;
  }

  /**
   * Dictamina una solicitud de admisión (admitido, rechazado, en_revision).
   * Al admitir, activa la cuenta y asigna el rol de 'estudiante'.
   */
  async reviewApplication(
    applicationId: string,
    dto: ReviewAdmissionDto,
    reviewerId: string,
  ) {
    const admin = this.supabase.getAdminClient();

    // La RPC reúne el dictamen y los cambios de acceso al programa en una transacción de base de datos.
    const { data, error } = await admin.rpc('iinicia_review_admission', {
      application_id: applicationId,
      reviewer_id: reviewerId,
      decision: dto.status,
      notes: dto.reviewer_notes ?? null,
    });

    if (error?.code === 'PGRST202' || error?.code === '42883') {
      throw new ServiceUnavailableException(
        'El entorno de Supabase requiere la migración de admisiones. Contacta a administración; el dictamen no se guardó.',
      );
    }

    if (error?.code === 'P0002') {
      throw new NotFoundException('Solicitud de admisión no encontrada.');
    }
    if (error?.code === '42501') {
      throw new ForbiddenException('No puedes dictaminar esta postulación.');
    }
    if (error?.code === 'P0001') {
      throw new ConflictException(error.message);
    }
    if (error || !data) {
      this.logger.error('Error al dictaminar admisión: ' + (error?.code ?? 'sin resultado'));
      throw new InternalServerErrorException('No fue posible actualizar el dictamen.');
    }
    // La matrícula inicial se intenta después de guardar la admisión.
    if (dto.status !== 'admitido') return data;
    try {
      const enrollment_summary = await this.enrollments.enrollAdmittedStudent(
        data.applicant_id, data.program_id, reviewerId,
      );
      return { ...data, enrollment_summary };
    } catch {
      this.logger.error('Admisión guardada, pero no se pudo completar la preparación de matrículas.');
      return { ...data, enrollment_summary: { state: 'incomplete' as const, total: 0, synced: 0 } };
    }
  }
}
