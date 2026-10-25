import { Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthRepository, UserRoleEmbed } from './auth.repository.js';
import { MeResponse } from './dto/me-response.dto.js';
import { RegisterDto } from './dto/register.dto.js';
import { SupabaseService } from '../../common/supabase/supabase.service.js';

type RoleEmbed = { slug: string } | { slug: string }[] | null;

@Injectable()
export class AuthService {
  constructor(
    private readonly repository: AuthRepository,
    private readonly supabase: SupabaseService,
  ) {}

  async register(dto: RegisterDto) {
    return this.supabase.signUp({
      email: dto.email,
      password: dto.password,
      firstName: dto.first_name,
      lastName: dto.last_name,
      phone: dto.phone,
    });
  }

  /**
   * Devuelve la identidad efectiva del usuario autenticado:
   * perfil, roles activos y permisos asignados.
   */
  async getMe(
    accessToken: string,
    userId: string,
    _tokenIssuedAt: number | null,
  ): Promise<MeResponse> {
    const profile = await this.repository.findOwnProfile(accessToken, userId);

    if (!profile) {
      throw new UnauthorizedException(
        'El usuario autenticado no tiene un perfil activo en el portal.',
      );
    }

    // Un perfil suspendido, inactivo o dado de baja no puede operar
    if (
      profile.status === 'suspendido' ||
      profile.status === 'inactivo' ||
      profile.status === 'baja'
    ) {
      throw new UnauthorizedException(
        'La cuenta no está activa. Contacta al administrador.',
      );
    }

    const assignments = await this.repository.findOwnRoles(accessToken, userId);

    // Filtrar roles no expirados
    const now = new Date().toISOString();
    const activeAssignments = assignments.filter((a: UserRoleEmbed) => {
      if (!a.is_active) return false;
      if (a.expires_at && a.expires_at < now) return false;
      return true;
    });

    const roles = uniqueSorted(
      activeAssignments
        .map((assignment: UserRoleEmbed) => roleSlug(assignment.roles))
        .filter((slug): slug is string => slug !== null),
    );

    const roleIds = Array.from(
      new Set(activeAssignments.map((a: UserRoleEmbed) => a.role_id)),
    );

    const permissionRows = await this.repository.findPermissionsByRoles(
      accessToken,
      roleIds,
    );

    const permissions = uniqueSorted(
      permissionRows.flatMap((row) =>
        (row.perms ?? [])
          .map((perm) => perm.code)
          .filter((code): code is string => typeof code === 'string'),
      ),
    );

    return {
      id: profile.id,
      email: profile.email,
      first_name: profile.first_name,
      last_name: profile.last_name,
      phone: profile.phone,
      avatar_url: profile.avatar_url,
      status: profile.status,
      roles,
      permissions,
      moodle_user_id: profile.moodle_user_id,
      moodle_sync_status: profile.moodle_sync_status,
      password_changed_at: null,
    } satisfies MeResponse;
  }
}

function roleSlug(embed: RoleEmbed): string | null {
  if (!embed) return null;
  if (Array.isArray(embed)) {
    return embed[0]?.slug ?? null;
  }
  return embed.slug ?? null;
}

function uniqueSorted(values: string[]): string[] {
  return Array.from(new Set(values)).sort((a, b) => a.localeCompare(b));
}
