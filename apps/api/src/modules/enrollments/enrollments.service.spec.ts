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
        service.deleteEnrollment('enr-missing', 'usr-1', false),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('throws ForbiddenException if non-staff tries to delete other user enrollment', async () => {
      adminClientMock.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({
              data: { id: 'enr-1', user_id: 'usr-different' },
              error: null,
            }),
          }),
        }),
      });

      await expect(
        service.deleteEnrollment('enr-1', 'usr-1', false),
      ).rejects.toBeInstanceOf(ForbiddenException);
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

      const res = await service.deleteEnrollment('enr-1', 'usr-1', false);

      expect(res.success).toBe(true);
      expect(moodleServiceMock.unenrolStudent).toHaveBeenCalledWith('enr-1');
    });
  });
});
