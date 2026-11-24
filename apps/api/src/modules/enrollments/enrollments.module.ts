// IINICIA Portal · matrículas · enrollments.module.ts
/** Registra el controlador y los proveedores de solicitudes y matrículas académicas en NestJS. */
import { Module } from '@nestjs/common';
import { SupabaseModule } from '../../common/supabase/supabase.module.js';
import { MoodleModule } from '../moodle/moodle.module.js';
import { EnrollmentsService } from './enrollments.service.js';
import { EnrollmentsController } from './enrollments.controller.js';

@Module({
  imports: [SupabaseModule, MoodleModule],
  controllers: [EnrollmentsController],
  providers: [EnrollmentsService],
  exports: [EnrollmentsService],
})
export class EnrollmentsModule {}
