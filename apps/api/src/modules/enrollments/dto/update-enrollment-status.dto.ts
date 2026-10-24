import { IsBoolean, IsEnum, IsOptional, IsString } from 'class-validator';
import type { EnrollmentStatus } from '../../../common/supabase/database.types.js';

export class UpdateEnrollmentStatusDto {
  @IsEnum(['autorizada', 'rechazada', 'pendiente', 'desmatriculada'], {
    message: 'El estado debe ser: autorizada, rechazada, pendiente o desmatriculada',
  })
  status!: EnrollmentStatus;

  @IsOptional()
  @IsString()
  notes?: string;

  /**
   * Si es true y el estado es 'autorizada', dispara inmediatamente la sincronización con Moodle.
   */
  @IsOptional()
  @IsBoolean()
  sync_to_moodle?: boolean = true;
}
