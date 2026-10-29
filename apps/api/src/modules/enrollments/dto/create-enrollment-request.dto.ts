import { IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';
import type { MoodleRoleType } from '../../../common/supabase/database.types.js';

export class CreateEnrollmentRequestDto {
  @IsUUID('4')
  course_mapping_id!: string;

  @IsOptional()
  @IsUUID('4')
  user_id?: string;

  @IsOptional()
  @IsUUID('4')
  program_id?: string;

  @IsOptional()
  @IsEnum(['student', 'editingteacher', 'teacher', 'manager', 'coursecreator'])
  moodle_role: MoodleRoleType = 'student';

  @IsOptional()
  @IsString()
  notes?: string;
}
