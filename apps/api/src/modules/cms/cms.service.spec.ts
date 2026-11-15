import { InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SupabaseService } from '../../common/supabase/supabase.service.js';
import { CmsService } from './cms.service.js';

describe('CmsService', () => {
  let service: CmsService;
  let supabaseMock: {
    getClient: ReturnType<typeof vi.fn>;
  };
  let clientMock: any;

  beforeEach(async () => {
    clientMock = {
      from: vi.fn(),
    };

    supabaseMock = {
      getClient: vi.fn().mockReturnValue(clientMock),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CmsService,
        { provide: SupabaseService, useValue: supabaseMock },
      ],
    }).compile();

    service = module.get<CmsService>(CmsService);
  });

  describe('findPublishedContents', () => {
    it('returns published contents ordered by published_at', async () => {
      const mockContents = [
        { id: '1', slug: 'noticia-1', title: 'Noticia 1', content_type: 'noticia' },
      ];

      clientMock.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({ data: mockContents, error: null }),
          }),
        }),
      });

      const result = await service.findPublishedContents();
      expect(result).toEqual(mockContents);
    });

    it('filters by content_type when provided', async () => {
      const mockPages = [
        { id: '2', slug: 'pagina-1', title: 'Página 1', content_type: 'pagina' },
      ];

      clientMock.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ data: mockPages, error: null }),
            }),
          }),
        }),
      });

      const result = await service.findPublishedContents('pagina');
      expect(result).toEqual(mockPages);
    });

    it('throws InternalServerErrorException on database error', async () => {
      clientMock.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({ data: null, error: { message: 'DB Error' } }),
          }),
        }),
      });

      await expect(service.findPublishedContents()).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });

  describe('findContentBySlug', () => {
    it('returns content by slug if published', async () => {
      const content = { id: '1', slug: 'quienes-somos', title: 'Quiénes somos' };

      clientMock.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({ data: content, error: null }),
            }),
          }),
        }),
      });

      const result = await service.findContentBySlug('quienes-somos');
      expect(result).toEqual(content);
    });

    it('throws NotFoundException if content does not exist', async () => {
      clientMock.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
            }),
          }),
        }),
      });

      await expect(service.findContentBySlug('no-existe')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('getDirectory', () => {
    it('returns visible directory entries ordered by display_order', async () => {
      const mockDirectory = [
        { id: 'd1', name: 'Rector General', is_visible: true, display_order: 1 },
      ];

      clientMock.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({ data: mockDirectory, error: null }),
          }),
        }),
      });

      const result = await service.getDirectory();
      expect(result).toEqual(mockDirectory);
    });
  });

  describe('submitContactMessage', () => {
    it('saves contact message and returns id with submission timestamp', async () => {
      const created = { id: 'msg-123', created_at: '2026-11-15T00:00:00Z' };

      clientMock.from.mockReturnValue({
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({ data: created, error: null }),
          }),
        }),
      });

      const result = await service.submitContactMessage(
        {
          full_name: 'Juan Pérez',
          email: 'juan@example.com',
          subject: 'Consulta académica',
          message: 'Deseo información sobre HTML Básico.',
        },
        '127.0.0.1',
      );

      expect(result).toEqual({
        success: true,
        message_id: 'msg-123',
        submitted_at: '2026-11-15T00:00:00Z',
      });
    });

    it('throws InternalServerErrorException if insert fails', async () => {
      clientMock.from.mockReturnValue({
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({ data: null, error: { message: 'Insert failed' } }),
          }),
        }),
      });

      await expect(
        service.submitContactMessage(
          {
            full_name: 'Juan Pérez',
            email: 'juan@example.com',
            subject: 'Consulta',
            message: 'Texto de prueba',
          },
          '127.0.0.1',
        ),
      ).rejects.toThrow(InternalServerErrorException);
    });
  });

  describe('getRedirectsMap (CA-01, CA-02)', () => {
    it('returns active 301/302 redirects from wp_migration_inventory', async () => {
      const mockRedirects = [
        {
          legacy_url: '/?page_id=1172',
          new_target_url: '/universidad',
          http_redirect_code: 301,
        },
        {
          legacy_url: '/?page_id=1202',
          new_target_url: '/cursos',
          http_redirect_code: 301,
        },
      ];

      clientMock.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            not: vi.fn().mockResolvedValue({ data: mockRedirects, error: null }),
          }),
        }),
      });

      const result = await service.getRedirectsMap();
      expect(result).toEqual(mockRedirects);
    });

    it('returns empty array when database query fails without throwing', async () => {
      clientMock.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            not: vi.fn().mockResolvedValue({ data: null, error: { message: 'Table not found' } }),
          }),
        }),
      });

      const result = await service.getRedirectsMap();
      expect(result).toEqual([]);
    });
  });
});
