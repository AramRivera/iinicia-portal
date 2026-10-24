import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import type { ProgramType } from '../../../common/supabase/database.types.js';

const PROGRAM_TYPES: ProgramType[] = [
  'degree',
  'diploma',
  'certification',
  'course',
];

export class QueryProgramsDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 50;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset = 0;

  @IsOptional()
  @IsIn(PROGRAM_TYPES)
  type?: ProgramType;

  @IsOptional()
  @IsString()
  @Matches(/^[A-Z0-9][A-Z0-9_-]{1,31}$/)
  @MaxLength(32)
  code?: string;
}
