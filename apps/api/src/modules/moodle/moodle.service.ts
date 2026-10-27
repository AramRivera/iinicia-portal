import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseService } from '../../common/supabase/supabase.service.js';
import { MoodleClient } from './moodle.client.js';
import { MOODLE_ROLE_IDS } from './moodle.types.js';
import type { MoodleRoleType } from '../../common/supabase/database.types.js';

@Injectable()
export class MoodleService {
  private readonly logger = new Logger(MoodleService.name);

  constructor(
    private readonly client: MoodleClient,
    private readonly supabase: SupabaseService,
    private readonly config: ConfigService,
  ) {}

  async checkStatus() {
    return this.client.checkConnection();
  }

  /**
   * Sincroniza un usuario de Supabase con Moodle LMS:
   * 1. Consulta el perfil en Supabase.
   * 2. Si no tiene moodle_user_id, busca en Moodle por email para evitar duplicados.
   * 3. Si no existe en Moodle, crea el usuario con datos institucionales.
   * 4. Actualiza moodle_user_id, moodle_username y moodle_sync_status en public.profiles.
   */
  async syncUser(userId: string) {
    const admin = this.supabase.getAdminClient();

    const { data: profile, error } = await admin
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();

    if (error || !profile) {
      throw new NotFoundException('Perfil de usuario no encontrado en la base de datos.');
    }

    try {
      let moodleUserId = profile.moodle_user_id;
      let moodleUsername = profile.moodle_username;

      if (!moodleUserId) {
        // Buscar primero por email para evitar duplicados
        const existing = await this.client.getUserByEmail(profile.email);

        if (existing) {
          moodleUserId = existing.id;
          moodleUsername = existing.username;
        } else {
          // Generar username institucional único a partir del correo o nombre
          let candidateUsername =
            profile.email.split('@')[0]?.toLowerCase().replace(/[^a-z0-9_.-]/g, '') ||
            `usr_${userId.slice(0, 8)}`;

          // Prevenir colisiones con usuarios existentes en Moodle
          const existingByUsername = await this.client.getUserByUsername(candidateUsername);
          if (
            existingByUsername &&
            existingByUsername.email?.toLowerCase() !== profile.email.toLowerCase()
          ) {
            candidateUsername = `${candidateUsername}_${userId.slice(0, 4)}`;
          } else if (
            existingByUsername &&
            existingByUsername.email?.toLowerCase() === profile.email.toLowerCase()
          ) {
            moodleUserId = existingByUsername.id;
            moodleUsername = existingByUsername.username;
          }

          if (!moodleUserId) {
            const created = await this.client.createUser({
              username: candidateUsername,
              email: profile.email,
              firstname: profile.first_name || 'Estudiante',
              lastname: profile.last_name || 'IINICIA',
            });

            moodleUserId = created.id;
            moodleUsername = created.username;
          }
        }
      }

      // Actualizar perfil con el identificador estable de Moodle
      const now = new Date().toISOString();
      const { error: updateError } = await admin
        .from('profiles')
        .update({
          moodle_user_id: moodleUserId,
          moodle_username: moodleUsername,
          moodle_sync_status: 'sincronizado',
          moodle_last_sync_at: now,
          moodle_sync_error: null,
        })
        .eq('id', userId);

      if (updateError) {
        throw new InternalServerErrorException(
          'Error al guardar el vínculo de Moodle en el perfil de Supabase.',
        );
      }

      // Bitácora de auditoría
      await admin.from('audit_logs').insert({
        actor_id: userId,
        target_user_id: userId,
        action: 'MOODLE_USER_SYNCED',
        entity_name: 'profiles',
        entity_id: userId,
        new_values: {
          moodle_user_id: moodleUserId,
          moodle_username: moodleUsername,
          moodle_sync_status: 'sincronizado',
        },
      });

      return {
        success: true,
        moodle_user_id: moodleUserId,
        moodle_username: moodleUsername,
        moodle_sync_status: 'sincronizado',
      };
    } catch (err: any) {
      this.logger.error(`Error al sincronizar usuario ${userId} con Moodle: ${err.message}`);

      // Registrar estado de error en profiles
      await admin
        .from('profiles')
        .update({
          moodle_sync_status: 'error',
          moodle_sync_error: err?.message || 'Error desconocido al sincronizar con Moodle',
        })
        .eq('id', userId);

      throw err;
    }
  }

