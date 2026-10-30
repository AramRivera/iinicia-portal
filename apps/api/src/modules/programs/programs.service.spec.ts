import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SupabaseService } from '../../common/supabase/supabase.service.js';
import { ProgramsService } from './programs.service.js';

describe('ProgramsService', () => {
  let service: ProgramsService;
  let supabaseMock: {
    getClient: ReturnType<typeof vi.fn>;
    getResilientClient: ReturnType<typeof vi.fn>;
    getAdminClient: ReturnType<typeof vi.fn>;
  };
  let clientMock: any;
  let adminClientMock: any;

  beforeEach(async () => {
    clientMock = {
      from: vi.fn(),
    };
    adminClientMock = {
      from: vi.fn(),
    };

    supabaseMock = {
      getClient: vi.fn().mockReturnValue(clientMock),
      getResilientClient: vi.fn().mockReturnValue(clientMock),
      getAdminClient: vi.fn().mockReturnValue(adminClientMock),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProgramsService,
        { provide: SupabaseService, useValue: supabaseMock },
      ],
    }).compile();

    service = module.get<ProgramsService>(ProgramsService);
  });

  describe('findAll', () => {
    it('returns only active programs for public visitors', async () => {
      const mockPrograms = [{ id: 'p1', name: 'Curso React', is_active: true }];

      clientMock.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          order: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ data: mockPrograms, error: null }),
          }),
        }),
      });

      const result = await service.findAll(undefined, false);
      expect(result).toEqual(mockPrograms);
    });

    it('returns all programs for staff members', async () => {
      const mockPrograms = [
        { id: 'p1', name: 'Curso React', is_active: true },
        { id: 'p2', name: 'Curso Oculto', is_active: false },
      ];

      clientMock.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({ data: mockPrograms, error: null }),
        }),
      });

      const result = await service.findAll('staff-token', true);
      expect(result).toEqual(mockPrograms);
    });
  });

  describe('findByIdOrSlug', () => {
    it('throws NotFoundException if program is not found', async () => {
      clientMock.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
          }),
        }),
      });

      await expect(service.findByIdOrSlug('non-existent')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('create', () => {
    it('inserts a new program and registers audit log', async () => {
      const createdProgram = {
        id: 'p-new',
        code: 'PROG-001',
        name: 'Licenciatura TI',
      };

      const insertMock = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockResolvedValue({ data: createdProgram, error: null }),
        }),
      });
      const auditMock = vi.fn().mockResolvedValue({ error: null });

      adminClientMock.from.mockImplementation((table: string) => {
        if (table === 'programs') {
          return { insert: insertMock };
        }
        if (table === 'audit_logs') {
          return { insert: auditMock };
        }
        return {};
      });

      const result = await service.create(
        {
          code: 'PROG-001',
          slug: 'lic-ti',
          name: 'Licenciatura TI',
          type: 'licenciatura',
          modality: 'en_linea',
        },
        'admin-id',
      );

      expect(result.id).toBe('p-new');
      expect(insertMock).toHaveBeenCalled();
      expect(auditMock).toHaveBeenCalled();
    });
  });
});
