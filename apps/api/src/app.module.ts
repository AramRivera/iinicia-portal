import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { SupabaseModule } from './common/supabase/supabase.module.js';
import { HealthModule } from './modules/health/health.module.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { UsersModule } from './modules/users/users.module.js';
import { RolesModule } from './modules/roles/roles.module.js';
import { PermissionsModule } from './modules/permissions/permissions.module.js';
import { ProgramsModule } from './modules/programs/programs.module.js';
import { CoursesModule } from './modules/courses/courses.module.js';
import { EnrollmentsModule } from './modules/enrollments/enrollments.module.js';
import { AdmissionsModule } from './modules/admissions/admissions.module.js';
import { MoodleModule } from './modules/moodle/moodle.module.js';
import { AuditModule } from './modules/audit/audit.module.js';
import { CmsModule } from './modules/cms/cms.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot([
      {
        ttl: 60000,
        limit: process.env.NODE_ENV === 'production' ? 100 : 300,
      },
    ]),
    SupabaseModule,
    HealthModule,
    AuthModule,
    UsersModule,
    RolesModule,
    PermissionsModule,
    ProgramsModule,
    CoursesModule,
    EnrollmentsModule,
    AdmissionsModule,
    MoodleModule,
    AuditModule,
    CmsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
