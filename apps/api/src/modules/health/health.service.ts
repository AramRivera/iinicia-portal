import { Injectable } from '@nestjs/common';
import { SupabaseService } from '../../common/supabase/supabase.service.js';
import { MoodleClient } from '../moodle/moodle.client.js';

@Injectable()
export class HealthService {
  constructor(
    private readonly supabase: SupabaseService,
    private readonly moodleClient: MoodleClient,
  ) {}

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
      if (error) {
        supabaseStatus = 'degraded';
        supabaseError = error.message;
      }
    } catch (err: any) {
      supabaseStatus = 'error';
      supabaseError = err?.message || 'Error al conectar con Supabase';
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
