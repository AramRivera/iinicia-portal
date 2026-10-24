import {
  IsEmail,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class RegisterDto {
  @IsEmail({}, { message: 'El correo electrónico debe ser válido.' })
  @MaxLength(254)
  email!: string;

  @IsString()
  @MinLength(8, { message: 'La contraseña debe tener al menos 8 caracteres.' })
  @MaxLength(128)
  password!: string;

  @IsString()
  @MinLength(1, { message: 'El nombre es obligatorio.' })
  @MaxLength(100)
  first_name!: string;

  @IsString()
  @MinLength(1, { message: 'Los apellidos son obligatorios.' })
  @MaxLength(100)
  last_name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  phone?: string;
}
