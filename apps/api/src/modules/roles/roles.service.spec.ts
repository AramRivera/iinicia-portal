import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SupabaseService } from '../../common/supabase/supabase.service.js';
import { RolesService } from './roles.service.js';

describe('RolesService', () => {
  let service: RolesService;
  let supabaseMock: {
    getResilientClient: ReturnType<typeof vi.fn>;
    getAdminClient: ReturnType<typeof vi.fn>;
  };
  let clientMock: any;
  let adminClientMock: any;

  beforeEach(async () => {
    clientMock = {
      from: vi.fn(),
    };
    adminClientMock = {
      from: vi.fn(),
    };

    supabaseMock = {
      getResilientClient: vi.fn().mockReturnValue(clientMock),
      getAdminClient: vi.fn().mockReturnValue(adminClientMock),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RolesService,
        { provide: SupabaseService, useValue: supabaseMock },
      ],
    }).compile();

    service = module.get<RolesService>(RolesService);
  });

  describe('findAll', () => {
    it('returns roles catalog ordered by hierarchy', async () => {
      const mockRoles = [
        { id: 1, slug: 'superadministrador', hierarchy_level: 100 },
        { id: 2, slug: 'administrador', hierarchy_level: 90 },
      ];

      clientMock.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({ data: mockRoles, error: null }),
        }),
      });

      const result = await service.findAll('user-token');
      expect(result).toEqual(mockRoles);
    });
  });

  describe('assignRole', () => {
    it('throws NotFoundException if role does not exist', async () => {
      adminClientMock.from.mockImplementation((table: string) => {
        if (table === 'roles') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
              }),
            }),
          };
        }
        return {};
      });

      await expect(
        service.assignRole('u1', { role_id: 99 }, 'admin-id'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('assigns role and records audit log', async () => {
      const role = { id: 5, slug: 'estudiante', name: 'Estudiante' };
      const profile = { id: 'u1', email: 'u1@test.com' };

      const insertUserRoleMock = vi.fn().mockResolvedValue({ error: null });
      const insertAuditMock = vi.fn().mockResolvedValue({ error: null });

      adminClientMock.from.mockImplementation((table: string) => {
        if (table === 'roles') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({ data: role, error: null }),
              }),
            }),
          };
        }
        if (table === 'profiles') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({ data: profile, error: null }),
              }),
            }),
          };
        }
        if (table === 'user_roles') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
                }),
              }),
            }),
            insert: insertUserRoleMock,
            update: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockResolvedValue({ error: null }),
              }),
            }),
          };
        }
        if (table === 'audit_logs') {
          return { insert: insertAuditMock };
        }
        return {};
      });

      const result = await service.assignRole('u1', { role_id: 5 }, 'admin-id');

      expect(result.success).toBe(true);
      expect(result.role_slug).toBe('estudiante');
      expect(insertUserRoleMock).toHaveBeenCalled();
      expect(insertAuditMock).toHaveBeenCalled();
    });
  });

  describe('revokeRole', () => {
    it('deactivates active role assignment and records audit', async () => {
      const assignment = {
        id: 'ur-1',
        role_id: 5,
        is_active: true,
        roles: { slug: 'estudiante', name: 'Estudiante' },
      };

      const updateMock = vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      });
      const insertAuditMock = vi.fn().mockResolvedValue({ error: null });

      adminClientMock.from.mockImplementation((table: string) => {
        if (table === 'user_roles') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  eq: vi.fn().mockReturnValue({
                    maybeSingle: vi.fn().mockResolvedValue({ data: assignment, error: null }),
                  }),
                }),
              }),
            }),
            update: updateMock,
          };
        }
        if (table === 'audit_logs') {
          return { insert: insertAuditMock };
        }
        return {};
      });

      const result = await service.revokeRole('u1', 5, 'admin-id');
      expect(result.success).toBe(true);
      expect(result.revoked_role_id).toBe(5);
      expect(updateMock).toHaveBeenCalledWith({ is_active: false });
      expect(insertAuditMock).toHaveBeenCalled();
    });
  });
});
