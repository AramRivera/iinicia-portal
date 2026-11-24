// IINICIA Portal · oferta de cursos · courses.module.ts
/** Registra el controlador y los proveedores de oferta académica y equivalencias con Moodle en NestJS. */
import { Module } from '@nestjs/common';
import { SupabaseModule } from '../../common/supabase/supabase.module.js';
import { MoodleModule } from '../moodle/moodle.module.js';
import { CoursesService } from './courses.service.js';
import { CoursesController } from './courses.controller.js';

@Module({
  imports: [SupabaseModule, MoodleModule],
  controllers: [CoursesController],
  providers: [CoursesService],
  exports: [CoursesService],
})
export class CoursesModule {}
