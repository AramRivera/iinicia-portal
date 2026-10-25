import { Test, TestingModule } from '@nestjs/testing';
import { PermissionRecord } from '../../common/supabase/database.types.js';
import { PermissionsRepository } from './permissions.repository.js';
import { PermissionsService } from './permissions.service.js';
import { QueryPermissionsDto } from './dto/query-permissions.dto.js';

describe('PermissionsService', () => {
  let service: PermissionsService;
  let repository: { findMany: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    repository = { findMany: vi.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PermissionsService,
        { provide: PermissionsRepository, useValue: repository },
      ],
    }).compile();

    service = module.get<PermissionsService>(PermissionsService);
  });

  it('returns permissions with pagination metadata', async () => {
    const permission: PermissionRecord = {
      id: 1,
      code: 'roles.read',
      module: 'roles',
      description: 'Consultar roles y permisos',
      created_at: '2026-10-23T00:00:00.000Z',
    };
    repository.findMany.mockResolvedValue({ data: [permission], count: 3 });

    const result = await service.findAll(
      Object.assign(new QueryPermissionsDto(), { limit: 1, offset: 1 }),
      'access-token',
    );

    expect(repository.findMany).toHaveBeenCalledWith('access-token', {
      limit: 1,
      offset: 1,
      code: undefined,
    });
    expect(result).toEqual({
      data: [permission],
      meta: { total: 3, limit: 1, offset: 1, hasMore: true },
    });
  });
});
