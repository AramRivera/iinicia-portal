import { Module } from '@nestjs/common';
import { SupabaseModule } from '../../common/supabase/supabase.module.js';
import { ProgramsController } from './programs.controller.js';
import { ProgramsRepository } from './programs.repository.js';
import { ProgramsService } from './programs.service.js';

@Module({
  imports: [SupabaseModule],
  controllers: [ProgramsController],
  providers: [ProgramsService, ProgramsRepository],
})
export class ProgramsModule {}
