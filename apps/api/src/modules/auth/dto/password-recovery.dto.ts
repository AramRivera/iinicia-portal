import { IsEmail, IsOptional, IsString, IsUUID, Length, Matches, MaxLength, MinLength } from 'class-validator';

export class RecoverPasswordDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(2048)
  captcha_token?: string;

  @IsEmail()
  @MaxLength(254)
  email!: string;

  @IsOptional()
  @Matches(/^[A-Za-z0-9_-]{43}$/)
  code_challenge?: string;
}

export class ResetPasswordDto {
  @IsOptional()
  @Matches(/^[A-Za-z0-9_-]{16,256}$/)
  token_hash?: string;

  @IsOptional()
  @IsUUID()
  auth_code?: string;

  @IsOptional()
  @Matches(/^[A-Za-z0-9_-]{43}$/)
  code_verifier?: string;

  @IsString()
  @Length(8, 72)
  password!: string;
}
