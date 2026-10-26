'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';

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
    <div className="relative flex min-h-[calc(100vh-120px)] items-center justify-center px-4 py-12 sm:px-6 lg:px-8">
      {/* Background ambient glow */}
      <div className="pointer-events-none absolute inset-0 -z-10 bg-aurora opacity-70" />

      <div className="w-full max-w-md space-y-8 rounded-3xl border border-border/80 bg-background/80 p-8 shadow-2xl backdrop-blur-xl sm:p-10">
        <div className="text-center">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-accent">
            Campus Virtual IINICIA
          </p>
          <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-foreground">
            Iniciar sesión
          </h1>
          <p className="mt-2 text-sm text-foreground/70">
            Ingresa tus credenciales para acceder a tus cursos y aula virtual
          </p>
        </div>

        {error && (
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-400">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-6 space-y-5">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-foreground/80">
              Correo Electrónico
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="tu.correo@iinicia.org"
              className="mt-1.5 w-full rounded-xl border border-border bg-foreground/5 px-4 py-3 text-sm text-foreground placeholder-foreground/40 transition-colors focus:border-accent focus:bg-background focus:outline-none focus:ring-1 focus:ring-accent"
            />
          </div>

          <div>
            <div className="flex items-center justify-between">
              <label className="block text-xs font-semibold uppercase tracking-wider text-foreground/80">
                Contraseña
              </label>
            </div>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="mt-1.5 w-full rounded-xl border border-border bg-foreground/5 px-4 py-3 text-sm text-foreground placeholder-foreground/40 transition-colors focus:border-accent focus:bg-background focus:outline-none focus:ring-1 focus:ring-accent"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-accent px-4 py-3.5 text-sm font-semibold text-white shadow-lg shadow-accent/25 transition-all hover:bg-accent-strong hover:shadow-accent/40 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                Ingresando al sistema...
              </span>
            ) : (
              'Entrar al Campus'
            )}
          </button>
        </form>

        {/* Demo Fast Fill Buttons for Testing & Grading */}
        <div className="border-t border-border/80 pt-6">
          <p className="text-center text-xs font-medium text-foreground/60">
            Acceso rápido para pruebas:
          </p>
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
            <button
              type="button"
              onClick={() => handleQuickLogin('admin@iinicia.org', 'Admin.2026!')}
              className="rounded-lg border border-border bg-foreground/5 px-2 py-2 text-xs font-medium text-foreground/80 hover:border-accent hover:text-accent transition-colors text-center"
              title="admin@iinicia.org / Admin.2026!"
            >
              Superadmin (Admin)
            </button>
            <button
              type="button"
              onClick={() => handleQuickLogin('aram@iinicia.org', '123456789')}
              className="rounded-lg border border-border bg-foreground/5 px-2 py-2 text-xs font-medium text-foreground/80 hover:border-accent hover:text-accent transition-colors text-center"
              title="aram@iinicia.org / 123456789"
            >
              Superadmin (Aram)
            </button>
            <button
              type="button"
              onClick={() => handleQuickLogin('profesor@iinicia.org', 'Docente.2026!')}
              className="rounded-lg border border-border bg-foreground/5 px-2 py-2 text-xs font-medium text-foreground/80 hover:border-accent hover:text-accent transition-colors text-center"
              title="profesor@iinicia.org / Docente.2026!"
            >
              Profesor
            </button>
            <button
              type="button"
              onClick={() => handleQuickLogin('estudiante1@iinicia.org', 'Alumno.2026!')}
              className="rounded-lg border border-border bg-foreground/5 px-2 py-2 text-xs font-medium text-foreground/80 hover:border-accent hover:text-accent transition-colors text-center"
              title="estudiante1@iinicia.org / Alumno.2026!"
            >
              Estudiante
            </button>
            <button
              type="button"
              onClick={() => handleQuickLogin('user3@yopmail.com', '123456789')}
              className="rounded-lg border border-border bg-foreground/5 px-2 py-2 text-xs font-medium text-foreground/80 hover:border-accent hover:text-accent transition-colors text-center"
              title="user3@yopmail.com / 123456789"
            >
              Aspirante
            </button>
          </div>
          <div className="mt-3 rounded-lg bg-foreground/5 p-2 text-center text-[11px] text-foreground/60 space-y-0.5">
            <div><strong>admin@iinicia.org</strong>: <code>Admin.2026!</code></div>
            <div><strong>aram@iinicia.org</strong>: <code>123456789</code></div>
          </div>
        </div>

        <div className="text-center text-xs text-foreground/70">
          ¿No tienes una cuenta aún?{' '}
          <Link href="/registro" className="font-semibold text-accent hover:underline">
            Crear cuenta de aspirante
          </Link>
        </div>
      </div>
    </div>
  );
}
