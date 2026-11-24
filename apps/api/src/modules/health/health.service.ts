// IINICIA Portal · diagnóstico de servicios · health.service.ts
/** Implementa las reglas para comprobar las dependencias y resumir su disponibilidad. */
import { Injectable } from '@nestjs/common';
import { SupabaseService } from '../../common/supabase/supabase.service.js';
import { MoodleClient } from '../moodle/moodle.client.js';

@Injectable()
export class HealthService {
  /** Recibe supabase y moodleClient como dependencias del módulo de diagnóstico de servicios. NestJS proporciona esas instancias para las operaciones del componente. */
  constructor(
    private readonly supabase: SupabaseService,
    private readonly moodleClient: MoodleClient,
  ) {}

  /** Consulta las dependencias y resume su disponibilidad para el diagnóstico HTTP. Los errores internos de la base se sustituyen por un mensaje fijo. */
  async checkHealth() {
    let supabaseStatus = 'ok';
    let supabaseError: string | null = null;

    try {
      this.supabase.assertConfiguration();
      const { error } = await this.supabase
        .getClient('')
        .from('roles')
        .select('id')
        .limit(1);
      // La ruta es pública. Basta con comunicar el estado sin enviar el diagnóstico de la base.
      if (error) {
        supabaseStatus = 'degraded';
        supabaseError = 'No fue posible verificar la conexión con Supabase.';
      }
    } catch {
      supabaseStatus = 'error';
      supabaseError = 'No fue posible verificar la conexión con Supabase.';
    }

    const moodleCheck = await this.moodleClient.checkConnection();

    return {
      status: supabaseStatus === 'ok' ? 'ok' : 'degraded',
      timestamp: new Date().toISOString(),
      services: {
        api: { status: 'ok', uptime: process.uptime() },
        supabase: {
          status: supabaseStatus,
          error: supabaseError,
        },
        moodle: {
          status: moodleCheck.ok ? 'ok' : 'disconnected',
          message: moodleCheck.message,
        },
      },
    };
  }
}
