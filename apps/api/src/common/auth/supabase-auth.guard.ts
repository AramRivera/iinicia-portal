// IINICIA Portal · identidad y autenticación · supabase-auth.guard.ts
/** Valida la identidad con Supabase y exige el segundo factor antes de entregar la petición al controlador. */
import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { User } from '@supabase/supabase-js';
import type { Request } from 'express';
import { SupabaseService } from '../supabase/supabase.service.js';
import { readSupabaseTokenClaims } from './supabase-token-claims.js';

export interface AuthenticatedRequest extends Request {
  accessToken: string;
  user: User;
  userRoles?: string[];
}

@Injectable()
export class SupabaseAuthGuard implements CanActivate {
  /** Recibe supabase como dependencias del módulo de identidad y autenticación. NestJS proporciona esas instancias para las operaciones del componente. */
  constructor(private readonly supabase: SupabaseService) {}

  /** Valida el token con Supabase, exige el segundo factor y comprueba el estado actual del perfil antes de exponer la identidad a la ruta. */
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const authorization = request.headers.authorization;
    const match = authorization?.match(/^Bearer\s+(\S+)$/i);

    if (!match) {
      throw new UnauthorizedException(
        'Se requiere un token Bearer de Supabase.',
      );
    }

    const accessToken = match[1];
    const user = await this.supabase.getAuthenticatedUser(accessToken);
    if (readSupabaseTokenClaims(accessToken).aal !== 'aal2') {
      throw new ForbiddenException('Completa la verificación en dos pasos.');
    }
    // El JWT identifica al titular. El estado del perfil confirma que conserva acceso a la ruta.
    await this.supabase.assertPortalAccount(accessToken, user.id);
    request.accessToken = accessToken;
    request.user = user;

    return true;
  }
}
