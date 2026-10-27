'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { IconAlertTriangle, IconCheck } from '@/components/campus-tech/Icons';

export default function LoginPage() {
  const router = useRouter();
  const { login, getDefaultDashboardPath } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const user = await login(email, password);
      const target = getDefaultDashboardPath(user.roles);
      router.push(target);
    } catch (err: any) {
      setError(err.message || 'Credenciales inválidas. Verifica tu correo y contraseña.');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickLogin = (demoEmail: string, demoPass: string) => {
    setEmail(demoEmail);
    setPassword(demoPass);
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
            Iniciar sesión
          </h1>
          <p className="mt-1 text-xs text-muted">
            Ingresa tus credenciales para acceder al portal universitario y aulas virtuales
          </p>
        </div>

        {error && (
          <div className="rounded-[8px] border border-danger/30 bg-danger/10 p-3.5 text-xs font-medium text-danger flex items-center gap-2">
            <IconAlertTriangle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
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
            className="w-full rounded-[6px] bg-primary py-2.5 text-xs font-semibold text-white shadow-minimal hover:bg-primary/90 transition-all disabled:cursor-not-allowed disabled:opacity-50 active:scale-[0.98]"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                <span>Validando credenciales...</span>
              </span>
            ) : (
              'Entrar al Campus'
            )}
          </button>
        </form>

        {/* Demo Fast Fill Buttons for Testing & Grading */}
        <div className="border-t border-border pt-4">
          <p className="text-center text-[11px] font-mono uppercase tracking-wider text-muted">
            Acceso rápido para verificación:
          </p>
          <div className="mt-2.5 grid grid-cols-2 gap-2 sm:grid-cols-3">
            <button
              type="button"
              onClick={() => handleQuickLogin('admin@iinicia.org', 'Admin.2026!')}
              className="rounded-[6px] border border-border bg-surface-muted/40 px-2 py-1.5 text-[11px] font-medium text-foreground hover:border-primary hover:text-primary transition-all text-center"
              title="admin@iinicia.org / Admin.2026!"
            >
              Superadmin
            </button>
            <button
              type="button"
              onClick={() => handleQuickLogin('aram@iinicia.org', '123456789')}
              className="rounded-[6px] border border-border bg-surface-muted/40 px-2 py-1.5 text-[11px] font-medium text-foreground hover:border-primary hover:text-primary transition-all text-center"
              title="aram@iinicia.org / 123456789"
            >
              Superadmin (Aram)
            </button>
            <button
              type="button"
              onClick={() => handleQuickLogin('profesor@iinicia.org', 'Docente.2026!')}
              className="rounded-[6px] border border-border bg-surface-muted/40 px-2 py-1.5 text-[11px] font-medium text-foreground hover:border-primary hover:text-primary transition-all text-center"
              title="profesor@iinicia.org / Docente.2026!"
            >
              Profesor
            </button>
            <button
              type="button"
              onClick={() => handleQuickLogin('estudiante1@iinicia.org', 'Alumno.2026!')}
              className="rounded-[6px] border border-border bg-surface-muted/40 px-2 py-1.5 text-[11px] font-medium text-foreground hover:border-primary hover:text-primary transition-all text-center"
              title="estudiante1@iinicia.org / Alumno.2026!"
            >
              Estudiante
            </button>
            <button
              type="button"
              onClick={() => handleQuickLogin('user3@yopmail.com', '123456789')}
              className="rounded-[6px] border border-border bg-surface-muted/40 px-2 py-1.5 text-[11px] font-medium text-foreground hover:border-primary hover:text-primary transition-all text-center"
              title="user3@yopmail.com / 123456789"
            >
              Aspirante
            </button>
          </div>
          <div className="mt-2.5 rounded-[6px] bg-surface-muted/40 border border-border p-2 text-center text-[10px] font-mono text-muted space-y-0.5">
            <div><strong>admin@iinicia.org</strong>: <code>Admin.2026!</code></div>
            <div><strong>aram@iinicia.org</strong>: <code>123456789</code></div>
          </div>
        </div>

        <div className="text-center text-xs text-muted">
          ¿No tienes una cuenta aún?{' '}
          <Link href="/registro" className="font-semibold text-primary hover:underline">
            Crear cuenta de aspirante
          </Link>
        </div>
      </div>
    </div>
  );
}
