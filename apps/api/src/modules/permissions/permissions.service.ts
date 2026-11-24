// IINICIA Portal · permisos · permissions.service.ts
/** Implementa las reglas para entregar el catálogo con metadatos de paginación. */
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
  /** Recibe repository como dependencias del módulo de permisos. NestJS proporciona esas instancias para las operaciones del componente. */
  constructor(private readonly repository: PermissionsRepository) {}

  /** Acota la consulta paginada y delega al repositorio la lectura de los permisos con el token de sesión. */
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
