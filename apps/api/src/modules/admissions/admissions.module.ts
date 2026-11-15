import { EnrollmentsModule } from '../enrollments/enrollments.module.js';
import { Module } from '@nestjs/common';
import { SupabaseModule } from '../../common/supabase/supabase.module.js';
import { AdmissionsService } from './admissions.service.js';
import { AdmissionsController } from './admissions.controller.js';

@Module({
  imports: [SupabaseModule, EnrollmentsModule],
  controllers: [AdmissionsController],
  providers: [AdmissionsService],
  exports: [AdmissionsService],
})
export class AdmissionsModule {}
