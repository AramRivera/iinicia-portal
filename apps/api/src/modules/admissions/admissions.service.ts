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
} from '../../common/auth/program-scope.js';
import { SupabaseService } from '../../common/supabase/supabase.service.js';
import { CreateAdmissionDto } from './dto/create-admission.dto.js';
import { ReviewAdmissionDto } from './dto/review-admission.dto.js';

@Injectable()
export class AdmissionsService {
  private readonly logger = new Logger(AdmissionsService.name);

  constructor(private readonly supabase: SupabaseService) {}

  /**
   * Consulta solicitudes de admisión.
   */
  async findApplications(userId: string, accessToken: string) {
    const admin = this.supabase.getAdminClient();
    const roles = await loadActiveRoleSlugs(admin, userId);
    const client = this.supabase.getResilientClient(accessToken);
    let query = client
      .from('admission_applications')
      .select('*, programs!program_id ( code, name, slug ), profiles!applicant_id ( id, email, first_name, last_name, phone )')
      .order('submitted_at', { ascending: false });

    if (isScopedCoordinator(roles)) {
      const programIds = await listAssignedProgramIds(admin, userId);
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

    const { data, error } = await admin.rpc('iinicia_review_admission', {
      application_id: applicationId,
      reviewer_id: reviewerId,
      decision: dto.status,
      notes: dto.reviewer_notes ?? null,
    });

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
    return data;
  }
}
