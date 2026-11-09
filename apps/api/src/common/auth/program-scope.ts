import { ForbiddenException, InternalServerErrorException } from '@nestjs/common';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../supabase/database.types.js';

type DatabaseClient = SupabaseClient<Database>;

export function hasGlobalAcademicAccess(roles: string[]): boolean {
  return roles.includes('superadministrador') || roles.includes('administrador');
}

export function isScopedCoordinator(roles: string[]): boolean {
  return roles.includes('coordinador') && !hasGlobalAcademicAccess(roles);
}

export async function loadActiveRoleSlugs(client: DatabaseClient, userId: string): Promise<string[]> {
  const { data, error } = await client
    .from('user_roles')
    .select('expires_at, roles!role_id(slug)')
    .eq('user_id', userId)
    .eq('is_active', true);

  if (error) throw new InternalServerErrorException('No fue posible verificar los roles.');
  const now = Date.now();

  return (data ?? []).flatMap(({ expires_at, roles }) => {
    if (expires_at && !(Date.parse(expires_at) > now)) return [];
    const relatedRoles = Array.isArray(roles) ? roles : roles ? [roles] : [];
    return relatedRoles.map(({ slug }) => slug);
  });
}

function assignedPrograms(client: DatabaseClient, userId: string) {
  return client
    .from('user_programs')
    .select('program_id')
    .eq('user_id', userId)
    .in('status', ['admitido', 'inscrito', 'cursando']);
}

export async function listAssignedProgramIds(client: DatabaseClient, userId: string): Promise<string[]> {
  const { data, error } = await assignedPrograms(client, userId);

  if (error) throw new InternalServerErrorException('No fue posible verificar el ámbito del usuario.');
  return (data ?? []).map(({ program_id }) => program_id);
}

export async function hasProgramScope(
  client: DatabaseClient,
  userId: string,
  programId: string | null | undefined,
): Promise<boolean> {
  if (!programId) return false;

  const { data, error } = await assignedPrograms(client, userId)
    .eq('program_id', programId)
    .maybeSingle();

  if (error) throw new InternalServerErrorException('No fue posible verificar el ámbito del usuario.');
  return Boolean(data);
}

export async function requireProgramScope(
  client: DatabaseClient,
  userId: string,
  programId: string | null | undefined,
): Promise<void> {
  if (!(await hasProgramScope(client, userId, programId))) {
    throw new ForbiddenException('El curso está fuera de tu ámbito.');
  }
}
