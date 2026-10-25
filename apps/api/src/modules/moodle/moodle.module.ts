import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { SupabaseModule } from '../../common/supabase/supabase.module.js';
import { MoodleClient } from './moodle.client.js';
import { MoodleService } from './moodle.service.js';
import { MoodleController } from './moodle.controller.js';

@Module({
  imports: [ConfigModule, SupabaseModule],
  controllers: [MoodleController],
  providers: [MoodleClient, MoodleService],
  exports: [MoodleClient, MoodleService],
})
export class MoodleModule {}
