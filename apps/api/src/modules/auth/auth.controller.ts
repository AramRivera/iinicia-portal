import {
  Body,
  Controller,
  Get,
  Header,
  HttpCode,
  Post,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { SupabaseAuthGuard } from '../../common/auth/supabase-auth.guard.js';
import type { AuthenticatedRequest } from '../../common/auth/supabase-auth.guard.js';
import { SupabaseService } from '../../common/supabase/supabase.service.js';
import { AuthService } from './auth.service.js';
import { LoginDto } from './dto/login.dto.js';
import { RegisterDto } from './dto/register.dto.js';
import { RecoverPasswordDto } from './dto/recover-password.dto.js';
import { ResetPasswordDto } from './dto/reset-password.dto.js';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly supabase: SupabaseService,
    private readonly authService: AuthService,
  ) {}

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

  @Post('register')
  @HttpCode(201)
  @Header('Cache-Control', 'no-store')
  @UseGuards(ThrottlerGuard)
  register(@Body() data: RegisterDto) {
    return this.authService.register(data);
  }

  @Post('recover')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  @UseGuards(ThrottlerGuard)
  async recover(@Body() data: RecoverPasswordDto) {
    await this.supabase.sendPasswordRecovery(data.email);
    return { message: 'Si la cuenta existe, recibirás un enlace de recuperación.' };
  }

  @Post('reset-password')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  @UseGuards(SupabaseAuthGuard, ThrottlerGuard)
  async resetPassword(
    @Req() request: AuthenticatedRequest,
    @Body() data: ResetPasswordDto,
  ) {
    await this.supabase.updatePassword(request.user.id, data.password);
    return { message: 'La contraseña se actualizó correctamente.' };
  }

  /**
   * Identidad efectiva del usuario autenticado: perfil, roles y permisos.
   * La identidad proviene del token validado por Supabase Auth.
   */
  @Get('me')
  @Header('Cache-Control', 'no-store')
  @UseGuards(SupabaseAuthGuard)
  async me(@Req() request: AuthenticatedRequest) {
    const { user } = request;

    if (!user.email) {
      throw new UnauthorizedException(
        'El token de acceso no contiene un correo válido.',
      );
    }

    return this.authService.getMe(
      request.accessToken,
      user.id,
      issuedAtSeconds(request.accessToken),
    );
  }
}

function issuedAtSeconds(accessToken: string): number | null {
  const payload = accessToken.split('.')[1];
  if (!payload) return null;

  try {
    const decoded: unknown = JSON.parse(
      Buffer.from(payload, 'base64url').toString('utf8'),
    );
    if (typeof decoded !== 'object' || decoded === null) return null;
    const iat = (decoded as Record<string, unknown>).iat;
    return typeof iat === 'number' && Number.isFinite(iat) ? iat : null;
  } catch {
    return null;
  }
}
