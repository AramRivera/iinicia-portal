import { ConfigService } from '@nestjs/config';
import { createClient } from '@supabase/supabase-js';
import { SupabaseService } from './supabase.service.js';

vi.mock('@supabase/supabase-js', () => ({ createClient: vi.fn() }));

describe('Supabase password recovery', () => {
  const resetPasswordForEmail = vi.fn();
  const verifyOtp = vi.fn();
  const updateUser = vi.fn();
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
    vi.mocked(createClient).mockReturnValue({
      auth: { resetPasswordForEmail, verifyOtp, updateUser },
    } as unknown as ReturnType<typeof createClient>);
  });

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
});
