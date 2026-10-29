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

    return true;
  }
}
