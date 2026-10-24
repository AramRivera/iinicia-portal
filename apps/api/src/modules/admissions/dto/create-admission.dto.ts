import {
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateAdmissionDto {
  @IsUUID('4')
  program_id!: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  previous_education_level?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  previous_institution?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  average_grade?: number;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  motivation_letter?: string;
}
