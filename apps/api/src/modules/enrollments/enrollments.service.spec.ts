import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SupabaseService } from '../../common/supabase/supabase.service.js';
import { MoodleService } from '../moodle/moodle.service.js';
import { EnrollmentsService } from './enrollments.service.js';

describe('EnrollmentsService', () => {
  let service: EnrollmentsService;
  let supabaseMock: {
    getResilientClient: ReturnType<typeof vi.fn>;
    getClient: ReturnType<typeof vi.fn>;
    getAdminClient: ReturnType<typeof vi.fn>;
  };
  let moodleServiceMock: {
    syncEnrollment: ReturnType<typeof vi.fn>;
    unenrolStudent: ReturnType<typeof vi.fn>;
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
      getClient: vi.fn().mockReturnValue(clientMock),
      getAdminClient: vi.fn().mockReturnValue(adminClientMock),
    };

    moodleServiceMock = {
      syncEnrollment: vi.fn().mockResolvedValue({ success: true }),
      unenrolStudent: vi.fn().mockResolvedValue({ success: true }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EnrollmentsService,
        { provide: SupabaseService, useValue: supabaseMock },
        { provide: MoodleService, useValue: moodleServiceMock },
      ],
    }).compile();

    service = module.get<EnrollmentsService>(EnrollmentsService);
  });

  describe('createEnrollmentRequest', () => {
    it('rejects a request that attempts to assign the requester a teaching role', async () => {
      await expect(
        service.createEnrollmentRequest('usr-1', {
          course_mapping_id: 'c1',
          moodle_role: 'editingteacher',
        }),
      ).rejects.toBeInstanceOf(ForbiddenException);

      expect(adminClientMock.from).not.toHaveBeenCalled();
      expect(moodleServiceMock.syncEnrollment).not.toHaveBeenCalled();
    });

    it('rejects assigning another user without enrollment authorization', async () => {
      adminClientMock.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({
              data: { id: 'c1', is_active: true, program_id: 'p1' },
              error: null,
            }),
          }),
        }),
      });
      clientMock.rpc = vi.fn().mockResolvedValue({ data: false, error: null });

      await expect(
        service.createEnrollmentRequest(
          'other-user',
          { course_mapping_id: 'c1', moodle_role: 'student' },
          'requester',
          'requester-token',
        ),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(moodleServiceMock.syncEnrollment).not.toHaveBeenCalled();
    });

    it('throws NotFoundException if course does not exist', async () => {
      adminClientMock.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
          }),
        }),
      });

      await expect(
        service.createEnrollmentRequest('usr-1', {
          course_mapping_id: 'c-invalid',
          moodle_role: 'student',
        }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('throws ConflictException if enrollment already exists for user and course', async () => {
      adminClientMock.from.mockImplementation((table: string) => {
        if (table === 'course_mappings') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: { id: 'c1', is_active: true, course_name: 'Curso 1' },
                  error: null,
                }),
              }),
            }),
          };
        }
        if (table === 'enrollment_requests') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  maybeSingle: vi.fn().mockResolvedValue({
                    data: { id: 'enr-exist', status: 'sincronizada' },
                    error: null,
                  }),
                }),
              }),
            }),
          };
        }
        return {};
      });

      await expect(
        service.createEnrollmentRequest('usr-1', {
          course_mapping_id: 'c1',
          moodle_role: 'student',
        }),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe('updateEnrollmentStatus', () => {
    it('authorizes enrollment and triggers moodle sync when requested', async () => {
      const current = {
        id: 'enr-1',
        user_id: 'usr-1',
        status: 'pendiente',
        notes: null,
      };

      const updated = {
        ...current,
        status: 'autorizada',
      };

      adminClientMock.from.mockImplementation((table: string) => {
        if (table === 'enrollment_requests') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({ data: current, error: null }),
              }),
            }),
            update: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                select: vi.fn().mockReturnValue({
                  maybeSingle: vi.fn().mockResolvedValue({ data: updated, error: null }),
                }),
              }),
            }),
          };
        }
        if (table === 'audit_logs') {
          return {
            insert: vi.fn().mockResolvedValue({ error: null }),
          };
        }
        return {};
      });

      const result = await service.updateEnrollmentStatus(
        'enr-1',
        { status: 'autorizada', sync_to_moodle: true },
        'admin-1',
      );

      expect(result.enrollment.status).toBe('autorizada');
      expect(moodleServiceMock.syncEnrollment).toHaveBeenCalledWith('enr-1');
    });
  });

  it('lists own enrollments and those from the coordinator assigned programs only', async () => {
    adminClientMock.from.mockImplementation((table: string) => {
      if (table === 'user_roles') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({
                data: [
                  { roles: { slug: 'coordinador' }, expires_at: null },
                  { roles: { slug: 'administrador' }, expires_at: '2000-01-01T00:00:00Z' },
                ],
                error: null,
              }),
            }),
          }),
        };
      }
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            in: vi.fn().mockResolvedValue({ data: [{ program_id: 'assigned' }], error: null }),
          }),
        }),
      };
    });
    clientMock.from.mockReturnValue({
      select: vi.fn().mockReturnValue({
        order: vi.fn().mockResolvedValue({
          data: [
            { id: 'personal', user_id: 'coord', course_mappings: { program_id: 'other' } },
            { id: 'allowed', user_id: 'student', course_mappings: { program_id: 'assigned' } },
            { id: 'denied', user_id: 'student', program_id: 'assigned', course_mappings: { program_id: 'other' } },
            { id: 'unmapped', user_id: 'student', course_mappings: null },
          ],
          error: null,
        }),
      }),
    });

    const result = await service.findEnrollments('coord', 'access-token');
    expect(result.map(({ id }) => id)).toEqual(['personal', 'allowed']);
  });

  describe('deleteEnrollment', () => {
    it('throws NotFoundException if enrollment does not exist', async () => {
      adminClientMock.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
          }),
        }),
      });

      await expect(
        service.deleteEnrollment('enr-missing', 'usr-1'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('throws ForbiddenException if non-staff tries to delete other user enrollment', async () => {
      adminClientMock.from.mockImplementation((table: string) => {
        if (table === 'user_roles') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockResolvedValue({ data: [], error: null }),
              }),
            }),
          };
        }
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({
                data: { id: 'enr-1', user_id: 'usr-different' },
                error: null,
              }),
            }),
          }),
        };
      });

      await expect(
        service.deleteEnrollment('enr-1', 'usr-1'),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it.each([true, false])('allows a coordinator to delete another enrollment only inside scope (%s)', async (assigned) => {
      const deleteRow = vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      });
      const findAssignment = vi.fn().mockReturnValue({
        maybeSingle: vi.fn().mockResolvedValue({
          data: assigned ? { program_id: 'course-program' } : null,
          error: null,
        }),
      });
      adminClientMock.from.mockImplementation((table: string) => {
        if (table === 'enrollment_requests') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: {
                    id: 'enr-1',
                    user_id: 'student',
                    program_id: 'stale-program',
                    course_mappings: { program_id: 'course-program' },
                  },
                  error: null,
                }),
              }),
            }),
            delete: deleteRow,
          };
        }
        if (table === 'user_roles') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockResolvedValue({
                  data: [{ roles: { slug: 'coordinador' }, expires_at: null }],
                  error: null,
                }),
              }),
            }),
          };
        }
        if (table === 'user_programs') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                in: vi.fn().mockReturnValue({ eq: findAssignment }),
              }),
            }),
          };
        }
        return { insert: vi.fn().mockResolvedValue({ error: null }) };
      });

      const result = service.deleteEnrollment('enr-1', 'coordinator');
      if (assigned) {
        await expect(result).resolves.toMatchObject({ success: true });
        expect(moodleServiceMock.unenrolStudent).toHaveBeenCalledWith('enr-1');
        expect(deleteRow).toHaveBeenCalledOnce();
      } else {
        await expect(result).rejects.toBeInstanceOf(ForbiddenException);
        expect(moodleServiceMock.unenrolStudent).not.toHaveBeenCalled();
        expect(deleteRow).not.toHaveBeenCalled();
      }
      expect(findAssignment).toHaveBeenCalledWith('program_id', 'course-program');
    });

    it('successfully unenrolls user from Moodle and deletes record', async () => {
      const current = {
        id: 'enr-1',
        user_id: 'usr-1',
        status: 'sincronizada',
        course_mappings: { course_name: 'Curso Demo' },
      };

      adminClientMock.from.mockImplementation((table: string) => {
        if (table === 'enrollment_requests') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({ data: current, error: null }),
              }),
            }),
            delete: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ error: null }),
            }),
          };
        }
        if (table === 'audit_logs') {
          return {
            insert: vi.fn().mockResolvedValue({ error: null }),
          };
        }
        return {};
      });

      const res = await service.deleteEnrollment('enr-1', 'usr-1');

      expect(res.success).toBe(true);
      expect(moodleServiceMock.unenrolStudent).toHaveBeenCalledWith('enr-1');
    });
  });
});
