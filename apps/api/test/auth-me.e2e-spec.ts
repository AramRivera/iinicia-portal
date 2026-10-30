import { Test } from '@nestjs/testing';
import {
  INestApplication,
  ServiceUnavailableException,
  UnauthorizedException,
  ValidationPipe,
} from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { AppModule } from '../src/app.module.js';
import { SupabaseService } from '../src/common/supabase/supabase.service.js';
import { AuthService } from '../src/modules/auth/auth.service.js';

function fakeAccessToken(issuedAt: number): string {
  const encode = (value: object) =>
    Buffer.from(JSON.stringify(value)).toString('base64url');
  return `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({ iat: issuedAt })}.signature`;
}

describe('GET /api/v1/auth/me', () => {
  let app: INestApplication<App>;
  const getAuthenticatedUser = vi.fn();
  const getMe = vi.fn();

  const userId = '11111111-1111-1111-1111-111111111111';
  const issuedAt = 1_790_000_000;

  beforeEach(async () => {
    getAuthenticatedUser.mockReset();
    getMe.mockReset();
    getAuthenticatedUser.mockResolvedValue({
      id: userId,
      email: 'juan@example.com',
    });

    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(SupabaseService)
      .useValue({ getAuthenticatedUser })
      .overrideProvider(AuthService)
      .useValue({ getMe })
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

  it('returns the identity of the bearer token owner', async () => {
    const body = {
      id: userId,
      email: 'juan@example.com',
      first_name: 'Juan',
      last_name: 'Pérez',
      status: 'active',
      roles: ['admin'],
      permissions: ['users.read', 'programs.read'],
      password_changed_at: null,
    };
    getMe.mockResolvedValue(body);

    const result = await request(app.getHttpServer())
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${fakeAccessToken(issuedAt)}`)
      .expect(200);

    expect(result.headers['cache-control']).toBe('no-store');
    expect(result.body).toEqual(body);
    expect(getMe).toHaveBeenCalledWith(
      fakeAccessToken(issuedAt),
      userId,
      issuedAt,
    );
  });

  it('rejects the request without a bearer token', async () => {
    await request(app.getHttpServer()).get('/api/v1/auth/me').expect(401);
    expect(getMe).not.toHaveBeenCalled();
  });

  it('ignores any user identifier supplied by the client', async () => {
    getMe.mockResolvedValue({ id: userId });

    const token = fakeAccessToken(issuedAt);
    await request(app.getHttpServer())
      .get('/api/v1/auth/me?userId=other-user')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(getMe).toHaveBeenCalledWith(token, userId, issuedAt);
  });

  it('returns 401 when the profile is missing or not active', async () => {
    getMe.mockRejectedValue(new UnauthorizedException('Cuenta no activa.'));

    await request(app.getHttpServer())
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${fakeAccessToken(issuedAt)}`)
      .expect(401);
  });

  it('returns 503 when Supabase is unavailable', async () => {
    getMe.mockRejectedValue(new ServiceUnavailableException('No disponible.'));

    await request(app.getHttpServer())
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${fakeAccessToken(issuedAt)}`)
      .expect(503);
  });
});
