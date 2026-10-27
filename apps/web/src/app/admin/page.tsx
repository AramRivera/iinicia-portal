"use client";

import Link from "next/link";
import { usePortalTheme } from "@/components/PortalThemeProvider";
import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { ApiError, identity, readSession, record, request, rows, SESSION_KEY, str } from "./admin-api";
import type { Profile, Row, Session } from "./admin-api";
import "./admin.css";

const styles = {"access": "iiniciaAdmin_access", "account": "iiniciaAdmin_account", "actions": "iiniciaAdmin_actions", "badge": "iiniciaAdmin_badge", "brand": "iiniciaAdmin_brand", "checkbox": "iiniciaAdmin_checkbox", "content": "iiniciaAdmin_content", "dialog": "iiniciaAdmin_dialog", "empty": "iiniciaAdmin_empty", "error": "iiniciaAdmin_error", "eyebrow": "iiniciaAdmin_eyebrow", "filters": "iiniciaAdmin_filters", "footnote": "iiniciaAdmin_footnote", "gate": "iiniciaAdmin_gate", "heading": "iiniciaAdmin_heading", "overlay": "iiniciaAdmin_overlay", "pagination": "iiniciaAdmin_pagination", "panel": "iiniciaAdmin_panel", "primary": "iiniciaAdmin_primary", "secondary": "iiniciaAdmin_secondary", "shell": "iiniciaAdmin_shell", "sidebar": "iiniciaAdmin_sidebar", "stats": "iiniciaAdmin_stats", "success": "iiniciaAdmin_success", "tableWrap": "iiniciaAdmin_tableWrap"};

type Section = "usuarios" | "inscripciones" | "cursos";
type Change = { id: string; label: string; status: string; kind: "usuario" | "inscripcion" };
const statuses = ["pendiente", "activo", "suspendido", "inactivo", "baja"];
const enrollmentStatuses = ["pendiente", "autorizada", "rechazada", "sincronizada", "error_sincronizacion", "desmatriculada"];
const roleNames = ["superadministrador", "administrador", "coordinador", "profesor", "estudiante", "soporte", "aspirante"];
function name(row: Row) { return [str(row.first_name), str(row.last_name)].filter(Boolean).join(" ") || str(row.email) || str(row.id); }
function nested(row: Row, key: string): Row { const v = row[key]; return record(v) ? v : Array.isArray(v) && record(v[0]) ? v[0] : {}; }
function courseName(row: Row) { return str(row.course_name) || str(row.name) || str(row.portal_course_name) || str(row.portal_course_code) || str(row.course_mapping_id) || "Curso sin nombre"; }
function date(value: unknown) { const d = new Date(str(value)); return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString("es-MX"); }
function Badge({ value }: { value: unknown }) { const text = str(value) || "Sin información"; return <span className={styles.badge} data-state={text}>{text.replaceAll("_", " ")}</span>; }

