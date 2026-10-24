import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SupabaseService } from '../../common/supabase/supabase.service.js';
import { MoodleClient } from './moodle.client.js';
import { MoodleService } from './moodle.service.js';

describe('MoodleService', () => {
  let service: MoodleService;
  let clientMock: {
    checkConnection: ReturnType<typeof vi.fn>;
    getUserByEmail: ReturnType<typeof vi.fn>;
    getUserByUsername: ReturnType<typeof vi.fn>;
    createUser: ReturnType<typeof vi.fn>;
    enrolUser: ReturnType<typeof vi.fn>;
  };
  let supabaseMock: {
    getAdminClient: ReturnType<typeof vi.fn>;
  };
  let configMock: {
    get: ReturnType<typeof vi.fn>;
  };

  let adminClientMock: any;

  beforeEach(async () => {
    clientMock = {
      checkConnection: vi.fn(),
      getUserByEmail: vi.fn(),
      getUserByUsername: vi.fn(),
      createUser: vi.fn(),
      enrolUser: vi.fn(),
    };

    configMock = {
      get: vi.fn((key: string) => {
        if (key === 'MOODLE_URL') return 'http://localhost/moodle';
        return null;
      }),
    };

    adminClientMock = {
      from: vi.fn(),
    };

    supabaseMock = {
      getAdminClient: vi.fn().mockReturnValue(adminClientMock),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MoodleService,
        { provide: MoodleClient, useValue: clientMock },
        { provide: SupabaseService, useValue: supabaseMock },
        { provide: ConfigService, useValue: configMock },
      ],
    }).compile();

    service = module.get<MoodleService>(MoodleService);
  });

  describe('syncUser', () => {
    it('creates a new user in Moodle when not found and links profile', async () => {
      const profile = {
        id: 'usr-1',
        email: 'alumno@iinicia.org',
        first_name: 'Carlos',
        last_name: 'Gómez',
        moodle_user_id: null,
      };

      const selectMock = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockResolvedValue({ data: profile, error: null }),
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

      clientMock.getUserByEmail.mockResolvedValue(null);
      clientMock.createUser.mockResolvedValue({
        id: 77,
        username: 'alumno',
        email: profile.email,
      });

      const result = await service.syncUser('usr-1');

      expect(clientMock.getUserByEmail).toHaveBeenCalledWith('alumno@iinicia.org');
      expect(clientMock.createUser).toHaveBeenCalled();
      expect(result.moodle_user_id).toBe(77);
      expect(result.moodle_sync_status).toBe('sincronizado');
    });

    it('links existing Moodle user by email without creating a duplicate', async () => {
      const profile = {
        id: 'usr-2',
        email: 'existente@iinicia.org',
        first_name: 'Ana',
        last_name: 'López',
        moodle_user_id: null,
      };

      const selectMock = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockResolvedValue({ data: profile, error: null }),
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

      clientMock.getUserByEmail.mockResolvedValue({
        id: 88,
        username: 'ana.lopez',
        email: profile.email,
      });

      const result = await service.syncUser('usr-2');

      expect(clientMock.getUserByEmail).toHaveBeenCalledWith('existente@iinicia.org');
      expect(clientMock.createUser).not.toHaveBeenCalled();
      expect(result.moodle_user_id).toBe(88);
      expect(result.moodle_sync_status).toBe('sincronizado');
    });

    it('throws NotFoundException if profile does not exist', async () => {
      adminClientMock.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
          }),
        }),
      });

      await expect(service.syncUser('not-found')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('syncEnrollment', () => {
    it('throws BadRequestException if enrollment is not authorized', async () => {
      adminClientMock.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({
              data: { id: 'enr-1', status: 'pendiente' },
              error: null,
            }),
          }),
        }),
      });

      await expect(service.syncEnrollment('enr-1')).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('enrols user in Moodle and updates status to sincronizada', async () => {
      const enrollment = {
        id: 'enr-2',
        status: 'autorizada',
        moodle_role: 'student',
        user_id: 'usr-1',
        sync_attempts: 0,
        course_mappings: {
          moodle_course_id: 2,
        },
        profiles: {
          id: 'usr-1',
          moodle_user_id: 77,
          email: 'alumno@iinicia.org',
        },
      };

      const selectMock = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockResolvedValue({ data: enrollment, error: null }),
        }),
      });

      const updateMock = vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      });

      const insertMock = vi.fn().mockResolvedValue({ error: null });

      adminClientMock.from.mockImplementation((table: string) => {
        if (table === 'enrollment_requests') {
          return { select: selectMock, update: updateMock };
        }
        if (table === 'audit_logs') {
          return { insert: insertMock };
        }
        return {};
      });

      clientMock.enrolUser.mockResolvedValue(undefined);

      const result = await service.syncEnrollment('enr-2');

      expect(clientMock.enrolUser).toHaveBeenCalledWith({
        userId: 77,
        courseId: 2,
        roleId: 5, // student role id
      });
      expect(result.status).toBe('sincronizada');
    });
  });

  describe('getCourseAccessUrl', () => {
    it('returns launch URL and logs access when enrollment is authorized', async () => {
      const enrollment = {
        id: 'enr-3',
        status: 'autorizada',
        course_mappings: {
          course_name: 'Curso de React',
          moodle_course_id: 3,
        },
      };

      const selectMock = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({ data: enrollment, error: null }),
          }),
        }),
      });

      const insertMock = vi.fn().mockResolvedValue({ error: null });
      const updateMock = vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      });

      adminClientMock.from.mockImplementation((table: string) => {
        if (table === 'enrollment_requests') {
          return { select: selectMock, update: updateMock };
        }
        if (table === 'campus_access_logs') {
          return { insert: insertMock };
        }
        return {};
      });

      const result = await service.getCourseAccessUrl({
        userId: 'usr-1',
        courseMappingId: 'map-1',
        ipAddress: '127.0.0.1',
        userAgent: 'Mozilla/5.0',
      });

      expect(result.access_url).toBe('http://localhost/moodle/course/view.php?id=3');
      expect(insertMock).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: 'usr-1',
          succeeded: true,
        }),
      );
    });

    it('rejects with ForbiddenException and logs failure when enrollment is not authorized', async () => {
      const selectMock = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
          }),
        }),
      });

      const insertMock = vi.fn().mockResolvedValue({ error: null });

      adminClientMock.from.mockImplementation((table: string) => {
        if (table === 'enrollment_requests') {
          return { select: selectMock };
        }
        if (table === 'campus_access_logs') {
          return { insert: insertMock };
        }
        return {};
      });

      await expect(
        service.getCourseAccessUrl({
          userId: 'usr-1',
          courseMappingId: 'map-unauthorized',
        }),
      ).rejects.toBeInstanceOf(ForbiddenException);

      expect(insertMock).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: 'usr-1',
          succeeded: false,
        }),
      );
    });
  });
});
