// IINICIA Portal · diagnóstico de servicios · health.controller.ts
/** Expone por HTTP el estado de la API, Supabase y Moodle. */
import { Controller, Get } from '@nestjs/common';
import { HealthService } from './health.service.js';

@Controller('health')
export class HealthController {
  /** Recibe healthService como dependencias del módulo de diagnóstico de servicios. NestJS proporciona esas instancias para las operaciones del componente. */
  constructor(private readonly healthService: HealthService) {}

  /** Devuelve el estado agregado de la API y sus dependencias mediante el servicio de salud. */
  @Get()
  check() {
    return this.healthService.checkHealth();
  }
}
