'use client';

import { useEffect, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { ApiError, authApi } from '@/lib/api';
import { clearRecoveryVerifier, readRecoveryVerifier } from '@/lib/recovery-pkce';
import type { LoginResponse } from '@/types';

type RecoveryProof = { token_hash: string } | { auth_code: string; code_verifier: string };

export default function RestablecerPasswordPage() {
  const [proof, setProof] = useState<RecoveryProof | null>(null);
  const [missingVerifier, setMissingVerifier] = useState(false);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mfa, setMfa] = useState<Extract<LoginResponse, { step: 'verify' }> | null>(null);
  const [factorId, setFactorId] = useState('');
  const [code, setCode] = useState('');

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const url = new URL(window.location.href);
      const fragment = new URLSearchParams(url.hash.slice(1));
      const code = url.searchParams.get('code');
      const tokenHash = fragment.get('token_hash');
      if (code) {
        const verifier = readRecoveryVerifier();
        if (verifier) setProof({ auth_code: code, code_verifier: verifier });
        else setMissingVerifier(true);
      } else if (fragment.get('type') === 'recovery' && tokenHash) {
        setProof({ token_hash: tokenHash });
      }
      if (url.search || url.hash) {
        window.history.replaceState(null, '', url.pathname);
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!proof && !mfa) return;
    if (password !== confirm) { setError('Las contraseñas no coinciden.'); return; }
    setLoading(true);
    setError(null);
    try {
      if (mfa) {
        await authApi.verifyRecoveryMfa(mfa.mfa_token, factorId, code, password);
      } else if (proof) {
        const result = await authApi.resetPassword(proof, password);
        if ('code_verifier' in proof) clearRecoveryVerifier(proof.code_verifier);
        setProof(null);
        if ('step' in result) {
          setMfa(result);
          setFactorId(result.factors[0]?.id ?? '');
          return;
        }
      }
      setMfa(null);
      setCode('');
      setPassword('');
      setConfirm('');
      setDone(true);
    } catch (err: unknown) {
      if (mfa && err instanceof ApiError && (err.statusCode === 401 || err.statusCode === 403)) {
        setMfa(null);
        setPassword('');
        setConfirm('');
      }
      setCode('');
      setError(err instanceof Error ? err.message : 'No fue posible cambiar la contraseña.');
    } finally { setLoading(false); }
  };

  return (
    <main className="mx-auto flex min-h-[70vh] max-w-md flex-col justify-center px-4 py-12 text-foreground">
      <div className="rounded-xl border border-border bg-surface p-7 shadow-minimal">
        <h1 className="text-2xl font-bold">Restablecer contraseña</h1>
        {done ? (
          <div className="mt-5 space-y-4 text-sm"><p>Tu contraseña se actualizó. Ya puedes iniciar sesión.</p><Link className="font-semibold text-primary underline" href="/login">Ir al inicio de sesión</Link></div>
        ) : mfa ? (
          <form onSubmit={submit} className="mt-5 space-y-4">
            <p className="text-sm">Ingresa el código de tu app autenticadora para guardar la nueva contraseña.</p>
            {mfa.factors.length > 1 && (
              <label className="block text-sm">Autenticador
                <select value={factorId} onChange={(e) => setFactorId(e.target.value)} disabled={loading} className="mt-1 w-full rounded-md border border-border bg-surface px-3 py-2">
                  {mfa.factors.map((factor, index) => (
                    <option key={factor.id} value={factor.id}>{factor.name || `Autenticador ${index + 1}`}</option>
                  ))}
                </select>
              </label>
            )}
            <label className="block text-sm">Código del autenticador
              <input type="text" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} className="mt-1 w-full rounded-md border border-border bg-surface px-3 py-2" />
            </label>
            {error && <p role="alert" className="text-sm text-danger">{error}</p>}
            <button disabled={loading || code.length !== 6 || !factorId} className="w-full rounded-md bg-primary-action px-4 py-2 font-semibold text-white disabled:opacity-50">{loading ? 'Verificando…' : 'Verificar y guardar contraseña'}</button>
            <Link className="text-sm font-semibold text-primary underline" href="/recuperar-password">Solicitar otro enlace</Link>
          </form>
        ) : proof ? (
          <form onSubmit={submit} className="mt-5 space-y-4">
            <label className="block text-sm">Nueva contraseña<input type="password" autoComplete="new-password" minLength={8} required value={password} onChange={(e) => setPassword(e.target.value)} className="mt-1 w-full rounded-md border border-border bg-surface px-3 py-2" /></label>
            <label className="block text-sm">Confirmar contraseña<input type="password" autoComplete="new-password" minLength={8} required value={confirm} onChange={(e) => setConfirm(e.target.value)} className="mt-1 w-full rounded-md border border-border bg-surface px-3 py-2" /></label>
            {error && <p role="alert" className="text-sm text-danger">{error}</p>}
            <button disabled={loading} className="w-full rounded-md bg-primary-action px-4 py-2 font-semibold text-white disabled:opacity-50">{loading ? 'Guardando...' : 'Guardar contraseña'}</button>
          </form>
        ) : (
          <p className="mt-5 text-sm text-muted">{missingVerifier ? 'Abre el enlace en el navegador donde pediste la recuperación.' : 'El enlace es inválido o ya caducó.'} <Link className="font-semibold text-primary underline" href="/recuperar-password">Solicita uno nuevo</Link>.</p>
        )}
      </div>
    </main>
  );
}
