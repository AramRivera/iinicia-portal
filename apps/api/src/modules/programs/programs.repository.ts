import {
  Injectable,
  InternalServerErrorException,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import type { PublicProgramRecord } from '../../common/supabase/database.types.js';
import { SupabaseService } from '../../common/supabase/supabase.service.js';
import type { QueryProgramsDto } from './dto/query-programs.dto.js';

@Injectable()
export class ProgramsRepository {
  private readonly logger = new Logger(ProgramsRepository.name);

  constructor(private readonly supabase: SupabaseService) {}

  async findPublished(
    params: QueryProgramsDto,
  ): Promise<{ data: PublicProgramRecord[]; count: number }> {
    try {
      let query = this.supabase
        .getPublicClient()
        .from('programs')
        .select(
          'id, code, slug, name, type, summary, description, duration_hours',
          { count: 'exact' },
        )
        .eq('is_published', true)
        .eq('is_active', true)
        .is('deleted_at', null);

      if (params.type) {
        query = query.eq('type', params.type);
      }
      if (params.code) {
        query = query.eq('code', params.code);
      }

      const { data, error, count } = await query
        .order('sort_order', { ascending: true })
        .order('name', { ascending: true })
        .range(params.offset, params.offset + params.limit - 1);

      if (error) {
        this.logger.error('Supabase public programs query failed.');
        throw new ServiceUnavailableException(
          'No fue posible consultar el catálogo de programas.',
        );
      }

      if (data === null || count === null) {
        this.logger.error('Supabase returned an incomplete programs result.');
        throw new InternalServerErrorException(
          'La respuesta del catálogo de programas está incompleta.',
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

      this.logger.error('Supabase public programs request failed.');
      throw new ServiceUnavailableException(
        'No fue posible consultar el catálogo de programas.',
      );
    }
  }
}
