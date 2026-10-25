import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import type { AcademicStatus } from '../../../common/supabase/database.types.js';

export class ReviewAdmissionDto {
  @IsEnum(['en_revision', 'admitido', 'rechazado'], {
    message: 'El dictamen debe ser: en_revision, admitido o rechazado',
  })
  status!: AcademicStatus;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  reviewer_notes?: string;
}
