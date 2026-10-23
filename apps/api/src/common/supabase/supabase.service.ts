import {
  Injectable,
  Logger,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient, User } from '@supabase/supabase-js';
import { Database } from './database.types.js';

@Injectable()
export class SupabaseService {
  private readonly logger = new Logger(SupabaseService.name);

  constructor(private readonly config: ConfigService) {}

  assertConfiguration(): void {
    this.getConfiguration();
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

  private createClient(accessToken: string): SupabaseClient<Database> {
    const { url, publishableKey } = this.getConfiguration();

    return createClient<Database>(url, publishableKey, {
      auth: {
        autoRefreshToken: false,
        detectSessionInUrl: false,
        persistSession: false,
      },
      global: {
        headers: { Authorization: `Bearer ${accessToken}` },
      },
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
}
