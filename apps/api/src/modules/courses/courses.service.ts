import {
  ConflictException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { SupabaseService } from '../../common/supabase/supabase.service.js';
import type { Json } from '../../common/supabase/database.types.js';
import { MoodleClient } from '../moodle/moodle.client.js';
import { CreateCourseMappingDto } from './dto/create-course-mapping.dto.js';
import { UpdateCourseMappingDto } from './dto/update-course-mapping.dto.js';

@Injectable()
export class CoursesService {
  private readonly logger = new Logger(CoursesService.name);

  constructor(
    private readonly supabase: SupabaseService,
    private readonly moodleClient: MoodleClient,
  ) {}

  /**
   * Cursos del usuario:
   * - Si es estudiante o profesor: consulta exclusivamente los cursos autorizados en `v_user_authorized_courses`.
   * - Si es staff: sincroniza automáticamente nuevos cursos desde Moodle y consulta el catálogo completo en `course_mappings`.
   */
  async findCourses(userId: string, isStaff: boolean, accessToken: string) {
    const client = this.supabase.getResilientClient(accessToken);

    if (!isStaff) {
      const { data, error } = await client
        .from('v_user_authorized_courses')
        .select('*')
        .eq('user_id', userId);

      if (error) {
        this.logger.error(`Error al consultar cursos autorizados: ${error.message}`);
        throw new InternalServerErrorException(
          'No fue posible consultar tus cursos autorizados.',
        );
      }
      return data || [];
    }

    // Auto-sincronización automática de cursos creados en Moodle LMS
    try {
      await this.syncCoursesFromMoodle();
    } catch (syncErr: any) {
      this.logger.warn(`Auto-sync de cursos Moodle reportó advertencia: ${syncErr?.message}`);
    }

    const { data, error } = await client
      .from('course_mappings')
      .select('*, programs!program_id ( code, name, slug )')
      .order('created_at', { ascending: false });

    if (error) {
      this.logger.error(`Error al consultar catálogo de cursos: ${error.message}`);
      throw new InternalServerErrorException(
        'No fue posible consultar el catálogo de cursos.',
      );
    }
    return data || [];
  }

  /**
   * Sincroniza automáticamente los cursos de Moodle hacia `course_mappings` en Supabase:
   * 1. Consulta todos los cursos en Moodle LMS vía `core_course_get_courses`.
   * 2. Omite el curso de sitio (id: 1).
   * 3. Para cada curso que no exista en `course_mappings`:
   *    - Busca si existe un programa con nombre/código similar o crea uno nuevo en `programs`.
   *    - Inserta el registro correspondiente en `course_mappings`.
   */
  async syncCoursesFromMoodle() {
    const admin = this.supabase.getAdminClient();
    const moodleCourses = await this.moodleClient.getAllCourses();
    const moodleBaseUrl = await this.moodleClient.getEffectiveBaseUrl();

    // Descartar el curso global de sitio (id: 1)
    const activeMoodleCourses = moodleCourses.filter((c) => Number(c.id) > 1);

    if (activeMoodleCourses.length === 0) {
      return { total: 0, imported: 0 };
    }

    // Obtener los mappings existentes
    const { data: existingMappings } = await admin
      .from('course_mappings')
      .select('moodle_course_id');

    const existingMoodleIds = new Set(
      (existingMappings || []).map((m) => Number(m.moodle_course_id)),
    );

    let importedCount = 0;

    for (const mc of activeMoodleCourses) {
      const courseId = Number(mc.id);
      if (existingMoodleIds.has(courseId)) {
        continue;
      }

      const cleanName = (mc.fullname || `Curso #${courseId}`).trim();
      const cleanShortname = (mc.shortname || `CUR-${courseId}`).trim();
      const code = (mc.idnumber || cleanShortname).replace(/\s+/g, '-').toUpperCase();
      const baseSlug = cleanName
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
      const slug = `${baseSlug}-${courseId}`;

      // Buscar si ya existe un programa para asociarlo
      const { data: existingProgram } = await admin
        .from('programs')
        .select('id')
        .or(`name.ilike.%${cleanName}%,code.ilike.%${code}%`)
        .maybeSingle();

      let programId = existingProgram?.id;

      if (!programId) {
        // Crear el programa en programs si no existía
        const { data: newProgram, error: progErr } = await admin
          .from('programs')
          .insert({
            name: cleanName,
            code,
            slug,
            description: mc.summary?.replace(/<[^>]*>/g, '').trim() || cleanName,
            type: 'curso',
            modality: 'en_linea',
            is_active: true,
          })
          .select('id')
          .single();

        if (!progErr && newProgram) {
          programId = newProgram.id;
        } else if (progErr) {
          this.logger.warn(`No se pudo crear programa automático para ${cleanName}: ${progErr.message}`);
        }
      }

      if (programId) {
        const { error: insertErr } = await admin.from('course_mappings').insert({
          program_id: programId,
          portal_course_code: code,
          slug,
          course_name: cleanName,
          course_description: mc.summary?.replace(/<[^>]*>/g, '').trim() || cleanName,
          moodle_course_id: courseId,
          moodle_shortname: cleanShortname,
          moodle_course_url: `${moodleBaseUrl}/course/view.php?id=${courseId}`,
          is_active: true,
          term_or_module: 1,
          is_mandatory: true,
        });

        if (!insertErr) {
          importedCount++;
          existingMoodleIds.add(courseId);
          this.logger.log(`Curso #${courseId} ("${cleanName}") sincronizado exitosamente desde Moodle.`);
        } else {
          this.logger.warn(`Error al insertar mapping para curso #${courseId}: ${insertErr.message}`);
        }
      }
    }

    return {
      total: activeMoodleCourses.length,
      imported: importedCount,
    };
  }

  /**
   * Detalle de un curso por ID.
   */
  async findById(courseId: string, accessToken: string) {
    const client = this.supabase.getResilientClient(accessToken);
    const { data, error } = await client
      .from('course_mappings')
      .select('*, programs!program_id ( code, name, slug )')
      .eq('id', courseId)
      .maybeSingle();

    if (error || !data) {
      throw new NotFoundException('Curso no encontrado.');
    }

    return data;
  }

  /**
   * Registra un nuevo mapeo entre una materia del portal y un curso real en Moodle.
   */
  async create(dto: CreateCourseMappingDto, actorId: string) {
    const admin = this.supabase.getAdminClient();

    // Validar existencia del curso en Moodle si es posible
    try {
      const moodleCourse = await this.moodleClient.getCourseById(dto.moodle_course_id);
      if (moodleCourse) {
        this.logger.log(`Curso validado en Moodle: ${moodleCourse.fullname} (${moodleCourse.id})`);
      }
    } catch {
      this.logger.warn(`No fue posible validar curso ${dto.moodle_course_id} directamente en Moodle.`);
    }

    const { data, error } = await admin
      .from('course_mappings')
      .insert({
        program_id: dto.program_id ?? null,
        portal_course_code: dto.portal_course_code,
        slug: dto.slug,
        course_name: dto.course_name,
        course_description: dto.course_description,
        thumbnail_url: dto.thumbnail_url,
        term_or_module: dto.term_or_module ?? 1,
        is_mandatory: dto.is_mandatory ?? true,
        moodle_course_id: dto.moodle_course_id,
        moodle_shortname: dto.moodle_shortname,
        moodle_category_id: dto.moodle_category_id ?? null,
        moodle_course_url: dto.moodle_course_url ?? null,
        is_active: dto.is_active ?? true,
      })
      .select()
      .maybeSingle();

    if (error || !data) {
      if (error?.code === '23505') {
        throw new ConflictException(
          'Ya existe un curso con el mismo código, slug o moodle_course_id.',
        );
      }
      this.logger.error(`Error al registrar mapeo de curso: ${error?.message}`);
      throw new InternalServerErrorException('No fue posible registrar el curso.');
    }

    await admin.from('audit_logs').insert({
      actor_id: actorId,
      action: 'COURSE_MAPPING_CREATED',
      entity_name: 'course_mappings',
      entity_id: data.id,
      new_values: {
        portal_course_code: data.portal_course_code,
        moodle_course_id: data.moodle_course_id,
        course_name: data.course_name,
      },
    });

    return data;
  }

  /**
   * Actualiza los datos de mapeo de un curso.
   */
  async update(courseId: string, dto: UpdateCourseMappingDto, actorId: string) {
    const admin = this.supabase.getAdminClient();

    const { data: current, error: findError } = await admin
      .from('course_mappings')
      .select('*')
      .eq('id', courseId)
      .maybeSingle();

    if (findError || !current) {
      throw new NotFoundException('Curso no encontrado.');
    }

    const { data, error } = await admin
      .from('course_mappings')
      .update(dto)
      .eq('id', courseId)
      .select()
      .maybeSingle();

    if (error) {
      this.logger.error(`Error al actualizar curso: ${error.message}`);
      throw new InternalServerErrorException('No fue posible actualizar el curso.');
    }

    await admin.from('audit_logs').insert({
      actor_id: actorId,
      action: 'COURSE_MAPPING_UPDATED',
      entity_name: 'course_mappings',
      entity_id: courseId,
      old_values: current as unknown as Json,
      new_values: dto as unknown as Json,
    });

    return data;
  }
}
