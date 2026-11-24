// IINICIA Portal · identidad y autenticación · roles.guard.spec.ts
/** Comprueba acceso sin restricción, coincidencia de roles y denegación cuando no existe asignación. */
import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { RolesGuard } from './roles.guard.js';
import { SupabaseService } from '../supabase/supabase.service.js';

describe('RolesGuard', () => {
  let guard: RolesGuard;
  let reflector: Reflector;
  let supabaseMock: {
    getResilientClient: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    reflector = new Reflector();
    supabaseMock = {
      getResilientClient: vi.fn(),
    };
    guard = new RolesGuard(reflector, supabaseMock as unknown as SupabaseService);
  });

  /** Prepara el contexto HTTP mínimo para probar el guard con diferentes metadatos de rol. */
  function createMockContext(
    user: { id: string } | null,
    accessToken?: string,
  ): ExecutionContext {
    const request = {
      user,
      accessToken,
    };
    return {
      getHandler: () => ({}),
      getClass: () => ({}),
      switchToHttp: () => ({
        getRequest: () => request,
      }),
    } as unknown as ExecutionContext;
  }

  it('allows access when no roles are required', async () => {
    vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);
    supabaseMock.getResilientClient.mockReturnValue({
      rpc: vi.fn().mockResolvedValue({ data: ['administrador'], error: null }),
    });
    const context = createMockContext({ id: 'admin' }, 'token');

    const result = await guard.canActivate(context);
    expect(result).toBe(true);
    expect(context.switchToHttp().getRequest().userRoles).toEqual(['administrador']);
  });

  it('allows superadministrador access regardless of required roles', async () => {
    vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['profesor']);
    const clientMock = {
      rpc: vi.fn().mockResolvedValue({ data: ['superadministrador'], error: null }),
    };
    supabaseMock.getResilientClient.mockReturnValue(clientMock);

    const context = createMockContext({ id: 'user-1' }, 'token-xyz');
    const result = await guard.canActivate(context);
    expect(result).toBe(true);
  });

  it('allows user with matching role', async () => {
    vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['profesor', 'administrador']);
    const clientMock = {
      rpc: vi.fn().mockResolvedValue({ data: ['profesor'], error: null }),
    };
    supabaseMock.getResilientClient.mockReturnValue(clientMock);

    const context = createMockContext({ id: 'user-1' }, 'token-xyz');
    const result = await guard.canActivate(context);
    expect(result).toBe(true);
  });

  it('throws ForbiddenException when role is not present', async () => {
    vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['administrador']);
    const clientMock = {
      rpc: vi.fn().mockResolvedValue({ data: ['estudiante'], error: null }),
    };
    supabaseMock.getResilientClient.mockReturnValue(clientMock);

    const context = createMockContext({ id: 'user-1' }, 'token-xyz');
    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });
});
