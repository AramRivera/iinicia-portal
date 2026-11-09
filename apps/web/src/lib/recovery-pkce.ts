const STORAGE_KEY = 'iinicia_recovery_verifier';
const LIFETIME_MS = 30 * 60 * 1000;

function base64Url(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export async function startRecoveryProof() {
  const verifier = base64Url(crypto.getRandomValues(new Uint8Array(32)));
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ verifier, expiresAt: Date.now() + LIFETIME_MS }));
  return { verifier, challenge: base64Url(new Uint8Array(digest)) };
}

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

export function clearRecoveryVerifier(verifier: string): void {
  if (readRecoveryVerifier() === verifier) localStorage.removeItem(STORAGE_KEY);
}
