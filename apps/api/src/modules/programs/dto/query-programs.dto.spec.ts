import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { QueryProgramsDto } from './query-programs.dto.js';

describe('QueryProgramsDto', () => {
  it('transforms valid pagination and accepts a supported program type', async () => {
    const query = plainToInstance(QueryProgramsDto, {
      limit: '25',
      offset: '10',
      type: 'diploma',
      code: 'DIP-CIB-01',
    });

    await expect(validate(query)).resolves.toHaveLength(0);
    expect(query).toMatchObject({
      limit: 25,
      offset: 10,
      type: 'diploma',
      code: 'DIP-CIB-01',
    });
  });

  it.each([
    { limit: '101' },
    { offset: '-1' },
    { type: 'unknown' },
  ])('rejects invalid query parameters: %j', async (queryInput) => {
    const query = plainToInstance(QueryProgramsDto, queryInput);
    await expect(validate(query)).resolves.not.toHaveLength(0);
  });
});
