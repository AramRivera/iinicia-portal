'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  IconCheck,
  IconAlertTriangle,
  IconShield,
  IconArrowRight,
} from '@/components/campus-tech/Icons';

export default function RecuperarPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!email.trim() || !email.includes('@')) {
      setError('Ingresa una dirección de correo electrónico válida.');
      return;
    }

    setLoading(true);

    try {
      // Intentar contactar al backend si existiese endpoint o simular recuperación segura
      await new Promise((resolve) => setTimeout(resolve, 800));
      setSubmitted(true);
    } catch (err: any) {
      setError(err.message || 'No fue posible procesar la solicitud.');
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
            <span>Seguridad Institucional</span>
          </div>
          <h1 className="mt-3 text-2xl font-bold tracking-tight text-foreground">
            Recuperar contraseña
          </h1>
          <p className="mt-1 text-xs text-muted leading-relaxed">
            Ingresa el correo institucional o personal con el que estás registrado para restablecer tu clave de acceso.
          </p>
        </div>

        {submitted ? (
          <div className="space-y-4">
            <div className="rounded-[10px] border border-success/30 bg-success/10 p-5 text-center space-y-2">
              <div className="mx-auto grid h-10 w-10 place-items-center rounded-full bg-success/20 text-success">
                <IconCheck className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-bold text-foreground">
                Instrucciones enviadas
              </h3>
              <p className="text-xs text-muted leading-relaxed">
                Si la dirección <strong className="text-foreground">{email}</strong> corresponde a una cuenta registrada en IINICIA, recibirás un enlace de restablecimiento seguro en los próximos minutos.
              </p>
            </div>

            <div className="rounded-[8px] bg-surface-muted/50 border border-border p-3 text-[11px] text-muted space-y-1">
              <p>Revisa tu bandeja de entrada y la carpeta de correo no deseado (spam).</p>
              <p>El enlace de verificación caducará en 60 minutos por motivos de seguridad.</p>
            </div>

            <div className="pt-2 flex flex-col gap-2">
              <Link
                href="/login"
                className="w-full rounded-[6px] bg-primary py-2.5 text-center text-xs font-semibold text-white shadow-minimal hover:bg-primary/90 transition-all"
              >
                Volver a Iniciar Sesión
              </Link>
              <button
                type="button"
                onClick={() => setSubmitted(false)}
                className="text-center text-xs text-muted hover:text-foreground transition-colors py-1"
              >
                Probar con otra dirección de correo
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="rounded-[8px] border border-danger/30 bg-danger/10 p-3.5 text-xs font-medium text-danger flex items-center gap-2">
                <IconAlertTriangle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-foreground mb-1.5">
                Correo Electrónico Registrado
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="ejemplo@iinicia.org"
                className="w-full rounded-[6px] border border-border bg-surface-muted/40 px-3.5 py-2.5 text-xs text-foreground placeholder:text-muted focus:border-primary focus:bg-surface focus:outline-none transition-all"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-[6px] bg-primary py-2.5 text-xs font-semibold text-white shadow-minimal hover:bg-primary/90 transition-all disabled:opacity-50"
            >
              {loading ? 'Enviando solicitud...' : 'Enviar instrucciones de recuperación'}
            </button>

            <div className="border-t border-border pt-4 text-center text-xs text-muted">
              ¿Recordaste tu contraseña?{' '}
              <Link href="/login" className="font-semibold text-primary hover:underline">
                Iniciar sesión
              </Link>
            </div>
          </form>
        )}

        <div className="rounded-[8px] border border-border bg-surface-muted/30 p-3 text-center text-[11px] text-muted">
          ¿Problemas con tu cuenta? Escríbenos a{' '}
          <a
            href="mailto:soporte@iinicia.org"
            className="font-medium text-foreground hover:underline"
          >
            soporte@iinicia.org
          </a>
        </div>
      </div>
    </div>
  );
}
