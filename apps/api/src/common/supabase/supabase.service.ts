import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient, User } from '@supabase/supabase-js';
import { Database } from './database.types.js';

/** Primer segmento de la URL a la que PostgREST sirve `/rest/v1/<tabla>`. */
const REST_PATH = '/rest/v1/';

function preservePostgrestError(
  fetchImpl: typeof globalThis.fetch,
): typeof globalThis.fetch {
  return async (input, init) => {
    const response = await fetchImpl(input, init);
    if (response.ok) return response;

    const contentType = response.headers.get('content-type') ?? '';
    if (!contentType.includes('application/json')) return response;

    let body: unknown;
    try {
      body = await response.clone().json();
    } catch {
      return response;
    }
    if (typeof body !== 'object' || body === null) return response;
    const { code, message, details, hint, error } = body as Record<
      string,
      unknown
    >;
    if (typeof message !== 'string' && typeof error !== 'string') {
      return response;
    }

    const headers = new Headers(response.headers);
    headers.set('content-type', 'application/json');
    return new Response(
      JSON.stringify({
        code: code ?? null,
        message: typeof error === 'string' ? error : message,
        details: details ?? null,
        hint: hint ?? null,
      }),
      { status: response.status, statusText: response.statusText, headers },
    );
  };
}

@Injectable()
export class SupabaseService {
  private readonly logger = new Logger(SupabaseService.name);

  constructor(private readonly config: ConfigService) {}

  assertConfiguration(): void {
    this.getConfiguration();
  }

