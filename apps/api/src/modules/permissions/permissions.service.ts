import { Injectable } from '@nestjs/common';
import { PermissionRecord } from '../../common/supabase/database.types.js';
import { PermissionsRepository } from './permissions.repository.js';
import { QueryPermissionsDto } from './dto/query-permissions.dto.js';

export interface PermissionsResponse {
  data: PermissionRecord[];
  meta: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
}

@Injectable()
export class PermissionsService {
  constructor(private readonly repository: PermissionsRepository) {}

  async findAll(
    query: QueryPermissionsDto,
    accessToken: string,
  ): Promise<PermissionsResponse> {
    const { data, count } = await this.repository.findMany(accessToken, {
      limit: query.limit,
      offset: query.offset,
      code: query.code,
    });

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
