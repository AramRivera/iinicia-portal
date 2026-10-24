import {
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

const REGISTRATION_ACCEPTED_MESSAGE =
  'Si el registro puede completarse, recibirás instrucciones en el correo proporcionado.';

@Injectable()
export class SupabaseService {
  private readonly logger = new Logger(SupabaseService.name);
  private readonly readinessTimeoutMs = 3000;

  constructor(private readonly config: ConfigService) {}

  assertConfiguration(): void {
    this.getConfiguration();
  }

  async register(registration: {
    email: string;
    password: string;
    first_name?: string;
    last_name?: string;
    phone?: string;
  }): Promise<{ message: string }> {
    try {
      const { data, error } = await this.createClient().auth.signUp({
        email: registration.email.trim().toLowerCase(),
        password: registration.password,
        options: {
          data: {
            ...(registration.first_name !== undefined && {
              first_name: registration.first_name.trim(),
            }),
            ...(registration.last_name !== undefined && {
              last_name: registration.last_name.trim(),
            }),
            ...(registration.phone !== undefined && {
              phone: registration.phone.trim(),
            }),
          },
        },
      });

      if (error?.status === 429) {
        throw new HttpException(
          'Demasiados intentos. Intenta más tarde.',
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
      if (
        error?.code === 'email_exists' ||
        error?.code === 'user_already_exists'
      ) {
        return { message: REGISTRATION_ACCEPTED_MESSAGE };
      }
      if (error) {
        if (
          error.status === 400 ||
          error.status === 422
        ) {
          throw new HttpException(
            'No fue posible procesar el registro con esos datos.',
            HttpStatus.BAD_REQUEST,
          );
        }
        throw new ServiceUnavailableException(
          'No fue posible contactar al servicio de registro.',
        );
      }
      if (!data.user) {
        throw new ServiceUnavailableException(
          'El servicio de registro devolvió una respuesta incompleta.',
        );
      }

      return { message: REGISTRATION_ACCEPTED_MESSAGE };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      this.logger.error('Falló la comunicación con Supabase Auth al registrarse.');
      throw new ServiceUnavailableException(
        'No fue posible contactar al servicio de registro.',
      );
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

  getPublicClient(): SupabaseClient<Database> {
    return this.createClient();
  }

  async checkReadiness(): Promise<{
    database: boolean;
    authentication: boolean;
  }> {
    const { url, publishableKey } = this.getConfiguration();
    const databaseUrl = new URL('/rest/v1/programs', url);
    databaseUrl.searchParams.set('select', 'id');
    databaseUrl.searchParams.set('limit', '1');
    const authenticationUrl = new URL('/auth/v1/health', url);

    const [database, authentication] = await Promise.all([
      this.checkEndpoint(databaseUrl, publishableKey, 'database'),
      this.checkEndpoint(authenticationUrl, publishableKey, 'authentication'),
    ]);

    return { database, authentication };
  }

  private createClient(accessToken?: string): SupabaseClient<Database> {
    const { url, publishableKey } = this.getConfiguration();

    return createClient<Database>(url, publishableKey, {
      auth: {
        autoRefreshToken: false,
        detectSessionInUrl: false,
        persistSession: false,
      },
      global: {
        headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
      },
    });
  }

  private async checkEndpoint(
    url: URL,
    publishableKey: string,
    dependency: 'database' | 'authentication',
  ): Promise<boolean> {
    try {
      const response = await fetch(url, {
        headers: { apikey: publishableKey },
        signal: AbortSignal.timeout(this.readinessTimeoutMs),
      });
      await response.body?.cancel();

      if (!response.ok) {
        this.logger.warn(`Supabase ${dependency} readiness check failed.`);
        return false;
      }

      return true;
    } catch {
      this.logger.warn(`Supabase ${dependency} readiness check failed.`);
      return false;
    }
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
}
