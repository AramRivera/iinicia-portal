'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { coursesApi } from '@/lib/api';
import type { AuthorizedCourse } from '@/types';
import { LaunchCourseButton } from '@/components/moodle/LaunchCourseButton';
import { MoodleSyncBadge } from '@/components/moodle/MoodleSyncBadge';
import { CampusShell } from '@/components/campus-tech/CampusShell';
import {
  IconTeachers,
  IconGroups,
  IconSchedule,
  IconExternalLink,
  IconAlertTriangle,
  IconCheck,
} from '@/components/campus-tech/Icons';

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
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <p className="text-xs font-medium text-muted">Cargando panel docente Campus Tech OS...</p>
        </div>
      </div>
    );
  }

  return (
    <CampusShell
      currentTab="materias"
      onSelectTab={() => {}}
      breadcrumbs={['Campus Tech OS', 'Portal Docente', 'Mis Asignaturas']}
      counts={{
        courses: courses.length,
      }}
    >
      <div className="space-y-6">
        {/* Header Docente - Campus Tech OS */}
        <div className="rounded-[10px] border border-border bg-surface p-5 sm:p-6 shadow-minimal transition-all">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-[4px] bg-primary/10 px-2 py-0.5 text-[11px] font-mono font-semibold text-primary border border-primary/20">
                  Cuerpo Docente
                </span>
                <span className="rounded-[4px] bg-accent-lime/20 px-2 py-0.5 text-[11px] font-mono font-semibold text-foreground border border-accent-lime/40">
                  Profesor Titular
                </span>
                <MoodleSyncBadge
                  status={user?.moodle_sync_status}
                  moodleId={user?.moodle_user_id}
                />
              </div>
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
                Prof. {user?.first_name} {user?.last_name}
              </h1>
              <p className="text-xs sm:text-sm text-muted">
                Gestión de asignaturas, actas de evaluación y acceso directo con privilegios docentes en Moodle LMS.
              </p>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-1 gap-3 border-t border-border pt-4 sm:grid-cols-3">
            <div className="rounded-[8px] border border-border bg-surface-muted/30 p-3.5">
              <span className="text-[11px] font-mono uppercase tracking-wider text-muted">Cuenta Moodle</span>
              <p className="mt-1 font-mono text-sm font-semibold text-foreground">
                {user?.moodle_username || 'profesor'}
              </p>
            </div>
            <div className="rounded-[8px] border border-border bg-surface-muted/30 p-3.5">
              <span className="text-[11px] font-mono uppercase tracking-wider text-muted">Cursos a Cargo</span>
              <p className="mt-1 text-sm font-semibold text-foreground">
                {courses.length} asignatura(s) activas
              </p>
            </div>
            <div className="rounded-[8px] border border-border bg-surface-muted/30 p-3.5">
              <span className="text-[11px] font-mono uppercase tracking-wider text-muted">Periodo Académico</span>
              <p className="mt-1 text-sm font-semibold text-primary">
                2026-A • Campus Central
              </p>
            </div>
          </div>

          {/* Aviso de Acceso y Sesión en Moodle */}
          <div className="mt-4 rounded-[8px] border border-primary/20 bg-primary/5 p-3.5 text-xs text-foreground/85 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-start gap-2.5">
              <IconTeachers className="w-4 h-4 text-primary shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-foreground">Acceso Docente al Aula Moodle</p>
                <p className="mt-0.5 text-muted leading-relaxed">
                  Al pulsar <strong>&quot;Entrar al Aula&quot;</strong> serás transferido a Moodle LMS con privilegios docentes y sesión SSO instantánea.
                </p>
              </div>
            </div>
            <div className="shrink-0 rounded-[6px] border border-border bg-surface px-2.5 py-1.5 font-mono text-[11px] text-foreground">
              Usuario: <span className="font-bold text-primary">{user?.moodle_username || 'profesor'}</span>
            </div>
          </div>
        </div>

        {error && (
          <div className="rounded-[8px] border border-danger/30 bg-danger/10 p-3.5 text-xs font-medium text-danger flex items-center gap-2">
            <IconAlertTriangle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Cursos Asignados */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-foreground">
                Cursos Asignados para Impartir
              </h2>
              <p className="text-xs text-muted">
                Accede a las aulas de Moodle para editar materiales, registrar asistencia y asentar calificaciones.
              </p>
            </div>
            <span className="rounded-[4px] bg-surface-muted px-2 py-1 text-xs font-mono font-medium text-muted">
              {courses.length} materias
            </span>
          </div>

          {courses.length === 0 ? (
            <div className="rounded-[10px] border border-dashed border-border bg-surface p-10 text-center">
              <IconGroups className="w-8 h-8 text-muted mx-auto mb-2 opacity-50" />
              <p className="text-xs font-medium text-foreground">
                No tienes cursos asignados actualmente.
              </p>
              <p className="text-[11px] text-muted mt-1">
                Comunícate con la coordinación académica para vincular tus grupos asignados.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {courses.map((course) => (
                <div
                  key={course.course_mapping_id}
                  className="flex flex-col justify-between rounded-[10px] border border-border bg-surface p-5 shadow-minimal hover:border-primary/40 transition-all"
                >
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="rounded-[4px] bg-primary/10 px-2 py-0.5 font-mono text-[11px] font-semibold text-primary">
                        {course.course_code}
                      </span>
                      <span className="rounded-[4px] bg-surface-muted px-2 py-0.5 text-[11px] font-medium text-muted border border-border">
                        Docente Titular
                      </span>
                    </div>
                    <h3 className="mt-3 text-base font-semibold text-foreground">
                      {course.course_name}
                    </h3>
                    <p className="mt-1 text-xs text-muted font-mono">
                      Moodle ID: #{course.moodle_course_id}
                    </p>
                  </div>

                  <div className="mt-5 border-t border-border pt-3.5">
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
      </div>
    </CampusShell>
  );
}
