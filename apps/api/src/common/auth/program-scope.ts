// IINICIA Portal · identidad y autenticación · program-scope.ts
/** Centraliza las comprobaciones de ámbito académico para roles globales y coordinadores. */
import { ForbiddenException, InternalServerErrorException } from '@nestjs/common';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../supabase/database.types.js';

type DatabaseClient = SupabaseClient<Database>;

/** Identifica las cuentas con alcance académico global para que los servicios distingan ese acceso del ámbito por programa. */
export function hasGlobalAcademicAccess(roles: string[]): boolean {
  return roles.includes('superadministrador') || roles.includes('administrador');
}

/** Determina cuándo una cuenta debe limitar sus operaciones a los programas asignados a coordinación. */
export function isScopedCoordinator(roles: string[]): boolean {
  return roles.includes('coordinador') && !hasGlobalAcademicAccess(roles);
}

// Las comprobaciones de ámbito se basan en los roles vigentes de la cuenta.
/** Consulta las asignaciones del usuario y conserva los roles activos y vigentes para decidir el alcance de la operación. */
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

/** Construye la consulta de programas asignados al usuario en los estados que conceden acceso académico. */
function assignedPrograms(client: DatabaseClient, userId: string) {
  return client
    .from('user_programs')
    .select('program_id')
    .eq('user_id', userId)
    .in('status', ['admitido', 'inscrito', 'cursando']);
}

/** Materializa los identificadores de programas de la cuenta para aplicarlos como filtro de autorización en el servicio llamador. */
export async function listAssignedProgramIds(client: DatabaseClient, userId: string): Promise<string[]> {
  const { data, error } = await assignedPrograms(client, userId);

  if (error) throw new InternalServerErrorException('No fue posible verificar el ámbito del usuario.');
  return (data ?? []).map(({ program_id }) => program_id);
}

// Los roles globales no requieren una adscripción individual al programa.
/** Comprueba si el programa solicitado pertenece al ámbito de la cuenta. Un programa ausente no concede acceso. */
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

/** Interrumpe la operación con un error de autorización cuando el programa está fuera del ámbito de la cuenta. */
export async function requireProgramScope(
  client: DatabaseClient,
  userId: string,
  programId: string | null | undefined,
): Promise<void> {
  if (!(await hasProgramScope(client, userId, programId))) {
    throw new ForbiddenException('El curso está fuera de tu ámbito.');
  }
}
