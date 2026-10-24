import { Module } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import { SupabaseModule } from '../../common/supabase/supabase.module.js';
import { AuthController } from './auth.controller.js';

@Module({
  imports: [
    SupabaseModule,
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 5 }]),
  ],
  controllers: [AuthController],
})
export class AuthModule {}
