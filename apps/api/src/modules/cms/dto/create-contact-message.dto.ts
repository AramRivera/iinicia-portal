import { IsEmail, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class CreateContactMessageDto {
  @IsString()
  @MaxLength(150)
  full_name!: string;

  @IsEmail({}, { message: 'El correo electrónico debe ser válido.' })
  @MaxLength(254)
  email!: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  phone?: string;

  @IsString()
  @MaxLength(200)
  subject!: string;

  @IsOptional()
  @IsUUID('4')
  program_of_interest?: string;

  @IsString()
  @MaxLength(3000)
  message!: string;
}
