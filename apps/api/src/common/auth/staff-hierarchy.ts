// IINICIA Portal · identidad y autenticación · staff-hierarchy.ts
/** La administración de cuentas tiene un límite adicional al permiso de la ruta. Antes de modificar usuarios o asignar roles, se compara su jerarquía con la de quien ejecuta la operación. */
import { ForbiddenException } from '@nestjs/common';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../supabase/database.types.js';
import { hasGlobalAcademicAccess, loadActiveRoleSlugs } from './program-scope.js';

/** Comprueba si quien administra puede operar sobre el rol solicitado dentro de la jerarquía del portal. */
export function requireManageableRole(actorRoles: string[], role: string) {
  if (hasGlobalAcademicAccess([role]) && !actorRoles.includes('superadministrador')) {
    throw new ForbiddenException('Solo superadministración puede gestionar roles administrativos.');
  }
}

/** Consulta los roles de la cuenta objetivo y aplica las restricciones jerárquicas antes de permitir su modificación. */
export async function requireManageableAccount(
  client: SupabaseClient<Database>,
  actorRoles: string[],
  targetUserId: string,
) {
  if (actorRoles.includes('superadministrador')) return;
  const targetRoles = await loadActiveRoleSlugs(client, targetUserId);
  if (hasGlobalAcademicAccess(targetRoles)) {
    throw new ForbiddenException('Solo superadministración puede gestionar cuentas administrativas.');
  }
}
