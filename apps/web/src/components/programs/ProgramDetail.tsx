'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { programsApi } from '@/lib/api';
import type { Program } from '@/types';

const programTypeLabels: Record<Program['type'], string> = {
  licenciatura: 'Licenciatura',
  maestria: 'Maestría',
  diplomado: 'Diplomado',
  curso: 'Curso',
  certificacion: 'Certificación',
};

const modalityLabels: Record<Program['modality'], string> = {
  en_linea: 'En línea',
  presencial: 'Presencial',
  hibrido: 'Híbrida',
  autogestivo: 'Autogestiva',
};

export default function ProgramDetail({ slug }: { slug: string }) {
  const { user } = useAuth();
  const [program, setProgram] = useState<Program | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    let active = true;
    programsApi.getProgramBySlugOrId(slug)
      .then((result) => {
        if (!active) return;
        if (!result.is_active) {
          setProgram(null);
          setLoadError(true);
          return;
        }
        setProgram(result);
      })
      .catch(() => {
        if (active) setLoadError(true);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => { active = false; };
  }, [slug]);

  if (loading) {
    return <div className="grid min-h-[60vh] place-items-center text-sm text-muted">Cargando información del programa…</div>;
  }

  if (loadError || !program) {
    return (
      <section className="mx-auto grid min-h-[60vh] w-full max-w-3xl place-items-center px-4 py-16 text-center">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-primary">Oferta académica INICIA</p>
          <h1 className="mt-3 text-3xl font-bold text-foreground">No encontramos este programa</h1>
          <p className="mt-3 text-sm text-muted">Puede que ya no esté publicado o que el enlace haya cambiado.</p>
          <Link href="/#licenciaturas" className="mt-6 inline-flex rounded-lg bg-primary-action px-4 py-2 text-sm font-semibold text-white hover:bg-accent-strong">Volver a la oferta académica</Link>
        </div>
      </section>
    );
  }

  const nextStepHref = user ? '/dashboard' : '/registro';
  const nextStepLabel = user ? 'Ir a Mi IINICIA' : 'Crear cuenta para solicitar admisión';

  return (
    <article className="flex-1 bg-background text-foreground">
      <section className="border-b border-border bg-surface px-4 py-14 sm:py-20">
        <div className="mx-auto max-w-5xl">
          <Link href="/#licenciaturas" className="text-sm font-medium text-primary hover:underline">← Oferta académica</Link>
          <div className="mt-8 rounded-2xl border border-white/15 bg-welcome-panel p-6 text-white shadow-soft sm:p-10">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide">{programTypeLabels[program.type]}</span>
              <span className="rounded-full bg-white/10 px-3 py-1 text-xs">{program.code}</span>
            </div>
            <h1 className="mt-5 max-w-4xl text-3xl font-bold tracking-tight sm:text-5xl">{program.name}</h1>
            {program.short_description && <p className="mt-4 max-w-3xl text-base leading-relaxed text-white/80">{program.short_description}</p>}
          </div>
        </div>
      </section>

      <section className="mx-auto grid w-full max-w-5xl gap-8 px-4 py-12 sm:grid-cols-[minmax(0,1fr)_18rem] sm:px-6 sm:py-16">
        <div>
          <h2 className="text-xl font-semibold text-foreground">Acerca del programa</h2>
          <p className="mt-4 whitespace-pre-line text-sm leading-7 text-muted">{program.description || 'La descripción completa de este programa todavía no está publicada.'}</p>
        </div>

        <aside className="h-fit rounded-xl border border-border bg-surface p-5 shadow-minimal">
          <h2 className="text-base font-semibold text-foreground">Información académica</h2>
          <dl className="mt-4 divide-y divide-border text-sm">
            <div className="flex justify-between gap-3 py-3"><dt className="text-muted">Modalidad</dt><dd className="text-right font-medium text-foreground">{modalityLabels[program.modality]}</dd></div>
            <div className="flex justify-between gap-3 py-3"><dt className="text-muted">Duración</dt><dd className="text-right font-medium text-foreground">{program.duration_text || `${program.duration_hours} horas`}</dd></div>
          </dl>
          <Link href={nextStepHref} className="mt-4 flex justify-center rounded-lg bg-primary-action px-4 py-2.5 text-center text-sm font-semibold text-white transition-colors hover:bg-accent-strong">{nextStepLabel}</Link>
          <Link href="/#admisiones" className="mt-3 flex justify-center rounded-lg border border-border px-4 py-2.5 text-center text-sm font-medium text-foreground hover:bg-surface-muted">Ver proceso de admisión</Link>
        </aside>
      </section>
    </article>
  );
}
