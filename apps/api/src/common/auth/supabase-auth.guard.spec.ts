import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import type { Request } from 'express';
import { SupabaseService } from '../supabase/supabase.service.js';
import { SupabaseAuthGuard } from './supabase-auth.guard.js';

describe('SupabaseAuthGuard', () => {
  let guard: SupabaseAuthGuard;
  let supabase: { getAuthenticatedUser: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    supabase = { getAuthenticatedUser: vi.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SupabaseAuthGuard,
        { provide: SupabaseService, useValue: supabase },
      ],
    }).compile();

    guard = module.get<SupabaseAuthGuard>(SupabaseAuthGuard);
  });

  it('validates the bearer token and attaches the authenticated user', async () => {
    const user = { id: 'user-1' };
    supabase.getAuthenticatedUser.mockResolvedValue(user);
    const token = tokenWithLevel('aal2');
    const request = { headers: { authorization: `Bearer ${token}` } } as Request;
    const context = createExecutionContext(request);

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(supabase.getAuthenticatedUser).toHaveBeenCalledWith(token);
    expect(request).toMatchObject({
      accessToken: token,
      user,
    });
  });

  it.each([tokenWithLevel('aal1'), 'token-without-aal'])('denies a valid identity without MFA (%s)', async (token) => {
    supabase.getAuthenticatedUser.mockResolvedValue({ id: 'user-1' });
    const request = { headers: { authorization: `Bearer ${token}` } } as Request;
    await expect(guard.canActivate(createExecutionContext(request))).rejects.toMatchObject({ status: 403 });
    expect(request).not.toHaveProperty('user');
  });

  it('does not trust an AAL2 claim on an invalid JWT', async () => {
    supabase.getAuthenticatedUser.mockRejectedValue(new UnauthorizedException());
    const request = { headers: { authorization: `Bearer ${tokenWithLevel('aal2')}` } } as Request;
    await expect(guard.canActivate(createExecutionContext(request))).rejects.toMatchObject({ status: 401 });
  });

  it('rejects requests without a bearer token', async () => {
    const request = { headers: {} } as Request;

    await expect(
      guard.canActivate(createExecutionContext(request)),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(supabase.getAuthenticatedUser).not.toHaveBeenCalled();
  });
});

function tokenWithLevel(aal: string): string {
  return `header.${Buffer.from(JSON.stringify({ aal })).toString('base64url')}.signature`;
}

function createExecutionContext(request: Request): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => request,
    }),
  } as ExecutionContext;
}
