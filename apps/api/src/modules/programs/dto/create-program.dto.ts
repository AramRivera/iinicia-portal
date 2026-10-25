import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import type {
  ProgramModality,
  ProgramType,
} from '../../../common/supabase/database.types.js';

export class CreateProgramDto {
  @IsString()
  @MaxLength(50)
  code!: string;

  @IsString()
  @MaxLength(100)
  slug!: string;

  @IsString()
  @MaxLength(255)
  name!: string;

  @IsOptional()
  @IsString()
  short_description?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsEnum([
    'licenciatura',
    'maestria',
    'diplomado',
    'certificacion',
    'curso',
    'taller',
    'otro',
  ])
  type: ProgramType = 'curso';

  @IsOptional()
  @IsEnum(['en_linea', 'presencial', 'hibrido', 'autogestivo'])
  modality: ProgramModality = 'en_linea';

  @IsOptional()
  @IsString()
  duration_text?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  duration_hours?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  credits?: number;

  @IsOptional()
  @IsString()
  banner_url?: string;

  @IsOptional()
  @IsString()
  thumbnail_url?: string;

  @IsOptional()
  @IsInt()
  moodle_category_id?: number;

  @IsOptional()
  @IsBoolean()
  is_featured?: boolean;

  @IsOptional()
  @IsBoolean()
  is_active?: boolean;
}
