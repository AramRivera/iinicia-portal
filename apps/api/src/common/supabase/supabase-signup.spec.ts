import { ConfigService } from '@nestjs/config';
import { createClient } from '@supabase/supabase-js';
import { SupabaseService } from './supabase.service.js';

vi.mock('@supabase/supabase-js', () => ({ createClient: vi.fn() }));

describe('Registro con confirmación de correo', () => {
  const signup = vi.fn();
  const fetchSettings = vi.fn();
  const settings = {
    external: { email: true },
    disable_signup: false,
    mailer_autoconfirm: false,
  };
  const credentials = { email: 'persona@example.test', password: 'test-password' };
  const service = new SupabaseService(new ConfigService({
    SUPABASE_URL: 'https://example.supabase.co',
    SUPABASE_PUBLISHABLE_KEY: 'test-publishable-key',
    FRONTEND_URL: 'https://portal.example.test',
  }));

  beforeEach(() => {
    vi.resetAllMocks();
    vi.stubGlobal('fetch', fetchSettings);
    fetchSettings.mockResolvedValue(Response.json(settings));
    vi.mocked(createClient).mockReturnValue({
      auth: { signUp: signup },
    } as unknown as ReturnType<typeof createClient>);
  });

  afterEach(() => vi.unstubAllGlobals());

  it('solicita confirmación con la clave pública y devuelve un mensaje sin sesión', async () => {
    signup.mockResolvedValue({ data: { user: { id: 'id' }, session: null }, error: null });

    const result = await service.signUp({ ...credentials, firstName: 'Persona' });
    expect(result).toEqual({ message: expect.any(String) });
    expect(createClient).toHaveBeenCalledWith(
      'https://example.supabase.co',
      'test-publishable-key',
      expect.any(Object),
    );
    expect(signup).toHaveBeenCalledWith({
      ...credentials,
      options: {
        emailRedirectTo: 'https://portal.example.test/confirmar-correo',
        data: { first_name: 'Persona', last_name: '', phone: null },
      },
    });
  });

  it('rechaza el registro si Supabase confirma correos automáticamente', async () => {
    fetchSettings.mockResolvedValue(Response.json({ ...settings, mailer_autoconfirm: true }));
    await expect(service.signUp(credentials)).rejects.toMatchObject({ status: 503 });
    expect(signup).not.toHaveBeenCalled();
  });

  it('rechaza una sesión inesperada durante el registro público', async () => {
    signup.mockResolvedValue({ data: { user: { id: 'id' }, session: {} }, error: null });
    await expect(service.signUp(credentials)).rejects.toMatchObject({ status: 503 });
  });

  it('devuelve la misma respuesta si Supabase indica que el correo ya existe', async () => {
    signup.mockResolvedValueOnce({ data: { user: { id: 'id' }, session: null }, error: null })
      .mockResolvedValueOnce({ data: {}, error: { code: 'user_already_exists' } });
    const initial = await service.signUp(credentials);
    fetchSettings.mockResolvedValue(Response.json(settings));
    await expect(service.signUp(credentials)).resolves.toEqual(initial);
  });
});
