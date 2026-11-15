/** Valida el usuario y los datos académicos de la adscripción a un programa. */
import { IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';
import type { AcademicStatus } from '../../../common/supabase/database.types.js';

export class AssignUserProgramDto {
  @IsUUID('4')
  user_id!: string;

  @IsOptional()
  @IsEnum([
    'postulado',
    'en_revision',
    'admitido',
    'rechazado',
    'inscrito',
    'cursando',
    'egresado',
    'baja',
    'suspendido',
  ])
  status: AcademicStatus = 'admitido';

  @IsOptional()
  @IsString()
  cohort?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
