'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

type Confirmation = 'checking' | 'confirmed' | 'invalid';

export default function ConfirmarCorreoPage() {
  const [confirmation, setConfirmation] = useState<Confirmation>('checking');

  useEffect(() => {
    // El enlace de Supabase confirma el correo antes de redirigir a esta página.
    // El portal retira el fragmento sin conservar la sesión del enlace.
    const timer = window.setTimeout(() => {
      const result = new URLSearchParams(window.location.hash.slice(1));
      const confirmed = result.get('type') === 'signup' && result.has('access_token');
      window.history.replaceState(null, '', window.location.pathname);
      setConfirmation(confirmed ? 'confirmed' : 'invalid');
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <main className="mx-auto flex min-h-[70vh] max-w-md flex-col justify-center px-4 py-12">
      <div className="rounded-xl border border-border bg-surface p-7 shadow-minimal">
        <h1 className="text-2xl font-bold">Confirmación de correo</h1>
        <div className="mt-4 space-y-3 text-sm" role="status">
          {confirmation === 'checking' && <p>Verificando el enlace…</p>}
          {confirmation === 'confirmed' && (
            <>
              <p>Tu correo quedó confirmado. Ya puedes iniciar sesión.</p>
              <Link href="/login" className="font-semibold text-primary underline">
                Ir a iniciar sesión
              </Link>
            </>
          )}
          {confirmation === 'invalid' && (
            <>
              <p>El enlace no está disponible o ya fue usado. Si confirmaste tu correo antes, puedes iniciar sesión.</p>
              <Link href="/login" className="font-semibold text-primary underline">
                Ir a iniciar sesión
              </Link>
            </>
          )}
        </div>
      </div>
    </main>
  );
}
