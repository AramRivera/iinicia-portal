'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { coursesApi, enrollmentsApi } from '@/lib/api';
import type { CourseOffering, EnrollmentRequest } from '@/types';
import { MoodleSyncBadge } from '@/components/moodle/MoodleSyncBadge';
import { CampusShell } from '@/components/campus-tech/CampusShell';
import {
  IconStudents,
  IconGroups,
  IconCheck,
  IconAlertTriangle,
  IconPlus,
  IconExternalLink,
} from '@/components/campus-tech/Icons';

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
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <p className="text-xs font-medium text-muted">Cargando portal de admisiones...</p>
        </div>
      </div>
    );
  }

  return (
    <CampusShell
      currentTab="ofertas"
      onSelectTab={() => {}}
      breadcrumbs={['IINICIA', 'Portal de Admisiones', 'Oferta Académica']}
      counts={{
        enrollments: enrollments.length,
      }}
    >
      <div className="space-y-6">
        {/* Header Aspirante */}
        <div className="rounded-[10px] border border-border bg-surface p-5 sm:p-6 shadow-minimal transition-all">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-[4px] bg-primary/10 px-2 py-0.5 text-[11px] font-mono font-semibold text-primary border border-primary/20">
                  Admisiones IINICIA
                </span>
                <span className="rounded-[4px] bg-surface-muted px-2 py-0.5 text-[11px] font-mono font-medium text-muted border border-border">
                  Rol: Aspirante
                </span>
              </div>
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
                Bienvenido, {user?.first_name} {user?.last_name}
              </h1>
              <p className="text-xs sm:text-sm text-muted">
                Tu registro en la plataforma está activo. Elige un curso a continuación para inscribirte y habilitar tu aula virtual.
              </p>
            </div>
          </div>

          {/* Guía operativa */}
          <div className="mt-5 rounded-[8px] border border-primary/20 bg-primary/5 p-4 text-xs text-foreground/85">
            <p className="font-semibold text-foreground flex items-center gap-2">
              <IconStudents className="w-4 h-4 text-primary" />
              <span>Pasos para iniciar tu formación</span>
            </p>
            <ol className="mt-2 list-decimal pl-5 space-y-1 text-muted leading-relaxed">
              <li>Elige cualquiera de los cursos disponibles y pulsa <strong>&quot;Inscribirme y Tomar Curso&quot;</strong>.</li>
              <li>El sistema sincronizará tu cuenta con Moodle LMS en tiempo real.</li>
              <li>Ingresarás directamente a tu aula virtual y comenzarás a estudiar de inmediato.</li>
            </ol>
          </div>
        </div>

        {message && (
          <div className="rounded-[8px] border border-emerald-500/25 bg-emerald-500/10 p-4 text-xs font-medium text-emerald-700 dark:text-emerald-400 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-minimal">
            <div className="flex items-center gap-2">
              <IconCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span>{message}</span>
            </div>
            <Link
              href="/dashboard/estudiante"
              className="rounded-[6px] bg-primary px-3 py-1.5 text-xs font-semibold text-white shadow-minimal hover:bg-primary/90 transition-all shrink-0"
            >
              Ir a mi Aula de Estudiante →
            </Link>
          </div>
        )}

        {error && (
          <div className="rounded-[8px] border border-danger/30 bg-danger/10 p-3.5 text-xs font-medium text-danger flex items-center gap-2 shadow-minimal">
            <IconAlertTriangle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Mis Solicitudes Actuales */}
        {enrollments.length > 0 && (
          <div className="space-y-4">
            <h2 className="text-base font-semibold text-foreground">
              Estado de mis Solicitudes
            </h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {enrollments.map((enr) => (
                <div
                  key={enr.id}
                  className="rounded-[10px] border border-border bg-surface p-5 shadow-minimal"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs text-muted">
                      {enr.course_mappings?.code || 'CURSO'}
                    </span>
                    <span
                      className={`rounded-[4px] px-2 py-0.5 text-[11px] font-medium capitalize border ${
                        enr.status === 'autorizada' || enr.status === 'sincronizada'
                          ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                          : enr.status === 'rechazada'
                          ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20'
                          : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20'
                      }`}
                    >
                      {enr.status}
                    </span>
                  </div>
                  <h3 className="mt-2 text-sm font-semibold text-foreground">
                    {enr.course_mappings?.courses?.name || enr.course_mappings?.moodle_shortname || 'Curso IINICIA'}
                  </h3>
                  <div className="mt-4 flex items-center justify-between border-t border-border pt-3 text-xs text-muted">
                    <span>Moodle LMS:</span>
                    <MoodleSyncBadge status={enr.moodle_sync_status} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Catálogo de Cursos Disponibles */}
        <div className="space-y-4 pt-2">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-foreground">
                Oferta de Cursos Disponibles para Inscripción
              </h2>
              <p className="text-xs text-muted">
                Cursos maestros con vinculación directa al campus virtual Moodle LMS.
              </p>
            </div>
            <span className="rounded-[4px] bg-surface-muted px-2 py-1 text-xs font-mono font-medium text-muted">
              {offerings.length} opciones
            </span>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {offerings.map((off) => {
              const already = isAlreadyEnrolled(off.course_mapping_id);
              const isSubmitting = actionLoading === off.course_mapping_id;

              return (
                <div
                  key={off.course_mapping_id}
                  className="flex flex-col justify-between rounded-[10px] border border-border bg-surface p-5 shadow-minimal hover:border-primary/40 transition-all"
                >
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="rounded-[4px] bg-surface-muted px-2 py-0.5 font-mono text-[11px] font-semibold text-foreground">
                        {off.code}
                      </span>
                      <span className="text-xs text-muted font-mono">
                        Moodle #{off.moodle_course_id}
                      </span>
                    </div>

                    <h3 className="mt-3 text-base font-semibold text-foreground">
                      {off.name}
                    </h3>
                    <p className="mt-1 text-xs text-muted">
                      Programa: {off.program_name}
                    </p>

                    <div className="mt-4 flex items-center gap-3 text-xs text-muted font-mono">
                      <span>{off.credits} créditos</span>
                      <span>•</span>
                      <span>{off.hours_theory + off.hours_practice} horas</span>
                    </div>
                  </div>

                  <div className="mt-5 border-t border-border pt-3.5">
                    {already ? (
                      <button
                        disabled
                        className="w-full rounded-[6px] border border-border bg-surface-muted py-2 text-xs font-medium text-muted cursor-not-allowed flex items-center justify-center gap-1.5"
                      >
                        <IconCheck className="w-3.5 h-3.5 text-emerald-500" />
                        <span>Solicitud registrada previamente</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleApply(off.course_mapping_id, off.name)}
                        disabled={isSubmitting}
                        className="w-full rounded-[6px] bg-primary py-2 text-xs font-semibold text-white shadow-minimal hover:bg-primary/90 transition-all disabled:opacity-50 active:scale-[0.98] flex items-center justify-center gap-1.5"
                      >
                        {isSubmitting ? (
                          <>
                            <span className="h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" />
                            <span>Inscribiendo...</span>
                          </>
                        ) : (
                          <>
                            <IconPlus className="w-3.5 h-3.5 text-accent-lime" />
                            <span>Inscribirme y Tomar Curso</span>
                          </>
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
    </CampusShell>
  );
}
