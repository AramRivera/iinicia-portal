import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';

export class UpdateCourseMappingDto {
  @IsOptional()
  @IsUUID('4')
  program_id?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  course_name?: string;

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

  @IsOptional()
  @IsInt()
  @Min(1)
  moodle_course_id?: number;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  moodle_shortname?: string;

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
