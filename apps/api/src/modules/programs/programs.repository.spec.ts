import { ServiceUnavailableException } from '@nestjs/common';
import { SupabaseService } from '../../common/supabase/supabase.service.js';
import type { QueryProgramsDto } from './dto/query-programs.dto.js';
import { ProgramsRepository } from './programs.repository.js';

describe('ProgramsRepository', () => {
  const range = vi.fn();
  const order = vi.fn();
  const is = vi.fn();
  const eq = vi.fn();
  const select = vi.fn();
  const from = vi.fn();
  let repository: ProgramsRepository;

  beforeEach(() => {
    vi.clearAllMocks();
    const queryBuilder = {
      select,
      eq,
      is,
      order,
      range,
    };
    from.mockReturnValue(queryBuilder);
    select.mockReturnValue(queryBuilder);
    eq.mockReturnValue(queryBuilder);
    is.mockReturnValue(queryBuilder);
    order.mockReturnValue(queryBuilder);

    const supabase = {
      getPublicClient: () => ({ from }),
    } as unknown as SupabaseService;
    repository = new ProgramsRepository(supabase);
  });

  it('queries only active public programs with deterministic ordering and pagination', async () => {
    const records = [{ id: 'program-id', code: 'DIP-CIB-01' }];
    range.mockResolvedValue({ data: records, count: 1, error: null });

    await expect(
      repository.findPublished({
        limit: 10,
        offset: 5,
        type: 'diploma',
        code: 'DIP-CIB-01',
      }),
    ).resolves.toEqual({ data: records, count: 1 });

    expect(from).toHaveBeenCalledWith('programs');
    expect(select).toHaveBeenCalledWith(expect.any(String), {
      count: 'exact',
    });
    expect(eq).toHaveBeenCalledWith('is_published', true);
    expect(eq).toHaveBeenCalledWith('is_active', true);
    expect(eq).toHaveBeenCalledWith('type', 'diploma');
    expect(eq).toHaveBeenCalledWith('code', 'DIP-CIB-01');
    expect(is).toHaveBeenCalledWith('deleted_at', null);
    expect(order).toHaveBeenNthCalledWith(1, 'sort_order', {
      ascending: true,
    });
    expect(order).toHaveBeenNthCalledWith(2, 'name', { ascending: true });
    expect(range).toHaveBeenCalledWith(5, 14);
  });

  it('does not expose Supabase failures to API consumers', async () => {
    range.mockResolvedValue({
      data: null,
      count: null,
      error: { message: 'private database detail' },
    });

    try {
      await repository.findPublished({ limit: 50, offset: 0 });
      expect.fail('Expected the repository request to fail');
    } catch (error) {
      expect(error).toBeInstanceOf(ServiceUnavailableException);
      expect((error as Error).message).not.toContain('private database detail');
    }
  });
});
