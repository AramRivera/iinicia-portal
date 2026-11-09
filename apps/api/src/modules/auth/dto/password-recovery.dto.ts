import { IsEmail, IsString, Length, Matches, MaxLength } from 'class-validator';

export class RecoverPasswordDto {
  @IsEmail()
  @MaxLength(254)
  email!: string;
}

export class ResetPasswordDto {
  @IsString()
  @Matches(/^[A-Za-z0-9_-]{16,256}$/)
  token_hash!: string;

  @IsString()
  @Length(8, 72)
  password!: string;
}
