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
  const signup = vi.fn();
  const recover = vi.fn();
  const reset = vi.fn();
  const credentials = { email: 'user@example.com', password: 'password' };

  beforeEach(async () => {
    login.mockReset();
    signup.mockReset().mockResolvedValue({ message: 'Confirma tu correo.' });
    recover.mockReset().mockResolvedValue({ message: 'Solicitud recibida' });
    reset.mockReset().mockResolvedValue({ message: 'Contraseña actualizada' });
    login.mockResolvedValue({
      access_token: 'access',
      refresh_token: 'refresh',
      token_type: 'bearer',
      expires_in: 3600,
      user: { id: 'id' },
    });
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(SupabaseService)
      .useValue({ signInWithPassword: login, signUp: signup, requestPasswordRecovery: recover, resetPassword: reset })
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
  it('returns a confirmation message and no session after public signup', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ ...credentials, first_name: 'Persona', last_name: 'De prueba' })
      .expect(201);
    expect(response.body).toEqual({ message: 'Confirma tu correo.' });
    expect(response.headers['cache-control']).toBe('no-store');
    expect(signup).toHaveBeenCalledOnce();
    expect(login).not.toHaveBeenCalled();
  });

  it('rejects a role supplied by a public signup request', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ ...credentials, first_name: 'Persona', last_name: 'De prueba', role: 'superadministrador' })
      .expect(400);
    expect(signup).not.toHaveBeenCalled();
  });

  it('passes the recovery email and one-time token to Supabase without caching', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/recover')
      .send({ email: credentials.email })
      .expect(200);
    expect(response.headers['cache-control']).toBe('no-store');
    expect(recover).toHaveBeenCalledWith(credentials.email);

    const tokenHash = 'a'.repeat(56);
    await request(app.getHttpServer())
      .post('/api/v1/auth/reset-password')
      .send({ token_hash: tokenHash, password: credentials.password })
      .expect(200);
    expect(reset).toHaveBeenCalledWith(tokenHash, credentials.password);
  });

  it('does not accept a regular Bearer token in place of a recovery token', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/auth/reset-password')
      .set('Authorization', 'Bearer regular-session')
      .send({ password: credentials.password })
      .expect(400);
    expect(reset).not.toHaveBeenCalled();
  });

});
