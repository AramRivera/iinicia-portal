import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { SupabaseService } from '../../common/supabase/supabase.service.js';
import { QueryAuditDto } from './dto/query-audit.dto.js';

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly supabase: SupabaseService) {}

  async findAll(query: QueryAuditDto, accessToken: string) {
    const client = this.supabase.getResilientClient(accessToken);
    let q = client
      .from('audit_logs')
      .select('*', { count: 'exact' });

    if (query.action) {
      q = q.eq('action', query.action);
    }

    if (query.entity_name) {
      q = q.eq('entity_name', query.entity_name);
    }

    const from = query.offset;
    const to = query.offset + query.limit - 1;

    const { data, error, count } = await q
      .range(from, to)
      .order('created_at', { ascending: false });

    if (error) {
      this.logger.error(`Error al consultar bitácora de auditoría: ${error.message}`);
      throw new InternalServerErrorException(
        'No fue posible obtener los registros de auditoría.',
      );
    }

    const total = count ?? (data?.length || 0);

    return {
      data: data || [],
      meta: {
        total,
        limit: query.limit,
        offset: query.offset,
        hasMore: query.offset + (data?.length || 0) < total,
      },
    };
  }
}