  /**
   * Sincroniza en lote a todos los usuarios del portal que aún no cuentan
   * con identificador en Moodle LMS o están en estado no_vinculado / error.
   */
  async syncAllUsers() {
    const admin = this.supabase.getAdminClient();
    const { data: profiles, error } = await admin
      .from('profiles')
      .select('id, email, first_name, last_name, moodle_user_id, moodle_sync_status')
      .or('moodle_user_id.is.null,moodle_sync_status.neq.sincronizado');

    if (error) {
      throw new InternalServerErrorException(
        'Error al consultar perfiles pendientes de sincronizar en Supabase.',
      );
    }

    const results: Array<{
      id: string;
      email: string;
      status: 'sincronizado' | 'error';
      moodle_user_id?: number | null;
      moodle_username?: string | null;
      error?: string;
    }> = [];

    for (const profile of profiles || []) {
      try {
        const syncRes = await this.syncUser(profile.id);
        results.push({
          id: profile.id,
          email: profile.email,
          status: 'sincronizado',
          moodle_user_id: syncRes.moodle_user_id,
          moodle_username: syncRes.moodle_username,
        });
      } catch (err: any) {
        results.push({
          id: profile.id,
          email: profile.email,
          status: 'error',
          error: err.message,
        });
      }
    }

    return {
      total: results.length,
      synced: results.filter((r) => r.status === 'sincronizado').length,
      failed: results.filter((r) => r.status === 'error').length,
      results,
    };
  }

  /**
   * Sincroniza una matrícula autorizada con Moodle:
   * 1. Verifica que la solicitud esté en estado 'autorizada'.
   * 2. Sincroniza al usuario en Moodle si aún no lo está.
   * 3. Llama a enrol_manual_enrol_users en Moodle con el rol correspondiente.
   * 4. Actualiza enrollment_requests a 'sincronizada' y registra fecha e intentos.
   */
  async syncEnrollment(enrollmentId: string) {
    const admin = this.supabase.getAdminClient();

    const { data: enrollment, error } = await admin
      .from('enrollment_requests')
      .select('*, course_mappings!course_mapping_id (*), profiles!user_id (*)')
      .eq('id', enrollmentId)
      .maybeSingle();

    if (error || !enrollment) {
      throw new NotFoundException('Solicitud de inscripción no encontrada.');
    }

    if (enrollment.status !== 'autorizada' && enrollment.status !== 'sincronizada') {
      throw new BadRequestException(
        `La solicitud debe estar autorizada para sincronizarse (estado actual: ${enrollment.status}).`,
      );
    }

    const courseMapping = (enrollment as any).course_mappings;
    const profile = (enrollment as any).profiles;

    if (!courseMapping?.moodle_course_id) {
      throw new BadRequestException(
        'El curso seleccionado no cuenta con un identificador de Moodle vinculado.',
      );
    }

    // Asegurar que el usuario esté sincronizado en Moodle
    let moodleUserId = profile.moodle_user_id;
    if (!moodleUserId) {
      const syncResult = await this.syncUser(profile.id);
      moodleUserId = syncResult.moodle_user_id;
    }

    const moodleRole: MoodleRoleType = enrollment.moodle_role || 'student';
    const roleId = MOODLE_ROLE_IDS[moodleRole] ?? MOODLE_ROLE_IDS.student;
    const attempts = (enrollment.sync_attempts || 0) + 1;

    try {
      try {
        await this.client.enrolUser({
          userId: Number(moodleUserId),
          courseId: Number(courseMapping.moodle_course_id),
          roleId,
        });
      } catch (enrolError: any) {
        // Verificar si quedó inscrito a pesar de errores no fatales (ej. fallo de servidor SMTP local)
        try {
          const courses = await this.client.getUserCourses(Number(moodleUserId));
          const enrolled = courses.some(
            (c) => Number(c.id) === Number(courseMapping.moodle_course_id),
          );
          if (!enrolled) {
            throw enrolError;
          }
          this.logger.warn(
            `Moodle enrolUser reportó advertencia (${enrolError.message}), pero el usuario ya figura matriculado en el curso remoto.`,
          );
        } catch (checkErr) {
          if (checkErr !== enrolError) {
            throw enrolError;
          }
          throw checkErr;
        }
      }

      const now = new Date().toISOString();
      await admin
        .from('enrollment_requests')
        .update({
          status: 'sincronizada',
          synced_to_moodle_at: now,
          sync_attempts: attempts,
          sync_error_message: null,
        })
        .eq('id', enrollmentId);

      await admin.from('audit_logs').insert({
        actor_id: enrollment.authorized_by || enrollment.user_id,
        target_user_id: enrollment.user_id,
        action: 'MOODLE_ENROLLMENT_SYNCED',
        entity_name: 'enrollment_requests',
        entity_id: enrollmentId,
        new_values: {
          moodle_user_id: moodleUserId,
          moodle_course_id: courseMapping.moodle_course_id,
          moodle_role: moodleRole,
          status: 'sincronizada',
        },
      });

      return {
        success: true,
        status: 'sincronizada',
        moodle_course_id: courseMapping.moodle_course_id,
        moodle_user_id: moodleUserId,
      };
    } catch (err: any) {
      this.logger.error(`Error al matricular en Moodle (${enrollmentId}): ${err.message}`);

      await admin
        .from('enrollment_requests')
        .update({
          status: 'error_sincronizacion',
          sync_attempts: attempts,
          sync_error_message: err?.message || 'Error al ejecutar enrol_manual_enrol_users en Moodle',
        })
        .eq('id', enrollmentId);

      throw err;
    }
  }

