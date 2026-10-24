import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { AppModule } from '../src/app.module.js';
import { ProgramsService } from '../src/modules/programs/programs.service.js';

describe('GET /api/v1/programs', () => {
  let app: INestApplication<App>;
  const findAll = vi.fn();

  beforeEach(async () => {
    findAll.mockReset();
    findAll.mockResolvedValue({
      data: [
        {
          id: '0b5a4b3b-615b-4a27-bacd-123456789abc',
          code: 'DIP-CIB-01',
          slug: 'diplomado-ciberseguridad',
          name: 'Diplomado en Ciberseguridad',
          type: 'diploma',
          summary: 'Formación en ciberseguridad.',
          description: null,
          duration_hours: 240,
        },
      ],
      meta: { total: 1, limit: 50, offset: 0, hasMore: false },
    });

    const module = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(ProgramsService)
      .useValue({ findAll })
      .compile();

    app = module.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true,
      }),
    );
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('returns the public catalog without requiring authentication', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/programs')
      .expect(200);

    expect(response.body.data).toHaveLength(1);
    expect(response.body.data[0]).toMatchObject({
      code: 'DIP-CIB-01',
      type: 'diploma',
    });
    expect(response.body.meta).toEqual({
      total: 1,
      limit: 50,
      offset: 0,
      hasMore: false,
    });
    expect(findAll).toHaveBeenCalledWith({
      limit: 50,
      offset: 0,
    });
  });

  it('supports pagination and catalog filters', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/programs?limit=10&offset=5&type=diploma&code=DIP-CIB-01')
      .expect(200);

    expect(findAll).toHaveBeenCalledWith({
      limit: 10,
      offset: 5,
      type: 'diploma',
      code: 'DIP-CIB-01',
    });
  });

  it.each([
    '?limit=101',
    '?offset=-1',
    '?type=superadmin',
    '?unexpected=true',
  ])('rejects invalid query parameters: %s', async (query) => {
    await request(app.getHttpServer())
      .get(`/api/v1/programs${query}`)
      .expect(400);
    expect(findAll).not.toHaveBeenCalled();
  });
});
