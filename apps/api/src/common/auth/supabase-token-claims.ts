/** Lee claims de un JWT. La firma debe validarse por separado en Supabase. */
export function readSupabaseTokenClaims(token: string): Record<string, unknown> {
  const payload = token.split('.')[1];
  if (!payload) return {};

  try {
    const claims: unknown = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    return typeof claims === 'object' && claims !== null && !Array.isArray(claims)
      ? claims as Record<string, unknown>
      : {};
  } catch {
    return {};
  }
}
