// IINICIA Portal · identidad y autenticación · login.dto.ts
/** Valida el correo, la contraseña y la prueba CAPTCHA que recibe el inicio de sesión. */
import { IsEmail, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class LoginDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(2048)
  captcha_token?: string;

  @IsEmail()
  @MaxLength(254)
  email!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(4096)
  password!: string;
}
