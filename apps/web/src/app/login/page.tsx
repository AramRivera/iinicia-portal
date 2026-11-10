'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { IconAlertTriangle } from '@/components/campus-tech/Icons';
import { ApiError } from '@/lib/api';
import type { LoginResponse } from '@/types';

type DemoAccount = { label: string; email: string; password: string };

function readDemoAccounts(value: string | undefined): DemoAccount[] {
  if (!value) return [];
  try {
    const accounts: unknown = JSON.parse(value);
    if (!Array.isArray(accounts)) return [];
    return accounts.filter((account: unknown): account is DemoAccount => {
      if (typeof account !== 'object' || account === null) return false;
      const { label, email, password } = account as Partial<DemoAccount>;
      return typeof label === 'string' && !!label.trim() &&
        typeof email === 'string' && !!email.trim() &&
        typeof password === 'string' && !!password;
    });
  } catch {
    return [];
  }
}

const demoAccounts = process.env.NODE_ENV === 'development'
  ? readDemoAccounts(process.env.NEXT_PUBLIC_DEMO_ACCOUNTS)
  : [];

export default function LoginPage() {
  const router = useRouter();
  const { login, verifyLoginMfa, getDefaultDashboardPath } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mfa, setMfa] = useState<LoginResponse | null>(null);
  const [factorId, setFactorId] = useState('');
  const [code, setCode] = useState('');

  const resetMfa = () => {
    setMfa(null);
    setFactorId('');
    setCode('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (mfa) {
        const user = await verifyLoginMfa(mfa.mfa_token, factorId, code);
        resetMfa();
        router.replace(getDefaultDashboardPath(user.roles));
      } else {
        const nextStep = await login(email, password);
        setPassword('');
        setFactorId(nextStep.step === 'setup' ? nextStep.factor_id : nextStep.factors[0]?.id ?? '');
        setMfa(nextStep);
      }
    } catch (err) {
      if (mfa && err instanceof ApiError && (err.statusCode === 401 || err.statusCode === 403)) {
        resetMfa();
      }
      setCode('');
      setError(err instanceof Error ? err.message : 'No fue posible iniciar sesión.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-[calc(100vh-140px)] items-center justify-center px-4 py-12 sm:px-6 lg:px-8">
      <div className="w-full max-w-md space-y-6 rounded-[14px] border border-border bg-surface p-7 sm:p-9 shadow-minimal">
        <div className="text-center">
          <div className="inline-flex items-center gap-1.5 rounded-[4px] bg-primary/10 px-2.5 py-1 text-[11px] font-mono font-semibold text-primary border border-primary/20">
            <span className="h-1.5 w-1.5 rounded-full bg-accent-lime" />
            <span>Campus Virtual • Autenticación</span>
          </div>
          <h1 className="mt-3 text-2xl font-bold tracking-tight text-foreground">
            {mfa ? 'Verificación en dos pasos' : 'Iniciar sesión'}
          </h1>
          <p className="mt-1 text-xs text-muted">
            {mfa?.step === 'setup'
              ? 'Vincula una app autenticadora para proteger tu cuenta.'
              : mfa
                ? 'Ingresa el código de seis dígitos de tu app autenticadora.'
                : 'Ingresa tus credenciales para acceder al portal universitario y aulas virtuales.'}
          </p>
        </div>

        {error && (
          <div role="alert" className="rounded-[8px] border border-danger/30 bg-danger/10 p-3.5 text-xs font-medium text-danger flex items-center gap-2">
            <IconAlertTriangle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {mfa ? (
          <form onSubmit={handleSubmit} className="space-y-4">
            {mfa.step === 'setup' && (
              <div className="space-y-2 rounded-md border border-border p-3 text-xs text-foreground">
                <p>Escanea el código QR o introduce la clave manualmente en tu app.</p>
                {mfa.qr_code && (
                  <Image src={mfa.qr_code} alt="Código QR para configurar el autenticador de IINICIA" width={160} height={160} unoptimized className="mx-auto rounded bg-white p-2" />
                )}
                <p>Clave de configuración</p>
                <code className="block break-all select-all font-mono">{mfa.secret}</code>
              </div>
            )}
            {mfa.step === 'verify' && mfa.factors.length > 1 && (
              <div className="space-y-1">
                <label htmlFor="mfa-factor" className="block text-xs font-medium">Autenticador</label>
                <select id="mfa-factor" value={factorId} onChange={(e) => setFactorId(e.target.value)} disabled={loading} className="w-full rounded-md border border-border bg-surface p-2 text-sm">
                  {mfa.factors.map((factor, index) => (
                    <option key={factor.id} value={factor.id}>{factor.name || `Autenticador ${index + 1}`}</option>
                  ))}
                </select>
              </div>
            )}
            <div className="space-y-1">
              <label htmlFor="mfa-code" className="block text-xs font-medium">Código del autenticador</label>
              <input id="mfa-code" type="text" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} className="w-full rounded-md border border-border bg-surface-muted/40 px-3.5 py-2.5 text-sm focus:border-primary" />
            </div>
            <button type="submit" disabled={loading || code.length !== 6 || !factorId} className="w-full rounded-md bg-primary-action py-2.5 text-xs font-semibold text-white disabled:opacity-50">
              {loading ? 'Verificando…' : 'Verificar código'}
            </button>
            <button type="button" disabled={loading} onClick={() => { resetMfa(); setError(null); }} className="w-full text-xs font-medium text-muted hover:text-primary disabled:opacity-50">
              Volver al inicio de sesión
            </button>
          </form>
        ) : <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-foreground mb-1.5">
              Correo Electrónico
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="tu.correo@iinicia.org"
              className="w-full rounded-[6px] border border-border bg-surface-muted/40 px-3.5 py-2.5 text-xs text-foreground placeholder:text-muted focus:border-primary focus:bg-surface focus:outline-none transition-all"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-medium text-foreground">
                Contraseña
              </label>
              <Link
                href="/recuperar-password"
                className="text-[11px] text-muted hover:text-primary transition-colors"
              >
                ¿Olvidaste tu contraseña?
              </Link>
            </div>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full rounded-[6px] border border-border bg-surface-muted/40 px-3.5 py-2.5 text-xs text-foreground placeholder:text-muted focus:border-primary focus:bg-surface focus:outline-none transition-all"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-[6px] bg-primary-action py-2.5 text-xs font-semibold text-white shadow-minimal hover:bg-primary-action/90 transition-all disabled:cursor-not-allowed disabled:opacity-50 active:scale-[0.98]"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                <span>Validando credenciales...</span>
              </span>
            ) : (
              'Continuar'
            )}
          </button>
        </form>}

        {!mfa && demoAccounts.length > 0 && (
          <section aria-label="Accesos rápidos de prueba" className="space-y-2 border-t border-border pt-4">
            <p className="text-center text-xs text-muted">Accesos rápidos de prueba</p>
            <div className="flex flex-wrap justify-center gap-2">
              {demoAccounts.map(({ label, email: demoEmail, password: demoPassword }) => (
                <button
                  key={demoEmail}
                  type="button"
                  disabled={loading}
                  onClick={() => {
                    setEmail(demoEmail);
                    setPassword(demoPassword);
                    setError(null);
                  }}
                  className="rounded-md border border-border bg-surface-muted px-3 py-2 text-xs font-medium hover:border-primary hover:text-primary disabled:opacity-50"
                >
                  {label}
                </button>
              ))}
            </div>
          </section>
        )}

        {!mfa && <div className="text-center text-xs text-muted">
          ¿No tienes una cuenta aún?{' '}
          <Link href="/registro" className="font-semibold text-primary hover:underline">
            Crear cuenta de aspirante
          </Link>
        </div>}
      </div>
    </div>
  );
}
