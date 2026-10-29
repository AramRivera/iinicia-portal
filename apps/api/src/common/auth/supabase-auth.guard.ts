import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { User } from '@supabase/supabase-js';
import type { Request } from 'express';
import { SupabaseService } from '../supabase/supabase.service.js';

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
    request.accessToken = accessToken;
    request.user = await this.supabase.getAuthenticatedUser(accessToken);

    const { data: profile, error } = await this.supabase
      .getResilientClient(accessToken)
      .from('profiles')
      .select('status')
      .eq('id', request.user.id)
      .maybeSingle();
    if (error || !profile || ['suspendido', 'inactivo', 'baja'].includes(profile.status)) {
      throw new UnauthorizedException('La cuenta no está activa en el portal.');
    }

    return true;
  }
}
