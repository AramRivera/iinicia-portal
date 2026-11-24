// IINICIA Portal · cuentas de usuario · update-own-profile.dto.ts
/** Limita la edición del perfil propio a los datos admitidos por la API. */
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateOwnProfileDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  first_name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  last_name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  phone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  avatar_url?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  bio?: string;
}
