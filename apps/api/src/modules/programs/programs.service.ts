import { Injectable } from '@nestjs/common';
import type { PublicProgramRecord } from '../../common/supabase/database.types.js';
import { QueryProgramsDto } from './dto/query-programs.dto.js';
import { ProgramsRepository } from './programs.repository.js';

export interface ProgramsResponse {
  data: PublicProgramRecord[];
  meta: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
}

@Injectable()
export class ProgramsService {
  constructor(private readonly repository: ProgramsRepository) {}

  async findAll(query: QueryProgramsDto): Promise<ProgramsResponse> {
    const { data, count } = await this.repository.findPublished(query);

    return {
      data,
      meta: {
        total: count,
        limit: query.limit,
        offset: query.offset,
        hasMore: query.offset + query.limit < count,
      },
    };
  }
}
