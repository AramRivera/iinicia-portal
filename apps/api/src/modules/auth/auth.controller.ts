import {
  BadRequestException,
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
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { SupabaseAuthGuard } from '../../common/auth/supabase-auth.guard.js';
import type { AuthenticatedRequest } from '../../common/auth/supabase-auth.guard.js';
import { SupabaseService } from '../../common/supabase/supabase.service.js';
import { AuthService } from './auth.service.js';
import { LoginDto } from './dto/login.dto.js';
import { RecoverPasswordDto, ResetPasswordDto } from './dto/password-recovery.dto.js';
import { RegisterDto } from './dto/register.dto.js';
import { VerifyLoginMfaDto, VerifyRecoveryMfaDto } from './dto/verify-login-mfa.dto.js';
import { readSupabaseTokenClaims } from '../../common/auth/supabase-token-claims.js';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly supabase: SupabaseService,
    private readonly authService: AuthService,
  ) {}

  @Post('login')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  @UseGuards(ThrottlerGuard)
  login(@Body() credentials: LoginDto) {
    return this.supabase.signInWithPassword(
      credentials.email,
      credentials.password,
      credentials.captcha_token,
    );
  }

  @Post('mfa/verify')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  verifyLoginMfa(@Body() dto: VerifyLoginMfaDto, @Req() request: AuthenticatedRequest) {
    return this.supabase.verifyLoginMfa(mfaToken(request), dto.factor_id, dto.code);
  }

  @Post('mfa/recover')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  verifyRecoveryMfa(@Body() dto: VerifyRecoveryMfaDto, @Req() request: AuthenticatedRequest) {
    return this.supabase.resetPasswordWithMfa(mfaToken(request), dto.factor_id, dto.code, dto.password);
  }

  @Post('register')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
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
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  recoverPassword(@Body() dto: RecoverPasswordDto) {
    return dto.code_challenge
      ? this.supabase.requestPkcePasswordRecovery(dto.email, dto.code_challenge, dto.captcha_token)
      : this.supabase.requestPasswordRecovery(dto.email, dto.captcha_token);
  }

  @Post('reset-password')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  resetPassword(@Body() dto: ResetPasswordDto) {
    const { token_hash, auth_code, code_verifier, password } = dto;
    if (auth_code && code_verifier && !token_hash) {
      return this.supabase.resetPasswordWithCode(auth_code, code_verifier, password);
    }
    if (token_hash && !auth_code && !code_verifier) {
      return this.supabase.resetPassword(token_hash, password);
    }
    throw new BadRequestException('Se requiere un enlace de recuperación válido.');
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

function mfaToken(request: AuthenticatedRequest): string {
  const match = request.headers.authorization?.match(/^Bearer\s+(\S+)$/i);
  if (!match) throw new UnauthorizedException('Se requiere una sesión de verificación.');
  return match[1];
}

function issuedAtSeconds(accessToken: string): number | null {
  const { iat } = readSupabaseTokenClaims(accessToken);
  return typeof iat === 'number' && Number.isFinite(iat) ? iat : null;
}
