import { ConfigService } from '@nestjs/config';
import { HttpException } from '@nestjs/common';
import { createClient } from '@supabase/supabase-js';
import { SupabaseService } from './supabase.service.js';

vi.mock('@supabase/supabase-js', () => ({ createClient: vi.fn() }));

describe('Supabase password login', () => {
  const signInWithPassword = vi.fn();
  const listFactors = vi.fn();
  const enroll = vi.fn();
  const unenroll = vi.fn();
  const getUser = vi.fn();
  const factorId = '39f63a84-f56b-47ab-bf82-ec0e76e1f681';
  const factor = { id: factorId, factor_type: 'totp', status: 'verified', friendly_name: 'IINICIA' };
  const token = (aal: string, method = 'password') =>
    `header.${Buffer.from(JSON.stringify({ aal, sub: 'user-id', amr: [{ method }] })).toString('base64url')}.signature`;
  let service: SupabaseService;

  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(createClient).mockReturnValue({
      auth: { signInWithPassword, getUser, mfa: { listFactors, enroll, unenroll } },
    } as unknown as ReturnType<typeof createClient>);
    service = new SupabaseService(
      new ConfigService({
        SUPABASE_URL: 'https://example.supabase.co',
        SUPABASE_PUBLISHABLE_KEY: 'test-publishable-key',
      }),
    );
  });

  afterEach(() => vi.unstubAllGlobals());

  function signInWithAal1() {
    signInWithPassword.mockResolvedValue({
      data: {
        session: {
          access_token: token('aal1'),
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
  }

  it('asks for an existing TOTP factor without issuing a portal session', async () => {
    signInWithAal1();
    listFactors.mockResolvedValue({ data: { totp: [factor], all: [factor] }, error: null });
    expect(
      await service.signInWithPassword('user@example.com', ' password '),
    ).toEqual({
      step: 'verify', mfa_token: token('aal1'), factors: [{ id: factorId, name: 'IINICIA' }],
    });
    expect(signInWithPassword).toHaveBeenCalledWith({
      email: 'user@example.com',
      password: ' password ',
    });
    expect(createClient).toHaveBeenCalledWith(
      'https://example.supabase.co',
      'test-publishable-key',
      {
        auth: {
          autoRefreshToken: false,
          detectSessionInUrl: false,
          persistSession: false,
        },
        global: {},
      },
    );
    expect(enroll).not.toHaveBeenCalled();
  });

  it('restarts an abandoned setup and only shows the secret for the new factor', async () => {
    signInWithAal1();
    listFactors.mockResolvedValue({ data: { totp: [], all: [{ ...factor, status: 'unverified' }] }, error: null });
    unenroll.mockResolvedValue({ error: null });
    enroll.mockResolvedValue({ data: { id: 'new-factor', totp: { secret: 'TESTSECRET' } }, error: null });
    await expect(service.signInWithPassword('user@example.com', 'password')).resolves.toEqual({
      step: 'setup', mfa_token: token('aal1'), factor_id: 'new-factor', secret: 'TESTSECRET',
    });
    expect(unenroll).toHaveBeenCalledWith({ factorId });
  });

  it('challenges and verifies the chosen factor with Supabase before returning AAL2', async () => {
    getUser.mockResolvedValue({ data: { user: { id: 'user-id', factors: [factor] } }, error: null });
    const upstream = vi.fn().mockResolvedValueOnce(Response.json({ id: 'challenge-id' }))
      .mockResolvedValueOnce(Response.json({ access_token: token('aal2'), refresh_token: 'verified-refresh', expires_in: 3600, token_type: 'bearer' }));
    vi.stubGlobal('fetch', upstream);
    await expect(service.verifyLoginMfa(token('aal1'), factorId, '012345')).resolves.toMatchObject({ access_token: token('aal2') });
    expect(upstream.mock.calls[0][0].pathname).toBe(`/auth/v1/factors/${factorId}/challenge`);
    expect(upstream.mock.calls[1][0].pathname).toBe(`/auth/v1/factors/${factorId}/verify`);
    expect(upstream.mock.calls[1][1].headers.Authorization).toBe(`Bearer ${token('aal1')}`);
    expect(JSON.parse(upstream.mock.calls[1][1].body)).toEqual({ challenge_id: 'challenge-id', code: '012345' });
  });

  it('does not complete login with a recovery token, a different factor or an incorrect code', async () => {
    getUser.mockResolvedValue({ data: { user: { id: 'user-id', factors: [factor] } }, error: null });
    const upstream = vi.fn().mockResolvedValueOnce(Response.json({ id: 'challenge-id' }))
      .mockResolvedValueOnce(Response.json({}, { status: 422 }));
    vi.stubGlobal('fetch', upstream);
    await expect(service.verifyLoginMfa(token('aal1', 'recovery'), factorId, '012345')).rejects.toMatchObject({ status: 401 });
    await expect(service.verifyLoginMfa(token('aal1'), 'another-factor', '012345')).rejects.toMatchObject({ status: 403 });
    expect(upstream).not.toHaveBeenCalled();
    await expect(service.verifyLoginMfa(token('aal1'), factorId, '012345')).rejects.toMatchObject({ status: 400 });
  });

  it('pins the user bearer token on every request of the scoped client', async () => {
    service.getClient('user-access-token');

    const [, , options] = vi.mocked(createClient).mock.calls[0];
    const scoped = options?.global;
    expect(scoped).toBeDefined();
    expect(typeof scoped?.fetch).toBe('function');

    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(null));
    await scoped?.fetch?.('https://example.supabase.co/rest/v1/profiles', {
      headers: { Authorization: 'Bearer overwritten-by-the-sdk' },
    });
    const sentHeaders = new Headers(
      (fetchSpy.mock.calls[0][1] as RequestInit).headers,
    );
    expect(sentHeaders.get('Authorization')).toBe('Bearer user-access-token');
    fetchSpy.mockRestore();
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
