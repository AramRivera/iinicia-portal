'use client';

import React, { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { coursesApi, enrollmentsApi, moodleApi, usersApi } from '@/lib/api';
import type { AuthorizedCourse, CourseOffering, EnrollmentRequest, MoodleCourseProgress } from '@/types';
import { LaunchCourseButton } from '@/components/moodle/LaunchCourseButton';
import { MoodleSyncBadge } from '@/components/moodle/MoodleSyncBadge';
import { CampusShell } from '@/components/campus-tech/CampusShell';
import {
  closeMoodleLaunchWindow,
  navigateMoodleLaunchWindow,
  openMoodleLaunchWindow,
} from '@/lib/moodle-window';
import {
  IconStudents,
  IconGroups,
  IconCheck,
  IconAlertTriangle,
  IconPlus,
  IconExternalLink,
  IconClose,
  IconGrades,
  IconBookOpen,
  IconClock,
  IconSearch,
  IconRefresh,
  IconSettings,
} from '@/components/campus-tech/Icons';

type StudentTab = 'cursos' | 'inscripciones' | 'calificaciones' | 'moodle' | 'perfil';

interface CourseDropTarget {
  enrollmentId: string;
  courseName: string;
  courseCode: string;
}

export default function EstudianteDashboardPage() {
  const router = useRouter();
  const { user, loading: authLoading, refreshUser } = useAuth();

  const [activeTab, setActiveTab] = useState<StudentTab>('cursos');
  const [courses, setCourses] = useState<AuthorizedCourse[]>([]);
  const [offerings, setOfferings] = useState<CourseOffering[]>([]);
  const [enrollments, setEnrollments] = useState<EnrollmentRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Modales interactivos
  const [dropTarget, setDropTarget] = useState<CourseDropTarget | null>(null);
  const [syllabusTarget, setSyllabusTarget] = useState<AuthorizedCourse | null>(null);
  const [courseProgressMap, setCourseProgressMap] = useState<Record<number, MoodleCourseProgress>>({});
  const [moodleContents, setMoodleContents] = useState<any[]>([]);
  const [loadingContents, setLoadingContents] = useState(false);
  const [editProfileOpen, setEditProfileOpen] = useState(false);
  const [profileForm, setProfileForm] = useState({
    first_name: '',
    last_name: '',
    phone: '',
    bio: '',
  });

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [userCourses, myEnrollments, allOfferings] = await Promise.all([
        coursesApi.getAuthorizedCourses(),
        enrollmentsApi.getMyEnrollments(),
        coursesApi.getOfferings(),
      ]);
      setCourses(userCourses);
      setEnrollments(myEnrollments);
      setOfferings(allOfferings);

      // Cargar progreso en tiempo real desde Moodle LMS para cada materia
      if (userCourses.length > 0) {
        const progMap: Record<number, MoodleCourseProgress> = {};
        await Promise.all(
          userCourses.map(async (c) => {
            if (c.moodle_course_id) {
              try {
                const prog = await moodleApi.getCourseProgress(
                  c.moodle_course_id,
                  user?.moodle_user_id || undefined,
                );
                if (prog) progMap[c.moodle_course_id] = prog;
              } catch {
                // Silencioso si Moodle está procesando
              }
            }
          }),
        );
        setCourseProgressMap(progMap);
      }
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
    if (!user.roles.includes('estudiante') && !user.roles.includes('superadministrador')) {
      router.replace('/dashboard');
      return;
    }

    loadData();
  }, [user, authLoading, router]);

  const handleOpenSyllabus = async (course: AuthorizedCourse) => {
    setSyllabusTarget(course);
    setMoodleContents([]);
    setLoadingContents(true);
    try {
      const contents = await moodleApi.getCourseContents(course.moodle_course_id);
      setMoodleContents(contents || []);
    } catch {
      setMoodleContents([]);
    } finally {
      setLoadingContents(false);
    }
  };

  const handleLaunchCampusSSO = async () => {
    const launchWindow = openMoodleLaunchWindow();
    if (!launchWindow) {
      setError('Permite las ventanas emergentes para abrir Moodle.');
      return;
    }
    setActionLoading('launch-campus');
    setNotice(null);
    setError(null);

    try {
      const res = await moodleApi.launchCampus();
      navigateMoodleLaunchWindow(launchWindow, res.access_url);
      setNotice('Sesión iniciada en el Campus Virtual Moodle vía SSO.');
    } catch (err: any) {
      closeMoodleLaunchWindow(launchWindow);
      setError(err.message || 'Error al iniciar sesión SSO en Moodle.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleLaunchCourseSSO = async (courseMappingId: string) => {
    const launchWindow = openMoodleLaunchWindow();
    if (!launchWindow) {
      setError('Permite las ventanas emergentes para abrir Moodle.');
      return;
    }
    setActionLoading(`launch-${courseMappingId}`);
    setNotice(null);
    setError(null);

    try {
      const res = await coursesApi.launchCourse(courseMappingId);
      navigateMoodleLaunchWindow(launchWindow, res.access_url);
    } catch (err: any) {
      closeMoodleLaunchWindow(launchWindow);
      setError(err.message || 'Error al acceder al aula virtual en Moodle vía SSO.');
    } finally {
      setActionLoading(null);
    }
  };

  // Inscripción rápida en un curso disponible
  const handleQuickEnroll = async (courseMappingId: string, courseName: string) => {
    setActionLoading(`enroll-${courseMappingId}`);
    setNotice(null);
    setError(null);

    try {
      await enrollmentsApi.requestEnrollment(courseMappingId);
      setNotice(
        `Tu solicitud para "${courseName}" quedó registrada. Un administrador debe autorizar la matrícula en Moodle.`,
      );
      await loadData();
    } catch (err: any) {
      setError(err.message || 'Error al inscribirse en el curso.');
    } finally {
      setActionLoading(null);
    }
  };

  // Dar de baja materia / desasignar curso
  const handleConfirmDropCourse = async () => {
    if (!dropTarget) return;

    setActionLoading(`drop-${dropTarget.enrollmentId}`);
    setNotice(null);
    setError(null);

    try {
      await enrollmentsApi.deleteEnrollment(dropTarget.enrollmentId);
      setNotice(
        `La solicitud de baja de "${dropTarget.courseName}" se retiró del portal. Consulta con administración el estado del aula virtual.`,
      );
      setDropTarget(null);
      await loadData();
    } catch (err: any) {
      setError(err.message || 'Error al dar de baja la materia.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleOpenEditProfile = () => {
    setProfileForm({
      first_name: user?.first_name || '',
      last_name: user?.last_name || '',
      phone: user?.phone || '',
      bio: (user as any)?.bio || '',
    });
    setEditProfileOpen(true);
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionLoading('save-profile');
    setNotice(null);
    setError(null);

    try {
      await usersApi.updateOwnProfile({
        first_name: profileForm.first_name.trim(),
        last_name: profileForm.last_name.trim(),
        phone: profileForm.phone.trim(),
        bio: profileForm.bio.trim(),
      });
      await refreshUser();
      setNotice('Tu expediente y perfil han sido actualizados con éxito.');
      setEditProfileOpen(false);
    } catch (err: any) {
      setError(err.message || 'No fue posible actualizar tu perfil.');
    } finally {
      setActionLoading(null);
    }
  };

  const enrolledMappingIds = useMemo(
    () => new Set(courses.map((c) => c.course_mapping_id)),
    [courses],
  );

  const availableOfferings = useMemo(() => {
    let list = offerings.filter((off) => !enrolledMappingIds.has(off.course_mapping_id || off.id));
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (off) =>
          (off.name || '').toLowerCase().includes(q) ||
          (off.code || '').toLowerCase().includes(q) ||
          (off.program_name || '').toLowerCase().includes(q),
      );
    }
    return list;
  }, [offerings, enrolledMappingIds, searchQuery]);

  const filteredEnrolledCourses = useMemo(() => {
    if (!searchQuery.trim()) return courses;
    const q = searchQuery.toLowerCase().trim();
    return courses.filter(
      (c) =>
        (c.course_name || '').toLowerCase().includes(q) ||
        (c.course_code || '').toLowerCase().includes(q) ||
        (c.program_name || '').toLowerCase().includes(q),
    );
  }, [courses, searchQuery]);

  // Mapa de enrollment_id para cada curso autorizado
  const courseEnrollmentMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const enr of enrollments) {
      if (enr.course_mapping_id) {
        map.set(enr.course_mapping_id, enr.id);
      }
    }
    return map;
  }, [enrollments]);

  // Cálculos de avance curricular y kárdex consolidado
  const kardexSummary = useMemo(() => {
    let accreditedCount = 0;
    let gradedSum = 0;
    let gradedCount = 0;
    let totalCredits = 0;

    for (const c of courses) {
      const offering = offerings.find(
        (o) => o.course_mapping_id === c.course_mapping_id || o.id === c.course_mapping_id,
      );
      totalCredits += offering?.credits ?? 0;

      if (c.cached_final_grade != null) {
        const num = Number(c.cached_final_grade);
        gradedSum += num;
        gradedCount += 1;
        if (num >= 6) accreditedCount += 1;
      }
    }

    const average = gradedCount > 0 ? (gradedSum / gradedCount).toFixed(1) : null;
    return {
      totalCourses: courses.length,
      accreditedCount,
      average,
      totalCredits,
    };
  }, [courses, offerings]);

  const getBreadcrumbs = (tab: StudentTab) => {
    switch (tab) {
      case 'cursos':
        return ['INICIA', 'Portal Estudiante', 'Mis Materias Activas'];
      case 'inscripciones':
        return ['INICIA', 'Portal Estudiante', 'Catálogo e Inscripción'];
      case 'calificaciones':
        return ['INICIA', 'Portal Estudiante', 'Kárdex y Avance Curricular'];
      case 'perfil':
        return ['INICIA', 'Portal Estudiante', 'Expediente Escolar'];
      default:
        return ['INICIA', 'Portal Estudiante'];
    }
  };

  if (authLoading || loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <p className="text-xs font-medium text-muted">Cargando tu aula virtual...</p>
        </div>
      </div>
    );
  }

  return (
    <CampusShell
      currentTab={activeTab}
      onSelectTab={(tabId) => {
        if (tabId === 'moodle') {
          handleLaunchCampusSSO();
        } else {
          setActiveTab(tabId as StudentTab);
        }
      }}
      breadcrumbs={getBreadcrumbs(activeTab)}
      counts={{
        courses: courses.length,
        enrollments: enrollments.length,
      }}
      onLaunchCampusSSO={handleLaunchCampusSSO}
    >
      <div className="space-y-6">
        {/* Header Estudiante */}
        <div className="rounded-[10px] border border-border bg-surface p-5 sm:p-6 shadow-minimal transition-all">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-[4px] bg-primary/10 px-2 py-0.5 text-[11px] font-mono font-semibold text-primary border border-primary/20">
                  Estudiante Regular
                </span>
                <span className="rounded-[4px] bg-accent-lime/20 px-2 py-0.5 text-[11px] font-mono font-semibold text-foreground border border-accent-lime/40">
                  Campus Virtual Activo
                </span>
                <MoodleSyncBadge
                  status={user?.moodle_sync_status}
                  moodleId={user?.moodle_user_id}
                />
              </div>
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
                ¡Hola, {user?.first_name || 'Estudiante'}!
              </h1>
              <p className="text-xs sm:text-sm text-muted">
                Bienvenido a tu entorno de aprendizaje. Accede a tus materias, consulta calificaciones e interactúa en Moodle LMS.
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={handleLaunchCampusSSO}
                disabled={actionLoading === 'launch-campus'}
                className="inline-flex items-center justify-center gap-1.5 rounded-[6px] bg-primary-action text-white font-medium px-3.5 py-2 text-xs shadow-minimal hover:bg-primary-action/90 active:scale-[0.98] transition-all disabled:opacity-50"
                title="Abrir Moodle con sesión iniciada al instante"
              >
                {actionLoading === 'launch-campus' ? (
                  <>
                    <span className="h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    <span>Iniciando SSO...</span>
                  </>
                ) : (
                  <>
                    <IconExternalLink className="w-3.5 h-3.5 text-accent-lime" />
                    <span>Campus Virtual Moodle</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={loadData}
                className="h-8 w-8 rounded-[6px] border border-border bg-surface hover:bg-surface-muted text-muted hover:text-foreground flex items-center justify-center transition-all"
                title="Actualizar datos"
              >
                <IconRefresh className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Tarjetas de Métricas Operativas del Alumno */}
          <div className="mt-5 grid grid-cols-1 gap-3 border-t border-border pt-4 sm:grid-cols-4">
            <div className="rounded-[8px] border border-border bg-surface-muted/30 p-3.5">
              <span className="text-[11px] font-mono uppercase tracking-wider text-muted">Usuario Moodle</span>
              <p className="mt-1 font-mono text-sm font-semibold text-foreground">
                {user?.moodle_username || 'estudiante'}
              </p>
              <span className="text-[11px] text-muted mt-0.5 block">Identificador de acceso</span>
            </div>

            <div className="rounded-[8px] border border-border bg-surface-muted/30 p-3.5">
              <span className="text-[11px] font-mono uppercase tracking-wider text-muted">Materias Activas</span>
              <p className="mt-1 text-sm font-semibold text-foreground">
                {courses.length} curso(s) cursando
              </p>
              <span className="text-[11px] text-muted mt-0.5 block">Con acceso a tareas y foros</span>
            </div>

            <div className="rounded-[8px] border border-border bg-surface-muted/30 p-3.5">
              <span className="text-[11px] font-mono uppercase tracking-wider text-muted">Créditos SATCA</span>
              <p className="mt-1 text-sm font-semibold text-foreground">
                {kardexSummary.totalCredits} créditos
              </p>
              <span className="text-[11px] text-muted mt-0.5 block">Valor curricular acumulado</span>
            </div>

            <div className="rounded-[8px] border border-border bg-surface-muted/30 p-3.5">
              <span className="text-[11px] font-mono uppercase tracking-wider text-muted">Estado Escolar</span>
              <p className="mt-1 text-sm font-semibold capitalize text-emerald-600 dark:text-emerald-400">
                {user?.status || 'activo'}
              </p>
              <span className="text-[11px] text-muted mt-0.5 block">Inscripción regular vigente</span>
            </div>
          </div>
        </div>

        {/* Notificaciones y Avisos */}
        {notice && (
          <div className="rounded-[8px] border border-emerald-500/25 bg-emerald-500/10 p-3.5 text-xs font-medium text-emerald-700 dark:text-emerald-400 flex items-center justify-between shadow-minimal">
            <div className="flex items-center gap-2">
              <IconCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span>{notice}</span>
            </div>
            <button
              type="button"
              onClick={() => setNotice(null)}
              className="text-xs text-muted hover:text-foreground"
            >
              <IconClose className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {error && (
          <div className="rounded-[8px] border border-danger/30 bg-danger/10 p-3.5 text-xs font-medium text-danger flex items-center justify-between shadow-minimal">
            <div className="flex items-center gap-2">
              <IconAlertTriangle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
            <button
              type="button"
              onClick={() => setError(null)}
              className="text-xs text-muted hover:text-foreground"
            >
              <IconClose className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* ========================================================================= */}
        {/* PESTAÑA 1: MIS MATERIAS ACTIVAS (CON OPCIÓN DE DESASIGNAR / DAR DE BAJA)  */}
        {/* ========================================================================= */}
        {activeTab === 'cursos' && (
          <div className="space-y-4">
            <div className="rounded-[10px] border border-border bg-surface p-5 shadow-minimal">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
                    <IconGroups className="w-5 h-5 text-primary" />
                    <span>Mis Aulas y Asignaturas Activas</span>
                  </h2>
                  <p className="text-xs text-muted mt-0.5">
                    Entra a tus cursos en Moodle, consulta materiales de estudio o gestiona tu carga académica.
                  </p>
                </div>

                <div className="flex items-center gap-2.5">
                  <div className="relative w-full sm:w-64">
                    <input
                      type="text"
                      placeholder="Buscar en mis materias..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full rounded-[6px] border border-border bg-surface-muted/40 px-3 py-1.5 text-xs text-foreground placeholder:text-muted focus:border-primary focus:bg-surface focus:outline-none transition-all"
                    />
                    {searchQuery && (
                      <button
                        type="button"
                        onClick={() => setSearchQuery('')}
                        className="absolute right-2.5 top-2 text-xs text-muted hover:text-foreground"
                      >
                        <IconClose className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveTab('inscripciones')}
                    className="inline-flex items-center gap-1.5 rounded-[6px] bg-primary-action px-3 py-1.5 text-xs font-semibold text-white shadow-minimal hover:bg-primary-action/90 transition-all shrink-0"
                  >
                    <IconPlus className="w-3.5 h-3.5" />
                    <span>Inscribir más materias</span>
                  </button>
                </div>
              </div>
            </div>

            {filteredEnrolledCourses.length === 0 ? (
              <div className="rounded-[10px] border border-dashed border-border bg-surface p-10 text-center">
                <IconGroups className="w-8 h-8 text-muted mx-auto mb-2 opacity-50" />
                <p className="text-xs font-medium text-foreground">
                  {searchQuery
                    ? 'No se encontraron materias que coincidan con la búsqueda.'
                    : 'Aún no tienes cursos inscritos en tu aula virtual.'}
                </p>
                <p className="text-[11px] text-muted mt-1 max-w-sm mx-auto">
                  Explora las materias disponibles y solicita tu matrícula.
                </p>
                <div className="pt-3">
                  <button
                    type="button"
                    onClick={() => setActiveTab('inscripciones')}
                    className="rounded-[6px] bg-primary-action px-4 py-2 text-xs font-semibold text-white shadow-minimal hover:bg-primary-action/90 transition-all"
                  >
                    Ver catálogo disponible
                  </button>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {filteredEnrolledCourses.map((course, index) => {
                  const courseKey = course.course_mapping_id || `enrolled-${index}`;
                  const enrollmentId =
                    course.enrollment_id ||
                    courseEnrollmentMap.get(course.course_mapping_id) ||
                    '';

                  return (
                    <div
                      key={courseKey}
                      className="flex flex-col justify-between rounded-[10px] border border-border bg-surface p-5 shadow-minimal hover:border-primary/40 transition-all"
                    >
                      <div>
                        <div className="flex items-center justify-between">
                          <span className="rounded-[4px] bg-primary/10 px-2 py-0.5 font-mono text-[11px] font-semibold text-primary">
                            {course.course_code || course.portal_course_code}
                          </span>
                          <span className="rounded-[4px] bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                            Matrícula Oficial
                          </span>
                        </div>

                        <h3 className="mt-3 text-base font-semibold text-foreground">
                          {course.course_name}
                        </h3>

                        <p className="mt-1 text-xs text-muted">
                          {course.program_name ? `Programa: ${course.program_name} • ` : ''}
                          Moodle ID #{course.moodle_course_id}
                        </p>

                        {/* Barra de Progreso Didáctico enlazada con Moodle */}
                        {(() => {
                          const prog = courseProgressMap[course.moodle_course_id];
                          const rawProgress = prog?.progress_percentage;
                          const pct = typeof rawProgress === 'number' && Number.isFinite(rawProgress)
                            ? Math.min(100, Math.max(0, rawProgress))
                            : null;
                          return (
                            <div className="mt-4 space-y-1.5">
                              <div className="flex justify-between text-[11px] text-muted">
                                <span>Avance del Curso (Moodle)</span>
                                <span className="font-mono font-medium text-foreground">
                                  {pct === null ? 'Progreso no disponible' : `${pct}% completado`}
                                </span>
                              </div>
                              <div className="h-1.5 w-full rounded-full bg-surface-muted overflow-hidden">
                                {pct !== null && (
                                  <div
                                    className="h-full rounded-full bg-primary-action transition-all duration-300"
                                    style={{ width: `${pct}%` }}
                                  />
                                )}
                              </div>
                              {prog?.total_modules != null && (
                                <div className="flex justify-between text-[10px] text-muted font-mono pt-0.5">
                                  <span>{prog.total_modules} actividades / recursos</span>
                                  {prog.grade_formatted && prog.grade_formatted !== '-' && (
                                    <span className="font-semibold text-primary">Nota: {prog.grade_formatted}</span>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })()}

                        {/* Accesos de Temario y Consulta */}
                        <div className="mt-3.5 flex items-center gap-2 text-[11px]">
                          <button
                            type="button"
                            onClick={() => handleOpenSyllabus(course)}
                            className="inline-flex items-center gap-1 text-muted hover:text-primary transition-colors py-1"
                          >
                            <IconBookOpen className="w-3.5 h-3.5" />
                            <span>Ver temario y contenidos Moodle</span>
                          </button>
                        </div>
                      </div>

                      <div className="mt-5 border-t border-border pt-3.5 flex items-center gap-2">
                        <LaunchCourseButton
                          courseMappingId={course.course_mapping_id}
                          courseName={course.course_name}
                          isAuthorized={true}
                          className="flex-1"
                        />

                        {enrollmentId && (
                          <button
                            type="button"
                            onClick={() =>
                              setDropTarget({
                                enrollmentId,
                                courseName: course.course_name,
                                courseCode: course.course_code || '',
                              })
                            }
                            className="rounded-[6px] border border-border bg-surface hover:border-danger/40 hover:bg-danger/10 hover:text-danger px-3 py-2 text-xs font-medium text-muted transition-all"
                            title="Dar de baja esta materia"
                          >
                            Dar de baja
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ========================================================================= */}
        {/* PESTAÑA 2: CATÁLOGO E INSCRIPCIÓN DE MATERIAS NUEVAS                      */}
        {/* ========================================================================= */}
        {activeTab === 'inscripciones' && (
          <div className="space-y-4">
            <div className="rounded-[10px] border border-border bg-surface p-5 shadow-minimal">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
                    <IconPlus className="w-5 h-5 text-primary" />
                    <span>Catálogo de Cursos Disponibles para Inscripción</span>
                  </h2>
                  <p className="text-xs text-muted mt-0.5">
                    Selecciona una materia para solicitarla. Verás el acceso a Moodle cuando se autorice y sincronice la matrícula.
                  </p>
                </div>

                <div className="relative w-full sm:w-64">
                  <input
                    type="text"
                    placeholder="Filtrar por curso o programa..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full rounded-[6px] border border-border bg-surface-muted/40 px-3 py-1.5 text-xs text-foreground placeholder:text-muted focus:border-primary focus:bg-surface focus:outline-none transition-all"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      className="absolute right-2.5 top-2 text-xs text-muted hover:text-foreground"
                    >
                      <IconClose className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>
            </div>

            {availableOfferings.length === 0 ? (
              <div className="rounded-[10px] border border-dashed border-border bg-surface p-10 text-center">
                <IconCheck className="w-8 h-8 text-emerald-500 mx-auto mb-2 opacity-80" />
                <p className="text-xs font-semibold text-foreground">
                  {searchQuery
                    ? 'No se encontraron materias que coincidan con la búsqueda.'
                    : 'No hay más materias disponibles en el catálogo.'}
                </p>
                <p className="text-[11px] text-muted mt-1 max-w-sm mx-auto">
                  Pronto se abrirán nuevas convocatorias y módulos para tu periodo académico.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {availableOfferings.map((off, index) => {
                  const offeringId = off.course_mapping_id || off.id || `offering-${index}`;
                  const isSubmitting = actionLoading === `enroll-${offeringId}`;
                  const isPending = enrollments.some((request) =>
                    request.course_mapping_id === offeringId && request.status === 'pendiente');

                  return (
                    <div
                      key={offeringId}
                      className="flex flex-col justify-between rounded-[10px] border border-border bg-surface p-5 shadow-minimal hover:border-primary/40 transition-all"
                    >
                      <div>
                        <div className="flex items-center justify-between">
                          <span className="rounded-[4px] bg-surface-muted px-2 py-0.5 font-mono text-[11px] font-semibold text-foreground border border-border">
                            {off.code}
                          </span>
                          {off.credits != null && (
                            <span className="rounded-[4px] bg-primary/10 px-2 py-0.5 text-[11px] font-mono text-primary border border-primary/20">
                              {off.credits} créditos SATCA
                            </span>
                          )}
                        </div>

                        <h3 className="mt-3 text-base font-semibold text-foreground">
                          {off.name}
                        </h3>

                        <p className="mt-1 text-xs text-muted leading-relaxed">
                          Programa: <strong className="text-foreground">{off.program_name}</strong>
                          {off.hours_theory || off.hours_practice
                            ? ` • ${off.hours_theory || 0}h teoría / ${off.hours_practice || 0}h práctica`
                            : ''}
                        </p>
                        <p className="mt-2 text-xs text-muted font-mono">
                          Moodle Course ID #{off.moodle_course_id}
                        </p>
                      </div>

                      <div className="mt-5 border-t border-border pt-3.5">
                        <button
                          type="button"
                          onClick={() => handleQuickEnroll(offeringId, off.name)}
                          disabled={isSubmitting || isPending}
                          className="w-full rounded-[6px] bg-primary-action px-4 py-2 text-xs font-semibold text-white shadow-minimal hover:bg-primary-action/90 transition-all disabled:opacity-50 active:scale-[0.98] flex items-center justify-center gap-1.5"
                        >
                          {isPending ? (
                            <span>Solicitud pendiente de autorización</span>
                          ) : isSubmitting ? (
                            <>
                              <span className="h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" />
                              <span>Registrando solicitud...</span>
                            </>
                          ) : (
                            <>
                              <IconPlus className="w-3.5 h-3.5 text-accent-lime" />
                              <span>Solicitar inscripción</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ========================================================================= */}
        {/* PESTAÑA 3: KÁRDEX Y AVANCE CURRICULAR                                      */}
        {/* ========================================================================= */}
        {activeTab === 'calificaciones' && (
          <div className="space-y-4">
            <div className="rounded-[10px] border border-border bg-surface p-5 shadow-minimal">
              <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
                <IconGrades className="w-5 h-5 text-primary" />
                <span>Kárdex Académico y Calificaciones</span>
              </h2>
              <p className="text-xs text-muted mt-0.5">
                Historial de asignaturas cursadas, créditos acumulados y actas de evaluación consolidadas.
              </p>
            </div>

            {/* Tarjetas Bento de Resumen Académico */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="rounded-[10px] border border-border bg-surface p-4 shadow-minimal">
                <span className="text-[11px] font-medium text-muted block">Materias Inscritas</span>
                <span className="text-lg font-bold font-mono text-foreground mt-1 block">
                  {kardexSummary.totalCourses}
                </span>
                <span className="text-[10px] text-muted">En plan vigente</span>
              </div>
              <div className="rounded-[10px] border border-border bg-surface p-4 shadow-minimal">
                <span className="text-[11px] font-medium text-muted block">Acreditadas</span>
                <span className="text-lg font-bold font-mono text-emerald-600 dark:text-emerald-400 mt-1 block">
                  {kardexSummary.accreditedCount}
                </span>
                <span className="text-[10px] text-muted">Evaluaciones aprobadas</span>
              </div>
              <div className="rounded-[10px] border border-border bg-surface p-4 shadow-minimal">
                <span className="text-[11px] font-medium text-muted block">Promedio Parcial</span>
                <span className="text-lg font-bold font-mono text-primary mt-1 block">
                  {kardexSummary.average ? `${kardexSummary.average} / 10` : 'En curso'}
                </span>
                <span className="text-[10px] text-muted">Escala oficial 0 a 10</span>
              </div>
              <div className="rounded-[10px] border border-border bg-surface p-4 shadow-minimal">
                <span className="text-[11px] font-medium text-muted block">Créditos Cursados</span>
                <span className="text-lg font-bold font-mono text-foreground mt-1 block">
                  {kardexSummary.totalCredits}
                </span>
                <span className="text-[10px] text-muted">Sistema SATCA</span>
              </div>
            </div>

            <div className="rounded-[10px] border border-border bg-surface overflow-hidden shadow-minimal">
              {courses.length === 0 ? (
                <div className="p-8 text-center text-xs text-muted">
                  Aún no tienes historial de asignaturas cursadas para generar tu kárdex.
                </div>
              ) : (
                <table className="w-full text-left text-xs">
                  <thead className="bg-surface-muted/60 text-muted font-medium border-b border-border">
                    <tr>
                      <th className="px-5 py-3.5">Asignatura</th>
                      <th className="px-5 py-3.5">Créditos</th>
                      <th className="px-5 py-3.5">Calificación</th>
                      <th className="px-5 py-3.5">Estado</th>
                      <th className="px-5 py-3.5 text-right">Constancia</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {courses.map((course, index) => {
                      const courseKey = course.course_mapping_id || `kardex-${index}`;
                      const offering = offerings.find(
                        (o) => o.course_mapping_id === course.course_mapping_id || o.id === course.course_mapping_id,
                      );
                      const credits = offering?.credits;
                      const hasGrade = course.cached_final_grade != null;
                      const grade = hasGrade ? Number(course.cached_final_grade) : null;
                      const isPassing = grade != null ? grade >= 6 : null;

                      return (
                        <tr key={courseKey} className="hover:bg-surface-muted/30 transition-colors">
                          <td className="px-5 py-3.5">
                            <span className="font-semibold text-foreground block">
                              {course.course_name}
                            </span>
                            <span className="font-mono text-[11px] text-muted">
                              {course.course_code || course.portal_course_code}
                            </span>
                          </td>
                          <td className="px-5 py-3.5 font-mono text-xs">
                            {credits != null ? `${credits} SATCA` : 'Sin dato'}
                          </td>
                          <td className="px-5 py-3.5 font-mono text-xs">
                            {hasGrade ? (
                              <span className="font-bold text-foreground bg-surface-muted px-2 py-0.5 rounded-[4px] border border-border">
                                {grade} / 10
                              </span>
                            ) : (
                              <span className="text-muted">Evaluando en Moodle</span>
                            )}
                          </td>
                          <td className="px-5 py-3.5">
                            {isPassing === true ? (
                              <span className="rounded-[4px] bg-emerald-500/10 px-2 py-0.5 text-[10px] font-mono text-emerald-600 dark:text-emerald-400 font-semibold border border-emerald-500/20">
                                Acreditada
                              </span>
                            ) : isPassing === false ? (
                              <span className="rounded-[4px] bg-danger/10 px-2 py-0.5 text-[10px] font-mono text-danger font-semibold border border-danger/20">
                                No Acreditada
                              </span>
                            ) : (
                              <span className="rounded-[4px] bg-primary/10 px-2 py-0.5 text-[10px] font-mono text-primary font-semibold border border-primary/20">
                                En Curso
                              </span>
                            )}
                          </td>
                          <td className="px-5 py-3.5 text-right font-mono text-[11px]">
                            <button
                              type="button"
                              onClick={() => handleLaunchCourseSSO(course.course_mapping_id)}
                              disabled={actionLoading === `launch-${course.course_mapping_id}`}
                              className="text-primary hover:underline font-medium inline-flex items-center gap-1 disabled:opacity-50"
                            >
                              {actionLoading === `launch-${course.course_mapping_id}` ? (
                                <span>Abriendo...</span>
                              ) : (
                                <span>Ver Aula ↗</span>
                              )}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* PESTAÑA 4: EXPEDIENTE ESCOLAR Y PERFIL DEL ESTUDIANTE                      */}
        {/* ========================================================================= */}
        {activeTab === 'perfil' && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-[10px] border border-border bg-surface p-5 shadow-minimal">
              <div>
                <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
                  <IconSettings className="w-5 h-5 text-primary" />
                  <span>Expediente Escolar del Alumno</span>
                </h2>
                <p className="text-xs text-muted mt-0.5">
                  Datos de registro oficial ante la Dirección de Servicios Escolares de INICIA.
                </p>
              </div>
              <button
                type="button"
                onClick={handleOpenEditProfile}
                className="inline-flex items-center gap-1.5 self-start sm:self-auto rounded-[6px] border border-border bg-surface-muted/50 hover:bg-surface-muted px-3 py-1.5 text-xs font-semibold text-foreground transition-all"
              >
                <IconSettings className="w-3.5 h-3.5 text-primary" />
                <span>Editar Información</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="rounded-[10px] border border-border bg-surface p-5 space-y-3 shadow-minimal">
                <span className="text-[11px] font-mono uppercase tracking-wider text-muted">
                  Datos de Matrícula y Contacto
                </span>
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between py-1 border-b border-border/50">
                    <span className="text-muted">Nombre Completo</span>
                    <span className="font-semibold text-foreground">
                      {user?.first_name} {user?.last_name}
                    </span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-border/50">
                    <span className="text-muted">Correo Institucional</span>
                    <span className="font-mono text-foreground">{user?.email}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-border/50">
                    <span className="text-muted">Teléfono de Contacto</span>
                    <span className="font-mono text-foreground">{user?.phone || 'No registrado'}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-border/50">
                    <span className="text-muted">Matrícula Escolar</span>
                    <span className="font-mono font-bold text-primary">
                      {user?.id ? `AL-${user.id.slice(0, 8).toUpperCase()}` : 'AL-2026-REG'}
                    </span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-muted">Estatus Académico</span>
                    <span className="capitalize text-emerald-600 dark:text-emerald-400 font-medium">
                      {user?.status || 'activo'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="rounded-[10px] border border-border bg-surface p-5 space-y-3 shadow-minimal">
                <span className="text-[11px] font-mono uppercase tracking-wider text-muted">
                  Vinculación con Moodle LMS
                </span>
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between py-1 border-b border-border/50">
                    <span className="text-muted">Usuario en Moodle</span>
                    <span className="font-mono text-foreground">
                      {user?.moodle_username || user?.email?.split('@')[0] || 'estudiante'}
                    </span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-border/50">
                    <span className="text-muted">Moodle ID</span>
                    <span className="font-mono text-foreground">
                      {user?.moodle_user_id ? `#${user.moodle_user_id}` : 'Enlazado por correo'}
                    </span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-border/50">
                    <span className="text-muted">Estado de Sincronización</span>
                    <MoodleSyncBadge
                      status={user?.moodle_sync_status}
                      moodleId={user?.moodle_user_id}
                    />
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-muted">Acceso SSO Transparente</span>
                    <span className="font-mono text-emerald-600 dark:text-emerald-400 font-medium">
                      Activo (auth_userkey)
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* MODAL: CONFIRMACIÓN PARA DAR DE BAJA MATERIA (DESASIGNAR) */}
        {dropTarget && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="w-full max-w-md rounded-[14px] border border-border bg-surface p-6 shadow-xl space-y-4 animate-in fade-in zoom-in-95">
              <div className="flex items-center gap-3 text-danger">
                <div className="grid h-10 w-10 place-items-center rounded-full bg-danger/10 border border-danger/20">
                  <IconAlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-foreground">
                    Dar de baja materia
                  </h3>
                  <p className="text-xs text-muted">Confirmación de desasignación académica</p>
                </div>
              </div>

              <div className="rounded-[8px] bg-surface-muted/50 border border-border p-3.5 text-xs text-muted space-y-1">
                <p>
                  ¿Estás seguro de que deseas dar de baja la materia{' '}
                  <strong className="text-foreground">{dropTarget.courseName}</strong>?
                </p>
                <p className="text-[11px] text-danger/90 pt-1">
                  Se revocará tu matrícula y acceso al aula virtual en Moodle LMS. Podrás volver a inscribirla en el catálogo si decides retomarla más adelante.
                </p>
              </div>

              <div className="flex justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setDropTarget(null)}
                  disabled={actionLoading === `drop-${dropTarget.enrollmentId}`}
                  className="rounded-[6px] border border-border bg-surface px-4 py-2 text-xs font-semibold text-foreground hover:bg-surface-muted transition-all"
                >
                  Conservar Materia
                </button>
                <button
                  type="button"
                  onClick={handleConfirmDropCourse}
                  disabled={actionLoading === `drop-${dropTarget.enrollmentId}`}
                  className="rounded-[6px] bg-danger px-4 py-2 text-xs font-semibold text-white shadow-minimal hover:bg-danger/90 transition-all disabled:opacity-50"
                >
                  {actionLoading === `drop-${dropTarget.enrollmentId}`
                    ? 'Procesando baja...'
                    : 'Sí, dar de baja'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* MODAL: TEMARIO Y DETALLES DEL CURSO */}
        {syllabusTarget && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="w-full max-w-lg rounded-[14px] border border-border bg-surface p-6 shadow-xl space-y-4 animate-in fade-in zoom-in-95">
              <div className="flex items-center justify-between border-b border-border pb-3">
                <div className="flex items-center gap-2">
                  <IconBookOpen className="w-5 h-5 text-primary" />
                  <h3 className="text-base font-bold text-foreground">
                    Temario y Ficha Técnica
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setSyllabusTarget(null)}
                  className="text-muted hover:text-foreground"
                >
                  <IconClose className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-3 text-xs">
                <div>
                  <span className="font-mono text-primary font-bold text-[11px]">
                    {syllabusTarget.course_code || syllabusTarget.portal_course_code}
                  </span>
                  <h4 className="text-sm font-bold text-foreground mt-0.5">
                    {syllabusTarget.course_name}
                  </h4>
                  <p className="text-muted mt-1 leading-relaxed">
                    {syllabusTarget.course_description ||
                      'Asignatura oficial con créditos universitarios, evaluaciones prácticas y proyectos aplicados en el entorno Moodle LMS.'}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-2 rounded-[8px] bg-surface-muted/40 p-3 border border-border">
                  <div>
                    <span className="text-muted block text-[11px]">Créditos SATCA:</span>
                    <strong className="text-foreground">8 Créditos</strong>
                  </div>
                  <div>
                    <span className="text-muted block text-[11px]">Modalidad:</span>
                    <strong className="text-foreground">En línea 100%</strong>
                  </div>
                  <div>
                    <span className="text-muted block text-[11px]">Plataforma:</span>
                    <strong className="text-foreground font-mono">Moodle ID #{syllabusTarget.moodle_course_id}</strong>
                  </div>
                  <div>
                    <span className="text-muted block text-[11px]">Evaluación:</span>
                    <strong className="text-foreground">Sumativa / Práctica</strong>
                  </div>
                </div>

                <div className="space-y-1.5 pt-1">
                  <span className="font-semibold text-foreground text-xs flex items-center justify-between">
                    <span>Estructura y Contenidos de Moodle LMS:</span>
                    {loadingContents && (
                      <span className="text-[10px] text-muted flex items-center gap-1 font-normal">
                        <IconRefresh className="w-3 h-3 animate-spin text-primary" />
                        Cargando secciones...
                      </span>
                    )}
                  </span>
                  {moodleContents.length > 0 ? (
                    <div className="max-h-48 overflow-y-auto space-y-2 pr-1 divide-y divide-border/40">
                      {moodleContents.map((sec, idx) => (
                        <div key={idx} className="pt-1.5 first:pt-0">
                          <p className="font-semibold text-foreground text-[11px]">{sec.name || `Tema ${idx}`}</p>
                          {sec.modules && sec.modules.length > 0 ? (
                            <ul className="mt-1 space-y-0.5 pl-3 border-l border-border/60">
                              {sec.modules.map((m: any, mIdx: number) => (
                                <li key={mIdx} className="text-[11px] text-muted flex items-center gap-1.5">
                                  <span className="h-1 w-1 rounded-full bg-primary-action shrink-0" />
                                  <span className="truncate">{m.name}</span>
                                  {m.modplural && <span className="text-[9px] font-mono text-muted/70">({m.modplural})</span>}
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <p className="text-[10px] text-muted italic pl-3">Sin actividades en esta sección</p>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <ul className="list-disc pl-4 text-muted space-y-1 text-xs">
                      <li>Módulo 1: Fundamentos teóricos y principios aplicados</li>
                      <li>Módulo 2: Arquitectura metodológica y desarrollo práctico</li>
                      <li>Módulo 3: Casos de estudio y evaluación integradora en campus virtual</li>
                    </ul>
                  )}
                </div>
              </div>

              <div className="flex justify-end gap-2.5 pt-3 border-t border-border">
                <button
                  type="button"
                  onClick={() => setSyllabusTarget(null)}
                  className="rounded-[6px] border border-border bg-surface px-4 py-2 text-xs font-semibold text-foreground hover:bg-surface-muted transition-all"
                >
                  Cerrar
                </button>
                <LaunchCourseButton
                  courseMappingId={syllabusTarget.course_mapping_id}
                  courseName={syllabusTarget.course_name}
                  isAuthorized={true}
                />
              </div>
            </div>
          </div>
        )}

        {/* MODAL: EDITAR INFORMACIÓN DE PERFIL */}
        {editProfileOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="w-full max-w-md rounded-[14px] border border-border bg-surface p-6 shadow-xl space-y-4 animate-in fade-in zoom-in-95">
              <div className="flex items-center justify-between border-b border-border pb-3">
                <div className="flex items-center gap-2">
                  <IconSettings className="w-5 h-5 text-primary" />
                  <h3 className="text-base font-bold text-foreground">
                    Editar Datos del Expediente
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setEditProfileOpen(false)}
                  className="text-muted hover:text-foreground"
                >
                  <IconClose className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleSaveProfile} className="space-y-3 text-xs">
                <div>
                  <label className="block text-muted font-medium mb-1">Nombre</label>
                  <input
                    type="text"
                    required
                    value={profileForm.first_name}
                    onChange={(e) => setProfileForm({ ...profileForm, first_name: e.target.value })}
                    className="w-full rounded-[6px] border border-border bg-surface-muted/40 px-3 py-2 text-foreground focus:border-primary focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-muted font-medium mb-1">Apellidos</label>
                  <input
                    type="text"
                    required
                    value={profileForm.last_name}
                    onChange={(e) => setProfileForm({ ...profileForm, last_name: e.target.value })}
                    className="w-full rounded-[6px] border border-border bg-surface-muted/40 px-3 py-2 text-foreground focus:border-primary focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-muted font-medium mb-1">Teléfono</label>
                  <input
                    type="tel"
                    placeholder="Ej. +52 55 1234 5678"
                    value={profileForm.phone}
                    onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value })}
                    className="w-full rounded-[6px] border border-border bg-surface-muted/40 px-3 py-2 text-foreground focus:border-primary focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-muted font-medium mb-1">Biografía o notas de expediente</label>
                  <textarea
                    rows={3}
                    placeholder="Semblanza académica o intereses curriculares..."
                    value={profileForm.bio}
                    onChange={(e) => setProfileForm({ ...profileForm, bio: e.target.value })}
                    className="w-full rounded-[6px] border border-border bg-surface-muted/40 px-3 py-2 text-foreground focus:border-primary focus:outline-none"
                  />
                </div>

                <div className="flex justify-end gap-2.5 pt-3 border-t border-border">
                  <button
                    type="button"
                    onClick={() => setEditProfileOpen(false)}
                    disabled={actionLoading === 'save-profile'}
                    className="rounded-[6px] border border-border bg-surface px-4 py-2 text-xs font-semibold text-foreground hover:bg-surface-muted transition-all"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={actionLoading === 'save-profile'}
                    className="inline-flex items-center gap-1.5 rounded-[6px] bg-primary-action px-4 py-2 text-xs font-semibold text-white hover:bg-primary-action/90 transition-all disabled:opacity-50"
                  >
                    {actionLoading === 'save-profile' ? (
                      <span>Guardando...</span>
                    ) : (
                      <>
                        <IconCheck className="w-3.5 h-3.5" />
                        <span>Guardar Cambios</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </CampusShell>
  );
}
