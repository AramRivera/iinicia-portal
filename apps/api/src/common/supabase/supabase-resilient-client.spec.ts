import { ConfigService } from '@nestjs/config';
import { SupabaseService } from './supabase.service.js';

/**
 * `postgrest-js` descarta el cuerpo de error de PostgREST cuando el estado
 * HTTP no está en su lista de errores con cuerpo (404 de tabla o columna
 * inexistente) y entrega `error` vacío. `getResilientClient` lo conserva.
 * Esta prueba usa el SDK real; solo se sustituye `fetch`.
 */
describe('SupabaseService.getResilientClient', () => {
  const accessToken = 'user-access-token';
  let service: SupabaseService;
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    service = new SupabaseService(
      new ConfigService({
        SUPABASE_URL: 'https://example.supabase.co',
        SUPABASE_PUBLISHABLE_KEY: 'test-publishable-key',
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function jsonResponse(status: number, body: unknown): Response {
    return new Response(JSON.stringify(body), {
      status,
      headers: { 'content-type': 'application/json' },
    });
  }

  function sentRequest(callIndex = 0): { url: string; headers: Headers } {
    const [input, init] = fetchMock.mock.calls[callIndex] as [
      RequestInfo | URL,
      RequestInit,
    ];
    const url = input instanceof Request ? input.url : String(input);
    return { url, headers: new Headers(init?.headers) };
  }

  it('sends the user bearer token to PostgREST, not the anonymous key', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, []));

    await service
      .getResilientClient(accessToken)
      .from('profiles')
      .select('id')
      .eq('id', 'user-1');

    const { url, headers } = sentRequest();
    expect(url).toContain('/rest/v1/profiles');
    expect(headers.get('Authorization')).toBe(`Bearer ${accessToken}`);
  });

  it('keeps the PostgREST error body when a column does not exist', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(404, {
        code: 'PGRST204',
        message: "Could not find the 'password_changed_at' column",
        details: null,
        hint: null,
      }),
    );

    const { data, error, status } = await service
      .getResilientClient(accessToken)
      .from('profiles')
      .select('id, password_changed_at')
      .eq('id', 'user-1')
      .maybeSingle();

    expect(data).toBeNull();
    expect(status).toBe(404);
    expect(error).toMatchObject({
      code: 'PGRST204',
      message: "Could not find the 'password_changed_at' column",
    });
  });

  it('keeps the PostgREST error body for an undefined table', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(404, {
        code: '42P01',
        message: 'relation "public.user_roles" does not exist',
      }),
    );

    const { error } = await service
      .getResilientClient(accessToken)
      .from('user_roles')
      .select('role_id');

    expect(error).toMatchObject({ code: '42P01' });
    expect(error?.message).toContain('user_roles');
  });

  it('leaves successful responses untouched', async () => {
    const rows = [{ id: 'user-1' }];
    fetchMock.mockResolvedValue(jsonResponse(200, rows));

    const { data, error } = await service
      .getResilientClient(accessToken)
      .from('profiles')
      .select('id');

    expect(error).toBeNull();
    expect(data).toEqual(rows);
  });

  it('still decodes a single row through maybeSingle', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, [{ id: 'user-1' }]));

    const { data } = await service
      .getResilientClient(accessToken)
      .from('profiles')
      .select('id')
      .eq('id', 'user-1')
      .maybeSingle();

    expect(data).toEqual({ id: 'user-1' });
  });

  it('only wraps queries aimed at the REST endpoint', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { id: 'user-1' }));

    // La ruta de Auth no debe pasar por el decorador de PostgREST.
    const { data, error } = await service
      .getResilientClient(accessToken)
      .auth.getUser(accessToken);

    expect(error).toBeNull();
    expect(data.user).toMatchObject({ id: 'user-1' });
    expect(sentRequest().url).toContain('/auth/v1/user');
  });
});
