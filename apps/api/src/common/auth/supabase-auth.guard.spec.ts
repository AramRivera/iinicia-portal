import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import type { Request } from 'express';
import { SupabaseService } from '../supabase/supabase.service.js';
import { SupabaseAuthGuard } from './supabase-auth.guard.js';

describe('SupabaseAuthGuard', () => {
  let guard: SupabaseAuthGuard;
  let supabase: { getAuthenticatedUser: ReturnType<typeof vi.fn>; getResilientClient: ReturnType<typeof vi.fn> };
  const query = { select: vi.fn(), eq: vi.fn(), maybeSingle: vi.fn() };

  beforeEach(async () => {
    query.select.mockReturnValue(query);
    query.eq.mockReturnValue(query);
    query.maybeSingle.mockResolvedValue({ data: { status: 'activo' }, error: null });
    supabase = {
      getAuthenticatedUser: vi.fn(),
      getResilientClient: vi.fn(() => ({ from: vi.fn(() => query) })),
    };

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

  it('rejects suspended accounts even with a valid Supabase token', async () => {
    supabase.getAuthenticatedUser.mockResolvedValue({ id: 'user-1' });
    query.maybeSingle.mockResolvedValueOnce({ data: { status: 'suspendido' }, error: null });
    const request = { headers: { authorization: 'Bearer valid-token' } } as Request;
    await expect(guard.canActivate(createExecutionContext(request)))
      .rejects.toBeInstanceOf(UnauthorizedException);
  });
});

function createExecutionContext(request: Request): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => request,
    }),
  } as ExecutionContext;
}
