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
    unenrolUser?: ReturnType<typeof vi.fn>;
    requestUserKeyLoginUrl: ReturnType<typeof vi.fn>;
    getEffectiveBaseUrl: ReturnType<typeof vi.fn>;
    getUserCourseGrades: ReturnType<typeof vi.fn>;
    getCourseCompletionStatus: ReturnType<typeof vi.fn>;
    getActivitiesCompletionStatus: ReturnType<typeof vi.fn>;
    getCourseContents: ReturnType<typeof vi.fn>;
    getUserCourses: ReturnType<typeof vi.fn>;
  };
  let supabaseMock: {
    getAdminClient: ReturnType<typeof vi.fn>;
    getResilientClient: ReturnType<typeof vi.fn>;
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
      unenrolUser: vi.fn(),
      requestUserKeyLoginUrl: vi.fn(),
      getEffectiveBaseUrl: vi.fn().mockResolvedValue('http://localhost/moodle'),
      getUserCourseGrades: vi.fn(),
      getCourseCompletionStatus: vi.fn(),
      getActivitiesCompletionStatus: vi.fn(),
      getCourseContents: vi.fn(),
      getUserCourses: vi.fn(),
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
      getResilientClient: vi.fn(),
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

  describe('authorizeCourseRead', () => {
    function withCourseAccess(moodleRole: string | null, moodleUserId = 42) {
      const db = {
        from: vi.fn((table: string) => {
          if (table === 'user_roles') return {
            select: () => ({ eq: () => ({ eq: async () => ({ data: [{ is_active: true, expires_at: null, roles: { slug: 'estudiante' } }], error: null }) }) }),
          };
          if (table === 'v_user_authorized_courses') return {
            select: () => ({ eq: () => ({ eq: async () => ({ data: moodleRole ? [{ moodle_role: moodleRole }] : [], error: null }) }) }),
          };
          if (table === 'profiles') return {
            select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { moodle_user_id: moodleUserId }, error: null }) }) }),
          };
          return {};
        }),
      };
      supabaseMock.getResilientClient.mockReturnValue(db);
    }

    it('denies course contents without an authorized enrollment', async () => {
      withCourseAccess(null);
      await expect(service.authorizeCourseRead('token', 'usr-1', 7, 'contents'))
        .rejects.toBeInstanceOf(ForbiddenException);
    });

    it('uses the authenticated student Moodle ID for progress and blocks another ID', async () => {
      withCourseAccess('student');
      await expect(service.authorizeCourseRead('token', 'usr-1', 7, 'progress'))
        .resolves.toBe(42);
      await expect(service.authorizeCourseRead('token', 'usr-1', 7, 'progress', 99))
        .rejects.toBeInstanceOf(ForbiddenException);
    });

    it('does not expose participant data to a student', async () => {
      withCourseAccess('student');
      await expect(service.authorizeCourseRead('token', 'usr-1', 7, 'participants'))
        .rejects.toBeInstanceOf(ForbiddenException);
    });
  });

  describe('getUserCourseProgress', () => {
    it('keeps the grade separate from Moodle course progress', async () => {
      clientMock.getUserCourseGrades.mockResolvedValue({
        gradeitems: [{ itemtype: 'course', graderaw: 10, grademax: 10, gradeformatted: '10.00', percentageformatted: '100.00 %' }],
      });
      clientMock.getCourseCompletionStatus.mockResolvedValue({ completed: false });
      clientMock.getActivitiesCompletionStatus.mockResolvedValue({
        statuses: [
          { cmid: 1, state: 1, tracking: 2 },
          { cmid: 2, state: 0, tracking: 2 },
          { cmid: 3, state: 0, tracking: 1 },
          { cmid: 4, state: 0, tracking: 2 },
        ],
      });
      clientMock.getCourseContents.mockResolvedValue([{ modules: [{}, {}, {}, {}] }]);
      clientMock.getUserCourses.mockResolvedValue([{ id: 7, progress: 25 }]);

      const result = await service.getUserCourseProgress(7, 42);

      expect(result.grade_percentage).toBe(100);
      expect(result.progress_percentage).toBe(25);
      expect(result.completed_activities).toBe(1);
      expect(result.total_tracked_activities).toBe(4);
    });

    it('calculates progress from tracked activities when Moodle omits course progress', async () => {
      clientMock.getUserCourseGrades.mockResolvedValue({ gradeitems: [] });
      clientMock.getCourseCompletionStatus.mockResolvedValue({ completed: false });
      clientMock.getActivitiesCompletionStatus.mockResolvedValue({
        statuses: [
          { cmid: 1, state: 1, tracking: 2 },
          { cmid: 2, state: 2, tracking: 2 },
          { cmid: 3, state: 0, tracking: 1 },
          { cmid: 4, state: 3, tracking: 2 },
          { cmid: 5, state: 1, tracking: 0 },
        ],
      });
      clientMock.getCourseContents.mockResolvedValue([]);
      clientMock.getUserCourses.mockResolvedValue([{ id: 7 }]);

      const result = await service.getUserCourseProgress(7, 42);

      expect(result.progress_percentage).toBe(75);
      expect(result.completed_activities).toBe(3);
      expect(result.total_tracked_activities).toBe(4);
    });
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

      clientMock.requestUserKeyLoginUrl.mockResolvedValue(
        'http://localhost/moodle/auth/userkey/login.php?key=dummy-test-key',
      );

      adminClientMock.from.mockImplementation((table: string) => {
        if (table === 'profiles') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: { id: 'usr-1', email: 'test@example.com', moodle_user_id: 10 },
                  error: null,
                }),
              }),
            }),
          };
        }
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

      expect(result.access_url).toContain('http://localhost/moodle/auth/userkey/login.php?key=dummy-test-key&wantsurl=');
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

  describe('unenrolStudent', () => {
    it('calls moodle client unenrolUser when moodle ids are present', async () => {
      const enrollment = {
        id: 'enr-1',
        moodle_role: 'student',
        profiles: { moodle_user_id: 12 },
        course_mappings: { moodle_course_id: 4 },
      };

      adminClientMock.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({ data: enrollment, error: null }),
          }),
        }),
      });

      const res = await service.unenrolStudent('enr-1');
      expect(res.success).toBe(true);
      expect(clientMock.unenrolUser).toHaveBeenCalledWith({
        userId: 12,
        courseId: 4,
        roleId: 5,
      });
    });
  });
});
