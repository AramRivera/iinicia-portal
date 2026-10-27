'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { coursesApi, enrollmentsApi } from '@/lib/api';
import type { AuthorizedCourse, CourseOffering, EnrollmentRequest } from '@/types';
import { LaunchCourseButton } from '@/components/moodle/LaunchCourseButton';
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

export default function EstudianteDashboardPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  const [courses, setCourses] = useState<AuthorizedCourse[]>([]);
  const [offerings, setOfferings] = useState<CourseOffering[]>([]);
  const [enrollments, setEnrollments] = useState<EnrollmentRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [enrollingId, setEnrollingId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadData = async () => {
    try {
      setLoading(true);
      const [userCourses, myEnrollments, allOfferings] = await Promise.all([
        coursesApi.getAuthorizedCourses().catch(() => []),
        enrollmentsApi.getMyEnrollments().catch(() => []),
        coursesApi.getOfferings().catch(() => []),
      ]);
      setCourses(userCourses);
      setEnrollments(myEnrollments);
      setOfferings(allOfferings);
    } catch (err: any) {
      setError(err.message || 'No fue posible cargar tus cursos.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.push('/login');
      return;
    }

    loadData();
  }, [user, authLoading, router]);

  const handleQuickEnroll = async (courseMappingId: string, courseName: string) => {
    setEnrollingId(courseMappingId);
    setNotice(null);
    setError(null);

    try {
      await enrollmentsApi.requestEnrollment(courseMappingId);
      setNotice(`¡Te has inscrito exitosamente a "${courseName}"! Ya está disponible en tus materias activas.`);
      await loadData();
    } catch (err: any) {
      setError(err.message || 'Error al inscribirse en el curso.');
    } finally {
      setEnrollingId(null);
    }
  };

  const enrolledMappingIds = new Set(courses.map((c) => c.course_mapping_id));
  const availableToEnroll = offerings.filter(
    (off) => !enrolledMappingIds.has(off.course_mapping_id),
  );

  if (authLoading || loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <p className="text-xs font-medium text-muted">Cargando tu aula virtual Campus Tech OS...</p>
        </div>
      </div>
    );
  }

  return (
    <CampusShell
      currentTab="cursos"
      onSelectTab={() => {}}
      breadcrumbs={['Campus Tech OS', 'Portal Estudiante', 'Mis Materias']}
      counts={{
        courses: courses.length,
        enrollments: enrollments.length,
      }}
    >
      <div className="space-y-6">
        {/* Header Estudiante - Campus Tech OS */}
        <div className="rounded-[10px] border border-border bg-surface p-5 sm:p-6 shadow-minimal transition-all">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-[4px] bg-primary/10 px-2 py-0.5 text-[11px] font-mono font-semibold text-primary border border-primary/20">
                  Estudiante Regular
                </span>
                <span className="rounded-[4px] bg-accent-lime/20 px-2 py-0.5 text-[11px] font-mono font-semibold text-foreground border border-accent-lime/40">
                  Periodo 2026-A
                </span>
                <MoodleSyncBadge
                  status={user?.moodle_sync_status}
                  moodleId={user?.moodle_user_id}
                />
              </div>
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
                ¡Hola, {user?.first_name}!
              </h1>
              <p className="text-xs sm:text-sm text-muted">
                Bienvenido a tu espacio académico interactivo. Accede a tus aulas de Moodle LMS con SSO directo.
              </p>
            </div>

            <Link
              href="/cursos"
              className="inline-flex items-center justify-center gap-1.5 rounded-[6px] border border-border bg-surface hover:bg-surface-muted px-3.5 py-2 text-xs font-medium text-foreground transition-all shadow-minimal shrink-0"
            >
              <span>Explorar catálogo</span>
              <IconExternalLink className="w-3.5 h-3.5 text-primary" />
            </Link>
          </div>

          <div className="mt-5 grid grid-cols-1 gap-3 border-t border-border pt-4 sm:grid-cols-3">
            <div className="rounded-[8px] border border-border bg-surface-muted/30 p-3.5">
              <span className="text-[11px] font-mono uppercase tracking-wider text-muted">Usuario en Moodle</span>
              <p className="mt-1 font-mono text-sm font-semibold text-foreground">
                {user?.moodle_username || 'estudiante1'}
              </p>
            </div>
            <div className="rounded-[8px] border border-border bg-surface-muted/30 p-3.5">
              <span className="text-[11px] font-mono uppercase tracking-wider text-muted">Materias Activas</span>
              <p className="mt-1 text-sm font-semibold text-foreground">
                {courses.length} curso(s) matriculado(s)
              </p>
            </div>
            <div className="rounded-[8px] border border-border bg-surface-muted/30 p-3.5">
              <span className="text-[11px] font-mono uppercase tracking-wider text-muted">Estado Académico</span>
              <p className="mt-1 text-sm font-semibold capitalize text-emerald-600 dark:text-emerald-400">
                {user?.status || 'activo'}
              </p>
            </div>
          </div>

          {/* Aviso de Acceso y Sesión en Moodle */}
          <div className="mt-4 rounded-[8px] border border-primary/20 bg-primary/5 p-3.5 text-xs text-foreground/85 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-start gap-2.5">
              <IconStudents className="w-4 h-4 text-primary shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-foreground">Acceso Directo al Campus Moodle</p>
                <p className="mt-0.5 text-muted leading-relaxed">
                  Al pulsar <strong>&quot;Entrar al Aula&quot;</strong> serás transferido a Moodle LMS con sesión SSO automática sin volver a escribir tu contraseña.
                </p>
              </div>
            </div>
            <div className="shrink-0 rounded-[6px] border border-border bg-surface px-2.5 py-1.5 font-mono text-[11px] text-foreground">
              Usuario: <span className="font-bold text-primary">{user?.moodle_username || 'estudiante1'}</span>
            </div>
          </div>
        </div>

        {notice && (
          <div className="rounded-[8px] border border-emerald-500/25 bg-emerald-500/10 p-3.5 text-xs font-medium text-emerald-700 dark:text-emerald-400 flex items-center justify-between shadow-minimal">
            <div className="flex items-center gap-2">
              <IconCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span>{notice}</span>
            </div>
            <button type="button" onClick={() => setNotice(null)} className="text-xs opacity-70 hover:opacity-100">
              ✕
            </button>
          </div>
        )}

        {error && (
          <div className="rounded-[8px] border border-danger/30 bg-danger/10 p-3.5 text-xs font-medium text-danger flex items-center justify-between shadow-minimal">
            <div className="flex items-center gap-2">
              <IconAlertTriangle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
            <button type="button" onClick={() => setError(null)} className="text-xs opacity-70 hover:opacity-100">
              ✕
            </button>
          </div>
        )}

        {/* Sección: Cursos Autorizados en Moodle */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-foreground">
                Mis Cursos y Aulas Virtuales
              </h2>
              <p className="text-xs text-muted">
                Aulas oficiales con recursos, tareas y foros en Moodle LMS.
              </p>
            </div>
            <span className="rounded-[4px] bg-surface-muted px-2 py-1 text-xs font-mono font-medium text-muted">
              {courses.length} inscritas
            </span>
          </div>

          {courses.length === 0 ? (
            <div className="rounded-[10px] border border-dashed border-border bg-surface p-10 text-center">
              <IconGroups className="w-8 h-8 text-muted mx-auto mb-2 opacity-50" />
              <p className="text-xs font-medium text-foreground">
                Aún no tienes cursos autorizados en Moodle.
              </p>
              <p className="text-[11px] text-muted mt-1 max-w-sm mx-auto">
                Inscríbete a continuación en alguna de las materias disponibles para habilitar tu aula virtual.
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
                      <span className="rounded-[4px] bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                        Matrícula Activa
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

        {/* Sección: Cursos Disponibles para Tomar */}
        {availableToEnroll.length > 0 && (
          <div className="space-y-4 pt-4 border-t border-border">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-semibold text-foreground">
                  Cursos Disponibles para Inscripción Inmediata
                </h2>
                <p className="text-xs text-muted">
                  Materias abiertas en el portal. Inscríbete con un solo clic y matricúlate automáticamente en Moodle LMS.
                </p>
              </div>
              <Link
                href="/cursos"
                className="text-xs font-semibold text-primary hover:underline"
              >
                Ver todos →
              </Link>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {availableToEnroll.map((off) => {
                const isSubmitting = enrollingId === off.course_mapping_id;

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
                        <span className="rounded-[4px] bg-primary/10 px-2 py-0.5 text-[11px] font-mono text-primary border border-primary/20">
                          Moodle ID #{off.moodle_course_id}
                        </span>
                      </div>
                      <h3 className="mt-3 text-base font-semibold text-foreground">
                        {off.name}
                      </h3>
                      <p className="mt-1 text-xs text-muted">
                        Programa: {off.program_name} • {off.credits} créditos SATCA
                      </p>
                    </div>

                    <div className="mt-5 border-t border-border pt-3.5">
                      <button
                        type="button"
                        onClick={() => handleQuickEnroll(off.course_mapping_id, off.name)}
                        disabled={isSubmitting}
                        className="w-full rounded-[6px] bg-primary px-4 py-2 text-xs font-semibold text-white shadow-minimal hover:bg-primary/90 transition-all disabled:opacity-50 active:scale-[0.98] flex items-center justify-center gap-1.5"
                      >
                        {isSubmitting ? (
                          <>
                            <span className="h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" />
                            <span>Matriculando en Moodle...</span>
                          </>
                        ) : (
                          <>
                            <IconPlus className="w-3.5 h-3.5 text-accent-lime" />
                            <span>Inscribirme y Empezar Curso</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Sección: Historial de Solicitudes */}
        <div className="space-y-3 pt-4 border-t border-border">
          <h2 className="text-base font-semibold text-foreground">
            Historial de Inscripciones y Solicitudes
          </h2>
          <div className="rounded-[10px] border border-border bg-surface overflow-hidden shadow-minimal">
            {enrollments.length === 0 ? (
              <div className="p-6 text-center text-xs text-muted">
                No tienes solicitudes de matrícula recientes.
              </div>
            ) : (
              <table className="w-full text-left text-xs">
                <thead className="bg-surface-muted/60 text-muted font-medium border-b border-border">
                  <tr>
                    <th className="px-5 py-3">Materia</th>
                    <th className="px-5 py-3">Estado Portal</th>
                    <th className="px-5 py-3">Moodle Sync</th>
                    <th className="px-5 py-3 text-right">Fecha</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {enrollments.map((enr) => (
                    <tr key={enr.id} className="hover:bg-surface-muted/30 transition-colors">
                      <td className="px-5 py-3.5 font-medium text-foreground">
                        {enr.course_mappings?.courses?.name || enr.course_mappings?.code || 'Curso IINICIA'}
                      </td>
                      <td className="px-5 py-3.5">
                        <span className="capitalize text-foreground font-medium">
                          {enr.status}
                        </span>
                      </td>
                      <td className="px-5 py-3.5">
                        <MoodleSyncBadge status={enr.moodle_sync_status} />
                      </td>
                      <td className="px-5 py-3.5 text-right font-mono text-muted text-[11px]">
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
    </CampusShell>
  );
}
