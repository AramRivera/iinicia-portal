import { ConfigService } from '@nestjs/config';
import { HttpException } from '@nestjs/common';
import { createClient } from '@supabase/supabase-js';
import { SupabaseService } from './supabase.service.js';

vi.mock('@supabase/supabase-js', () => ({ createClient: vi.fn() }));

describe('Supabase password login', () => {
  const signInWithPassword = vi.fn();
  let service: SupabaseService;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(createClient).mockReturnValue({
      auth: { signInWithPassword },
    } as unknown as ReturnType<typeof createClient>);
    service = new SupabaseService(
      new ConfigService({
        SUPABASE_URL: 'https://example.supabase.co',
        SUPABASE_PUBLISHABLE_KEY: 'test-publishable-key',
      }),
    );
  });

  it('returns only session fields and minimal user info using an isolated public client', async () => {
    signInWithPassword.mockResolvedValue({
      data: {
        session: {
          access_token: 'access',
          refresh_token: 'refresh',
          token_type: 'bearer',
          expires_in: 3600,
          expires_at: 12345,
        },
        user: {
          id: 'user-id',
          email: 'user@example.com',
          app_metadata: { internal: true },
        },
      },
      error: null,
    });
    expect(
      await service.signInWithPassword('user@example.com', ' password '),
    ).toEqual({
      access_token: 'access',
      refresh_token: 'refresh',
      token_type: 'bearer',
      expires_in: 3600,
      expires_at: 12345,
      user: { id: 'user-id', email: 'user@example.com' },
    });
    expect(signInWithPassword).toHaveBeenCalledWith({
      email: 'user@example.com',
      password: ' password ',
    });
    expect(createClient).toHaveBeenCalledWith(
      'https://example.supabase.co',
      'test-publishable-key',
      expect.objectContaining({
        auth: {
          autoRefreshToken: false,
          detectSessionInUrl: false,
          persistSession: false,
        },
        global: { headers: {} },
      }),
    );
  });

  it.each([
    [400, 401],
    [401, 401],
    [403, 401],
    [422, 401],
    [429, 429],
    [500, 503],
  ])(
    'maps Supabase status %i to %i without leaking details',
    async (upstream, expected) => {
      signInWithPassword.mockResolvedValue({
        data: {},
        error: { status: upstream, message: 'PRIVATE_DETAIL' },
      });
      try {
        await service.signInWithPassword('user@example.com', 'password');
        expect.fail('Expected login failure');
      } catch (error) {
        expect(error).toBeInstanceOf(HttpException);
        expect((error as HttpException).getStatus()).toBe(expected);
        expect((error as Error).message).not.toContain('PRIVATE_DETAIL');
      }
    },
  );

  it('handles missing sessions and network failures', async () => {
    signInWithPassword.mockResolvedValue({
      data: { session: null, user: null },
      error: null,
    });
    await expect(
      service.signInWithPassword('user@example.com', 'password'),
    ).rejects.toMatchObject({ status: 503 });
    signInWithPassword.mockRejectedValue(new Error('network'));
    await expect(
      service.signInWithPassword('user@example.com', 'password'),
    ).rejects.toMatchObject({ status: 503 });
  });
});
