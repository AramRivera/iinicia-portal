import { Controller, Get, Header } from '@nestjs/common';
import { HealthService } from './health.service.js';
import type {
  HealthResponse,
  ReadinessResponse,
} from './health.service.js';

@Controller('health')
export class HealthController {
  constructor(private readonly health: HealthService) {}

  @Get()
  @Header('Cache-Control', 'no-store')
  getLiveness(): HealthResponse {
    return this.health.getLiveness();
  }

  @Get('ready')
  @Header('Cache-Control', 'no-store')
  getReadiness(): Promise<ReadinessResponse> {
    return this.health.getReadiness();
  }
}
