// IINICIA Portal · permisos · permissions.repository.ts
/** Consulta y pagina los permisos con el cliente de datos asociado a la sesión. */
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

  /** Recibe supabase como dependencias del módulo de permisos. NestJS proporciona esas instancias para las operaciones del componente. */
  constructor(private readonly supabase: SupabaseService) {}

  /** Consulta las filas del catálogo con el alcance y el intervalo recibidos del servicio. */
  async findMany(
    accessToken: string,
    params: { limit: number; offset: number; code?: string },
  ): Promise<{ data: PermissionRecord[]; count: number }> {
    try {
      let query = this.supabase
        .getClient(accessToken)
        .from('permissions')
        .select('id, code, module, description, created_at', { count: 'exact' });

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
