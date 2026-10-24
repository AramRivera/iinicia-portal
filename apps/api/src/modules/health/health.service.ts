import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { SupabaseService } from '../../common/supabase/supabase.service.js';

export interface HealthResponse {
  status: 'ok';
  timestamp: string;
}

export interface ReadinessResponse {
  status: 'ok' | 'error';
  timestamp: string;
  dependencies: {
    database: 'available' | 'unavailable';
    authentication: 'available' | 'unavailable';
  };
}

@Injectable()
export class HealthService {
  constructor(private readonly supabase: SupabaseService) {}

  getLiveness(): HealthResponse {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
    };
  }

  async getReadiness(): Promise<ReadinessResponse> {
    const checks = await this.supabase.checkReadiness();
    const response: ReadinessResponse = {
      status: checks.database && checks.authentication ? 'ok' : 'error',
      timestamp: new Date().toISOString(),
      dependencies: {
        database: checks.database ? 'available' : 'unavailable',
        authentication: checks.authentication ? 'available' : 'unavailable',
      },
    };

    if (response.status === 'error') {
      throw new ServiceUnavailableException(response);
    }

    return response;
  }
}
