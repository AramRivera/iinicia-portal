import { ConfigService } from '@nestjs/config';
import { HttpException } from '@nestjs/common';
import { createClient } from '@supabase/supabase-js';
import { SupabaseService } from './supabase.service.js';

vi.mock('@supabase/supabase-js', () => ({ createClient: vi.fn() }));

describe('Supabase registration', () => {
  const signUp = vi.fn();
  let service: SupabaseService;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(createClient).mockReturnValue({
      auth: { signUp },
    } as unknown as ReturnType<typeof createClient>);
    service = new SupabaseService(
      new ConfigService({
        SUPABASE_URL: 'https://example.supabase.co',
        SUPABASE_PUBLISHABLE_KEY: 'test-publishable-key',
      }),
    );
  });

  it('sends only validated profile metadata and never a client-selected role', async () => {
    signUp.mockResolvedValue({
      data: { user: { id: 'user-id' }, session: null },
      error: null,
    });

    await expect(
      service.register({
        email: ' USER@example.com ',
        password: 'secure-password',
        first_name: 'Ana',
        last_name: 'García',
        phone: '+525512345678',
      }),
    ).resolves.toEqual({
      message:
        'Si el registro puede completarse, recibirás instrucciones en el correo proporcionado.',
    });

    expect(signUp).toHaveBeenCalledWith({
      email: 'user@example.com',
      password: 'secure-password',
      options: {
        data: {
          first_name: 'Ana',
          last_name: 'García',
          phone: '+525512345678',
        },
      },
    });
  });

  it.each([
    [400, 400],
    [422, 400],
    [429, 429],
    [500, 503],
  ])(
    'maps Supabase status %i to %i without leaking provider details',
    async (upstreamStatus, expectedStatus) => {
      signUp.mockResolvedValue({
        data: { user: null, session: null },
        error: {
          status: upstreamStatus,
          message: 'PRIVATE_PROVIDER_DETAIL',
        },
      });

      try {
        await service.register({
          email: 'user@example.com',
          password: 'secure-password',
        });
        expect.fail('Expected registration failure');
      } catch (error) {
        expect(error).toBeInstanceOf(HttpException);
        expect((error as HttpException).getStatus()).toBe(expectedStatus);
        expect((error as Error).message).not.toContain(
          'PRIVATE_PROVIDER_DETAIL',
        );
      }
    },
  );

  it('uses the same accepted response for an already registered email', async () => {
    signUp.mockResolvedValue({
      data: { user: null, session: null },
      error: {
        status: 400,
        code: 'email_exists',
        message: 'User already registered',
      },
    });

    await expect(
      service.register({
        email: 'user@example.com',
        password: 'secure-password',
      }),
    ).resolves.toEqual({
      message:
        'Si el registro puede completarse, recibirás instrucciones en el correo proporcionado.',
    });
  });

  it('returns a controlled error when Supabase returns no user or is unreachable', async () => {
    signUp.mockResolvedValue({
      data: { user: null, session: null },
      error: null,
    });
    await expect(
      service.register({
        email: 'user@example.com',
        password: 'secure-password',
      }),
    ).rejects.toMatchObject({ status: 503 });

    signUp.mockRejectedValue(new Error('network'));
    await expect(
      service.register({
        email: 'user@example.com',
        password: 'secure-password',
      }),
    ).rejects.toMatchObject({ status: 503 });
  });
});
