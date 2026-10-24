import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateCourseMappingDto {
  @IsOptional()
  @IsUUID('4')
  program_id?: string;

  @IsString()
  @MaxLength(50)
  portal_course_code!: string;

  @IsString()
  @MaxLength(100)
  slug!: string;

  @IsString()
  @MaxLength(255)
  course_name!: string;

  @IsOptional()
  @IsString()
  course_description?: string;

  @IsOptional()
  @IsString()
  thumbnail_url?: string;

  @IsOptional()
  @IsInt()
  term_or_module?: number;

  @IsOptional()
  @IsBoolean()
  is_mandatory?: boolean;

  @IsInt()
  @Min(1)
  moodle_course_id!: number;

  @IsString()
  @MaxLength(100)
  moodle_shortname!: string;

  @IsOptional()
  @IsInt()
  moodle_category_id?: number;

  @IsOptional()
  @IsString()
  moodle_course_url?: string;

  @IsOptional()
  @IsBoolean()
  is_active?: boolean;
}
