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
    const request = {
      headers: { authorization: 'Bearer valid-token' },
    } as Request;
    const context = createExecutionContext(request);

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(supabase.getAuthenticatedUser).toHaveBeenCalledWith('valid-token');
    expect(request).toMatchObject({
      accessToken: 'valid-token',
      user,
    });
  });

  it('rejects requests without a bearer token', async () => {
    const request = { headers: {} } as Request;

    await expect(
      guard.canActivate(createExecutionContext(request)),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(supabase.getAuthenticatedUser).not.toHaveBeenCalled();
  });
});

function createExecutionContext(request: Request): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => request,
    }),
  } as ExecutionContext;
}
