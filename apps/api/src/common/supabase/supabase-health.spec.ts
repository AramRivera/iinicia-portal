import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { SupabaseService } from './supabase.service.js';

describe('Supabase readiness checks', () => {
  let service: SupabaseService;
  let module: TestingModule;
  const publishableKey = 'test-publishable-key';

  beforeEach(async () => {
    const config = {
      get: vi.fn((key: string) => {
        if (key === 'SUPABASE_URL') return 'https://example.supabase.co';
        if (key === 'SUPABASE_PUBLISHABLE_KEY') return publishableKey;
        return undefined;
      }),
    };

    module = await Test.createTestingModule({
      providers: [
        SupabaseService,
        { provide: ConfigService, useValue: config },
      ],
    }).compile();
    service = module.get(SupabaseService);
  });

  afterEach(async () => {
    vi.unstubAllGlobals();
    await module.close();
  });

  it('checks PostgREST and Supabase Auth using bounded, non-privileged requests', async () => {
    vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue(new Response(null, { status: 200 })),
    );

    await expect(service.checkReadiness()).resolves.toEqual({
      database: true,
      authentication: true,
    });

    expect(fetch).toHaveBeenCalledTimes(2);
    const requests = vi.mocked(fetch).mock.calls;
    const databaseRequest = requests.find(([input]) =>
        String(input).includes('/rest/v1/programs?'),
    );
    const authRequest = requests.find(([input]) =>
        String(input).includes('/auth/v1/health'),
    );

    expect(databaseRequest).toBeDefined();
    expect(authRequest).toBeDefined();
    for (const call of [databaseRequest, authRequest]) {
      expect(call?.[1]?.headers).toEqual({ apikey: publishableKey });
      expect(call?.[1]?.signal).toBeInstanceOf(AbortSignal);
    }
    expect(String(databaseRequest?.[0])).toContain('select=id');
    expect(String(databaseRequest?.[0])).toContain('limit=1');
  });

  it('reports an unavailable dependency without exposing its response body', async () => {
    vi.stubGlobal(
        'fetch',
        vi&#xA;        .fn()
        .mockResolvedValueOnce(
            new Response('internal database details', { status: 503 }),
        )
        .mockResolvedValueOnce(new Response(null, { status: 200 })),
  );

    await expect(service.checkReadiness()).resolves.toEqual({
      database: false,
      authentication: true,
    });
  });
});\