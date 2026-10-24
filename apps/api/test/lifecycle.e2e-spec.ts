import { Test } from '@nestjs/testing';
import {
  INestApplication,
  ValidationPipe,
} from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { AppModule } from '../src/app.module.js';
import { SupabaseService } from '../src/common/supabase/supabase.service.js';
import { MoodleClient } from '../src/modules/moodle/moodle.client.js';

function fakeAccessToken(issuedAt: number = 1_790_000_000): string {
  const encode = (value: object) =>
    Buffer.from(JSON.stringify(value)).toString('base64url');
  return `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({ iat: issuedAt })}.signature`;
}

describe('Portal Lifecycle E2E Test Suite', () => {
  let app: INestApplication<App>;

  let currentRoles: string[] = [];
  let currentPermissions: string[] = [];

  const mockClient = {
    rpc: vi.fn((fnName: string) => {
      if (fnName === 'get_my_roles') return Promise.resolve({ data: currentRoles, error: null });
      if (fnName === 'get_my_permissions') return Promise.resolve({ data: currentPermissions, error: null });
      return Promise.resolve({ data: null, error: null });
    }),
    from: vi.fn(),
  };

  const mockAdminClient = {
    rpc: vi.fn(),
    from: vi.fn(),
  };

  const mockSupabase = {
    assertConfiguration: vi.fn(),
    getAuthenticatedUser: vi.fn(),
    getUserRoleSlugs: vi.fn(),
    getUserPermissions: vi.fn(),
    getProfile: vi.fn(),
    getClient: vi.fn().mockReturnValue(mockClient),
    getResilientClient: vi.fn().mockReturnValue(mockClient),
    getAdminClient: vi.fn().mockReturnValue(mockAdminClient),
  };

  const mockMoodleClient = {
    checkConnection: vi.fn(),
    getSiteInfo: vi.fn(),
    getUserByField: vi.fn(),
    getUserByEmail: vi.fn(),
    createUsers: vi.fn(),
    updateUsers: vi.fn(),
    enrolUser: vi.fn(),
    unenrolUser: vi.fn(),
    getUserCourses: vi.fn(),
    getCourseByField: vi.fn(),
  };

  const adminUserId = '11111111-1111-4111-8111-111111111111';
  const studentUserId = '22222222-2222-4222-8222-222222222222';
  const courseMappingId = 'a0000000-0000-4000-8000-000000000001';
  const token = fakeAccessToken();

  beforeEach(async () => {
    vi.clearAllMocks();
    currentRoles = [];
    currentPermissions = [];

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(SupabaseService)
      .useValue(mockSupabase)
      .overrideProvider(MoodleClient)
      .useValue(mockMoodleClient)
      .compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true,
      }),
    );
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  describe('1. Health Checks (CA-16)', () => {
    it('GET /api/v1/health returns ok status', async () => {
      mockSupabase.assertConfiguration.mockReturnValue(undefined);
      mockClient.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue({ data: [{ id: 'role-1' }], error: null }),
        }),
      });
      mockMoodleClient.checkConnection.mockResolvedValueOnce({
        ok: true,
        message: 'Conectado a Moodle Web Services (v5.1dev)',
      });

      const res = await request(app.getHttpServer())
        .get('/api/v1/health')
        .expect(200);

      expect(res.body.status).toBe('ok');
      expect(res.body.services.supabase.status).toBe('ok');
      expect(res.body.services.moodle.status).toBe('ok');
    });

    it('GET /api/v1/moodle/status reports Moodle connectivity', async () => {
      mockMoodleClient.checkConnection.mockResolvedValueOnce({
        ok: true,
        message: 'Conectado a Moodle Web Services',
      });

      const res = await request(app.getHttpServer())
        .get('/api/v1/moodle/status')
        .expect(200);

      expect(res.body.ok).toBe(true);
      expect(res.body.message).toContain('Moodle');
    });
  });

  describe('2. CMS & Migration Endpoints (CA-14, CA-15)', () => {
    it('GET /api/v1/cms/contents returns institutional contents without authentication', async () => {
      mockClient.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({
              data: [
                { slug: 'nosotros', title: 'Sobre Nosotros', status: 'publicado' },
                { slug: 'contacto', title: 'Contacto', status: 'publicado' },
              ],
              error: null,
            }),
          }),
        }),
      });

      const res = await request(app.getHttpServer())
        .get('/api/v1/cms/contents')
        .expect(200);

      expect(res.body).toHaveLength(2);
      expect(res.body[0].slug).toBe('nosotros');
    });

    it('POST /api/v1/contact validates input and records message', async () => {
      mockClient.from.mockReturnValue({
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({
              data: {
                id: 'contact-123',
                full_name: 'Maria Lopez',
                email: 'maria@example.com',
                subject: 'Informacion Maestria',
                message: 'Deseo conocer la fecha de inicio.',
                status: 'nuevo',
              },
              error: null,
            }),
          }),
        }),
      });

      const res = await request(app.getHttpServer())
        .post('/api/v1/contact')
        .send({
          full_name: 'Maria Lopez',
          email: 'maria@example.com',
          subject: 'Informacion Maestria',
          message: 'Deseo conocer la fecha de inicio.',
        })
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.message_id).toBe('contact-123');
    });
  });

  describe('3. Course Catalog & Access Isolation (CA-11, CA-12, CA-13)', () => {
    it('GET /api/v1/courses strictly returns only authorized courses for the logged-in student', async () => {
      currentRoles = ['estudiante'];
      mockSupabase.getAuthenticatedUser.mockResolvedValue({ id: studentUserId, email: 'student@example.com' });
      mockSupabase.getUserRoleSlugs.mockResolvedValue(['estudiante']);

      mockClient.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({
            data: [
              {
                course_id: 'c-101',
                course_code: 'IINICIA-TI-101',
                title: 'Introducción a Tecnologías de la Información',
                moodle_course_id: 2,
                role: 'estudiante',
              },
            ],
            error: null,
          }),
        }),
      });

      const res = await request(app.getHttpServer())
        .get('/api/v1/courses')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body).toHaveLength(1);
      expect(res.body[0].course_code).toBe('IINICIA-TI-101');
    });
  });

  describe('4. Enrollment Flow with Moodle Sync (CA-07, CA-08, CA-09, CA-10)', () => {
    it('POST /api/v1/enrollments creates a pending enrollment request', async () => {
      currentRoles = ['estudiante'];
      mockSupabase.getAuthenticatedUser.mockResolvedValue({ id: studentUserId, email: 'student@example.com' });
      mockSupabase.getUserRoleSlugs.mockResolvedValue(['estudiante']);

      mockAdminClient.from.mockImplementation((table: string) => {
        if (table === 'course_mappings') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: { id: courseMappingId, is_active: true, program_id: null },
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
                  maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
                }),
              }),
            }),
            insert: vi.fn().mockReturnValue({
              select: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: {
                    id: 'enr-999',
                    user_id: studentUserId,
                    course_mapping_id: courseMappingId,
                    status: 'pendiente',
                    moodle_sync_status: 'pendiente',
                  },
                  error: null,
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

      const res = await request(app.getHttpServer())
        .post('/api/v1/enrollments')
        .set('Authorization', `Bearer ${token}`)
        .send({ course_mapping_id: courseMappingId })
        .expect(201);

      expect(res.body.id).toBe('enr-999');
      expect(res.body.status).toBe('pendiente');
      expect(res.body.moodle_sync_status).toBe('pendiente');
    });

    it('PATCH /api/v1/enrollments/:id/status authorizes and enrols user in Moodle', async () => {
      currentRoles = ['superadministrador'];
      currentPermissions = ['enrollments.authorize'];
      mockSupabase.getAuthenticatedUser.mockResolvedValue({ id: adminUserId, email: 'admin@example.com' });
      mockSupabase.getUserRoleSlugs.mockResolvedValue(['superadministrador']);

      const mockEnrollment = {
        id: 'enr-999',
        user_id: studentUserId,
        course_mapping_id: courseMappingId,
        moodle_role: 'student',
        status: 'autorizada',
        moodle_sync_status: 'pendiente',
        sync_attempts: 0,
        course_mappings: { id: courseMappingId, moodle_course_id: 2 },
        profiles: {
          id: studentUserId,
          first_name: 'Juan',
          last_name: 'Perez',
          email: 'student@example.com',
          moodle_user_id: 45,
          status: 'activo',
        },
      };

      mockAdminClient.from.mockImplementation((table: string) => {
        if (table === 'enrollment_requests') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({ data: mockEnrollment, error: null }),
              }),
            }),
            update: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                select: vi.fn().mockReturnValue({
                  maybeSingle: vi.fn().mockResolvedValue({
                    data: { ...mockEnrollment, status: 'autorizada', moodle_sync_status: 'sincronizado' },
                    error: null,
                  }),
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
      mockMoodleClient.enrolUser.mockResolvedValueOnce(undefined);

      const res = await request(app.getHttpServer())
        .patch('/api/v1/enrollments/enr-999/status')
        .set('Authorization', `Bearer ${token}`)
        .send({ status: 'autorizada' })
        .expect(200);

      expect(res.body.enrollment.status).toBe('autorizada');
      expect(mockMoodleClient.enrolUser).toHaveBeenCalledWith({
        roleId: 5,
        userId: 45,
        courseId: 2,
      });
    });
  });

  describe('5. Campus Launch & SSO Link (CA-09, CA-22)', () => {
    it('POST /api/v1/moodle/courses/:id/launch generates direct course URL and writes audit log', async () => {
      currentRoles = ['estudiante'];
      mockSupabase.getAuthenticatedUser.mockResolvedValue({ id: studentUserId, email: 'student@example.com' });
      mockSupabase.getUserRoleSlugs.mockResolvedValue(['estudiante']);

      mockAdminClient.from.mockImplementation((table: string) => {
        if (table === 'enrollment_requests') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  maybeSingle: vi.fn().mockResolvedValue({
                    data: {
                      id: 'enr-999',
                      status: 'autorizada',
                      moodle_role: 'student',
                      course_mappings: {
                        id: courseMappingId,
                        course_name: 'Introducción a TI',
                        moodle_course_id: 2,
                      },
                    },
                    error: null,
                  }),
                }),
              }),
            }),
            update: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ error: null }),
            }),
          };
        }
        if (table === 'campus_access_logs') {
          return {
            insert: vi.fn().mockResolvedValue({ error: null }),
          };
        }
        return {};
      });

      const res = await request(app.getHttpServer())
        .post(`/api/v1/moodle/courses/${courseMappingId}/launch`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body.access_url).toContain('/course/view.php?id=2');
      expect(res.body.moodle_course_id).toBe(2);
      expect(res.body.course_mapping_id).toBe(courseMappingId);
    });
  });
});
