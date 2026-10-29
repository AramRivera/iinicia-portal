import { ForbiddenException } from '@nestjs/common';
import { AdmissionsService } from './admissions.service.js';
import { SupabaseService } from '../../common/supabase/supabase.service.js';

describe('AdmissionsService role scope', () => {
  const query = {
    select: vi.fn(),
    eq: vi.fn(),
  };
  const supabase = {
    getResilientClient: vi.fn(() => ({ from: vi.fn(() => query) })),
  } as unknown as SupabaseService;
  const service = new AdmissionsService(supabase);

  beforeEach(() => {
    vi.clearAllMocks();
    query.select.mockReturnValue(query);
  });

  const roleRows = (data: unknown, error: unknown = null) => {
    query.eq.mockReturnValueOnce(query).mockResolvedValueOnce({ data, error });
  };

  it('permits active administrative roles to review all applications', async () => {
    roleRows([{ expires_at: null, roles: { slug: 'administrador' } }]);
    await expect(service.checkCanReview('admin-id', 'token')).resolves.toBe(true);
  });

  it('keeps students and coordinators restricted to their own applications', async () => {
    roleRows([
        { expires_at: null, roles: { slug: 'estudiante' } },
        { expires_at: null, roles: { slug: 'coordinador' } },
      ]);
    await expect(service.checkCanReview('student-id', 'token')).resolves.toBe(false);
  });

  it('fails closed when roles cannot be checked', async () => {
    roleRows(null, {});
    await expect(service.checkCanReview('user-id', 'token')).rejects.toThrow(ForbiddenException);
  });
});
