import {
  Injectable,
  InternalServerErrorException,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { SupabaseService } from '../../common/supabase/supabase.service.js';
import { PermissionRecord } from '../../common/supabase/database.types.js';

@Injectable()
export class PermissionsRepository {
  private readonly logger = new Logger(PermissionsRepository.name);

  constructor(private readonly supabase: SupabaseService) {}

  async findMany(
    accessToken: string,
    params: { limit: number; offset: number; code?: string },
  ): Promise<{ data: PermissionRecord[]; count: number }> {
    try {
      let query = this.supabase
        .getClient(accessToken)
        .from('permissions')
        .select('id, code, description, created_at', { count: 'exact' });

      if (params.code) {
        query = query.eq('code', params.code);
      }

      const { data, error, count } = await query
        .order('code', { ascending: true })
        .range(params.offset, params.offset + params.limit - 1);

      if (error) {
        this.logger.error('Supabase permissions query failed.');
        throw new ServiceUnavailableException(
          'No fue posible consultar el catálogo de permisos.',
        );
      }

      if (data === null || count === null) {
        this.logger.error(
          'Supabase returned an incomplete permissions result.',
        );
        throw new InternalServerErrorException(
          'La respuesta del catálogo de permisos está incompleta.',
        );
      }

      return { data, count };
    } catch (error) {
      if (
        error instanceof ServiceUnavailableException ||
        error instanceof InternalServerErrorException
      ) {
        throw error;
      }

      this.logger.error('Supabase permissions request failed.');
      throw new ServiceUnavailableException(
        'No fue posible consultar el catálogo de permisos.',
      );
    }
  }
}
