import { SetMetadata } from '@nestjs/common';

export const ROLES_KEY = 'roles';

export const ROLE_ALIASES: Record<string, string> = {
  superadmin: 'superadministrador',
  superadministrador: 'superadministrador',
  admin: 'administrador',
  administrador: 'administrador',
  coordinator: 'coordinador',
  coordinador: 'coordinador',
  teacher: 'profesor',
  profesor: 'profesor',
  student: 'estudiante',
  estudiante: 'estudiante',
  applicant: 'aspirante',
  aspirante: 'aspirante',
  support: 'soporte',
  soporte: 'soporte',
};

/**
 * Normaliza un rol a su slug oficial en español según IINICIA_DATABASE.
 */
export function normalizeRoleSlug(role: string): string {
  const lower = role.toLowerCase().trim();
  return ROLE_ALIASES[lower] ?? lower;
}

/**
 * Decorador para restringir el acceso a uno o más roles.
 * Soporta tanto los identificadores oficiales en español como sus alias en inglés.
 * Ejemplo: `@Roles('administrador', 'coordinador')` o `@Roles('admin', 'teacher')`.
 */
export const Roles = (...roles: string[]) =>
  SetMetadata(
    ROLES_KEY,
    roles.map((r) => normalizeRoleSlug(r)),
  );
