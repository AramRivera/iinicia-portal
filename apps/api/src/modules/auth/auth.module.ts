import { Module } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import { SupabaseAuthGuard } from '../../common/auth/supabase-auth.guard.js';
import { SupabaseModule } from '../../common/supabase/supabase.module.js';
import { AuthController } from './auth.controller.js';
import { AuthRepository } from './auth.repository.js';
import { AuthService } from './auth.service.js';

@Module({
  imports: [
    SupabaseModule,
    ThrottlerModule.forRoot([
      {
        ttl: 60000,
        limit: process.env.NODE_ENV === 'production' ? 30 : 300,
      },
    ]),
  ],
  controllers: [AuthController],
  providers: [AuthService, AuthRepository, SupabaseAuthGuard],
  exports: [AuthService],
})
export class AuthModule {}
