/** Registra el controlador y los proveedores de gestión de usuarios y perfiles en NestJS. */
import { Module } from '@nestjs/common';
import { SupabaseModule } from '../../common/supabase/supabase.module.js';
import { MoodleModule } from '../moodle/moodle.module.js';
import { UsersService } from './users.service.js';
import { UsersController } from './users.controller.js';

@Module({
  imports: [SupabaseModule, MoodleModule],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
