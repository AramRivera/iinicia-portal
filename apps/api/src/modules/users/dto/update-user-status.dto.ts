import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateUserStatusDto {
  @IsEnum(['pendiente', 'activo', 'suspendido', 'inactivo', 'baja'], {
    message: 'El estado debe ser: pendiente, activo, suspendido, inactivo o baja',
  })
  status!: 'pendiente' | 'activo' | 'suspendido' | 'inactivo' | 'baja';

  @IsOptional()
  @IsString()
  @MaxLength(255)
  reason?: string;
}
