// IINICIA Portal · portal Next.js · recovery-pkce.ts
/** Genera la prueba PKCE y conserva temporalmente el verificador necesario para canjear el enlace de recuperación. */
const STORAGE_KEY = 'iinicia_recovery_verifier';
const LIFETIME_MS = 30 * 60 * 1000;

/** Convierte bytes al alfabeto URL seguro que necesitan el verificador y su reto PKCE. */
function base64Url(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// Comparte el reto derivado con la API y conserva el verificador para el intercambio posterior.
/** Genera el verificador criptográfico, almacena su vigencia en el navegador y retorna el reto que usará la API. */
export async function startRecoveryProof() {
  const verifier = base64Url(crypto.getRandomValues(new Uint8Array(32)));
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ verifier, expiresAt: Date.now() + LIFETIME_MS }));
  return { verifier, challenge: base64Url(new Uint8Array(digest)) };
}

/** Recupera un verificador de recuperación vigente y descarta un registro caducado. */
export function readRecoveryVerifier(): string | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const value = JSON.parse(raw) as { verifier?: string; expiresAt?: number };
    if (value.verifier && typeof value.expiresAt === 'number' && value.expiresAt > Date.now()) {
      return value.verifier;
    }
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    return null;
  }
  return null;
}

// Evita eliminar el verificador de una solicitud más reciente.
/** Elimina solo la prueba utilizada para conservar una solicitud más reciente si las operaciones se cruzan. */
export function clearRecoveryVerifier(verifier: string): void {
  if (readRecoveryVerifier() === verifier) localStorage.removeItem(STORAGE_KEY);
}
