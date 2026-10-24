import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SupabaseService } from '../../common/supabase/supabase.service.js';
import { MoodleClient } from '../moodle/moodle.client.js';
import { UsersService } from './users.service.js';

describe('UsersService', () => {
  let service: UsersService;
  let supabaseMock: {
    getResilientClient: ReturnType<typeof vi.fn>;
    getAdminClient: ReturnType<typeof vi.fn>;
  };
  let moodleClientMock: {
    updateUser: ReturnType<typeof vi.fn>;
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

    moodleClientMock = {
      updateUser: vi.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: SupabaseService, useValue: supabaseMock },
        { provide: MoodleClient, useValue: moodleClientMock },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
  });

  describe('findUsers', () => {
    it('returns paginated users list with metadata', async () => {
      const mockUsers = [
        { id: 'u1', email: 'u1@test.com', status: 'activo' },
        { id: 'u2', email: 'u2@test.com', status: 'activo' },
      ];

      const rangeMock = vi.fn().mockReturnValue({
        order: vi.fn().mockResolvedValue({
          data: mockUsers,
          error: null,
          count: 2,
        }),
      });

      const selectMock = vi.fn().mockReturnValue({
        range: rangeMock,
      });

      clientMock.from.mockReturnValue({
        select: selectMock,
      });

      const result = await service.findUsers(
        { limit: 20, offset: 0 },
        'user-token',
      );

      expect(result.data).toHaveLength(2);
      expect(result.meta.total).toBe(2);
      expect(result.meta.hasMore).toBe(false);
    });
  });

  describe('findUserById', () => {
    it('throws ForbiddenException if non-staff tries to see other user', async () => {
      await expect(
        service.findUserById('other-id', 'my-id', false, 'user-token'),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('allows user to see their own profile', async () => {
      const userProfile = { id: 'my-id', email: 'me@test.com' };
      clientMock.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({ data: userProfile, error: null }),
          }),
        }),
      });

      const result = await service.findUserById('my-id', 'my-id', false, 'user-token');
      expect(result).toEqual(userProfile);
    });

    it('allows staff to see another user profile', async () => {
      const userProfile = { id: 'other-id', email: 'other@test.com' };
      clientMock.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({ data: userProfile, error: null }),
          }),
        }),
      });

      const result = await service.findUserById('other-id', 'my-id', true, 'user-token');
      expect(result).toEqual(userProfile);
    });
  });

  describe('updateUserStatus', () => {
    it('updates status and syncs with moodle if user has moodle_user_id', async () => {
      const currentProfile = {
        id: 'u1',
        email: 'u1@test.com',
        status: 'activo',
        moodle_user_id: 99,
      };

      const selectMock = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockResolvedValue({ data: currentProfile, error: null }),
        }),
      });

      const updateMock = vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      });

      const insertMock = vi.fn().mockResolvedValue({ error: null });

      adminClientMock.from.mockImplementation((table: string) => {
        if (table === 'profiles') {
          return { select: selectMock, update: updateMock };
        }
        if (table === 'audit_logs') {
          return { insert: insertMock };
        }
        return {};
      });

      const result = await service.updateUserStatus(
        'u1',
        { status: 'suspendido', reason: 'Falta de pago' },
        'admin-id',
      );

      expect(result.previous_status).toBe('activo');
      expect(result.current_status).toBe('suspendido');
      expect(moodleClientMock.updateUser).toHaveBeenCalledWith(99, { suspended: 1 });
      expect(insertMock).toHaveBeenCalled();
    });
  });
});