  /**
   * Genera el enlace de salto seguro al Campus Moodle y registra el acceso en `campus_access_logs`.
   * Verifica estrictamente que el usuario tenga una matrícula autorizada o sincronizada.
   */
  async getCourseAccessUrl(params: {
    userId: string;
    courseMappingId: string;
    ipAddress?: string;
    userAgent?: string;
  }) {
    const admin = this.supabase.getAdminClient();

    // Consultar si el usuario tiene curso autorizado en enrollment_requests
    const { data: enrollment, error } = await admin
      .from('enrollment_requests')
      .select('id, status, moodle_role, course_mappings!course_mapping_id (*)')
      .eq('user_id', params.userId)
      .eq('course_mapping_id', params.courseMappingId)
      .maybeSingle();

    const courseMapping = (enrollment as any)?.course_mappings;
    const moodleCourseId = courseMapping?.moodle_course_id;

    const isAuthorized =
      !error &&
      enrollment &&
      (enrollment.status === 'autorizada' || enrollment.status === 'sincronizada');

    if (!isAuthorized) {
      // Registrar intento no autorizado en campus_access_logs
      await admin.from('campus_access_logs').insert({
        user_id: params.userId,
        course_mapping_id: params.courseMappingId,
        moodle_course_id: moodleCourseId ?? null,
        access_method: 'sso_portal_redirect',
        ip_address: params.ipAddress ?? null,
        user_agent: params.userAgent ?? null,
        succeeded: false,
        error_detail: 'Usuario sin matrícula activa o curso no autorizado',
      });

      throw new ForbiddenException(
        'No cuentas con una matrícula autorizada para acceder a este curso en Moodle.',
      );
    }

    // Registrar acceso exitoso en campus_access_logs
    await admin.from('campus_access_logs').insert({
      user_id: params.userId,
      course_mapping_id: params.courseMappingId,
      moodle_course_id: Number(moodleCourseId),
      access_method: 'sso_portal_redirect',
      ip_address: params.ipAddress ?? null,
      user_agent: params.userAgent ?? null,
      succeeded: true,
      error_detail: null,
    });

    // Actualizar último acceso a Moodle
    await admin
      .from('enrollment_requests')
      .update({ last_moodle_access_at: new Date().toISOString() })
      .eq('id', enrollment.id);

    const moodleBase =
      this.config.get<string>('MOODLE_BASE_URL') ||
      this.config.get<string>('MOODLE_URL') ||
      'http://localhost/moodle';
    const courseUrl = `${moodleBase.replace(/\/+$/, '')}/course/view.php?id=${moodleCourseId}`;

    let accessUrl = courseUrl;

    // Obtener correo del usuario para solicitar token SSO de un solo uso
    const { data: userProfile } = await admin
      .from('profiles')
      .select('email')
      .eq('id', params.userId)
      .maybeSingle();

    if (userProfile?.email) {
      try {
        const loginUrl = await this.client.requestUserKeyLoginUrl(userProfile.email);
        if (loginUrl) {
          const sep = loginUrl.includes('?') ? '&' : '?';
          accessUrl = `${loginUrl}${sep}wantsurl=${encodeURIComponent(courseUrl)}`;
        }
      } catch (err: any) {
        this.logger.warn(
          `No fue posible generar SSO one-time key para ${userProfile.email}, usando URL directa: ${err?.message}`,
        );
      }
    }

    return {
      course_mapping_id: params.courseMappingId,
      course_name: courseMapping.course_name,
      moodle_course_id: moodleCourseId,
      access_url: accessUrl,
    };
  }

