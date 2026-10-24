import { Module } from '@nestjs/common';
import { SupabaseModule } from '../../common/supabase/supabase.module.js';
import { ProgramsService } from './programs.service.js';
import { ProgramsController } from './programs.controller.js';

@Module({
  imports: [SupabaseModule],
  controllers: [ProgramsController],
  providers: [ProgramsService],
  exports: [ProgramsService],
})
export class ProgramsModule {}
