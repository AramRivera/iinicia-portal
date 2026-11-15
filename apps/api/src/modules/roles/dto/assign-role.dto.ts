/** Valida el identificador del rol y la información de la asignación. */
import { IsInt, IsOptional, IsString, Min } from 'class-validator';

export class AssignRoleDto {
  @IsInt()
  @Min(1)
  role_id!: number;

  @IsOptional()
  @IsString()
  expires_at?: string;
}
