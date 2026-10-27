export const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? "").trim().replace(/\/+$/, "");
export const SESSION_KEY = `iinicia.portal.session.v1:${API_URL}`;
export type Row = Record<string, unknown>;
export type Session = { accessToken: string; expiresAt: number };
export type Profile = { id: string; email: string; first_name: string; last_name: string; status: string; roles: string[]; permissions: string[] };
export class ApiError extends Error { constructor(message: string, public status = 0) { super(message); } }
export function record(v: unknown): v is Row { return !!v && typeof v === "object" && !Array.isArray(v); }
export function str(v: unknown): string { return typeof v === "string" || typeof v === "number" ? String(v) : ""; }
export function readSession(): Session | null {
  try {
    const v: unknown = JSON.parse(sessionStorage.getItem(SESSION_KEY) ?? "null");
    return record(v) && typeof v.accessToken === "string" && !!v.accessToken && typeof v.expiresAt === "number" && Number.isFinite(v.expiresAt) && v.expiresAt > Date.now() ? { accessToken: v.accessToken, expiresAt: v.expiresAt } : null;
  } catch { return null; }
}
export async function request(session: Session, path: string, init: RequestInit = {}, signal?: AbortSignal): Promise<unknown> {
  if (!API_URL) throw new ApiError("Falta configurar NEXT_PUBLIC_API_URL en apps/web/.env.local.");
  if (session.expiresAt <= Date.now()) throw new ApiError("Tu sesión expiró. Vuelve a iniciar sesión.", 401);
  const controller = new AbortController();
  const abort = () => controller.abort();
  if (signal?.aborted) controller.abort();
  signal?.addEventListener("abort", abort, { once: true });
  const timer = setTimeout(abort, 20000);
  try {
    const response = await fetch(`${API_URL}${path}`, { ...init, credentials: "omit", cache: "no-store", signal: controller.signal, headers: { Accept: "application/json", ...(init.body ? { "Content-Type": "application/json" } : {}), ...init.headers, Authorization: `Bearer ${session.accessToken}` } });
    const data: unknown = await response.json().catch(() => null);
    if (!response.ok) {
      const message = record(data) ? data.message : null;
      throw new ApiError(response.status === 401 ? "La sesión ya no es válida. Inicia sesión nuevamente." : response.status === 403 ? "Tu cuenta no tiene permiso para esta operación." : typeof message === "string" ? message : Array.isArray(message) ? message.filter(x => typeof x === "string").join(". ") : `No se pudo completar la operación (${response.status}).`, response.status);
    }
    return data;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (signal?.aborted) throw error;
    throw new ApiError(controller.signal.aborted ? "La API tardó demasiado en responder. Puedes reintentar." : "No fue posible conectar con la API. Revisa ZeroTier y que el servidor esté encendido.");
  } finally { clearTimeout(timer); signal?.removeEventListener("abort", abort); }
}
export async function identity(session: Session, signal?: AbortSignal): Promise<Profile> {
  const p = await request(session, "/auth/me", {}, signal);
  if (!record(p) || !["id", "email", "first_name", "last_name", "status"].every(k => typeof p[k] === "string") || !Array.isArray(p.roles) || !p.roles.every(x => typeof x === "string") || !Array.isArray(p.permissions) || !p.permissions.every(x => typeof x === "string")) throw new ApiError("La API devolvió un perfil incompleto.");
  if (p.status !== "activo" || !p.roles.some(r => ["administrador", "superadministrador"].includes(r))) throw new ApiError("Este panel está disponible únicamente para administradores con cuenta activa.", 403);
  return p as Profile;
}
export function rows(value: unknown): { items: Row[]; total: number | null } {
  const items = Array.isArray(value) ? value : record(value) ? value.data ?? value.items : null;
  if (!Array.isArray(items) || !items.every(record)) throw new ApiError("El formato de la lista recibida no coincide con el esperado. Solicita revisar la respuesta de la API.");
  const meta = record(value) && record(value.meta) ? value.meta : value;
  const total = record(meta) && typeof meta.total === "number" && Number.isFinite(meta.total) ? meta.total : null;
  return { items, total };
}
