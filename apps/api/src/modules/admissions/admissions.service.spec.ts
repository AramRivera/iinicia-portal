import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SupabaseService } from '../../common/supabase/supabase.service.js';
import { AdmissionsService } from './admissions.service.js';

describe('AdmissionsService', () => {
  const fromAdmin = vi.fn();
  const rpc = vi.fn();
  const query = {
    select: vi.fn().mockReturnThis(),
    order: vi.fn().mockResolvedValue({ data: [] }),
    eq: vi.fn().mockResolvedValue({ data: [] }),
    in: vi.fn().mockResolvedValue({ data: [] }),
  };
  const service = new AdmissionsService({
    getAdminClient: () => ({ from: fromAdmin, rpc }),
    getResilientClient: () => ({ from: () => query }),
  } as unknown as SupabaseService);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  function roles(...slugs: string[]) {
    fromAdmin.mockReturnValueOnce({
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
    fromAdmin.mockReturnValueOnce({
      select: () => ({ eq: () => ({ in: async () => ({ data: [{ program_id: 'program' }] }) }) }),
    });
    await service.findApplications('coordinator', 'jwt');
    expect(query.in).toHaveBeenCalledWith('program_id', ['program']);
  });

  it('only reads the current applicant records for an unprivileged role', async () => {
    roles('aspirante');
    await service.findApplications('applicant', 'jwt');
    expect(query.eq).toHaveBeenCalledWith('applicant_id', 'applicant');
  });

  it('returns the committed decision from the database', async () => {
    const row = { id: 'application', status: 'admitido' };
    rpc.mockResolvedValueOnce({ data: row });
    await expect(service.reviewApplication('application', { status: 'admitido' }, 'reviewer'))
      .resolves.toEqual(row);
    expect(rpc).toHaveBeenCalledWith('iinicia_review_admission', {
      application_id: 'application',
      reviewer_id: 'reviewer',
      decision: 'admitido',
      notes: null,
    });
  });

  it.each([['42501', 403], ['P0002', 404], ['P0001', 409], ['23503', 500]])(
    'maps database error %s to HTTP %s',
    async (code, status) => {
      rpc.mockResolvedValueOnce({ error: { code, message: 'Error' } });
      await expect(service.reviewApplication('application', { status: 'admitido' }, 'reviewer'))
        .rejects.toMatchObject({ status });
    },
  );
});
