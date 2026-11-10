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
  constructor(private readonly supabase: SupabaseService) {}

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
    request.accessToken = accessToken;
    request.user = user;

    return true;
  }
}
