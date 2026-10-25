import { UnauthorizedException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AuthRepository } from './auth.repository.js';
import { AuthService } from './auth.service.js';
import { SupabaseService } from '../../common/supabase/supabase.service.js';

describe('AuthService.getMe', () => {
  let service: AuthService;
  let repository: {
    findOwnProfile: ReturnType<typeof vi.fn>;
    findOwnRoles: ReturnType<typeof vi.fn>;
    findPermissionsByRoles: ReturnType<typeof vi.fn>;
  };
  let supabaseMock: {
    signUp: ReturnType<typeof vi.fn>;
  };

  const profile = {
    id: '11111111-1111-1111-1111-111111111111',
    email: 'juan@example.com',
    first_name: 'Juan',
    last_name: 'Pérez',
    phone: '5551234567',
    avatar_url: null,
    status: 'activo' as const,
    moodle_user_id: 42,
    moodle_sync_status: 'sincronizado' as const,
  };

  beforeEach(async () => {
    repository = {
      findOwnProfile: vi.fn().mockResolvedValue(profile),
      findOwnRoles: vi.fn().mockResolvedValue([]),
      findPermissionsByRoles: vi.fn().mockResolvedValue([]),
    };

    supabaseMock = {
      signUp: vi.fn().mockResolvedValue({ id: profile.id, email: profile.email }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: AuthRepository, useValue: repository },
        { provide: SupabaseService, useValue: supabaseMock },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  it('returns the contract shape with deduplicated roles and permissions', async () => {
    repository.findOwnRoles.mockResolvedValue([
      { role_id: 2, is_active: true, expires_at: null, roles: { slug: 'administrador' } },
      { role_id: 2, is_active: true, expires_at: null, roles: [{ slug: 'administrador' }] },
      { role_id: 3, is_active: true, expires_at: null, roles: { slug: 'coordinador' } },
    ]);
    repository.findPermissionsByRoles.mockResolvedValue([
      {
        role_id: 2,
        perms: [
          { code: 'users.read' },
          { code: 'programs.manage' },
          { code: 'enrollments.authorize' },
        ],
      },
      { role_id: 3, perms: [{ code: 'users.read' }] },
    ]);

    const result = await service.getMe(
      'access-token',
      profile.id,
      1_700_000_000,
    );

    expect(repository.findOwnProfile).toHaveBeenCalledWith(
      'access-token',
      profile.id,
    );
    expect(repository.findPermissionsByRoles).toHaveBeenCalledWith(
      'access-token',
      [2, 3],
    );
    expect(result).toEqual({
      id: profile.id,
      email: profile.email,
      first_name: 'Juan',
      last_name: 'Pérez',
      phone: '5551234567',
      avatar_url: null,
      status: 'activo',
      roles: ['administrador', 'coordinador'],
      permissions: [
        'enrollments.authorize',
        'programs.manage',
        'users.read',
      ],
      moodle_user_id: 42,
      moodle_sync_status: 'sincronizado',
      password_changed_at: null,
    });
  });

  it('handles permissions when perms is an object (PostgREST relation shape) or null', async () => {
    repository.findOwnRoles.mockResolvedValue([
      { role_id: 1, is_active: true, expires_at: null, roles: { slug: 'superadministrador' } },
    ]);
    repository.findPermissionsByRoles.mockResolvedValue([
      { role_id: 1, perms: { code: 'system.settings.manage' } as any },
      { role_id: 1, perms: { code: 'audit.logs.read' } as any },
      { role_id: 1, perms: null },
    ]);

    const result = await service.getMe('access-token', profile.id, null);

    expect(result.roles).toEqual(['superadministrador']);
    expect(result.permissions).toEqual(['audit.logs.read', 'system.settings.manage']);
  });

  it('allows pendiente status (e.g. for aspirante)', async () => {
    repository.findOwnProfile.mockResolvedValue({
      ...profile,
      status: 'pendiente',
    });
    repository.findOwnRoles.mockResolvedValue([
      { role_id: 7, is_active: true, expires_at: null, roles: { slug: 'aspirante' } },
    ]);

    const result = await service.getMe('access-token', profile.id, null);
    expect(result.status).toBe('pendiente');
    expect(result.roles).toEqual(['aspirante']);
  });

  it('rejects suspended accounts', async () => {
    repository.findOwnProfile.mockResolvedValue({
      ...profile,
      status: 'suspendido',
    });

    await expect(
      service.getMe('access-token', profile.id, null),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects inactive or baja accounts', async () => {
    repository.findOwnProfile.mockResolvedValue({
      ...profile,
      status: 'baja',
    });

    await expect(
      service.getMe('access-token', profile.id, null),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects users without profile', async () => {
    repository.findOwnProfile.mockResolvedValue(null);

    await expect(
      service.getMe('access-token', profile.id, null),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('registers a new user calling supabase signUp', async () => {
    const dto = {
      email: 'nuevo@example.com',
      password: 'Password123!',
      first_name: 'Nuevo',
      last_name: 'Usuario',
      phone: '1234567890',
    };

    await service.register(dto);
    expect(supabaseMock.signUp).toHaveBeenCalledWith({
      email: dto.email,
      password: dto.password,
      firstName: dto.first_name,
      lastName: dto.last_name,
      phone: dto.phone,
    });
  });
});
