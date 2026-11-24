// IINICIA Portal · identidad y autenticación · roles.guard.ts
/** Exige los roles de la ruta y resuelve sus asignaciones vigentes para el usuario autenticado. */
import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { SupabaseService } from '../supabase/supabase.service.js';
import { ROLES_KEY } from './roles.decorator.js';
import type { AuthenticatedRequest } from './supabase-auth.guard.js';

interface RequestWithRoles extends AuthenticatedRequest {
  userRoles?: string[];
}

@Injectable()
export class RolesGuard implements CanActivate {
  /** Recibe reflector y supabase como dependencias del módulo de identidad y autenticación. NestJS proporciona esas instancias para las operaciones del componente. */
  constructor(
    private readonly reflector: Reflector,
    private readonly supabase: SupabaseService,
  ) {}

  /** Lee los roles requeridos y resuelve los de la sesión. Adjunta los roles incluso cuando el controlador los necesita solo para filtrar la consulta. */
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    const request = context.switchToHttp().getRequest<RequestWithRoles>();
    const accessToken = request.accessToken;
    const user = request.user;

    if (!user || !accessToken) {
      throw new ForbiddenException('Usuario no autenticado.');
    }

    // El rol proviene de una consulta con la sesión validada y se reutiliza durante la misma petición.
    if (!request.userRoles) {
      request.userRoles = await this.resolveUserRoles(accessToken, user.id);
    }

    // Controllers such as GET /courses also need the roles to choose their
    // scoped query, even when all authenticated roles may call the route.
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const userRoles = request.userRoles;

    if (userRoles.includes('superadministrador')) {
      return true;
    }

    const hasRequiredRole = requiredRoles.some((role) =>
      userRoles.includes(role),
    );

    if (!hasRequiredRole) {
      throw new ForbiddenException(
        'No posees los roles necesarios para acceder a este recurso.',
      );
    }

    return true;
  }

  /** Intenta resolver los roles con la función de Supabase y recurre a las asignaciones vigentes cuando la función no devuelve roles. */
  private async resolveUserRoles(
    accessToken: string,
    userId: string,
  ): Promise<string[]> {
    try {
      const client = this.supabase.getResilientClient(accessToken);
      const { data: rpcRoles, error: rpcError } = await (client as any).rpc(
        'get_my_roles',
      );
      if (!rpcError && Array.isArray(rpcRoles) && rpcRoles.length > 0) {
        return rpcRoles as string[];
      }

      // Si la consulta de roles mediante la función falla o no devuelve roles, se leen las asignaciones vigentes del titular.
      const { data, error } = await client
        .from('user_roles')
        .select('is_active, expires_at, roles!role_id ( slug )')
        .eq('user_id', userId)
        .eq('is_active', true);

      if (error || !Array.isArray(data)) {
        return [];
      }

      const now = new Date().toISOString();
      const roles: string[] = [];

      for (const item of data) {
        const row = item as unknown as {
          is_active: boolean;
          expires_at: string | null;
          roles: { slug: string } | { slug: string }[] | null;
        };
        if (row.expires_at && row.expires_at < now) continue;
        if (!row.roles) continue;
        if (Array.isArray(row.roles)) {
          if (row.roles[0]?.slug) roles.push(row.roles[0].slug);
        } else if (row.roles.slug) {
          roles.push(row.roles.slug);
        }
      }

      return Array.from(new Set(roles));
    } catch {
      return [];
    }
  }
}
