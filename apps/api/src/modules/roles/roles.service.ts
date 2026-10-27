import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { SupabaseService } from '../../common/supabase/supabase.service.js';
import { AssignRoleDto } from './dto/assign-role.dto.js';

@Injectable()
export class RolesService {
  private readonly logger = new Logger(RolesService.name);

  constructor(private readonly supabase: SupabaseService) {}

  /**
   * Catálogo de roles disponibles en la plataforma.
   */
  async findAll(accessToken: string) {
    const client = this.supabase.getResilientClient(accessToken);
    const { data, error } = await client
      .from('roles')
      .select('*')
      .order('hierarchy_level', { ascending: false });

    if (error) {
      this.logger.error(`Error al consultar roles: ${error.message}`);
      throw new InternalServerErrorException('No fue posible consultar el catálogo de roles.');
    }

    return data || [];
  }

  /**
   * Asigna un rol a un usuario en `user_roles`.
   * Registra la acción en `audit_logs`.
   */
  async assignRole(
    targetUserId: string,
    dto: AssignRoleDto,
    actorId: string,
  ) {
    const admin = this.supabase.getAdminClient();

    // Validar existencia de usuario y de rol
    const { data: role, error: roleError } = await admin
      .from('roles')
      .select('id, slug, name')
      .eq('id', dto.role_id)
      .maybeSingle();

    if (roleError || !role) {
      throw new NotFoundException('El rol especificado no existe.');
    }

    const { data: profile, error: profileError } = await admin
      .from('profiles')
      .select('id, email')
      .eq('id', targetUserId)
      .maybeSingle();

    if (profileError || !profile) {
      throw new NotFoundException('El perfil de usuario no existe.');
    }

    // Insertar o reactivar en user_roles
    const { data: existingAssignment } = await admin
      .from('user_roles')
      .select('id, is_active')
      .eq('user_id', targetUserId)
      .eq('role_id', dto.role_id)
      .maybeSingle();

    if (existingAssignment) {
      if (existingAssignment.is_active) {
        throw new BadRequestException('El usuario ya cuenta con este rol activo.');
      }
      // Reactivar
      const { error: reactivateError } = await admin
        .from('user_roles')
        .update({
          is_active: true,
          assigned_by: actorId,
          expires_at: dto.expires_at ?? null,
          assigned_at: new Date().toISOString(),
        })
        .eq('id', existingAssignment.id);

      if (reactivateError) {
        throw new InternalServerErrorException('Error al reactivar el rol del usuario.');
      }
    } else {
      const { error: insertError } = await admin.from('user_roles').insert({
        user_id: targetUserId,
        role_id: dto.role_id,
        assigned_by: actorId,
        is_active: true,
        expires_at: dto.expires_at ?? null,
      });

      if (insertError) {
        throw new InternalServerErrorException('Error al asignar el rol al usuario.');
      }
    }

    // Si se asigna un rol formal (profesor, estudiante, administrador, coordinador, etc.),
    // desactivar automáticamente el rol temporal de 'aspirante' para evitar duplicidad y roles contradictorios.
    if (role.slug !== 'aspirante') {
      const { data: aspiranteRole } = await admin
        .from('roles')
        .select('id')
        .eq('slug', 'aspirante')
        .maybeSingle();

      if (aspiranteRole) {
        await admin
          .from('user_roles')
          .update({ is_active: false })
          .eq('user_id', targetUserId)
          .eq('role_id', aspiranteRole.id);
      }
    }

    // Registrar en audit_logs
    await admin.from('audit_logs').insert({
      actor_id: actorId,
      target_user_id: targetUserId,
      action: 'ROLE_ASSIGNED',
      entity_name: 'user_roles',
      entity_id: `${targetUserId}:${dto.role_id}`,
      new_values: {
        role_id: dto.role_id,
        role_slug: role.slug,
        role_name: role.name,
        expires_at: dto.expires_at ?? null,
      },
    });

    return {
      success: true,
      user_id: targetUserId,
      role_id: dto.role_id,
      role_slug: role.slug,
      assigned_at: new Date().toISOString(),
    };
  }

  /**
   * Revoca un rol a un usuario (desactiva en `user_roles`).
   */
  async revokeRole(
    targetUserId: string,
    roleId: number,
    actorId: string,
  ) {
    const admin = this.supabase.getAdminClient();

    const { data: assignment, error: findError } = await admin
      .from('user_roles')
      .select('id, role_id, is_active, roles!role_id ( slug, name )')
      .eq('user_id', targetUserId)
      .eq('role_id', roleId)
      .eq('is_active', true)
      .maybeSingle();

    if (findError || !assignment) {
      throw new NotFoundException('El usuario no tiene asignado este rol activo.');
    }

    const { error: deleteError } = await admin
      .from('user_roles')
      .update({ is_active: false })
      .eq('id', assignment.id);

    if (deleteError) {
      throw new InternalServerErrorException('Error al revocar el rol.');
    }

    const roleInfo = (assignment as any).roles;
    const roleSlug = Array.isArray(roleInfo) ? roleInfo[0]?.slug : roleInfo?.slug;

    // Registrar en audit_logs
    await admin.from('audit_logs').insert({
      actor_id: actorId,
      target_user_id: targetUserId,
      action: 'ROLE_REVOKED',
      entity_name: 'user_roles',
      entity_id: assignment.id,
      old_values: {
        role_id: roleId,
        role_slug: roleSlug,
      },
    });

    return {
      success: true,
      user_id: targetUserId,
      revoked_role_id: roleId,
      revoked_at: new Date().toISOString(),
    };
  }
}
