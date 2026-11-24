// IINICIA Portal · identidad y autenticación · current-user.decorator.ts
/** Obtiene del contexto HTTP la identidad que ya colocó el guard de autenticación. */
import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { AuthenticatedRequest } from './supabase-auth.guard.js';

export const CurrentUser = createParamDecorator(
  (data: string | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest<AuthenticatedRequest>();
    const user = request.user;
    if (!user) return null;
    return data ? (user as unknown as Record<string, unknown>)[data] : user;
  },
);
