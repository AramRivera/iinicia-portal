'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { coursesApi, enrollmentsApi } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import type { AuthorizedCourse, CourseOffering } from '@/types';
import { LaunchCourseButton } from '@/components/moodle/LaunchCourseButton';

export default function CursosPage() {
  const { user } = useAuth();
  const [offerings, setOfferings] = useState<CourseOffering[]>([]);
  const [myCourses, setMyCourses] = useState<AuthorizedCourse[]>([]);
  const [loading, setLoading] = useState(true);
  const [applyingId, setApplyingId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadData = async () => {
    try {
      setLoading(true);
      const [offeringsData, authorized] = await Promise.all([
        coursesApi.getOfferings(),
        user ? coursesApi.getAuthorizedCourses().catch(() => []) : Promise.resolve([]),
      ]);
      setOfferings(offeringsData);
      setMyCourses(authorized);
    } catch (err: any) {
      setError(err.message || 'No fue posible cargar el catálogo de cursos.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [user]);

  const isEnrolled = (courseMappingId: string) => {
    return myCourses.some((c) => c.course_mapping_id === courseMappingId);
  };

  const handleEnroll = async (courseMappingId: string, courseName: string) => {
    if (!user) {
      window.location.href = '/login';
      return;
    }

    try {
      setApplyingId(courseMappingId);
      setMessage(null);
      setError(null);

      await enrollmentsApi.requestEnrollment(courseMappingId);
      setMessage(`¡Inscripción exitosa en "${courseName}"! Ya estás matriculado en el campus y puedes ingresar directamente.`);
      await loadData();
    } catch (err: any) {
      setError(err.message || 'Error al inscribirse en el curso.');
    } finally {
      setApplyingId(null);
    }
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="text-center">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-accent">
          Oferta Académica Oficial
        </p>
        <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
          Cursos y Asignaturas IINICIA
        </h1>
        <p className="mx-auto mt-3 max-w-2xl text-sm text-foreground/70 sm:text-base">
          Desarrolla habilidades aplicadas con cursos respaldados e impartidos a través del Campus Virtual Moodle LMS. Los alumnos registrados pueden inscribirse y comenzar a tomar sus cursos de inmediato.
        </p>
      </div>

      {message && (
        <div className="mt-6 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-center text-sm text-emerald-300 flex flex-col sm:flex-row items-center justify-center gap-3">
          <span>{message}</span>
          <Link
            href="/dashboard/estudiante"
            className="rounded-xl bg-emerald-500 px-3 py-1.5 text-xs font-bold text-black hover:bg-emerald-400 transition-all shrink-0"
          >
            Ir a mi Aula Virtual
          </Link>
        </div>
      )}

      {error && (
        <div className="mt-6 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-center text-sm text-red-400">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex min-h-[40vh] items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <div className="h-8 w-8 animate-spin rounded-full border-3 border-accent border-t-transparent" />
            <p className="text-sm text-foreground/60">Cargando materias desde Moodle...</p>
          </div>
        </div>
      ) : (
        <div className="mt-12 grid grid-cols-1 gap-6 sm:grid-cols-2">
          {offerings.map((off) => {
            const isSubmitting = applyingId === off.course_mapping_id;
            const alreadyEnrolled = isEnrolled(off.course_mapping_id);

            return (
              <div
                key={off.course_mapping_id}
                className={`flex flex-col justify-between rounded-3xl border p-7 shadow-sm transition-all ${
                  alreadyEnrolled
                    ? 'border-emerald-500/40 bg-emerald-500/[0.03]'
                    : 'border-border/80 bg-background/60 hover:border-accent/50 hover:shadow-xl'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="rounded-lg bg-accent/10 px-2.5 py-1 font-mono text-xs font-semibold text-accent">
                      {off.code}
                    </span>
                    <div className="flex items-center gap-2">
                      {alreadyEnrolled && (
                        <span className="rounded-full bg-emerald-500/20 px-2.5 py-0.5 text-[11px] font-bold text-emerald-400 border border-emerald-500/30">
                          Matriculado
                        </span>
                      )}
                      <span className="rounded-full bg-blue-500/10 px-2.5 py-0.5 text-[11px] font-medium text-blue-400 border border-blue-500/20">
                        Moodle ID #{off.moodle_course_id}
                      </span>
                    </div>
                  </div>

                  <h3 className="mt-4 text-xl font-bold text-foreground">
                    {off.name}
                  </h3>

                  <p className="mt-2 text-xs font-medium text-foreground/60">
                    Programa Académico: {off.program_name}
                  </p>

                  <div className="mt-6 grid grid-cols-2 gap-3">
                    <div className="rounded-xl border border-border/60 bg-foreground/[0.02] p-3 text-center">
                      <span className="text-[11px] text-foreground/50">Créditos</span>
                      <p className="mt-0.5 font-bold text-foreground">{off.credits} SATCA</p>
                    </div>
                    <div className="rounded-xl border border-border/60 bg-foreground/[0.02] p-3 text-center">
                      <span className="text-[11px] text-foreground/50">Carga Horaria</span>
                      <p className="mt-0.5 font-bold text-foreground">
                        {off.hours_theory + off.hours_practice} hrs
                      </p>
                    </div>
                  </div>
                </div>

                <div className="mt-8 border-t border-border/80 pt-4">
                  {!user ? (
                    <Link
                      href="/login"
                      className="block w-full rounded-xl bg-accent px-4 py-3 text-center text-xs font-semibold text-white shadow-md hover:bg-accent-strong transition-all"
                    >
                      Inicia sesión para inscribirte y tomarlo
                    </Link>
                  ) : alreadyEnrolled ? (
                    <div className="space-y-2">
                      <LaunchCourseButton
                        courseMappingId={off.course_mapping_id}
                        courseName={off.name}
                        isAuthorized={true}
                        className="w-full shadow-md"
                      />
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleEnroll(off.course_mapping_id, off.name)}
                      disabled={isSubmitting}
                      className="w-full rounded-xl bg-accent px-4 py-3 text-xs font-bold text-white shadow-md hover:bg-accent-strong transition-all disabled:opacity-50"
                    >
                      {isSubmitting ? (
                        <span className="flex items-center justify-center gap-2">
                          <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                          Matriculando en Moodle LMS...
                        </span>
                      ) : (
                        'Inscribirme y Tomar este Curso'
                      )}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