  /**
   * Genera una URL de acceso directo con SSO al campus general de Moodle.
   */
  async getCampusAccessUrl(params: {
    userId: string;
    ipAddress?: string;
    userAgent?: string;
  }) {
    const admin = this.supabase.getAdminClient();
    const { data: profile } = await admin
      .from('profiles')
      .select('id, email, moodle_user_id')
      .eq('id', params.userId)
      .maybeSingle();

    if (!profile) {
      throw new NotFoundException('Perfil de usuario no encontrado.');
    }

    const moodleBase =
      this.config.get<string>('MOODLE_BASE_URL') ||
      this.config.get<string>('MOODLE_URL') ||
      'http://localhost/moodle';
    const baseUrl = moodleBase.replace(/\/+$/, '');

    let accessUrl = `${baseUrl}/`;

    if (profile.email) {
      try {
        const loginUrl = await this.client.requestUserKeyLoginUrl(profile.email);
        if (loginUrl) {
          const sep = loginUrl.includes('?') ? '&' : '?';
          accessUrl = `${loginUrl}${sep}wantsurl=${encodeURIComponent(baseUrl + '/')}`;
        }
      } catch (err: any) {
        this.logger.warn(`No fue posible generar SSO al campus: ${err?.message}`);
      }
    }

    return { access_url: accessUrl };
  }

  /**
   * Desmatricula a un usuario de un curso en Moodle LMS.
   */
  async unenrolStudent(enrollmentId: string) {
    const admin = this.supabase.getAdminClient();

    const { data: enrollment, error } = await admin
      .from('enrollment_requests')
      .select('*, course_mappings!course_mapping_id (*), profiles!user_id (*)')
      .eq('id', enrollmentId)
      .maybeSingle();

    if (error || !enrollment) {
      throw new NotFoundException('Solicitud de inscripción no encontrada.');
    }

    const courseMapping = (enrollment as any).course_mappings;
    const profile = (enrollment as any).profiles;

    if (profile?.moodle_user_id && courseMapping?.moodle_course_id) {
      try {
        const moodleRole: MoodleRoleType = enrollment.moodle_role || 'student';
        const roleId = MOODLE_ROLE_IDS[moodleRole] ?? MOODLE_ROLE_IDS.student;

        await this.client.unenrolUser({
          userId: Number(profile.moodle_user_id),
          courseId: Number(courseMapping.moodle_course_id),
          roleId,
        });
      } catch (err: any) {
        this.logger.warn(`Advertencia al desmatricular en Moodle (${enrollmentId}): ${err?.message}`);
      }
    }

    return { success: true };
  }
}
