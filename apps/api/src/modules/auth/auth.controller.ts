import {
  Body,
  Controller,
  Header,
  HttpCode,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { SupabaseService } from '../../common/supabase/supabase.service.js';
import { LoginDto } from './dto/login.dto.js';
import { RegisterDto } from './dto/register.dto.js';

@Controller('auth')
export class AuthController {
  constructor(private readonly supabase: SupabaseService) {}

  @Post('register')
  @HttpCode(202)
  @Header('Cache-Control', 'no-store')
  @UseGuards(ThrottlerGuard)
  register(@Body() registration: RegisterDto) {
    return this.supabase.register(registration);
  }

  @Post('login')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  @UseGuards(ThrottlerGuard)
  login(@Body() credentials: LoginDto) {
    return this.supabase.signInWithPassword(
      credentials.email,
      credentials.password,
    );
  }
}
