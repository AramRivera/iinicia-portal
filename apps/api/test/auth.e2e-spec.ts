import { Test } from '@nestjs/testing';
import {
  INestApplication,
  UnauthorizedException,
  ValidationPipe,
} from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { AppModule } from '../src/app.module.js';
import { SupabaseService } from '../src/common/supabase/supabase.service.js';

describe('POST /api/v1/auth/login', () => {
  let app: INestApplication<App>;
  const login = vi.fn();
  const credentials = { email: 'user@example.com', password: 'password' };

  beforeEach(async () => {
    login.mockReset();
    login.mockResolvedValue({
      access_token: 'access',
      refresh_token: 'refresh',
      token_type: 'bearer',
      expires_in: 3600,
      user: { id: 'id' },
    });
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(SupabaseService)
      .useValue({ signInWithPassword: login })
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

  it('allows login without a Bearer token and prevents caching', async () => {
    const result = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send(credentials)
      .expect(200);
    expect(result.headers['cache-control']).toBe('no-store');
    expect(result.body.access_token).toBe('access');
    expect(login).toHaveBeenCalledWith(credentials.email, credentials.password);
  });

  it.each([
    {},
    { email: 'invalid', password: 'password' },
    { email: 'user@example.com', password: '' },
    { ...credentials, role: 'superadmin' },
  ])('rejects invalid bodies before contacting Supabase: %j', async (body) => {
    await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send(body)
      .expect(400);
    expect(login).not.toHaveBeenCalled();
  });

  it('returns 401 for invalid credentials', async () => {
    login.mockRejectedValue(
      new UnauthorizedException('Credenciales inválidas.'),
    );
    await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send(credentials)
      .expect(401);
  });

  it('limits login requests to five per minute per IP', async () => {
    for (let i = 0; i < 5; i++) {
      await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send(credentials)
        .expect(200);
    }
    await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send(credentials)
      .expect(429);
    expect(login).toHaveBeenCalledTimes(5);
    await request(app.getHttpServer()).get('/api/v1').expect(200);
  });
});
