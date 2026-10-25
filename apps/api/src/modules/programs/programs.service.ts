import {
  ConflictException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { SupabaseService } from '../../common/supabase/supabase.service.js';
import type { Json } from '../../common/supabase/database.types.js';
import { CreateProgramDto } from './dto/create-program.dto.js';
import { UpdateProgramDto } from './dto/update-program.dto.js';
import { AssignUserProgramDto } from './dto/assign-user-program.dto.js';

@Injectable()
export class ProgramsService {
  private readonly logger = new Logger(ProgramsService.name);

  constructor(private readonly supabase: SupabaseService) {}

  /**
   * Catálogo de programas. Visitantes y estudiantes ven los activos;
   * administradores y coordinadores ven todos.
   */
  async findAll(accessToken?: string, isStaff = false) {
    const client = accessToken
      ? this.supabase.getResilientClient(accessToken)
      : this.supabase.getClient('');

    let query = client.from('programs').select('*').order('display_order', { ascending: true });

    if (!isStaff) {
      query = query.eq('is_active', true);
    }

    const { data, error } = await query;
    if (error) {
      this.logger.error(`Error al consultar programas: ${error.message}`);
      throw new InternalServerErrorException('No fue posible consultar la oferta académica.');
    }

    return data || [];
  }

  /**
   * Consulta el detalle de un programa académico por UUID o slug.
   */
  async findByIdOrSlug(idOrSlug: string, accessToken?: string) {
    const client = accessToken
      ? this.supabase.getResilientClient(accessToken)
      : this.supabase.getClient('');

    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      idOrSlug,
    );

    const query = client.from('programs').select('*');
    const { data, error } = isUuid
      ? await query.eq('id', idOrSlug).maybeSingle()
      : await query.eq('slug', idOrSlug).maybeSingle();

    if (error || !data) {
      throw new NotFoundException('Programa académico no encontrado.');
    }

    return data;
  }

  /**
   * Crea un nuevo programa académico.
   */
  async create(dto: CreateProgramDto, actorId: string) {
    const admin = this.supabase.getAdminClient();

    const { data, error } = await admin
      .from('programs')
      .insert({
        code: dto.code,
        slug: dto.slug,
        name: dto.name,
        short_description: dto.short_description,
        description: dto.description,
        type: dto.type,
        modality: dto.modality,
        duration_text: dto.duration_text,
        duration_hours: dto.duration_hours,
        credits: dto.credits,
        banner_url: dto.banner_url,
        thumbnail_url: dto.thumbnail_url,
        moodle_category_id: dto.moodle_category_id,
        is_featured: dto.is_featured ?? false,
        is_active: dto.is_active ?? true,
      })
      .select()
      .maybeSingle();

    if (error || !data) {
      if (error?.code === '23505') {
        throw new ConflictException('Ya existe un programa con el mismo código o slug.');
      }
      this.logger.error(`Error al crear programa: ${error?.message}`);
      throw new InternalServerErrorException('No fue posible crear el programa académico.');
    }

    await admin.from('audit_logs').insert({
      actor_id: actorId,
      action: 'PROGRAM_CREATED',
      entity_name: 'programs',
      entity_id: data.id,
      new_values: { code: data.code, name: data.name },
    });

    return data;
  }

  /**
   * Actualiza los datos de un programa académico.
   */
  async update(id: string, dto: UpdateProgramDto, actorId: string) {
    const admin = this.supabase.getAdminClient();

    const { data: current, error: findError } = await admin
      .from('programs')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (findError || !current) {
      throw new NotFoundException('Programa académico no encontrado.');
    }

    const { data, error } = await admin
      .from('programs')
      .update(dto)
      .eq('id', id)
      .select()
      .maybeSingle();

    if (error) {
      this.logger.error(`Error al actualizar programa: ${error.message}`);
      throw new InternalServerErrorException('No fue posible actualizar el programa.');
    }

    await admin.from('audit_logs').insert({
      actor_id: actorId,
      action: 'PROGRAM_UPDATED',
      entity_name: 'programs',
      entity_id: id,
      old_values: current as unknown as Json,
      new_values: dto as unknown as Json,
    });

    return data;
  }

  /**
   * Vincula un usuario a un programa en `user_programs` y actualiza su estatus académico.
   */
  async assignUserToProgram(
    programId: string,
    dto: AssignUserProgramDto,
    actorId: string,
  ) {
    const admin = this.supabase.getAdminClient();

    // Validar programa
    const { data: program } = await admin
      .from('programs')
      .select('id, name')
      .eq('id', programId)
      .maybeSingle();

    if (!program) {
      throw new NotFoundException('Programa académico no encontrado.');
    }

    // Insertar o actualizar user_programs
    const { data, error } = await admin
      .from('user_programs')
      .upsert(
        {
          user_id: dto.user_id,
          program_id: programId,
          status: dto.status,
          cohort: dto.cohort ?? null,
          notes: dto.notes ?? null,
          authorized_by: actorId,
        },
        { onConflict: 'user_id,program_id' },
      )
      .select()
      .maybeSingle();

    if (error || !data) {
      this.logger.error(`Error al asociar usuario a programa: ${error?.message}`);
      throw new InternalServerErrorException(
        'No fue posible asociar el estudiante al programa académico.',
      );
    }

    await admin.from('audit_logs').insert({
      actor_id: actorId,
      target_user_id: dto.user_id,
      action: 'USER_PROGRAM_ASSIGNED',
      entity_name: 'user_programs',
      entity_id: data.id,
      new_values: {
        program_id: programId,
        program_name: program.name,
        status: dto.status,
        cohort: dto.cohort,
      },
    });

    return data;
  }
}