export default function AdminPage() {
  const { theme, toggleTheme } = usePortalTheme();
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [checking, setChecking] = useState(true);
  const [authError, setAuthError] = useState("");
  const [section, setSection] = useState<Section>("usuarios");
  const [items, setItems] = useState<Row[]>([]);
  const [total, setTotal] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [role, setRole] = useState("");
  const [offset, setOffset] = useState(0);
  const [revision, setRevision] = useState(0);
  const [change, setChange] = useState<Change | null>(null);
  const [reason, setReason] = useState("");
  const [sync, setSync] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const reasonInput = useRef<HTMLTextAreaElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);
  const canRead = section !== "usuarios" || !!profile?.permissions.includes("users.read");
  const canManageUsers = !!profile?.permissions.includes("users.manage");
  const canAuthorize = !!profile?.permissions.includes("enrollments.authorize");

  useEffect(() => {
    const controller = new AbortController();
    let expiry: ReturnType<typeof setTimeout>;
    const invalidate = (message: string) => { setProfile(null); setSession(null); setAuthError(message); setChecking(false); };
    const validate = async () => {
      const saved = readSession();
      if (!saved) { invalidate("Inicia sesión con tu cuenta de administrador desde la portada, en esta misma pestaña."); return; }
      try {
        const current = await identity(saved, controller.signal);
        if (controller.signal.aborted) return;
        setProfile(current); setSession(saved); setAuthError(""); setChecking(false);
        clearTimeout(expiry);
        expiry = setTimeout(() => invalidate("Tu sesión expiró. Vuelve a iniciar sesión desde la portada."), Math.min(2147483647, Math.max(0, saved.expiresAt - Date.now())));
      } catch (e) { if (!controller.signal.aborted) invalidate(e instanceof Error ? e.message : "No se pudo verificar la sesión."); }
    };
    void validate();
    window.addEventListener("focus", validate);
    return () => { controller.abort(); clearTimeout(expiry); window.removeEventListener("focus", validate); };
  }, []);

  useEffect(() => {
    if (!session || !profile || !canRead) { setItems([]); return; }
    const controller = new AbortController();
    setLoading(true); setError(""); setItems([]); setTotal(null);
    const params = new URLSearchParams({ limit: "20", offset: String(offset) });
    if (query) params.set("search", query);
    if (status) params.set("status", status);
    if (role) params.set("role", role);
    const path = section === "usuarios" ? `/users?${params}` : section === "inscripciones" ? "/enrollments" : "/courses";
    request(session, path, {}, controller.signal).then(data => {
      if (!controller.signal.aborted) { const result = rows(data); setItems(result.items); setTotal(result.total); }
    }).catch(e => {
      if (!controller.signal.aborted) {
        setError(e instanceof Error ? e.message : "No se pudo consultar la información.");
        if (e instanceof ApiError && e.status === 401) { setSession(null); setProfile(null); setAuthError(e.message); }
      }
    }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [session, profile, section, query, status, role, offset, revision, canRead]);

  useEffect(() => {
    if (!change) { previousFocus.current?.focus(); return; }
    previousFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    reasonInput.current?.focus();
  }, [change]);

  const visible = section === "usuarios" ? items : items.filter(row => (!status || str(row.status ?? row.enrollment_status) === status) && (!query || JSON.stringify(row).toLocaleLowerCase().includes(query.toLocaleLowerCase())));
  function navigate(next: Section) { setSection(next); setOffset(0); setSearch(""); setQuery(""); setStatus(""); setRole(""); setNotice(""); }
  function begin(kind: Change["kind"], row: Row, next: string) { setChange({ kind, id: str(row.id), label: kind === "usuario" ? name(row) : `Inscripción ${str(row.id)}`, status: next }); setReason(""); setSync(true); setSaveError(""); }
  async function save(event: FormEvent) {
    event.preventDefault(); if (!change || !session || saving) return;
    setSaving(true); setSaveError("");
    try {
      const saved = readSession();
      if (!saved || saved.accessToken !== session.accessToken) throw new ApiError("La sesión cambió. Recarga el panel.", 401);
      const current = await identity(saved);
      const permission = change.kind === "usuario" ? "users.manage" : "enrollments.authorize";
      if (!current.permissions.includes(permission)) throw new ApiError("Tu cuenta no tiene permiso para realizar este cambio.", 403);
      const body = change.kind === "usuario" ? { status: change.status, ...(reason.trim() ? { reason: reason.trim() } : {}) } : { status: change.status, sync_to_moodle: sync, ...(reason.trim() ? { notes: reason.trim() } : {}) };
      const response = await request(saved, `/${change.kind === "usuario" ? "users" : "enrollments"}/${encodeURIComponent(change.id)}/status`, { method: "PATCH", body: JSON.stringify(body) });
      const moodle = record(response) && record(response.moodle_sync) ? response.moodle_sync : null;
      setNotice(moodle && (moodle.success === false || moodle.status === "error" || moodle.status === "error_sincronizacion") ? "El cambio se guardó, pero Moodle reportó un problema de sincronización. Revisa su estado antes de reintentar." : "La API confirmó el cambio. La lista se actualizará con el estado actual.");
      setChange(null); setRevision(x => x + 1);
    } catch (e) {
      setSaveError(e instanceof ApiError && e.status === 0 ? `${e.message} No pudimos confirmar el resultado; cancela y actualiza la lista antes de volver a intentar.` : e instanceof Error ? e.message : "No se pudo guardar el cambio.");
      if (e instanceof ApiError && e.status === 401) { setProfile(null); setSession(null); setAuthError(e.message); setChange(null); }
    } finally { setSaving(false); }
  }
  function logout() { try { sessionStorage.removeItem(SESSION_KEY); } catch {} window.location.assign("/"); }

  if (checking) return <section className={styles.gate} aria-live="polite"><span className={styles.eyebrow}>IINICIA · Administración</span><h1>Verificando tu sesión…</h1></section>;
  if (!profile || !session) return <section className={styles.gate}><span className={styles.eyebrow}>IINICIA · Administración</span><h1>Acceso al panel</h1><p role="alert">{authError}</p><Link href="/" className={styles.primary}>Ir a iniciar sesión</Link><button className={styles.secondary} onClick={() => window.location.reload()}>Reintentar verificación</button></section>;

  return <section className={styles.shell}>
    <aside className={styles.sidebar}>
      <Link href="/" className={styles.brand}>I² <span>IINICIA<small>Gestión académica</small></span></Link>
      <p className={styles.eyebrow}>Administración</p>
      <nav aria-label="Panel administrativo">{(["usuarios", "inscripciones", "cursos"] as Section[]).map((s, i) => <button key={s} aria-current={section === s ? "page" : undefined} onClick={() => navigate(s)}><span>0{i + 1}</span>{s[0].toUpperCase() + s.slice(1)}</button>)}</nav>
      <div className={styles.account}><strong>{profile.first_name} {profile.last_name}</strong><small>{profile.email}</small><Badge value={profile.roles.includes("superadministrador") ? "superadministrador" : "administrador"} /><button className={styles.secondary} onClick={logout}>Cerrar sesión</button></div>
    </aside>
    <div className={styles.content}>
      <header className={styles.heading}><div><span className={styles.eyebrow}>Portal institucional / Administración</span><h1>{section === "usuarios" ? "Comunidad IINICIA" : section === "inscripciones" ? "Inscripciones" : "Catálogo de cursos"}</h1><p>{section === "usuarios" ? "Consulta perfiles y administra el estado de las cuentas." : section === "inscripciones" ? "Revisa solicitudes y gestiona el acceso académico." : "Consulta los cursos registrados en el portal y su vinculación con el campus."}</p></div><div className={styles.actions}><button className={styles.secondary} onClick={toggleTheme}>{theme === "dark" ? "Tema claro" : "Tema oscuro"}</button><button className={styles.secondary} disabled={loading} onClick={() => setRevision(x => x + 1)}>↻ Actualizar</button><button className={styles.secondary} onClick={logout}>Salir</button></div></header>
      <div className={styles.stats}><article><span>{section === "usuarios" ? "Usuarios en esta página" : "Registros recibidos"}</span><strong>{loading ? "…" : error || !canRead ? "—" : items.length}</strong></article><article><span>{section === "usuarios" ? "Total informado por la API" : "Coincidencias del filtro"}</span><strong>{loading ? "…" : error || !canRead ? "—" : section === "usuarios" ? total ?? "—" : visible.length}</strong></article><article><span>Tu acceso</span><strong className={styles.access}>Administrador</strong><small>Permisos verificados con la API</small></article></div>
      {notice && <p role="status" className={styles.success}>{notice}</p>}
      {!canRead ? <p className={styles.error}>Tu cuenta no tiene el permiso users.read para consultar usuarios.</p> : <div className={styles.panel}>
        <form className={styles.filters} onSubmit={e => { e.preventDefault(); setQuery(search.trim()); setOffset(0); }}>
          <label>Buscar<input value={search} onChange={e => setSearch(e.target.value)} placeholder={section === "usuarios" ? "Nombre o correo electrónico" : "Buscar en los registros recibidos"} /></label>
          {section !== "cursos" && <label>Estado<select value={status} onChange={e => { setStatus(e.target.value); setOffset(0); }}><option value="">Todos los estados</option>{(section === "usuarios" ? statuses : enrollmentStatuses).map(s => <option key={s} value={s}>{s.replaceAll("_", " ")}</option>)}</select></label>}
          {section === "usuarios" && <label>Rol<select value={role} onChange={e => { setRole(e.target.value); setOffset(0); }}><option value="">Todos los roles</option>{roleNames.map(r => <option key={r}>{r}</option>)}</select></label>}
          <button className={styles.primary}>Buscar</button>
        </form>
        {loading ? <p className={styles.empty} role="status">Consultando información…</p> : error ? <div className={styles.error} role="alert">{error} <button className={styles.secondary} onClick={() => setRevision(x => x + 1)}>Reintentar</button></div> : visible.length === 0 ? <p className={styles.empty}>No hay registros para mostrar con estos filtros.</p> : <div className={styles.tableWrap}><table><thead><tr>{(section === "usuarios" ? ["Usuario", "Estado", "Roles", "Campus", "Acciones"] : section === "inscripciones" ? ["Solicitud / usuario", "Curso", "Estado", "Fecha", "Acciones"] : ["Curso", "Código", "Moodle", "Estado"]).map(h => <th key={h}>{h}</th>)}</tr></thead><tbody>{visible.map((row, index) => <tr key={str(row.id ?? row.course_id) || index}>
          {section === "usuarios" ? <><td><strong>{name(row)}</strong><small>{str(row.email)}</small></td><td><Badge value={row.status} /></td><td>{Array.isArray(row.roles) ? row.roles.map(r => typeof r === "string" ? r : record(r) ? str(r.slug ?? r.name) : "").filter(Boolean).join(", ") || "Sin roles informados" : "Sin información"}</td><td><Badge value={row.moodle_sync_status ?? (row.moodle_user_id ? "vinculado" : "Sin información")} /></td><td>{canManageUsers && !!str(row.id) && row.id !== profile.id ? <select aria-label={`Cambiar estado de ${name(row)}`} value="" onChange={e => { if (e.target.value) begin("usuario", row, e.target.value); }}><option value="">Cambiar estado…</option>{statuses.filter(s => s !== row.status).map(s => <option key={s}>{s}</option>)}</select> : row.id === profile.id ? "Tu cuenta" : "Solo consulta"}</td></> : section === "inscripciones" ? <><td><strong>{name(nested(row, "profiles")) || name(nested(row, "user")) || str(row.user_id) || "Sin usuario informado"}</strong><small>{str(row.id)}</small></td><td>{courseName(Object.keys(nested(row, "course_mappings")).length ? nested(row, "course_mappings") : row)}</td><td><Badge value={row.status ?? row.enrollment_status} /><small>{str(row.moodle_sync_status).replaceAll("_", " ")}</small></td><td>{date(row.created_at)}</td><td>{canAuthorize && !!str(row.id) ? <select aria-label={`Gestionar inscripción ${str(row.id)}`} value="" onChange={e => { if (e.target.value) begin("inscripcion", row, e.target.value); }}><option value="">Gestionar…</option>{["autorizada", "rechazada", "pendiente", "desmatriculada"].filter(s => s !== row.status).map(s => <option key={s}>{s}</option>)}</select> : "Solo consulta"}</td></> : <><td><strong>{courseName(row)}</strong><small>{str(row.id ?? row.course_id)}</small></td><td>{str(row.portal_course_code ?? row.code) || "—"}</td><td>{str(row.moodle_shortname) || "—"}<small>ID: {str(row.moodle_course_id) || "—"}</small></td><td><Badge value={typeof row.is_active === "boolean" ? row.is_active ? "activo" : "inactivo" : row.status} /></td></>}
        </tr>)}</tbody></table></div>}
        {section === "usuarios" && <div className={styles.pagination}><span>Página {Math.floor(offset / 20) + 1} · hasta 20 usuarios por página</span><button className={styles.secondary} disabled={loading || offset === 0} onClick={() => setOffset(x => Math.max(0, x - 20))}>Anterior</button><button className={styles.secondary} disabled={loading || !!error || (total !== null ? offset + 20 >= total : items.length < 20)} onClick={() => setOffset(x => x + 20)}>Siguiente</button></div>}
      </div>}
      <p className={styles.footnote}>Los cambios de cuentas e inscripciones pueden afectar el acceso al campus. Revisa el destinatario antes de confirmar.</p>
    </div>
    {change && <div className={styles.overlay} onKeyDown={e => {
      if (e.key === "Escape" && !saving) setChange(null);
      if (e.key === "Tab") { const nodes = e.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled), textarea, input'); const first = nodes[0]; const last = nodes[nodes.length - 1]; if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last?.focus(); } else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus(); } }
    }}><form className={styles.dialog} role="dialog" aria-modal="true" aria-labelledby="admin-confirm-title" onSubmit={save}><span className={styles.eyebrow}>Confirmar operación</span><h2 id="admin-confirm-title">Cambiar a {change.status}</h2><p>{change.label}</p><p>{change.kind === "usuario" ? "Este cambio puede activar o revocar el acceso de la cuenta y actualizar su estado en Moodle." : "Este cambio modifica el estado de la inscripción del usuario."}</p><label>Motivo o notas<textarea ref={reasonInput} value={reason} maxLength={1000} onChange={e => setReason(e.target.value)} disabled={saving} /></label>{change.kind === "inscripcion" && <label className={styles.checkbox}><input type="checkbox" checked={sync} onChange={e => setSync(e.target.checked)} disabled={saving} />Solicitar sincronización con Moodle</label>}{saveError && <p role="alert" className={styles.error}>{saveError}</p>}<div className={styles.actions}><button type="button" className={styles.secondary} disabled={saving} onClick={() => setChange(null)}>Cancelar</button><button className={styles.primary} disabled={saving}>{saving ? "Guardando…" : "Confirmar cambio"}</button></div></form></div>}
  </section>;
}
