import { ConfigService } from '@nestjs/config';
import { ServiceUnavailableException } from '@nestjs/common';
import { createClient } from '@supabase/supabase-js';
import { SupabaseService } from './supabase.service.js';

vi.mock('@supabase/supabase-js', () => ({ createClient: vi.fn() }));

describe('Supabase password recovery', () => {
  const resetPasswordForEmail = vi.fn();
  const updateUserById = vi.fn();
  let service: SupabaseService;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(createClient).mockReturnValue({
      auth: { resetPasswordForEmail, admin: { updateUserById } },
    } as unknown as ReturnType<typeof createClient>);
    service = new SupabaseService(new ConfigService({
      SUPABASE_URL: 'https://example.supabase.co',
      SUPABASE_PUBLISHABLE_KEY: 'public-key',
      SUPABASE_SECRET_KEY: 'server-only-key',
      FRONTEND_URL: 'http://localhost:4000',
    }));
  });

  it('sends a recovery link to the configured frontend', async () => {
    resetPasswordForEmail.mockResolvedValue({ error: null });
    await service.sendPasswordRecovery('user@example.com');
    expect(resetPasswordForEmail).toHaveBeenCalledWith('user@example.com', {
      redirectTo: 'http://localhost:4000/restablecer-password',
    });
  });

  it('updates only the verified user id and does not expose a Supabase error', async () => {
    updateUserById.mockResolvedValueOnce({ error: null });
    await service.updatePassword('verified-user', 'new-password');
    expect(updateUserById).toHaveBeenCalledWith('verified-user', { password: 'new-password' });

    updateUserById.mockResolvedValueOnce({ error: { status: 500, message: 'private-detail' } });
    await expect(service.updatePassword('verified-user', 'new-password'))
      .rejects.toThrow(ServiceUnavailableException);
  });
});
