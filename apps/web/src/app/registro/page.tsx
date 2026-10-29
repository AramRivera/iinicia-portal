'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { IconAlertTriangle } from '@/components/campus-tech/Icons';

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
    <div className="relative flex min-h-[calc(100vh-140px)] items-center justify-center px-4 py-12 sm:px-6 lg:px-8">
      <div className="w-full max-w-lg space-y-6 rounded-[14px] border border-border bg-surface p-7 sm:p-9 shadow-minimal">
        <div className="text-center">
          <div className="inline-flex items-center gap-1.5 rounded-[4px] bg-primary/10 px-2.5 py-1 text-[11px] font-mono font-semibold text-primary border border-primary/20">
            <span className="h-1.5 w-1.5 rounded-full bg-accent-lime" />
            <span>Admisiones • Registro de Aspirante</span>
          </div>
          <h1 className="mt-3 text-2xl font-bold tracking-tight text-foreground">
            Crear cuenta de aspirante
          </h1>
          <p className="mt-1 text-xs text-muted">
            Regístrate para inscribirte a asignaturas, diplomados y acceder a tus cursos en Moodle LMS
          </p>
        </div>

        {error && (
          <div className="rounded-[8px] border border-danger/30 bg-danger/10 p-3.5 text-xs font-medium text-danger flex items-center gap-2">
            <IconAlertTriangle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-medium text-foreground mb-1.5">
                Nombre(s)
              </label>
              <input
                type="text"
                required
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="Juan Carlos"
                className="w-full rounded-[6px] border border-border bg-surface-muted/40 px-3.5 py-2.5 text-xs text-foreground placeholder:text-muted focus:border-primary focus:bg-surface focus:outline-none transition-all"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-foreground mb-1.5">
                Apellido(s)
              </label>
              <input
                type="text"
                required
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="Pérez López"
                className="w-full rounded-[6px] border border-border bg-surface-muted/40 px-3.5 py-2.5 text-xs text-foreground placeholder:text-muted focus:border-primary focus:bg-surface focus:outline-none transition-all"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-foreground mb-1.5">
              Teléfono / WhatsApp (Opcional)
            </label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="5512345678"
              className="w-full rounded-[6px] border border-border bg-surface-muted/40 px-3.5 py-2.5 text-xs text-foreground placeholder:text-muted focus:border-primary focus:bg-surface focus:outline-none transition-all"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-foreground mb-1.5">
              Correo Electrónico
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="tu.correo@ejemplo.com"
              className="w-full rounded-[6px] border border-border bg-surface-muted/40 px-3.5 py-2.5 text-xs text-foreground placeholder:text-muted focus:border-primary focus:bg-surface focus:outline-none transition-all"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-foreground mb-1.5">
              Contraseña
            </label>
            <input
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Mínimo 8 caracteres"
              className="w-full rounded-[6px] border border-border bg-surface-muted/40 px-3.5 py-2.5 text-xs text-foreground placeholder:text-muted focus:border-primary focus:bg-surface focus:outline-none transition-all"
            />
            <p className="mt-1 text-[11px] text-muted">
              Debe contener al menos 8 caracteres para proteger tu cuenta.
            </p>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-[6px] bg-primary-action py-2.5 text-xs font-semibold text-white shadow-minimal hover:bg-primary-action/90 transition-all disabled:cursor-not-allowed disabled:opacity-50 active:scale-[0.98]"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                <span>Registrando aspirante...</span>
              </span>
            ) : (
              'Crear Cuenta y Continuar'
            )}
          </button>
        </form>

        <div className="text-center text-xs text-muted">
          ¿Ya tienes cuenta en IINICIA?{' '}
          <Link href="/login" className="font-semibold text-primary hover:underline">
            Inicia sesión aquí
          </Link>
        </div>
      </div>
    </div>
  );
}
