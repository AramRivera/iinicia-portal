import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { SupabaseService } from '../../common/supabase/supabase.service.js';
import type { Database } from '../../common/supabase/database.types.js';
import { MoodleClient } from '../moodle/moodle.client.js';
import { QueryUsersDto } from './dto/query-users.dto.js';
import { UpdateUserStatusDto } from './dto/update-user-status.dto.js';
import { UpdateOwnProfileDto } from './dto/update-own-profile.dto.js';
import { CreateUserAdminDto } from './dto/create-user-admin.dto.js';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    private readonly supabase: SupabaseService,
    private readonly moodleClient: MoodleClient,
  ) {}

  /**
   * Consulta paginada y filtrada de usuarios usando la vista consolidada
   * `v_user_complete_profile` (con security_invoker = true).
   */
  async findUsers(query: QueryUsersDto, accessToken: string) {
    const client = this.supabase.getResilientClient(accessToken);
    let q = client
      .from('v_user_complete_profile')
      .select('*', { count: 'exact' });

    if (query.status) {
      q = q.eq('status', query.status);
    }

    if (query.role) {
      q = q.contains('active_roles', [query.role.toLowerCase()]);
    }

    if (query.search) {
      const term = `%${query.search.trim()}%`;
      q = q.or(
        `first_name.ilike.${term},last_name.ilike.${term},email.ilike.${term}`,
      );
    }

    const from = query.offset;
    const to = query.offset + query.limit - 1;

    const { data, error, count } = await q.range(from, to).order('created_at', {
      ascending: false,
    });

    if (error) {
      this.logger.error(`Error al consultar usuarios: ${error.message}`);
      throw new InternalServerErrorException(
        'No fue posible obtener el listado de usuarios.',
      );
    }

    const total = count ?? (data?.length || 0);

    return {
      data: data || [],
      meta: {
        total,
        limit: query.limit,
        offset: query.offset,
        hasMore: query.offset + (data?.length || 0) < total,
      },
    };
  }

  /**
   * Consulta el detalle consolidado de un usuario por su ID.
   */
  async findUserById(
    targetUserId: string,
    requestingUserId: string,
    isStaff: boolean,
    accessToken: string,
  ) {
    if (!isStaff && targetUserId !== requestingUserId) {
      throw new ForbiddenException(
        'No tienes autorización para consultar el perfil de otro usuario.',
      );
    }

    const client = this.supabase.getResilientClient(accessToken);
    const { data, error } = await client
      .from('v_user_complete_profile')
      .select('*')
      .eq('id', targetUserId)
      .maybeSingle();

    if (error || !data) {
      throw new NotFoundException('Usuario no encontrado.');
    }

    return data;
  }

  /**
   * Actualiza el estado administrativo del usuario (pendiente, activo, suspendido, inactivo, baja).
   * Operación administrativa que utiliza el cliente seguro y registra en audit_logs.
   */
  async updateUserStatus(
    targetUserId: string,
    dto: UpdateUserStatusDto,
    actorId: string,
  ) {
    const admin = this.supabase.getAdminClient();

    const { data: currentProfile, error: fetchError } = await admin
      .from('profiles')
      .select('id, email, status, moodle_user_id')
      .eq('id', targetUserId)
      .maybeSingle();

    if (fetchError || !currentProfile) {
      throw new NotFoundException('Usuario no encontrado.');
    }

    const oldStatus = currentProfile.status;

    const { error: updateError } = await admin
      .from('profiles')
      .update({ status: dto.status })
      .eq('id', targetUserId);

    if (updateError) {
      this.logger.error(
        `Error al actualizar estado del usuario: ${updateError.message}`,
      );
      throw new InternalServerErrorException(
        'No fue posible actualizar el estado del usuario.',
      );
    }

    // Si el usuario tiene cuenta en Moodle y fue suspendido/reactivado, sincronizar estado en Moodle
    if (currentProfile.moodle_user_id) {
      try {
        const isSuspended = dto.status === 'suspendido' || dto.status === 'inactivo' ? 1 : 0;
        await this.moodleClient.updateUser(Number(currentProfile.moodle_user_id), {
          suspended: isSuspended,
        });
      } catch (err: any) {
        this.logger.warn(
          `No se pudo actualizar el estado de suspensión en Moodle: ${err.message}`,
        );
      }
    }

    // Registrar en audit_logs
    await admin.from('audit_logs').insert({
      actor_id: actorId,
      target_user_id: targetUserId,
      action: 'USER_STATUS_UPDATED',
      entity_name: 'profiles',
      entity_id: targetUserId,
      old_values: { status: oldStatus },
      new_values: { status: dto.status, reason: dto.reason ?? null },
    });

    return {
      id: targetUserId,
      previous_status: oldStatus,
      current_status: dto.status,
      updated_at: new Date().toISOString(),
    };
  }

  /**
   * Actualiza los datos editables del propio usuario autenticado bajo RLS.
   */
  async updateOwnProfile(
    userId: string,
    dto: UpdateOwnProfileDto,
    accessToken: string,
  ) {
    const client = this.supabase.getResilientClient(accessToken);

    const updatePayload: Database['public']['Tables']['profiles']['Update'] = {};
    if (dto.first_name !== undefined) updatePayload.first_name = dto.first_name;
    if (dto.last_name !== undefined) updatePayload.last_name = dto.last_name;
    if (dto.phone !== undefined) updatePayload.phone = dto.phone;
    if (dto.avatar_url !== undefined) updatePayload.avatar_url = dto.avatar_url;
    if (dto.bio !== undefined) updatePayload.bio = dto.bio;

    const { data, error } = await client
      .from('profiles')
      .update(updatePayload)
      .eq('id', userId)
      .select()
      .maybeSingle();

    if (error) {
      this.logger.error(`Error al actualizar perfil propio: ${error.message}`);
      throw new InternalServerErrorException(
        'No fue posible actualizar la información del perfil.',
      );
    }

    return data;
  }

  /**
   * Crea un usuario administrativamente en Supabase Auth y le asigna
   * directamente su rol definitivo sin interferir con la sesión del administrador.
   */
  async createUserByAdmin(dto: CreateUserAdminDto, actorId: string) {
    const admin = this.supabase.getAdminClient();

    // 1. Validar existencia del rol
    const { data: role, error: roleError } = await admin
      .from('roles')
      .select('id, slug, name')
      .eq('id', dto.role_id)
      .maybeSingle();

    if (roleError || !role) {
      throw new NotFoundException('El rol inicial especificado no existe.');
    }

    // 2. Crear identidad en Supabase Auth
    const { data: authData, error: authError } = await admin.auth.admin.createUser({
      email: dto.email.trim().toLowerCase(),
      password: dto.password,
      email_confirm: true,
      user_metadata: {
        first_name: dto.first_name.trim(),
        last_name: dto.last_name.trim(),
        phone: dto.phone?.trim() || null,
      },
    });

    if (authError || !authData.user) {
      const msg = authError?.message?.toLowerCase() || '';
      if (msg.includes('already registered') || msg.includes('already been registered')) {
        throw new ConflictException('El correo electrónico ya se encuentra registrado.');
      }
      throw new BadRequestException(
        authError?.message || 'No fue posible registrar al usuario en el servicio de identidad.',
      );
    }

    const newUserId = authData.user.id;

    // 3. Limpiar cualquier rol de 'aspirante' que el trigger haya asignado automáticamente si el rol elegido no es aspirante
    if (role.slug !== 'aspirante') {
      const { data: aspRole } = await admin
        .from('roles')
        .select('id')
        .eq('slug', 'aspirante')
        .maybeSingle();

      if (aspRole) {
        await admin
          .from('user_roles')
          .delete()
          .eq('user_id', newUserId)
          .eq('role_id', aspRole.id);
      }
    }

    // 4. Asignar el rol elegido como único rol activo
    await admin.from('user_roles').upsert(
      {
        user_id: newUserId,
        role_id: role.id,
        assigned_by: actorId,
        is_active: true,
        assigned_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,role_id' },
    );

    // 5. Sincronización proactiva con Moodle LMS
    let moodleUser: any = null;
    try {
      const safeUsername = dto.email.split('@')[0].toLowerCase().replace(/[^a-z0-9_.-]/g, '');
      moodleUser = await this.moodleClient.createUser({
        username: safeUsername,
        password: dto.password,
        firstname: dto.first_name.trim(),
        lastname: dto.last_name.trim(),
        email: dto.email.trim().toLowerCase(),
      });

      if (moodleUser) {
        await admin
          .from('profiles')
          .update({
            moodle_user_id: moodleUser.id,
            moodle_username: moodleUser.username,
            moodle_sync_status: 'sincronizado',
            moodle_last_sync_at: new Date().toISOString(),
          })
          .eq('id', newUserId);
      }
    } catch (moodleErr: any) {
      this.logger.warn(`Usuario creado pero fallo sincronización inicial Moodle: ${moodleErr.message}`);
    }

    // 6. Registro en bitácora de auditoría
    await admin.from('audit_logs').insert({
      actor_id: actorId,
      target_user_id: newUserId,
      action: 'USER_CREATED_BY_ADMIN',
      entity_name: 'profiles',
      entity_id: newUserId,
      new_values: {
        email: dto.email,
        first_name: dto.first_name,
        last_name: dto.last_name,
        assigned_role: role.slug,
        moodle_user_id: moodleUser?.id ?? null,
      },
    });

    // 7. Retornar perfil consolidado
    const { data: createdProfile } = await admin
      .from('v_user_complete_profile')
      .select('*')
      .eq('id', newUserId)
      .maybeSingle();

    return createdProfile || {
      id: newUserId,
      email: dto.email,
      active_roles: [role.slug],
    };
  }
}
