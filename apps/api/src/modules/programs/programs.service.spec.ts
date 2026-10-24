import { QueryProgramsDto } from './dto/query-programs.dto.js';
import { ProgramsRepository } from './programs.repository.js';
import { ProgramsService } from './programs.service.js';

describe('ProgramsService', () => {
  it('returns paginated public programs and computes hasMore', async () => {
    const records = [{ id: 'program-id' }];
    const findPublished = vi.fn().mockResolvedValue({
      data: records,
      count: 12,
    });
    const service = new ProgramsService({
      findPublished,
    } as unknown as ProgramsRepository);
    const query = Object.assign(new QueryProgramsDto(), {
      limit: 5,
      offset: 5,
      type: 'diploma' as const,
    });

    await expect(service.findAll(query)).resolves.toEqual({
      data: records,
      meta: {
        total: 12,
        limit: 5,
        offset: 5,
        hasMore: true,
      },
    });
    expect(findPublished).toHaveBeenCalledWith(query);
  });
});
