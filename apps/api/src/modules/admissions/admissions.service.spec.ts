/** Aísla las dependencias del servicio para comprobar cómo debe filtrar postulaciones por ámbito y promover al aspirante después del dictamen. */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SupabaseService } from '../../common/supabase/supabase.service.js';
import { AdmissionsService } from './admissions.service.js';

describe('AdmissionsService', () => {
  const fromUser = vi.fn();
  const rpc = vi.fn();
  const query = {
    select: vi.fn().mockReturnThis(),
    order: vi.fn().mockResolvedValue({ data: [] }),
    eq: vi.fn().mockResolvedValue({ data: [] }),
    in: vi.fn().mockResolvedValue({ data: [] }),
  };
  const enrollAdmittedStudent = vi.fn().mockResolvedValue({ state: 'synced', total: 1, synced: 1 });
  const service = new AdmissionsService({
    getAdminClient: () => ({ rpc }),
    getResilientClient: () => ({ from: fromUser }),
  } as unknown as SupabaseService, { enrollAdmittedStudent } as unknown as ConstructorParameters<typeof AdmissionsService>[1]);

  beforeEach(() => {
    vi.clearAllMocks();
    fromUser.mockReset().mockReturnValue(query);
  });

  function roles(...slugs: string[]) {
    fromUser.mockReturnValueOnce({
      select: () => ({
        eq: () => ({
          eq: async () => ({
            data: slugs.map((slug) => ({ expires_at: null, roles: { slug } })),
          }),
        }),
      }),
    });
    query.order.mockReturnValueOnce(query);
  }

  it('loads the administrator inbox without filtering by applicant', async () => {
    roles('administrador');
    await service.findApplications('admin', 'jwt');
    expect(query.order).toHaveBeenCalled();
    expect(query.eq).not.toHaveBeenCalled();
    expect(query.in).not.toHaveBeenCalled();
  });

  it('limits coordinator reads to assigned programs', async () => {
    roles('coordinador');
    const memberships = {
      select: () => ({ eq: () => ({ in: async () => ({ data: [{ program_id: 'program' }] }) }) }),
    };
    fromUser.mockImplementation((table: string) => table === 'user_programs' ? memberships : query);
    await service.findApplications('coordinator', 'jwt');
    expect(query.in).toHaveBeenCalledWith('program_id', ['program']);
  });

  it('only reads the current applicant records for an unprivileged role', async () => {
    roles('aspirante');
    await service.findApplications('applicant', 'jwt');
    expect(query.eq).toHaveBeenCalledWith('applicant_id', 'applicant');
  });

  it('returns the committed decision from the database', async () => {
    const row = { id: 'application', status: 'admitido', applicant_id: 'student', program_id: 'program' };
    rpc.mockResolvedValueOnce({ data: row });
    await expect(service.reviewApplication('application', { status: 'admitido' }, 'reviewer'))
      .resolves.toEqual({ ...row, enrollment_summary: { state: 'synced', total: 1, synced: 1 } });
    expect(enrollAdmittedStudent).toHaveBeenCalledWith('student', 'program', 'reviewer');
    expect(rpc).toHaveBeenCalledWith('iinicia_review_admission', {
      application_id: 'application',
      reviewer_id: 'reviewer',
      decision: 'admitido',
      notes: null,
    });
  });

  it.each([['42501', 403], ['P0002', 404], ['P0001', 409], ['23503', 500], ['PGRST202', 503]])(
    'maps database error %s to HTTP %s',
    async (code, status) => {
      rpc.mockResolvedValueOnce({ error: { code, message: 'Error' } });
      await expect(service.reviewApplication('application', { status: 'admitido' }, 'reviewer'))
        .rejects.toMatchObject({ status });
    },
  );
});
