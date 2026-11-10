import { ConfigService } from '@nestjs/config';
import { createClient } from '@supabase/supabase-js';
import { SupabaseService } from './supabase.service.js';

vi.mock('@supabase/supabase-js', () => ({ createClient: vi.fn() }));

describe('Supabase password recovery', () => {
  const resetPasswordForEmail = vi.fn();
  const verifyOtp = vi.fn();
  const updateUser = vi.fn();
  const setSession = vi.fn();
  const listFactors = vi.fn();
  const upstream = vi.fn();
  const email = 'user@example.com';
  const tokenHash = 'a'.repeat(56);
  const password = 'a-new-password';
  const service = new SupabaseService(new ConfigService({
    SUPABASE_URL: 'https://example.supabase.co',
    SUPABASE_PUBLISHABLE_KEY: 'test-publishable-key',
    FRONTEND_URL: 'https://portal.example.com',
  }));

  beforeEach(() => {
    vi.resetAllMocks();
    vi.stubGlobal('fetch', upstream);
    vi.mocked(createClient).mockReturnValue({
      auth: { resetPasswordForEmail, verifyOtp, updateUser, setSession, mfa: { listFactors } },
    } as unknown as ReturnType<typeof createClient>);
    listFactors.mockResolvedValue({ data: { all: [], totp: [] }, error: null });
  });

  afterEach(() => vi.unstubAllGlobals());

  it('uses the configured portal and returns the same response for an unknown email', async () => {
    resetPasswordForEmail.mockResolvedValueOnce({ error: null })
      .mockResolvedValueOnce({ error: { status: 404, code: 'user_not_found' } });
    const success = await service.requestPasswordRecovery(email);
    expect(await service.requestPasswordRecovery('unknown@example.com')).toEqual(success);
    expect(resetPasswordForEmail).toHaveBeenCalledWith(email, {
      redirectTo: 'https://portal.example.com/restablecer-password',
    });
  });

  it('updates the password in the session obtained from a recovery token', async () => {
    verifyOtp.mockResolvedValue({ data: { session: {} }, error: null });
    updateUser.mockResolvedValue({ error: null });
    await expect(service.resetPassword(tokenHash, password)).resolves.toEqual({
      message: 'Tu contraseña se actualizó.',
    });
    expect(verifyOtp).toHaveBeenCalledWith({ type: 'recovery', token_hash: tokenHash });
    expect(updateUser).toHaveBeenCalledWith({ password });
    expect(createClient).toHaveBeenCalledTimes(1);
  });

  it('never updates a password with an invalid or expired token', async () => {
    verifyOtp.mockResolvedValue({ data: { session: null }, error: { status: 403 } });
    await expect(service.resetPassword(tokenHash, password)).rejects.toMatchObject({ status: 400 });
    expect(updateUser).not.toHaveBeenCalled();
  });

  it('requires the registered TOTP factor before resetting the password', async () => {
    verifyOtp.mockResolvedValue({ data: { session: { access_token: 'recovery-token' } }, error: null });
    const factor = { id: 'factor-id', friendly_name: 'My authenticator' };
    listFactors.mockResolvedValue({ data: { all: [factor], totp: [factor] }, error: null });
    await expect(service.resetPassword(tokenHash, password)).resolves.toEqual({
      step: 'verify', mfa_token: 'recovery-token', factors: [{ id: 'factor-id', name: 'My authenticator' }],
    });
    expect(updateUser).not.toHaveBeenCalled();
  });
  it('requests a standard PKCE link with the portal URL and S256 challenge', async () => {
    upstream.mockResolvedValueOnce(Response.json({}))
      .mockResolvedValueOnce(Response.json({ error_code: 'over_email_send_rate_limit' }, { status: 429 }));
    const challenge = 'a'.repeat(43);
    const accepted = await service.requestPkcePasswordRecovery(email, challenge);
    await expect(service.requestPkcePasswordRecovery(email, challenge)).resolves.toEqual(accepted);

    const [url, options] = upstream.mock.calls[0];
    expect(url.pathname).toBe('/auth/v1/recover');
    expect(url.searchParams.get('redirect_to')).toBe('https://portal.example.com/restablecer-password');
    expect(JSON.parse(options.body)).toEqual({
      email, code_challenge: challenge, code_challenge_method: 's256',
    });
  });

  it('updates the password only after an accepted PKCE recovery exchange', async () => {
    const claim = Buffer.from(JSON.stringify({ amr: [{ method: 'recovery' }] })).toString('base64url');
    const session = { access_token: `header.${claim}.signature`, refresh_token: 'refresh' };
    upstream.mockResolvedValue(Response.json(session));
    setSession.mockResolvedValue({ error: null });
    updateUser.mockResolvedValue({ error: null });

    const code = '3d215b7c-0a43-4983-9c7a-8c14f5dca9b4';
    const verifier = 'a'.repeat(43);
    await expect(service.resetPasswordWithCode(code, verifier, password))
      .resolves.toEqual({ message: 'Tu contraseña se actualizó.' });

    const [url, options] = upstream.mock.calls[0];
    expect(url.pathname + url.search).toBe('/auth/v1/token?grant_type=pkce');
    expect(JSON.parse(options.body)).toEqual({ auth_code: code, code_verifier: verifier });
    expect(setSession).toHaveBeenCalledWith(session);
    expect(updateUser).toHaveBeenCalledWith({ password });
  });

  it('rejects an OAuth session and an expired exchange without changing a password', async () => {
    const claim = Buffer.from(JSON.stringify({ amr: [{ method: 'oauth' }] })).toString('base64url');
    upstream.mockResolvedValueOnce(Response.json({
      access_token: `header.${claim}.signature`, refresh_token: 'refresh',
    })).mockResolvedValueOnce(Response.json({}, { status: 422 }));

    await expect(service.resetPasswordWithCode('code', 'verifier', password))
      .rejects.toMatchObject({ status: 400 });
    await expect(service.resetPasswordWithCode('code', 'verifier', password))
      .rejects.toMatchObject({ status: 400 });
    expect(setSession).not.toHaveBeenCalled();
    expect(updateUser).not.toHaveBeenCalled();
  });

});
