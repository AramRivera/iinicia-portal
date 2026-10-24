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
  const register = vi.fn();
  const credentials = { email: 'user@example.com', password: 'password' };

  beforeEach(async () => {
    login.mockReset();
    register.mockReset();
    login.mockResolvedValue({
      access_token: 'access',
      refresh_token: 'refresh',
      token_type: 'bearer',
      expires_in: 3600,
      user: { id: 'id' },
    });
    register.mockResolvedValue({
      message:
        'Si el registro puede completarse, recibirás instrucciones en el correo proporcionado.',
    });
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(SupabaseService)
      .useValue({ signInWithPassword: login, register })
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

  it('registers publicly without returning credentials or accepting a role', async () => {
    const registration = {
      email: 'USER@example.com',
      password: 'secure-password',
      first_name: 'Ana',
      last_name: 'García',
      phone: '+525512345678',
    };
    const result = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send(registration)
      .expect(202);

    expect(result.headers['cache-control']).toBe('no-store');
    expect(result.body).toEqual({
      message:
        'Si el registro puede completarse, recibirás instrucciones en el correo proporcionado.',
    });
    expect(result.body.access_token).toBeUndefined();
    expect(register).toHaveBeenCalledWith(registration);
  });

  it.each([
    {},
    { email: 'invalid', password: 'secure-password' },
    { email: 'user@example.com', password: 'short' },
    {
      email: 'user@example.com',
      password: 'secure-password',
      role: 'superadmin',
    },
  ])('rejects invalid registration bodies before Supabase: %j', async (body) => {
    await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send(body)
      .expect(400);
    expect(register).not.toHaveBeenCalled();
  });

  it('limits public registrations to five requests per minute per IP', async () => {
    const registration = {
      email: 'user@example.com',
      password: 'secure-password',
    };

    for (let i = 0; i < 5; i++) {
      await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send(registration)
        .expect(202);
    }
    await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send(registration)
      .expect(429);
    expect(register).toHaveBeenCalledTimes(5);
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
