'use client';

import { useEffect, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { authApi } from '@/lib/api';

export default function RestablecerPasswordPage() {
  const [token, setToken] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.hash.slice(1));
    if (params.get('type') === 'recovery' && params.get('access_token')) {
      const recoveryToken = params.get('access_token')!;
      queueMicrotask(() => setToken(recoveryToken));
      window.history.replaceState(null, '', window.location.pathname);
    }
  }, []);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (password !== confirm) { setError('Las contraseñas no coinciden.'); return; }
    setLoading(true);
    setError(null);
    try {
      await authApi.resetPassword(token, password);
      setDone(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'No fue posible cambiar la contraseña.');
    } finally { setLoading(false); }
  };

  return (
    <main className="mx-auto flex min-h-[70vh] max-w-md flex-col justify-center px-4 py-12 text-foreground">
      <div className="rounded-xl border border-border bg-surface p-7 shadow-minimal">
        <h1 className="text-2xl font-bold">Restablecer contraseña</h1>
        {done ? (
          <div className="mt-5 space-y-4 text-sm"><p>Tu contraseña se actualizó. Ya puedes iniciar sesión.</p><Link className="font-semibold text-primary underline" href="/login">Ir al inicio de sesión</Link></div>
        ) : token ? (
          <form onSubmit={submit} className="mt-5 space-y-4">
            <label className="block text-sm">Nueva contraseña<input type="password" autoComplete="new-password" minLength={8} required value={password} onChange={(e) => setPassword(e.target.value)} className="mt-1 w-full rounded-md border border-border bg-surface px-3 py-2" /></label>
            <label className="block text-sm">Confirmar contraseña<input type="password" autoComplete="new-password" minLength={8} required value={confirm} onChange={(e) => setConfirm(e.target.value)} className="mt-1 w-full rounded-md border border-border bg-surface px-3 py-2" /></label>
            {error && <p role="alert" className="text-sm text-danger">{error}</p>}
            <button disabled={loading} className="w-full rounded-md bg-primary-action px-4 py-2 font-semibold text-white disabled:opacity-50">{loading ? 'Guardando...' : 'Guardar contraseña'}</button>
          </form>
        ) : (
          <p className="mt-5 text-sm text-muted">El enlace es inválido o ya caducó. <Link className="font-semibold text-primary underline" href="/recuperar-password">Solicita uno nuevo</Link>.</p>
        )}
      </div>
    </main>
  );
}
