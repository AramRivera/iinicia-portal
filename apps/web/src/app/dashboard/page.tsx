'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import {
  IconStudents,
  IconTeachers,
  IconShield,
  IconCourses,
  IconArrowRight,
} from '@/components/campus-tech/Icons';

export default function MiIiniciaDashboardHub() {
  const router = useRouter();
  const { user, loading, getDefaultDashboardPath } = useAuth();

  useEffect(() => {
    if (!loading) {
      if (!user) {
        router.replace('/login');
      } else {
        const targetPath = getDefaultDashboardPath();
        router.replace(targetPath);
      }
    }
  }, [user, loading, router, getDefaultDashboardPath]);

  return (
    <div className="flex min-h-[calc(100vh-140px)] items-center justify-center px-4 py-12">
      <div className="w-full max-w-lg space-y-6 rounded-[14px] border border-border bg-surface p-8 text-center shadow-minimal">
        <div className="mx-auto grid h-12 w-12 place-items-center rounded-[8px] bg-primary text-white shadow-minimal">
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
            <span>Mi IINICIA • Portal Institucional</span>
          </div>
          <h1 className="mt-3 text-2xl font-bold tracking-tight text-foreground">
            Redirigiendo a tu espacio de trabajo
          </h1>
          <p className="mt-1 text-xs text-muted">
            {loading
              ? 'Verificando sesión activa y perfil académico...'
              : user
              ? `Bienvenido, ${user.first_name || user.email}. Ingresando a tu panel...`
              : 'Sesión no detectada. Redirigiendo a inicio de sesión...'}
          </p>
        </div>

        <div className="flex justify-center py-2">
          <span className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>

        {/* Fallback en caso de demora */}
        <div className="border-t border-border pt-4 text-left">
          <p className="text-[11px] font-mono uppercase tracking-wider text-muted mb-2 text-center">
            Accesos directos por rol:
          </p>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <Link
              href="/dashboard/admin"
              className="rounded-[6px] border border-border bg-surface-muted/40 p-2.5 hover:border-primary/40 transition-all flex items-center justify-between"
            >
              <div className="flex items-center gap-2">
                <IconShield className="w-3.5 h-3.5 text-primary" />
                <span className="font-medium text-foreground">Administración</span>
              </div>
              <IconArrowRight className="w-3 h-3 text-muted" />
            </Link>

            <Link
              href="/dashboard/docente"
              className="rounded-[6px] border border-border bg-surface-muted/40 p-2.5 hover:border-primary/40 transition-all flex items-center justify-between"
            >
              <div className="flex items-center gap-2">
                <IconTeachers className="w-3.5 h-3.5 text-primary" />
                <span className="font-medium text-foreground">Docentes</span>
              </div>
              <IconArrowRight className="w-3 h-3 text-muted" />
            </Link>

            <Link
              href="/dashboard/estudiante"
              className="rounded-[6px] border border-border bg-surface-muted/40 p-2.5 hover:border-primary/40 transition-all flex items-center justify-between"
            >
              <div className="flex items-center gap-2">
                <IconStudents className="w-3.5 h-3.5 text-primary" />
                <span className="font-medium text-foreground">Estudiantes</span>
              </div>
              <IconArrowRight className="w-3 h-3 text-muted" />
            </Link>

            <Link
              href="/dashboard/aspirante"
              className="rounded-[6px] border border-border bg-surface-muted/40 p-2.5 hover:border-primary/40 transition-all flex items-center justify-between"
            >
              <div className="flex items-center gap-2">
                <IconCourses className="w-3.5 h-3.5 text-primary" />
                <span className="font-medium text-foreground">Aspirantes</span>
              </div>
              <IconArrowRight className="w-3 h-3 text-muted" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
