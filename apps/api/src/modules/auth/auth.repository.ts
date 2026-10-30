import {
  Injectable,
  InternalServerErrorException,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import type { PostgrestError } from '@supabase/supabase-js';
import { SupabaseService } from '../../common/supabase/supabase.service.js';
import { ProfileRecord } from '../../common/supabase/database.types.js';

const UNDEFINED_COLUMN = '42703';
const UNDEFINED_TABLE = '42P01';

const EXPOSE_SCHEMA_ERRORS =
  process.env.NODE_ENV !== 'production' && process.env.NODE_ENV !== 'test';

export interface UserRoleEmbed {
  role_id: number;
  is_active: boolean;
  expires_at: string | null;
  roles: { slug: string } | { slug: string }[] | null;
}

export type PermsEmbed = { code: string } | { code: string }[] | null;

export interface RolePermissionEmbed {
  role_id: number;
  perms: PermsEmbed;
}

@Injectable()
export class AuthRepository {
  private readonly logger = new Logger(AuthRepository.name);

  constructor(private readonly supabase: SupabaseService) {}

  /**
   * Consulta el perfil del usuario autenticado usando su propio JWT bajo RLS.
   */
  async findOwnProfile(
    accessToken: string,
    userId: string,
  ): Promise<ProfileRecord | null> {
    const { data, error } = await this.supabase
      .getResilientClient(accessToken)
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();

    if (error) {
      throw this.toHttpException(error, 'el perfil del usuario');
    }

    return data as ProfileRecord | null;
  }

  /**
   * Roles activos asignados al usuario en `user_roles`.
   */
  async findOwnRoles(
    accessToken: string,
    userId: string,
  ): Promise<UserRoleEmbed[]> {
    const { data, error } = await this.supabase
      .getResilientClient(accessToken)
      .from('user_roles')
      .select('role_id, is_active, expires_at, roles!role_id ( slug )')
      .eq('user_id', userId)
      .eq('is_active', true);

    if (error) {
      throw this.toHttpException(error, 'los roles del usuario');
    }
    if (!Array.isArray(data)) {
      this.logger.error('Supabase devolvió un resultado incompleto de user_roles.');
      throw new InternalServerErrorException(
        'La respuesta de los roles del usuario está incompleta.',
      );
    }

    return data as unknown as UserRoleEmbed[];
  }

  /**
   * Permisos asignados a los roles del usuario a través de `role_permissions`.
   */
  async findPermissionsByRoles(
    accessToken: string,
    roleIds: number[],
  ): Promise<RolePermissionEmbed[]> {
    if (roleIds.length === 0) return [];

    const { data, error } = await this.supabase
      .getResilientClient(accessToken)
      .from('role_permissions')
      .select('role_id, perms:permissions!permission_id ( code )')
      .in('role_id', roleIds);

    if (error) {
      throw this.toHttpException(error, 'los permisos del usuario');
    }
    if (!Array.isArray(data)) {
      this.logger.error(
        'Supabase devolvió un resultado incompleto de role_permissions.',
      );
      throw new InternalServerErrorException(
        'La respuesta de los permisos del usuario está incompleta.',
      );
    }

    return data as unknown as RolePermissionEmbed[];
  }

  private toHttpException(
    error: PostgrestError,
    subject: string,
  ): ServiceUnavailableException {
    this.logger.error(
      `Error de Supabase al consultar ${subject}: ${error.code} - ${error.message}`,
    );

    const isSchemaError =
      error.code === UNDEFINED_COLUMN || error.code === UNDEFINED_TABLE;

    if (isSchemaError && EXPOSE_SCHEMA_ERRORS) {
      const details = [error.code, error.message].filter(Boolean).join(': ');
      return new ServiceUnavailableException(
        `El esquema de base de datos no está listo (${details}). Ejecuta las migraciones pendientes.`,
      );
    }

    return new ServiceUnavailableException(
      'No fue posible consultar la información del usuario en la base de datos.',
    );
  }
}
