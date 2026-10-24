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
