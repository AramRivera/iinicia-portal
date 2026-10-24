import {
  IsEmail,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class RegisterDto {
  @IsEmail()
  @MaxLength(254)
  email!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(4096)
  password!: string;

  @IsOptional()
  @IsString()
  @Matches(/\S/, { message: 'first_name no puede estar vacío.' })
  @MaxLength(100)
  first_name?: string;

  @IsOptional()
  @IsString()
  @Matches(/\S/, { message: 'last_name no puede estar vacío.' })
  @MaxLength(100)
  last_name?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\+?[0-9 ()-]{7,20}$/)
  phone?: string;
}
