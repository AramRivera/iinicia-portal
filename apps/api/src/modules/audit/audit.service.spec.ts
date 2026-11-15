/** Aísla las dependencias del servicio para comprobar cómo debe aplicar filtros por actor, acción y entidad sobre eventos visibles para la sesión. */
import { InternalServerErrorException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SupabaseService } from '../../common/supabase/supabase.service.js';
import { AuditService } from './audit.service.js';
import { QueryAuditDto } from './dto/query-audit.dto.js';

describe('AuditService (CA-19)', () => {
  let service: AuditService;
  let supabaseMock: {
    getResilientClient: ReturnType<typeof vi.fn>;
  };
  let clientMock: any;

  beforeEach(async () => {
    clientMock = {
      from: vi.fn(),
    };

    supabaseMock = {
      getResilientClient: vi.fn().mockReturnValue(clientMock),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuditService,
        { provide: SupabaseService, useValue: supabaseMock },
      ],
    }).compile();

    service = module.get<AuditService>(AuditService);
  });

  it('returns paginated audit logs with metadata', async () => {
    const mockLogs = [
      {
        id: 'log-1',
        actor_id: 'actor-1',
        action: 'ROLE_ASSIGNED',
        entity_name: 'user_roles',
        entity_id: 'u1:4',
        created_at: '2026-11-14T20:00:00Z',
      },
      {
        id: 'log-2',
        actor_id: 'actor-1',
        action: 'USER_STATUS_UPDATED',
        entity_name: 'profiles',
        entity_id: 'u2',
        created_at: '2026-11-14T19:30:00Z',
      },
    ];

    const orderMock = vi.fn().mockResolvedValue({
      data: mockLogs,
      error: null,
      count: 2,
    });

    const rangeMock = vi.fn().mockReturnValue({
      order: orderMock,
    });

    const selectMock = vi.fn().mockReturnValue({
      range: rangeMock,
    });

    clientMock.from.mockReturnValue({
      select: selectMock,
    });

    const query: QueryAuditDto = {
      limit: 10,
      offset: 0,
    };

    const result = await service.findAll(query, 'admin-token');

    expect(clientMock.from).toHaveBeenCalledWith('audit_logs');
    expect(result.data).toEqual(mockLogs);
    expect(result.meta).toEqual({
      total: 2,
      limit: 10,
      offset: 0,
      hasMore: false,
    });
  });

  it('filters audit logs by action and entity_name when provided', async () => {
    const mockLogs = [
      {
        id: 'log-1',
        action: 'ROLE_ASSIGNED',
        entity_name: 'user_roles',
      },
    ];

    const orderMock = vi.fn().mockResolvedValue({
      data: mockLogs,
      error: null,
      count: 1,
    });

    const rangeMock = vi.fn().mockReturnValue({
      order: orderMock,
    });

    const eqEntityMock = vi.fn().mockReturnValue({
      range: rangeMock,
    });

    const eqActionMock = vi.fn().mockReturnValue({
      eq: eqEntityMock,
    });

    const selectMock = vi.fn().mockReturnValue({
      eq: eqActionMock,
    });

    clientMock.from.mockReturnValue({
      select: selectMock,
    });

    const query: QueryAuditDto = {
      limit: 5,
      offset: 0,
      action: 'ROLE_ASSIGNED',
      entity_name: 'user_roles',
    };

    const result = await service.findAll(query, 'admin-token');

    expect(eqActionMock).toHaveBeenCalledWith('action', 'ROLE_ASSIGNED');
    expect(eqEntityMock).toHaveBeenCalledWith('entity_name', 'user_roles');
    expect(result.data).toHaveLength(1);
    expect(result.meta.total).toBe(1);
  });

  it('throws InternalServerErrorException on database failure', async () => {
    const orderMock = vi.fn().mockResolvedValue({
      data: null,
      error: { message: 'Database connection failed' },
      count: null,
    });

    clientMock.from.mockReturnValue({
      select: vi.fn().mockReturnValue({
        range: vi.fn().mockReturnValue({
          order: orderMock,
        }),
      }),
    });

    await expect(
      service.findAll({ limit: 10, offset: 0 }, 'admin-token'),
    ).rejects.toThrow(InternalServerErrorException);
  });
});
