'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { coursesApi, enrollmentsApi } from '@/lib/api';
import type { AuthorizedCourse, EnrollmentRequest } from '@/types';
import { LaunchCourseButton } from '@/components/moodle/LaunchCourseButton';
import { MoodleSyncBadge } from '@/components/moodle/MoodleSyncBadge';

export default function EstudianteDashboardPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  const [courses, setCourses] = useState<AuthorizedCourse[]>([]);
  const [enrollments, setEnrollments] = useState<EnrollmentRequest[]>([]);
  const [loading, setLoading] = useState(true);
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
        const [userCourses, myEnrollments] = await Promise.all([
          coursesApi.getAuthorizedCourses().catch(() => []),
          enrollmentsApi.getMyEnrollments().catch(() => []),
        ]);
        setCourses(userCourses);
        setEnrollments(myEnrollments);
      } catch (err: any) {
        setError(err.message || 'No fue posible cargar tus cursos.');
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [user, authLoading, router]);

  if (authLoading || loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-3 border-accent border-t-transparent" />
          <p className="text-sm text-foreground/60">Cargando tu aula virtual...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
      {/* Header del Estudiante */}
      <div className="rounded-3xl border border-border/80 bg-background/60 p-6 backdrop-blur-xl sm:p-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-blue-500/10 px-3 py-1 text-xs font-semibold text-blue-400 border border-blue-500/20">
                Portal del Estudiante
              </span>
              <MoodleSyncBadge
                status={user?.moodle_sync_status}
                moodleId={user?.moodle_user_id}
              />
            </div>
            <h1 className="mt-2 text-2xl font-extrabold text-foreground sm:text-3xl">
              ¡Hola, {user?.first_name}!
            </h1>
            <p className="mt-1 text-sm text-foreground/70">
              Bienvenido a tu espacio académico. Aquí puedes acceder a tus materias en Moodle LMS.
            </p>
          </div>

          <Link
            href="/cursos"
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-xs font-semibold text-white shadow-md hover:bg-accent-strong transition-all shrink-0"
          >
            Explorar catálogo de cursos
          </Link>
        </div>

        {/* Info del Campus */}
        <div className="mt-6 grid grid-cols-1 gap-3 border-t border-border/80 pt-6 sm:grid-cols-3">
          <div className="rounded-2xl border border-border/50 bg-foreground/[0.02] p-4">
            <span className="text-xs text-foreground/60">Usuario en Moodle</span>
            <p className="mt-1 font-mono text-sm font-semibold text-foreground">
              {user?.moodle_username || 'Sincronización pendiente'}
            </p>
          </div>
          <div className="rounded-2xl border border-border/50 bg-foreground/[0.02] p-4">
            <span className="text-xs text-foreground/60">Materias Activas</span>
            <p className="mt-1 text-sm font-semibold text-foreground">
              {courses.length} curso(s) autorizados
            </p>
          </div>
          <div className="rounded-2xl border border-border/50 bg-foreground/[0.02] p-4">
            <span className="text-xs text-foreground/60">Estado de Cuenta</span>
            <p className="mt-1 text-sm font-semibold capitalize text-emerald-400">
              {user?.status}
            </p>
          </div>
        </div>
      </div>

      {error && (
        <div className="mt-6 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-400">
          {error}
        </div>
      )}

      {/* Sección: Cursos Autorizados en Moodle */}
      <div className="mt-10">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-foreground">
            Mis Cursos y Aulas Virtuales
          </h2>
          <span className="text-xs text-foreground/60">
            Fuente de aprendizaje: Moodle LMS
          </span>
        </div>

        {courses.length === 0 ? (
          <div className="mt-4 rounded-3xl border border-dashed border-border p-10 text-center">
            <p className="text-sm font-medium text-foreground/70">
              Aún no tienes cursos autorizados en Moodle.
            </p>
            <p className="mt-1 text-xs text-foreground/50">
              Revisa el catálogo o espera a que tu coordinador apruebe tu solicitud de matrícula.
            </p>
            <Link
              href="/cursos"
              className="mt-4 inline-block rounded-xl border border-border bg-foreground/5 px-4 py-2 text-xs font-semibold text-foreground hover:bg-foreground/10"
            >
              Ver cursos disponibles
            </Link>
          </div>
        ) : (
          <div className="mt-4 grid grid-cols-1 gap-5 md:grid-cols-2">
            {courses.map((course) => (
              <div
                key={course.course_mapping_id}
                className="flex flex-col justify-between rounded-3xl border border-border/80 bg-background/50 p-6 shadow-sm hover:border-accent/40 transition-all"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="rounded-lg bg-accent/10 px-2.5 py-1 font-mono text-[11px] font-semibold text-accent">
                      {course.course_code}
                    </span>
                    <span className="rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-medium text-emerald-400 border border-emerald-500/20">
                      Matrícula Activa
                    </span>
                  </div>
                  <h3 className="mt-3 text-lg font-bold text-foreground">
                    {course.course_name}
                  </h3>
                  <p className="mt-1 text-xs text-foreground/60">
                    ID en Moodle: #{course.moodle_course_id}
                  </p>
                </div>

                <div className="mt-6 border-t border-border/60 pt-4">
                  <LaunchCourseButton
                    courseMappingId={course.course_mapping_id}
                    courseName={course.course_name}
                    isAuthorized={true}
                    className="w-full"
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Sección: Solicitudes de Matrícula */}
      <div className="mt-12">
        <h2 className="text-xl font-bold text-foreground">
          Historial de Inscripciones
        </h2>
        <div className="mt-4 overflow-hidden rounded-2xl border border-border">
          {enrollments.length === 0 ? (
            <div className="p-6 text-center text-xs text-foreground/60">
              No tienes solicitudes de matrícula recientes.
            </div>
          ) : (
            <table className="w-full text-left text-xs">
              <thead className="border-b border-border bg-foreground/[0.02] text-foreground/70">
                <tr>
                  <th className="px-4 py-3 font-semibold">Materia</th>
                  <th className="px-4 py-3 font-semibold">Estado en Portal</th>
                  <th className="px-4 py-3 font-semibold">Estado en Moodle</th>
                  <th className="px-4 py-3 font-semibold">Fecha de Solicitud</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {enrollments.map((enr) => (
                  <tr key={enr.id} className="hover:bg-foreground/[0.01]">
                    <td className="px-4 py-3 font-medium text-foreground">
                      {enr.course_mappings?.courses?.name || enr.course_mappings?.code || 'Curso IINICIA'}
                    </td>
                    <td className="px-4 py-3">
                      <span className="capitalize text-foreground/80 font-medium">
                        {enr.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <MoodleSyncBadge status={enr.moodle_sync_status} />
                    </td>
                    <td className="px-4 py-3 text-foreground/60">
                      {new Date(enr.created_at).toLocaleDateString('es-MX')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
