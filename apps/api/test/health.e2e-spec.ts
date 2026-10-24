import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { AppModule } from '../src/app.module.js';
import { SupabaseService } from '../src/common/supabase/supabase.service.js';

describe('Health endpoints', () => {
  let app: INestApplication<App>;
  const checkReadiness = vi.fn();

  beforeEach(async () => {
    checkReadiness.mockReset();
    checkReadiness.mockResolvedValue({
      database: true,
      authentication: true,
    });

    const module = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(SupabaseService)
      .useValue({ checkReadiness })
      .compile();

    app = module.createNestApplication();
    app.setGlobalPrefix('api/v1');
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('returns liveness without depending on Supabase', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/health')
      .expect(200);

    expect(response.body).toEqual({
      status: 'ok',
      timestamp: expect.any(String),
    });
    expect(response.headers['cache-control']).toBe('no-store');
    expect(checkReadiness).not.toHaveBeenCalled();
  });

  it('returns ready when required Supabase services are reachable', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/health/ready')
      .expect(200);

    expect(response.body).toEqual({
      status: 'ok',
      timestamp: expect.any(String),
      dependencies: {
        database: 'available',
        authentication: 'available',
      },
    });
    expect(response.headers['cache-control']).toBe('no-store');
  });

  it('returns 503 and safe dependency statuses when a service is unavailable', async () => {
    checkReadiness.mockResolvedValue({
      database: false,
      authentication: true,
    });

    const response = await request(app.getHttpServer())
      .get('/api/v1/health/ready')
      .expect(503);

    expect(response.body).toEqual({
      status: 'error',
      timestamp: expect.any(String),
      dependencies: {
        database: 'unavailable',
        authentication: 'available',
      },
    });
  });
});
