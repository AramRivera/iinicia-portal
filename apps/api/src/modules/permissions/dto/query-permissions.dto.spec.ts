import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { QueryPermissionsDto } from './query-permissions.dto.js';

describe('QueryPermissionsDto', () => {
  it('transforms and accepts valid pagination parameters', async () => {
    const query = plainToInstance(QueryPermissionsDto, {
      limit: '25',
      offset: '10',
      code: 'roles.read',
    });

    await expect(validate(query)).resolves.toHaveLength(0);
    expect(query).toMatchObject({ limit: 25, offset: 10, code: 'roles.read' });
  });

  it('rejects limits greater than 100', async () => {
    const query = plainToInstance(QueryPermissionsDto, { limit: '101' });

    await expect(validate(query)).resolves.not.toHaveLength(0);
  });
});