  /**
   * Registro de un nuevo usuario en Supabase Auth.
   * El trigger PostgreSQL `handle_new_auth_user` crea automáticamente el perfil
   * en `public.profiles` con estado 'pendiente' y rol inicial 'aspirante'.
   */
  async signUp(params: {
    email: string;
    password: string;
    firstName?: string;
    lastName?: string;
    phone?: string;
  }): Promise<{ message: string }> {
    const message =
      'Si puedes registrar esta dirección, recibirás un enlace para confirmar tu correo.';
    try {
      const emailRedirectTo = this.getAuthRedirect('/confirmar-correo');
      await this.requireEmailConfirmation();

      const { data, error } = await this.createClient().auth.signUp({
        email: params.email,
        password: params.password,
        options: {
          emailRedirectTo,
          data: {
            first_name: params.firstName ?? '',
            last_name: params.lastName ?? '',
            phone: params.phone ?? null,
          },
        },
      });

      if (error?.code === 'user_already_exists') return { message };
      if (error?.status === 429) {
        throw new HttpException(
          'Demasiados intentos. Intenta más tarde.',
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
      if (error?.code === 'weak_password') {
        throw new BadRequestException('Elige una contraseña más segura.');
      }
      if (error || !data.user || data.session) {
        throw new ServiceUnavailableException(
          'No fue posible iniciar la confirmación del correo.',
        );
      }
      return { message };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      this.logger.error('Falló la comunicación con Supabase durante el registro.');
      throw new ServiceUnavailableException(
        'No fue posible completar el registro en el servicio de identidad.',
      );
    }
  }

  private async requireEmailConfirmation(): Promise<void> {
    const { url, publishableKey } = this.getConfiguration();
    const response = await fetch(new URL('/auth/v1/settings', url), {
      headers: { apikey: publishableKey },
      signal: AbortSignal.timeout(5000),
    });
    const settings = response.ok
      ? await response.json() as {
          mailer_autoconfirm?: boolean;
          disable_signup?: boolean;
          external?: { email?: boolean };
        }
      : null;
    if (
      settings?.mailer_autoconfirm !== false ||
      settings.disable_signup !== false ||
      settings.external?.email !== true
    ) {
      throw new ServiceUnavailableException(
        'El registro con confirmación de correo no está disponible.',
      );
    }
  }

  private getAuthRedirect(path: '/confirmar-correo' | '/restablecer-password'): string {
    const frontendUrl = this.config.get<string>('FRONTEND_URL') ?? 'http://localhost:4000';
    try {
      const redirectTo = new URL(path, frontendUrl);
      if (!['http:', 'https:'].includes(redirectTo.protocol)) {
        throw new Error('Protocolo no válido.');
      }
      return redirectTo.href;
    } catch {
      throw new ServiceUnavailableException('El enlace del portal no está configurado.');
    }
  }

  async signInWithPassword(email: string, password: string) {
    try {
      const { data, error } = await this.createClient().auth.signInWithPassword(
        {
          email,
          password,
        },
      );

      if (error?.status === 429) {
        throw new HttpException(
          'Demasiados intentos. Intenta más tarde.',
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
      if (error?.code === 'email_not_confirmed') {
        throw new UnauthorizedException('Confirma tu correo antes de iniciar sesión.');
      }
      if (error) {
        if (
          error.status === 400 ||
          error.status === 401 ||
          error.status === 403 ||
          error.status === 422
        ) {
          throw new UnauthorizedException(
            'No fue posible iniciar sesión con esas credenciales.',
          );
        }
        throw new ServiceUnavailableException(
          'No fue posible contactar al servicio de autenticación.',
        );
      }
      if (!data.session || !data.user) {
        throw new ServiceUnavailableException(
          'El servicio de autenticación devolvió una sesión incompleta.',
        );
      }

      return {
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
        token_type: data.session.token_type,
        expires_in: data.session.expires_in,
        expires_at: data.session.expires_at,
        user: { id: data.user.id, email: data.user.email },
      };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      this.logger.error(
        'Falló la comunicación con Supabase Auth durante el inicio de sesión.',
      );
      throw new ServiceUnavailableException(
        'No fue posible contactar al servicio de autenticación.',
      );
    }
  }

  async getAuthenticatedUser(accessToken: string): Promise<User> {
    try {
      const { data, error } =
        await this.createClient(accessToken).auth.getUser(accessToken);

      if (error) {
        if (error.status === 401 || error.status === 403) {
          throw new UnauthorizedException('El token de acceso no es válido.');
        }

        this.logger.error('Supabase no pudo validar el token de acceso.');
        throw new ServiceUnavailableException(
          'No fue posible validar la sesión.',
        );
      }

      if (!data.user) {
        throw new UnauthorizedException('El token de acceso no es válido.');
      }

      return data.user;
    } catch (error) {
      if (
        error instanceof UnauthorizedException ||
        error instanceof ServiceUnavailableException
      ) {
        throw error;
      }

      this.logger.error('Falló la comunicación con Supabase Auth.');
      throw new ServiceUnavailableException(
        'No fue posible validar la sesión.',
      );
    }
  }

  getClient(accessToken: string): SupabaseClient<Database> {
    return this.createClient(accessToken);
  }

  async requestPasswordRecovery(email: string): Promise<{ message: string }> {
    const { error } = await this.createClient().auth.resetPasswordForEmail(email, {
      redirectTo: this.getAuthRedirect('/restablecer-password'),
    });
    if (error && (error.status === undefined || error.status >= 500)) {
      this.logger.warn('Supabase Auth no pudo procesar la recuperación.');
    }
    // Una respuesta uniforme evita revelar si el correo existe o si alcanzó su cuota.
    return { message: 'Si el correo está registrado, recibirás instrucciones para restablecer tu contraseña.' };
  }

  async resetPassword(tokenHash: string, password: string): Promise<{ message: string }> {
    if (Buffer.byteLength(password, 'utf8') > 72) {
      throw new BadRequestException('La contraseña no debe superar 72 bytes.');
    }

    const { auth } = this.createClient();
    const { data, error } = await auth.verifyOtp({ type: 'recovery', token_hash: tokenHash });
    if (error && (error.status === undefined || error.status >= 500)) {
      throw new ServiceUnavailableException('No fue posible verificar el enlace de recuperación.');
    }
    if (error || !data.session) {
      throw new BadRequestException('El enlace de recuperación es inválido o ya caducó.');
    }

    const { error: updateError } = await auth.updateUser({ password });
    if (updateError) {
      if (updateError.code === 'weak_password' || updateError.code === 'same_password') {
        throw new BadRequestException(
          'Elige una contraseña segura y distinta de la anterior. Solicita un nuevo enlace para continuar.',
        );
      }
      throw new ServiceUnavailableException(
        'No fue posible cambiar la contraseña. Solicita un nuevo enlace para reintentar.',
      );
    }
    return { message: 'Tu contraseña se actualizó.' };
  }

  /**
   * Obtiene el cliente privilegiado (Service Role) aislado en el servidor.
   * Utilizar ÚNICAMENTE tras validación explícita de guards/permisos en NestJS
   * para operaciones administrativas, auditoría y sincronizaciones Moodle.
   */
  getAdminClient(): SupabaseClient<Database> {
    const { url, secretKey } = this.getAdminConfiguration();
    return createClient<Database>(url, secretKey, {
      auth: {
        autoRefreshToken: false,
        detectSessionInUrl: false,
        persistSession: false,
      },
    });
  }

  getResilientClient(accessToken: string): SupabaseClient<Database> {
    const client = this.getClient(accessToken);

    type FromRelation = (relation: string) => {
      url: URL;
      fetch: typeof globalThis.fetch;
    };
    const from = client.from.bind(client) as unknown as FromRelation;

    client.from = ((relation: string) => {
      const builder = from(relation);
      if (!builder.url.toString().includes(REST_PATH)) return builder;

      const fetchImpl = builder.fetch;
      builder.fetch = preservePostgrestError((input, init) =>
        fetchImpl(input, init),
      );
      return builder;
    }) as unknown as typeof client.from;

    return client;
  }

  private createClient(accessToken?: string): SupabaseClient<Database> {
    const { url, publishableKey } = this.getConfiguration();

    return createClient<Database>(url, publishableKey, {
      auth: {
        autoRefreshToken: false,
        detectSessionInUrl: false,
        persistSession: false,
      },
      global: accessToken
        ? {
            fetch: (input, init) => {
              const headers = new Headers(init?.headers);
              headers.set('Authorization', `Bearer ${accessToken}`);
              return fetch(input, { ...init, headers });
            },
          }
        : {},
    });
  }

  private getConfiguration(): { url: string; publishableKey: string } {
    const url = this.config.get<string>('SUPABASE_URL');
    const publishableKey = this.config.get<string>('SUPABASE_PUBLISHABLE_KEY');

    if (!url || !publishableKey) {
      throw new Error(
        'SUPABASE_URL y SUPABASE_PUBLISHABLE_KEY son obligatorias.',
      );
    }

    let parsedUrl: URL;
    try {
      parsedUrl = new URL(url);
    } catch {
      throw new Error('SUPABASE_URL debe ser una URL válida.');
    }

    if (parsedUrl.protocol !== 'https:' && parsedUrl.protocol !== 'http:') {
      throw new Error('SUPABASE_URL debe usar HTTP o HTTPS.');
    }

    return { url, publishableKey };
  }

  private getAdminConfiguration(): { url: string; secretKey: string } {
    const { url } = this.getConfiguration();
    const secretKey = this.config.get<string>('SUPABASE_SECRET_KEY');

    if (!secretKey) {
      throw new Error(
        'SUPABASE_SECRET_KEY es obligatoria para operaciones administrativas del servidor.',
      );
    }

    return { url, secretKey };
  }
}
