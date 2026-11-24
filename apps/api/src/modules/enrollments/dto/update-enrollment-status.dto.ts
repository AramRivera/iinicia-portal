// IINICIA Portal · matrículas · update-enrollment-status.dto.ts
/** Valida el nuevo estado de la matrícula y la información asociada a la revisión. */
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
