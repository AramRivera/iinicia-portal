'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { coursesApi } from '@/lib/api';
import type { AuthorizedCourse } from '@/types';
import { LaunchCourseButton } from '@/components/moodle/LaunchCourseButton';
import { MoodleSyncBadge } from '@/components/moodle/MoodleSyncBadge';

export default function DocenteDashboardPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  const [courses, setCourses] = useState<AuthorizedCourse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.push('/login');
      return;
    }

    async function loadTeacherCourses() {
      try {
        setLoading(true);
        const data = await coursesApi.getAuthorizedCourses();
        setCourses(data);
      } catch (err: any) {
        setError(err.message || 'No fue posible cargar tus asignaturas.');
      } finally {
        setLoading(false);
      }
    }

    loadTeacherCourses();
  }, [user, authLoading, router]);

  if (authLoading || loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-3 border-accent border-t-transparent" />
          <p className="text-sm text-foreground/60">Cargando panel docente...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
      {/* Header Docente */}
      <div className="rounded-3xl border border-border/80 bg-background/60 p-6 backdrop-blur-xl sm:p-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-violet-500/10 px-3 py-1 text-xs font-semibold text-violet-400 border border-violet-500/20">
                Panel del Profesor
              </span>
              <MoodleSyncBadge
                status={user?.moodle_sync_status}
                moodleId={user?.moodle_user_id}
              />
            </div>
            <h1 className="mt-2 text-2xl font-extrabold text-foreground sm:text-3xl">
              Prof. {user?.first_name} {user?.last_name}
            </h1>
            <p className="mt-1 text-sm text-foreground/70">
              Gestión de asignaturas y acceso como docente titular en Moodle LMS.
            </p>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-3 border-t border-border/80 pt-6 sm:grid-cols-3">
          <div className="rounded-2xl border border-border/50 bg-foreground/[0.02] p-4">
            <span className="text-xs text-foreground/60">Cuenta Moodle</span>
            <p className="mt-1 font-mono text-sm font-semibold text-foreground">
              {user?.moodle_username || 'profesor'}
            </p>
          </div>
          <div className="rounded-2xl border border-border/50 bg-foreground/[0.02] p-4">
            <span className="text-xs text-foreground/60">Cursos a Cargo</span>
            <p className="mt-1 text-sm font-semibold text-foreground">
              {courses.length} asignatura(s)
            </p>
          </div>
          <div className="rounded-2xl border border-border/50 bg-foreground/[0.02] p-4">
            <span className="text-xs text-foreground/60">Rol Académico</span>
            <p className="mt-1 text-sm font-semibold text-violet-400">
              Profesor Titular (Editing Teacher)
            </p>
          </div>
        </div>

        {/* Aviso de Acceso y Sesión en Moodle */}
        <div className="mt-4 rounded-2xl border border-violet-500/20 bg-violet-500/5 p-4 text-xs text-foreground/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-start gap-2.5">
            <span className="text-base leading-none">ℹ️</span>
            <div>
              <p className="font-semibold text-foreground">Acceso Docente al Aula Moodle</p>
              <p className="mt-0.5 text-foreground/70">
                Al pulsar <strong>&quot;Gestionar en Moodle&quot;</strong> serás transferido a Moodle LMS con privilegios docentes. Si tu navegador aún no tiene sesión abierta en Moodle, ingresa con tu usuario institucional.
              </p>
            </div>
          </div>
          <div className="shrink-0 rounded-xl border border-border/80 bg-background/80 px-3 py-2 font-mono text-[11px] text-foreground/90">
            Usuario: <span className="font-bold text-accent">{user?.moodle_username || 'profesor'}</span>
          </div>
        </div>
      </div>

      {error && (
        <div className="mt-6 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-400">
          {error}
        </div>
      )}

      {/* Cursos Asignados */}
      <div className="mt-10">
        <h2 className="text-xl font-bold text-foreground">
          Cursos Asignados para Impartir
        </h2>
        <p className="mt-1 text-xs text-foreground/60">
          Haz clic en cualquier curso para acceder como profesor con permisos de edición y calificación.
        </p>

        {courses.length === 0 ? (
          <div className="mt-4 rounded-3xl border border-dashed border-border p-10 text-center">
            <p className="text-sm font-medium text-foreground/70">
              No tienes cursos asignados actualmente.
            </p>
          </div>
        ) : (
          <div className="mt-4 grid grid-cols-1 gap-5 md:grid-cols-2">
            {courses.map((course) => (
              <div
                key={course.course_mapping_id}
                className="flex flex-col justify-between rounded-3xl border border-border/80 bg-background/50 p-6 shadow-sm hover:border-violet-500/40 transition-all"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="rounded-lg bg-violet-500/10 px-2.5 py-1 font-mono text-[11px] font-semibold text-violet-400">
                      {course.course_code}
                    </span>
                    <span className="rounded-full bg-violet-500/10 px-2.5 py-0.5 text-[11px] font-medium text-violet-400 border border-violet-500/20">
                      Docente Titular
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
                    className="w-full bg-violet-600 hover:bg-violet-500 shadow-violet-500/20"
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
