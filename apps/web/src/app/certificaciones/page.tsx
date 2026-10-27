'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { programsApi } from '@/lib/api';
import type { Program } from '@/types';
import { IconCheck, IconExternalLink } from '@/components/campus-tech/Icons';

export default function CertificacionesPage() {
  const [certificaciones, setCertificaciones] = useState<Program[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const fallbackCertificaciones: Program[] = [
    {
      id: 'cert-1',
      code: 'CERT-REACT-ADV',
      name: 'Certificación Profesional en React 19 y Next.js App Router',
      slug: 'certificacion-react-nextjs',
      type: 'certificacion',
      modality: 'en_linea',
      duration_hours: 80,
      duration_text: '80 horas lectivas',
      description: 'Validación técnica en Server Components, Server Actions, optimización de renderizado y diseño de sistemas modulares en React.',
      is_active: true,
    },
    {
      id: 'cert-2',
      code: 'CERT-NEST-BACKEND',
      name: 'Certificación en Desarrollo Backend Escalable con NestJS y PostgreSQL',
      slug: 'certificacion-nestjs-postgresql',
      type: 'certificacion',
      modality: 'en_linea',
      duration_hours: 80,
      duration_text: '80 horas lectivas',
      description: 'Arquitectura modular, autenticación JWT, Row Level Security con Supabase, integración Web Services Moodle y pruebas automatizadas.',
      is_active: true,
    },
    {
      id: 'cert-3',
      code: 'CERT-MOODLE-ADMIN',
      name: 'Certificación Oficial en Administración y Web Services Moodle LMS',
      slug: 'certificacion-moodle-admin',
      type: 'certificacion',
      modality: 'autogestivo',
      duration_hours: 60,
      duration_text: '60 horas lectivas',
      description: 'Gestión de roles docentes, configuración de protocolos SSO auth_userkey, matriculación distribuida y optimización de bases de datos.',
      is_active: true,
    },
    {
      id: 'cert-4',
      code: 'CERT-AGILE-DEVOPS',
      name: 'Certificación en DevOps para Equipos de Ingeniería de Software',
      slug: 'certificacion-devops-agile',
      type: 'certificacion',
      modality: 'en_linea',
      duration_hours: 70,
      duration_text: '70 horas lectivas',
      description: 'Pipelines CI/CD, Git workflows colaborativos, despliegues contenerizados con Docker y observabilidad en producción.',
      is_active: true,
    },
  ];

  useEffect(() => {
    async function loadCerts() {
      try {
        setLoading(true);
        const data = await programsApi.getPrograms('certificacion');
        if (data && data.length > 0) {
          setCertificaciones(data);
        } else {
          setCertificaciones(fallbackCertificaciones);
        }
      } catch {
        setCertificaciones(fallbackCertificaciones);
      } finally {
        setLoading(false);
      }
    }
    loadCerts();
  }, []);

  const filtered = certificaciones.filter((c) => {
    const q = search.toLowerCase().trim();
    if (!q) return true;
    return (
      c.name.toLowerCase().includes(q) ||
      c.code.toLowerCase().includes(q) ||
      (c.description || '').toLowerCase().includes(q)
    );
  });

  return (
    <div className="flex-1 bg-background text-foreground">
      {/* Header */}
      <section className="border-b border-border bg-surface px-4 py-12 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-5xl text-center space-y-3">
          <div className="inline-flex items-center gap-1.5 rounded-[4px] bg-primary/10 px-2.5 py-0.5 text-[11px] font-mono font-semibold text-primary border border-primary/20">
            <span>Acreditaciones con Valor Curricular</span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            Certificaciones Universitarias IINICIA
          </h1>
          <p className="mx-auto max-w-2xl text-xs sm:text-sm text-muted">
            Evalúa y certifica tus competencias técnicas con exámenes prácticos, laboratorios virtuales en Moodle LMS y acreditación digital verificable.
          </p>
        </div>
      </section>

      {/* Catálogo */}
      <section className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <p className="text-xs text-muted">
            Mostrando <strong className="text-foreground">{filtered.length}</strong> certificaciones disponibles
          </p>

          <div className="relative w-full sm:w-72">
            <input
              type="text"
              placeholder="Buscar certificación o código..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-[6px] border border-border bg-surface px-3.5 py-2 text-xs text-foreground placeholder:text-muted focus:border-primary focus:outline-none transition-all"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          {filtered.map((cert) => (
            <div
              key={cert.id}
              className="flex flex-col justify-between rounded-[10px] border border-border bg-surface p-6 shadow-minimal hover:border-primary/40 transition-all"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="rounded-[4px] bg-primary/10 px-2 py-0.5 font-mono text-[11px] font-semibold text-primary">
                    {cert.code}
                  </span>
                  <span className="rounded-[4px] bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                    Acreditación Digital
                  </span>
                </div>

                <h2 className="text-base font-bold text-foreground">{cert.name}</h2>
                <p className="text-xs text-muted leading-relaxed">{cert.description}</p>

                <div className="pt-2 flex items-center gap-4 text-xs font-mono text-muted border-t border-border/50">
                  <span>{cert.duration_text || `${cert.duration_hours} hrs`}</span>
                  <span>•</span>
                  <span>Evaluación en Moodle LMS</span>
                </div>
              </div>

              <div className="mt-6 border-t border-border pt-4 flex items-center justify-between gap-3">
                <Link
                  href="/cursos"
                  className="text-xs font-medium text-primary hover:underline"
                >
                  Ver cursos de preparación →
                </Link>
                <Link
                  href="/registro"
                  className="rounded-[6px] bg-primary px-3.5 py-1.5 text-xs font-semibold text-white shadow-minimal hover:bg-primary/90 transition-all"
                >
                  Registrarme
                </Link>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
