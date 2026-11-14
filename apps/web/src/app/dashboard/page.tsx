'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { IconArrowRight } from '@/components/campus-tech/Icons';
import { getRoleDashboards } from '@/lib/role-navigation';

export default function MiIiniciaDashboardHub() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const dashboards = getRoleDashboards(user?.roles ?? []);
  const singleDashboard = dashboards.length === 1 ? dashboards[0].href : null;

  useEffect(() => {
    if (loading) return;
    if (!user) router.replace('/login');
    else if (singleDashboard) router.replace(singleDashboard);
  }, [user, loading, router, singleDashboard]);

  return (
    <div className="flex min-h-[calc(100vh-140px)] items-center justify-center px-4 py-12">
      <div className="w-full max-w-lg space-y-6 rounded-[14px] border border-border bg-surface p-8 text-center shadow-minimal">
        <div className="mx-auto grid h-12 w-12 place-items-center rounded-[8px] bg-primary-action text-white shadow-minimal">
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M12 2l8 4.5v9L12 20l-8-4.5v-9L12 2z" />
            <path d="M12 2v9l8 4.5M12 11l-8 4.5" />
          </svg>
        </div>

        <div>
          <div className="inline-flex items-center gap-1.5 rounded-[4px] bg-primary/10 px-2.5 py-1 text-[11px] font-mono font-semibold text-primary border border-primary/20">
            <span className="h-1.5 w-1.5 rounded-full bg-accent-lime" />
            <span>Mi INICIA • Portal Institucional</span>
          </div>
          <h1 className="mt-3 text-2xl font-bold tracking-tight text-foreground">
            {dashboards.length > 1 ? 'Elige tu espacio de trabajo' : dashboards.length === 0 && user ? 'Sin rol activo' : 'Ingresando a tu espacio de trabajo'}
          </h1>
          <p className="mt-1 text-xs text-muted">
            {loading
              ? 'Verificando sesión activa y perfil académico...'
              : user
              ? dashboards.length > 1
                ? `Bienvenido, ${user.first_name || user.email}. Tienes acceso a estos paneles:`
                : dashboards.length === 0
                  ? 'Tu cuenta no tiene un rol activo. Solicita apoyo a administración.'
                  : `Bienvenido, ${user.first_name || user.email}. Ingresando a tu panel...`
              : 'Sesión no detectada. Redirigiendo a inicio de sesión...'}
          </p>
        </div>

        {(loading || !user || singleDashboard) && (
          <div className="flex justify-center py-2">
            <span className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        )}

        {user && dashboards.length > 1 && (
          <nav aria-label="Tus paneles" className="border-t border-border pt-4 text-left">
            <div className="grid gap-2 text-xs sm:grid-cols-2">
              {dashboards.map(({ href, label }) => (
                <Link
                  key={href}
                  href={href}
                  className="flex items-center justify-between rounded-[6px] border border-border bg-surface-muted/40 p-3 font-medium text-foreground transition-all hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  {label}
                  <IconArrowRight className="h-3.5 w-3.5 text-muted" />
                </Link>
              ))}
            </div>
          </nav>
        )}
      </div>
    </div>
  );
}
