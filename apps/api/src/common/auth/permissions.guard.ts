// IINICIA Portal · identidad y autenticación · permissions.guard.ts
/** Resuelve los permisos requeridos por la ruta y los compara con los permisos de la sesión. */
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
  /** Recibe reflector y supabase como dependencias del módulo de identidad y autenticación. NestJS proporciona esas instancias para las operaciones del componente. */
  constructor(
    private readonly reflector: Reflector,
    private readonly supabase: SupabaseService,
  ) {}

  /** Lee los permisos declarados por la ruta y exige que la cuenta satisfaga el conjunto con su sesión autorizada. */
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

    if (request.userRoles?.includes('superadministrador')) {
      return true;
    }

    // Los permisos se resuelven una vez por petición a partir de la identidad y las asignaciones vigentes.
    if (!request.userPermissions) {
      request.userPermissions = await this.resolveUserPermissions(
        accessToken,
        user.id,
      );
    }

    const userPermissions = request.userPermissions;

    // Una ruta puede declarar varios permisos. La autorización exige que la sesión cumpla todos.
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

  /** Obtiene los permisos derivados de los roles activos bajo la sesión de Supabase. Los fallos de resolución dejan la lista vacía. */
  private async resolveUserPermissions(
    accessToken: string,
    userId: string,
  ): Promise<string[]> {
    try {
      const client = this.supabase.getResilientClient(accessToken);

      const { data: isSuperadmin } = await (client as any).rpc('has_role', {
        required_role_slug: 'superadministrador',
        target_uid: userId,
      });

      if (isSuperadmin) {
        const { data: allPerms } = await client
          .from('permissions')
          .select('code');
        if (Array.isArray(allPerms)) {
          return (allPerms as Array<{ code: string }>).map((p) => p.code);
        }
      }

      const { data: userRoles } = await client
        .from('user_roles')
        .select('role_id, is_active, expires_at')
        .eq('user_id', userId)
        .eq('is_active', true);

      if (!Array.isArray(userRoles) || userRoles.length === 0) {
        return [];
      }

      const now = new Date().toISOString();
      const roleRows = userRoles as Array<{
        role_id: number;
        is_active: boolean;
        expires_at: string | null;
      }>;
      const roleIds = roleRows
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
