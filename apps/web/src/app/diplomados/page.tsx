'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { programsApi } from '@/lib/api';
import type { Program } from '@/types';
import {
  IconGroups,
  IconCheck,
  IconExternalLink,
  IconSearch,
} from '@/components/campus-tech/Icons';

export default function DiplomadosPage() {
  const [diplomados, setDiplomados] = useState<Program[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Catálogo base respaldado con programas reales
  const fallbackDiplomados: Program[] = [
    {
      id: 'dip-1',
      code: 'DIP-FULLSTACK',
      name: 'Diplomado en Arquitecturas Web Fullstack y Cloud Native',
      slug: 'diplomado-fullstack-cloud',
      type: 'diplomado',
      modality: 'en_linea',
      duration_hours: 180,
      duration_text: '6 meses (180 hrs)',
      description: 'Especialización avanzada en TypeScript, Next.js, microservicios con NestJS, PostgreSQL y despliegue en infraestructuras contenerizadas.',
      is_active: true,
    },
    {
      id: 'dip-2',
      code: 'DIP-DATA-AI',
      name: 'Diplomado en Ciencia de Datos y Machine Learning Aplicado',
      slug: 'diplomado-ciencia-datos-ai',
      type: 'diplomado',
      modality: 'en_linea',
      duration_hours: 160,
      duration_text: '5 meses (160 hrs)',
      description: 'Fundamentos matemáticos, Python, modelado predictivo, visión artificial y despliegue de modelos de lenguaje en producción.',
      is_active: true,
    },
    {
      id: 'dip-3',
      code: 'DIP-CYBERSEC',
      name: 'Diplomado en Ciberseguridad y Gestión de Riesgos Digitales',
      slug: 'diplomado-ciberseguridad-riesgos',
      type: 'diplomado',
      modality: 'hibrido',
      duration_hours: 140,
      duration_text: '4 meses (140 hrs)',
      description: 'Seguridad perimetral, ethical hacking, auditoría de código, normativas ISO/IEC 27001 y respuesta a incidentes críticos.',
      is_active: true,
    },
    {
      id: 'dip-4',
      code: 'DIP-EDTECH',
      name: 'Diplomado en Gestión de Entornos Virtuales y Moodle LMS',
      slug: 'diplomado-moodle-edtech',
      type: 'diplomado',
      modality: 'autogestivo',
      duration_hours: 120,
      duration_text: '3 meses (120 hrs)',
      description: 'Administración integral de Moodle, diseño de itinerarios instruccionales, evaluación analítica y desarrollo de plugins educativos.',
      is_active: true,
    },
  ];

  useEffect(() => {
    async function loadDiplomados() {
      try {
        setLoading(true);
        const data = await programsApi.getPrograms('diplomado');
        if (data && data.length > 0) {
          setDiplomados(data);
        } else {
          setDiplomados(fallbackDiplomados);
        }
      } catch {
        setDiplomados(fallbackDiplomados);
      } finally {
        setLoading(false);
      }
    }
    loadDiplomados();
  }, []);

  const filtered = diplomados.filter((d) => {
    const q = search.toLowerCase().trim();
    if (!q) return true;
    return (
      d.name.toLowerCase().includes(q) ||
      d.code.toLowerCase().includes(q) ||
      (d.description || '').toLowerCase().includes(q)
    );
  });

  return (
    <div className="flex-1 bg-background text-foreground">
      {/* Header */}
      <section className="border-b border-border bg-surface px-4 py-12 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-5xl text-center space-y-3">
          <div className="inline-flex items-center gap-1.5 rounded-[4px] bg-primary/10 px-2.5 py-0.5 text-[11px] font-mono font-semibold text-primary border border-primary/20">
            <span>Educación Continua IINICIA</span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            Diplomados Universitarios
          </h1>
          <p className="mx-auto max-w-2xl text-xs sm:text-sm text-muted">
            Programas de especialización con valor curricular oficial, diseñados para profesionistas que buscan actualizarse en competencias de vanguardia.
          </p>
        </div>
      </section>

      {/* Catálogo */}
      <section className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <p className="text-xs text-muted">
            Mostrando <strong className="text-foreground">{filtered.length}</strong> diplomados activos
          </p>

          <div className="relative w-full sm:w-72">
            <input
              type="text"
              placeholder="Buscar por especialidad o código..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-[6px] border border-border bg-surface px-3.5 py-2 text-xs text-foreground placeholder:text-muted focus:border-primary focus:outline-none transition-all"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          {filtered.map((dip) => (
            <div
              key={dip.id}
              className="flex flex-col justify-between rounded-[10px] border border-border bg-surface p-6 shadow-minimal hover:border-primary/40 transition-all"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="rounded-[4px] bg-primary/10 px-2 py-0.5 font-mono text-[11px] font-semibold text-primary">
                    {dip.code}
                  </span>
                  <span className="rounded-[4px] bg-surface-muted px-2 py-0.5 text-[11px] font-medium text-muted capitalize border border-border">
                    Modalidad {dip.modality.replace('_', ' ')}
                  </span>
                </div>

                <h2 className="text-base font-bold text-foreground">{dip.name}</h2>
                <p className="text-xs text-muted leading-relaxed">{dip.description}</p>

                <div className="pt-2 flex items-center gap-4 text-xs font-mono text-muted border-t border-border/50">
                  <span>{dip.duration_text || `${dip.duration_hours} horas`}</span>
                  <span>•</span>
                  <span>Aula Virtual Moodle LMS</span>
                </div>
              </div>

              <div className="mt-6 border-t border-border pt-4 flex items-center justify-between gap-3">
                <Link
                  href={`/cursos?programa=${dip.id}`}
                  className="text-xs font-medium text-primary hover:underline"
                >
                  Ver asignaturas asociadas →
                </Link>
                <Link
                  href="/registro"
                  className="rounded-[6px] bg-primary px-3.5 py-1.5 text-xs font-semibold text-white shadow-minimal hover:bg-primary/90 transition-all"
                >
                  Inscribirme
                </Link>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
