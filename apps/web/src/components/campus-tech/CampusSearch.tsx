/** Filtra las acciones del panel suministradas por la vista y permite saltar a la pestaña elegida. */
'use client';

import { useEffect, useRef, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { usersApi } from '@/lib/api';

export interface CampusSearchItem {
  id: string;
  title: string;
  detail?: string;
  section: string;
  tab?: string;
}

export function CampusSearch({ open, onClose, items, onSelectTab }: {
  open: boolean;
  onClose: () => void;
  items: CampusSearchItem[];
  onSelectTab: (tab: string) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const { hasPermission } = useAuth();
  // La consulta de usuarios solo se habilita en la interfaz para sesiones con el permiso correspondiente.
  const canReadUsers = hasPermission('users.read');
  const [query, setQuery] = useState('');
  const [users, setUsers] = useState<CampusSearchItem[]>([]);
  const [status, setStatus] = useState('');
  useEffect(() => {
    if (open) dialog.current?.showModal();
    else dialog.current?.close();
  }, [open]);
  useEffect(() => {
    if (!open || !canReadUsers || !query.trim()) return;
    let current = true;
    const timer = setTimeout(() => {
      setStatus('Buscando usuarios…');
      setUsers([]);
      usersApi.getUsers({ search: query.trim(), limit: 20 }).then((result) => {
        if (!current) return;
        setUsers(result.data.map((person) => ({
          id: person.id, title: [person.first_name, person.last_name].join(' '),
          detail: person.email + ' · ' + person.status, section: 'Usuarios',
        })));
        setStatus(result.meta?.hasMore ? 'Hay más usuarios. Escribe un nombre o correo más específico.' : '');
      }).catch(() => { if (current) setStatus('No fue posible buscar usuarios. Cambia la consulta para reintentar.'); });
    }, 300);
    return () => { current = false; clearTimeout(timer); };
  }, [query, open, canReadUsers]);
  // Compara términos sin distinguir mayúsculas ni acentos.
  const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const words = normalize(query).trim().split(/\s+/);
  const matches = query.trim() ? items.filter((item) => words.every((word) =>
    normalize([item.title, item.detail, item.id].join(' ')).includes(word))) : [];
  const results = [...matches, ...(query.trim() ? users : [])];
  return (
    <dialog ref={dialog} onCancel={onClose} onClose={onClose} aria-labelledby="campus-search-title"
      className="m-auto w-[min(95vw,42rem)] rounded-3xl border border-border bg-surface p-5 text-foreground shadow-xl backdrop:bg-black/50">
      <div className="flex items-center justify-between gap-4">
        <h2 id="campus-search-title" className="font-semibold">Buscar en mi panel</h2>
        <button type="button" onClick={onClose} className="min-h-10 rounded-full border border-border px-4 text-sm text-primary hover:bg-accent-soft">Cerrar</button>
      </div>
      <label className="mt-4 block text-sm">Nombre, correo, programa o código
        <input autoFocus type="search" value={query} onChange={(event) => {
          setQuery(event.target.value); setUsers([]); setStatus('');
        }} className="mt-2 w-full rounded-xl border border-border bg-surface-muted p-3" />
      </label>
      <p className="mt-2 text-xs text-muted">Cursos y solicitudes cargados en tu panel{canReadUsers ? ', y usuarios consultados en el directorio autorizado' : ''}.</p>
      <div aria-live="polite" className="mt-3 text-sm">{status}</div>
      <div className="mt-3 max-h-[55vh] overflow-y-auto">
        {!query.trim() ? <p>Escribe para buscar.</p> : results.length === 0 && !status ? <p>Sin coincidencias.</p> : null}
        <ul className="space-y-2">
          {results.slice(0, 50).map((item) => (
            <li key={item.section + item.id} className="rounded border border-border p-3">
              <p className="text-xs text-muted">{item.section}</p>
              <p className="font-medium">{item.title}</p>
              <p className="break-words text-sm text-muted">{item.detail}</p>
              {item.tab && <button type="button" onClick={() => { onSelectTab(item.tab!); onClose(); }}
                className="mt-2 text-sm text-primary underline">Ver sección</button>}
            </li>
          ))}
        </ul>
        {results.length > 50 && <p className="mt-2 text-sm">Mostrando 50 coincidencias. Afina tu búsqueda.</p>}
      </div>
    </dialog>
  );
}
