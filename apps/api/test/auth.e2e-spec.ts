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
  const recoverPkce = vi.fn();
  const resetPkce = vi.fn();
  const verifyMfa = vi.fn();
  const resetMfa = vi.fn();
  const factorId = '39f63a84-f56b-47ab-bf82-ec0e76e1f681';
  const credentials = { email: 'user@example.com', password: 'password' };

  beforeEach(async () => {
    login.mockReset();
    signup.mockReset().mockResolvedValue({ message: 'Confirma tu correo.' });
    recover.mockReset().mockResolvedValue({ message: 'Solicitud recibida' });
    recoverPkce.mockReset().mockResolvedValue({ message: 'Solicitud recibida' });
    resetPkce.mockReset().mockResolvedValue({ message: 'Contraseña actualizada' });
    reset.mockReset().mockResolvedValue({ message: 'Contraseña actualizada' });
    login.mockResolvedValue({ step: 'verify', mfa_token: 'partial', factors: [{ id: factorId }] });
    verifyMfa.mockReset().mockResolvedValue({
      access_token: 'access',
      refresh_token: 'refresh',
      token_type: 'bearer',
      expires_in: 3600,
      user: { id: 'id' },
    });
    resetMfa.mockReset().mockResolvedValue({ message: 'Contraseña actualizada' });
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(SupabaseService)
      .useValue({
        signInWithPassword: login,
        signUp: signup,
        requestPasswordRecovery: recover,
        requestPkcePasswordRecovery: recoverPkce,
        resetPassword: reset,
        resetPasswordWithCode: resetPkce,
        verifyLoginMfa: verifyMfa,
        resetPasswordWithMfa: resetMfa,
      })
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
    expect(result.body).toEqual({ step: 'verify', mfa_token: 'partial', factors: [{ id: factorId }] });
    expect(login).toHaveBeenCalledWith(credentials.email, credentials.password);
  });

  it('completes login only through MFA verification and disables caching', async () => {
    const response = await request(app.getHttpServer()).post('/api/v1/auth/mfa/verify')
      .set('Authorization', 'Bearer partial').send({ factor_id: factorId, code: '012345' }).expect(200);
    expect(response.body.access_token).toBe('access');
    expect(response.headers['cache-control']).toBe('no-store');
    expect(verifyMfa).toHaveBeenCalledWith('partial', factorId, '012345');
  });

  it('rejects a missing continuation token and malformed MFA codes', async () => {
    await request(app.getHttpServer()).post('/api/v1/auth/mfa/verify')
      .send({ factor_id: factorId, code: '012345' }).expect(401);
    await request(app.getHttpServer()).post('/api/v1/auth/mfa/verify')
      .set('Authorization', 'Bearer partial').send({ factor_id: factorId, code: '12345' }).expect(400);
    expect(verifyMfa).not.toHaveBeenCalled();
  });

  it('uses a separate verification endpoint for password recovery', async () => {
    await request(app.getHttpServer()).post('/api/v1/auth/mfa/recover')
      .set('Authorization', 'Bearer recovery').send({ factor_id: factorId, code: '012345', password: 'new-password' })
      .expect(200, { message: 'Contraseña actualizada' });
    expect(resetMfa).toHaveBeenCalledWith('recovery', factorId, '012345', 'new-password');
    expect(verifyMfa).not.toHaveBeenCalled();
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

  it('supports the standard PKCE recovery contract', async () => {
    const challenge = 'a'.repeat(43);
    const code = '3d215b7c-0a43-4983-9c7a-8c14f5dca9b4';
    const verifier = 'b'.repeat(43);
    await request(app.getHttpServer())
      .post('/api/v1/auth/recover')
      .send({ email: credentials.email, code_challenge: challenge })
      .expect(200);
    expect(recoverPkce).toHaveBeenCalledWith(credentials.email, challenge);

    await request(app.getHttpServer())
      .post('/api/v1/auth/reset-password')
      .send({ auth_code: code, code_verifier: verifier, password: credentials.password })
      .expect(200);
    expect(resetPkce).toHaveBeenCalledWith(code, verifier, credentials.password);

    await request(app.getHttpServer())
      .post('/api/v1/auth/reset-password')
      .send({ auth_code: code, password: credentials.password })
      .expect(400);
    expect(resetPkce).toHaveBeenCalledOnce();
  });

});
