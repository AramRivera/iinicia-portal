'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { coursesApi, enrollmentsApi } from '@/lib/api';
import type { CourseOffering, EnrollmentRequest } from '@/types';
import { MoodleSyncBadge } from '@/components/moodle/MoodleSyncBadge';

export default function AspiranteDashboardPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  const [offerings, setOfferings] = useState<CourseOffering[]>([]);
  const [enrollments, setEnrollments] = useState<EnrollmentRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.push('/login');
      return;
    }

    async function loadData() {
      try {
        setLoading(true);
        const [offData, enrData] = await Promise.all([
          coursesApi.getOfferings().catch(() => []),
          enrollmentsApi.getMyEnrollments().catch(() => []),
        ]);
        setOfferings(offData);
        setEnrollments(enrData);
      } catch (err: any) {
        setError(err.message || 'Error al cargar ofertas académicas.');
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [user, authLoading, router]);

  const handleApply = async (courseMappingId: string, courseName: string) => {
    setActionLoading(courseMappingId);
    setError(null);
    setMessage(null);

    try {
      await enrollmentsApi.requestEnrollment(courseMappingId);
      setMessage(`¡Inscripción exitosa en "${courseName}"! Ya estás matriculado en Moodle LMS y tu acceso está listo.`);

      // Recargar solicitudes
      const updated = await enrollmentsApi.getMyEnrollments();
      setEnrollments(updated);
    } catch (err: any) {
      setError(err.message || 'No fue posible registrar la inscripción.');
    } finally {
      setActionLoading(null);
    }
  };

  const isAlreadyEnrolled = (courseMappingId: string) => {
    return enrollments.some((e) => e.course_mapping_id === courseMappingId);
  };

  if (authLoading || loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-3 border-accent border-t-transparent" />
          <p className="text-sm text-foreground/60">Cargando portal de aspirante...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
      {/* Header Aspirante */}
      <div className="rounded-3xl border border-border/80 bg-background/60 p-6 backdrop-blur-xl sm:p-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-cyan-500/10 px-3 py-1 text-xs font-semibold text-cyan-400 border border-cyan-500/20">
                Portal de Admisiones
              </span>
              <span className="rounded-full bg-zinc-800 px-2.5 py-0.5 text-[11px] font-semibold text-zinc-400 border border-zinc-700">
                Rol: Aspirante
              </span>
            </div>
            <h1 className="mt-2 text-2xl font-extrabold text-foreground sm:text-3xl">
              Bienvenido, {user?.first_name} {user?.last_name}
            </h1>
            <p className="mt-1 text-sm text-foreground/70">
              Estás registrado en IINICIA. Elige un curso a continuación para solicitar tu inscripción oficial.
            </p>
          </div>
        </div>

        {/* Guía informativa */}
        <div className="mt-6 rounded-2xl border border-blue-500/20 bg-blue-500/5 p-4 text-xs text-blue-200">
          <p className="font-semibold text-blue-300">¿Cómo empezar?</p>
          <ol className="mt-1.5 list-decimal pl-4 space-y-1 text-blue-200/80">
            <li>Elige cualquiera de los cursos disponibles y haz clic en <strong>"Inscribirme y Tomar Curso"</strong>.</li>
            <li>El sistema sincronizará tu cuenta con Moodle LMS automáticamente.</li>
            <li>Podrás ingresar directamente a tu aula virtual y comenzar tu formación.</li>
          </ol>
        </div>
      </div>

      {message && (
        <div className="mt-6 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-center text-sm font-medium text-emerald-300 flex flex-col sm:flex-row items-center justify-center gap-3">
          <span>{message}</span>
          <Link
            href="/dashboard/estudiante"
            className="rounded-xl bg-emerald-500 px-3 py-1.5 text-xs font-bold text-black hover:bg-emerald-400 transition-all shrink-0"
          >
            Ir a mi Aula de Estudiante →
          </Link>
        </div>
      )}

      {error && (
        <div className="mt-6 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-400">
          {error}
        </div>
      )}

      {/* Mis Solicitudes Actuales */}
      {enrollments.length > 0 && (
        <div className="mt-10">
          <h2 className="text-xl font-bold text-foreground">
            Estado de mis Solicitudes
          </h2>
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            {enrollments.map((enr) => (
              <div
                key={enr.id}
                className="rounded-2xl border border-border bg-background/50 p-5"
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs text-foreground/60">
                    {enr.course_mappings?.code || 'CURSO'}
                  </span>
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${
                      enr.status === 'autorizada' || enr.status === 'sincronizada'
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                        : enr.status === 'rechazada'
                        ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                        : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                    }`}
                  >
                    {enr.status}
                  </span>
                </div>
                <h3 className="mt-2 font-bold text-foreground">
                  {enr.course_mappings?.courses?.name || enr.course_mappings?.moodle_shortname || 'Curso IINICIA'}
                </h3>
                <div className="mt-4 flex items-center justify-between border-t border-border/60 pt-3 text-xs text-foreground/60">
                  <span>En Moodle:</span>
                  <MoodleSyncBadge status={enr.moodle_sync_status} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Catálogo de Cursos Disponibles */}
      <div className="mt-12">
        <h2 className="text-xl font-bold text-foreground">
          Oferta de Cursos Disponibles para Inscripción
        </h2>
        <p className="mt-1 text-xs text-foreground/60">
          Cursos maestros configurados e integrados con Moodle LMS.
        </p>

        <div className="mt-4 grid grid-cols-1 gap-6 md:grid-cols-2">
          {offerings.map((off) => {
            const already = isAlreadyEnrolled(off.course_mapping_id);
            const isSubmitting = actionLoading === off.course_mapping_id;

            return (
              <div
                key={off.course_mapping_id}
                className="flex flex-col justify-between rounded-3xl border border-border/80 bg-background/50 p-6 hover:border-accent/40 transition-all"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="rounded-lg bg-accent/10 px-2.5 py-1 font-mono text-[11px] font-semibold text-accent">
                      {off.code}
                    </span>
                    <span className="text-xs text-foreground/60">
                      Moodle #{off.moodle_course_id}
                    </span>
                  </div>

                  <h3 className="mt-3 text-lg font-bold text-foreground">
                    {off.name}
                  </h3>
                  <p className="mt-1 text-xs text-foreground/60">
                    Programa: {off.program_name}
                  </p>

                  <div className="mt-4 flex items-center gap-4 text-xs text-foreground/70">
                    <span>{off.credits} créditos</span>
                    <span>•</span>
                    <span>{off.hours_theory + off.hours_practice} horas totales</span>
                  </div>
                </div>

                <div className="mt-6 border-t border-border/60 pt-4">
                  {already ? (
                    <button
                      disabled
                      className="w-full rounded-xl border border-border bg-foreground/5 py-2.5 text-xs font-semibold text-foreground/60 cursor-not-allowed"
                    >
                      ✓ Solicitud enviada previamente
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleApply(off.course_mapping_id, off.name)}
                      disabled={isSubmitting}
                      className="w-full rounded-xl bg-accent py-2.5 text-xs font-semibold text-white shadow-md hover:bg-accent-strong transition-all disabled:opacity-50"
                    >
                      {isSubmitting ? (
                        <span className="flex items-center justify-center gap-2">
                          <span className="h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" />
                          Enviando...
                        </span>
                      ) : (
                        'Solicitar Inscripción a este curso'
                      )}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
