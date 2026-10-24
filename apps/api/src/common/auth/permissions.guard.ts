import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { SupabaseService } from '../supabase/supabase.service.js';
import { PERMISSIONS_KEY } from './permissions.decorator.js';
import type { AuthenticatedRequest } from './supabase-auth.guard.js';

interface RequestWithPermissions extends AuthenticatedRequest {
  userPermissions?: string[];
  userRoles?: string[];
}

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly supabase: SupabaseService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredPermissions || requiredPermissions.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<RequestWithPermissions>();
    const accessToken = request.accessToken;
    const user = request.user;

    if (!user || !accessToken) {
      throw new ForbiddenException('Usuario no autenticado.');
    }

    if (!request.userPermissions) {
      request.userPermissions = await this.resolveUserPermissions(
        accessToken,
        user.id,
      );
    }

    const userPermissions = request.userPermissions;

    // Verificar si el usuario cuenta con todos los permisos requeridos
    const hasAll = requiredPermissions.every((perm) =>
      userPermissions.includes(perm),
    );

    if (!hasAll) {
      throw new ForbiddenException(
        'No posees los permisos necesarios para realizar esta acción.',
      );
    }

    return true;
  }

  private async resolveUserPermissions(
    accessToken: string,
    userId: string,
  ): Promise<string[]> {
    try {
      const client = this.supabase.getResilientClient(accessToken);

      // Si es superadministrador, tiene todos los permisos
      const { data: isSuperadmin } = await client.rpc('has_role', {
        required_role_slug: 'superadministrador',
        target_uid: userId,
      });

      if (isSuperadmin) {
        const { data: allPerms } = await client
          .from('permissions')
          .select('code');
        if (Array.isArray(allPerms)) {
          return allPerms.map((p) => p.code);
        }
      }

      // Obtener roles activos
      const { data: userRoles } = await client
        .from('user_roles')
        .select('role_id, is_active, expires_at')
        .eq('user_id', userId)
        .eq('is_active', true);

      if (!Array.isArray(userRoles) || userRoles.length === 0) {
        return [];
      }

      const now = new Date().toISOString();
      const roleIds = userRoles
        .filter((r) => !r.expires_at || r.expires_at >= now)
        .map((r) => r.role_id);

      if (roleIds.length === 0) return [];

      const { data: rolePerms } = await client
        .from('role_permissions')
        .select('perms:permissions!permission_id ( code )')
        .in('role_id', roleIds);

      if (!Array.isArray(rolePerms)) return [];

      const permissions: string[] = [];
      for (const item of rolePerms) {
        const row = item as unknown as {
          perms: { code: string } | { code: string }[] | null;
        };
        if (!row.perms) continue;
        if (Array.isArray(row.perms)) {
          for (const p of row.perms) {
            if (p?.code) permissions.push(p.code);
          }
        } else if (row.perms.code) {
          permissions.push(row.perms.code);
        }
      }

      return Array.from(new Set(permissions));
    } catch {
      return [];
    }
  }
}
