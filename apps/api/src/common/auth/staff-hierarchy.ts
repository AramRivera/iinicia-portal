import { ForbiddenException } from '@nestjs/common';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../supabase/database.types.js';
import { hasGlobalAcademicAccess, loadActiveRoleSlugs } from './program-scope.js';

export function requireManageableRole(actorRoles: string[], role: string) {
  if (hasGlobalAcademicAccess([role]) && !actorRoles.includes('superadministrador')) {
    throw new ForbiddenException('Solo superadministración puede gestionar roles administrativos.');
  }
}

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
