import {
  ConflictException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { SupabaseService } from '../../common/supabase/supabase.service.js';
import { CreateAdmissionDto } from './dto/create-admission.dto.js';
import { ReviewAdmissionDto } from './dto/review-admission.dto.js';

@Injectable()
export class AdmissionsService {
  private readonly logger = new Logger(AdmissionsService.name);

  constructor(private readonly supabase: SupabaseService) {}

  async checkCanReview(userId: string, accessToken: string): Promise<boolean> {
    const client = this.supabase.getResilientClient(accessToken);
    const { data, error } = await client
      .from('user_roles')
      .select('expires_at, roles!role_id ( slug )')
      .eq('user_id', userId)
      .eq('is_active', true);
    if (error || !data) throw new ForbiddenException('No fue posible comprobar tus permisos.');
    const now = new Date().toISOString();
    return data.some((assignment) => {
      if (assignment.expires_at && assignment.expires_at < now) return false;
      const embedded = assignment.roles as unknown as { slug: string } | { slug: string }[] | null;
      const slug = Array.isArray(embedded) ? embedded[0]?.slug : embedded?.slug;
      return slug === 'superadministrador' || slug === 'administrador';
    });
  }

  /**
   * Consulta solicitudes de admisión.
   */
  async findApplications(userId: string, isStaff: boolean, accessToken: string) {
    const client = this.supabase.getResilientClient(accessToken);
    let query = client
      .from('admission_applications')
      .select('*, programs!program_id ( code, name, slug ), profiles!applicant_id ( id, email, first_name, last_name, phone )')
      .order('submitted_at', { ascending: false });

    if (!isStaff) {
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

    const { data: program } = await admin
      .from('programs')
      .select('id, name')
      .eq('id', dto.program_id)
      .maybeSingle();

    if (!program) {
      throw new NotFoundException('El programa académico no existe.');
    }

    const { data: existing } = await admin
      .from('admission_applications')
      .select('id, status')
      .eq('applicant_id', userId)
      .eq('program_id', dto.program_id)
      .maybeSingle();

    if (existing) {
      throw new ConflictException(
        `Ya cuentas con una postulación a este programa (estado: ${existing.status}).`,
      );
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

    const { data: app, error: findError } = await admin
      .from('admission_applications')
      .select('*, profiles!applicant_id (*)')
      .eq('id', applicationId)
      .maybeSingle();

    if (findError || !app) {
      throw new NotFoundException('Solicitud de admisión no encontrada.');
    }

    const now = new Date().toISOString();

    const { data, error } = await admin
      .from('admission_applications')
      .update({
        status: dto.status,
        reviewer_id: reviewerId,
        reviewer_notes: dto.reviewer_notes ?? null,
        reviewed_at: now,
      })
      .eq('id', applicationId)
      .select()
      .maybeSingle();

    if (error) {
      this.logger.error(`Error al dictaminar admisión: ${error.message}`);
      throw new InternalServerErrorException('No fue posible actualizar el dictamen.');
    }

    // Si es admitido: asignar en user_programs y agregar rol 'estudiante'
    if (dto.status === 'admitido') {
      await admin.from('user_programs').upsert(
        {
          user_id: app.applicant_id,
          program_id: app.program_id,
          status: 'admitido',
          authorized_by: reviewerId,
        },
        { onConflict: 'user_id,program_id' },
      );

      // Activar cuenta en profiles si estaba pendiente
      await admin
        .from('profiles')
        .update({ status: 'activo' })
        .eq('id', app.applicant_id);

      // Asignar rol estudiante si no lo tiene
      const { data: estudianteRole } = await admin
        .from('roles')
        .select('id')
        .eq('slug', 'estudiante')
        .maybeSingle();

      if (estudianteRole) {
        await admin.from('user_roles').upsert(
          {
            user_id: app.applicant_id,
            role_id: estudianteRole.id,
            is_active: true,
            assigned_by: reviewerId,
          },
          { onConflict: 'user_id,role_id' },
        );
      }
    }

    await admin.from('audit_logs').insert({
      actor_id: reviewerId,
      target_user_id: app.applicant_id,
      action: 'ADMISSION_REVIEWED',
      entity_name: 'admission_applications',
      entity_id: applicationId,
      old_values: { status: app.status },
      new_values: { status: dto.status, reviewer_notes: dto.reviewer_notes },
    });

    return data;
  }
}
