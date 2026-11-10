import { IsString, IsUUID, Matches, MaxLength, MinLength } from 'class-validator';

export class VerifyLoginMfaDto {
  @IsUUID('4')
  factor_id!: string;

  @Matches(/^\d{6}$/)
  code!: string;
}

export class VerifyRecoveryMfaDto extends VerifyLoginMfaDto {
  @IsString()
  @MinLength(8)
  @MaxLength(72)
  password!: string;
}
