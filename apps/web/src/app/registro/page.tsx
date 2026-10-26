'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';

export default function RegistroPage() {
  const router = useRouter();
  const { register } = useAuth();

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      await register({
        first_name: firstName,
        last_name: lastName,
        phone: phone || undefined,
        email,
        password,
      });

      // Registro exitoso, redirigir al portal de aspirante
      router.push('/dashboard/aspirante');
    } catch (err: any) {
      setError(err.message || 'No fue posible completar el registro. Verifica los datos.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-[calc(100vh-120px)] items-center justify-center px-4 py-12 sm:px-6 lg:px-8">
      {/* Background ambient glow */}
      <div className="pointer-events-none absolute inset-0 -z-10 bg-aurora opacity-70" />

      <div className="w-full max-w-lg space-y-8 rounded-3xl border border-border/80 bg-background/80 p-8 shadow-2xl backdrop-blur-xl sm:p-10">
        <div className="text-center">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-accent">
            Admisiones IINICIA
          </p>
          <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-foreground">
            Crear cuenta de aspirante
          </h1>
          <p className="mt-2 text-sm text-foreground/70">
            Regístrate para solicitar tu ingreso a cursos, certificaciones y diplomados
          </p>
        </div>

        {error && (
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-400">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-foreground/80">
                Nombre(s)
              </label>
              <input
                type="text"
                required
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="Juan Carlos"
                className="mt-1.5 w-full rounded-xl border border-border bg-foreground/5 px-4 py-3 text-sm text-foreground placeholder-foreground/40 transition-colors focus:border-accent focus:bg-background focus:outline-none focus:ring-1 focus:ring-accent"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-foreground/80">
                Apellido(s)
              </label>
              <input
                type="text"
                required
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="Pérez López"
                className="mt-1.5 w-full rounded-xl border border-border bg-foreground/5 px-4 py-3 text-sm text-foreground placeholder-foreground/40 transition-colors focus:border-accent focus:bg-background focus:outline-none focus:ring-1 focus:ring-accent"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-foreground/80">
              Teléfono / WhatsApp (Opcional)
            </label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="5512345678"
              className="mt-1.5 w-full rounded-xl border border-border bg-foreground/5 px-4 py-3 text-sm text-foreground placeholder-foreground/40 transition-colors focus:border-accent focus:bg-background focus:outline-none focus:ring-1 focus:ring-accent"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-foreground/80">
              Correo Electrónico
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="tu.correo@ejemplo.com"
              className="mt-1.5 w-full rounded-xl border border-border bg-foreground/5 px-4 py-3 text-sm text-foreground placeholder-foreground/40 transition-colors focus:border-accent focus:bg-background focus:outline-none focus:ring-1 focus:ring-accent"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-foreground/80">
              Contraseña
            </label>
            <input
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Mínimo 8 caracteres"
              className="mt-1.5 w-full rounded-xl border border-border bg-foreground/5 px-4 py-3 text-sm text-foreground placeholder-foreground/40 transition-colors focus:border-accent focus:bg-background focus:outline-none focus:ring-1 focus:ring-accent"
            />
            <p className="mt-1 text-[11px] text-foreground/50">
              Debe contener al menos 8 caracteres para proteger tu cuenta.
            </p>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="mt-2 w-full rounded-xl bg-accent px-4 py-3.5 text-sm font-semibold text-white shadow-lg shadow-accent/25 transition-all hover:bg-accent-strong hover:shadow-accent/40 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                Registrando aspirante...
              </span>
            ) : (
              'Registrarse como Aspirante'
            )}
          </button>
        </form>

        <div className="text-center text-xs text-foreground/70">
          ¿Ya tienes cuenta en IINICIA?{' '}
          <Link href="/login" className="font-semibold text-accent hover:underline">
            Inicia sesión aquí
          </Link>
        </div>
      </div>
    </div>
  );
}
