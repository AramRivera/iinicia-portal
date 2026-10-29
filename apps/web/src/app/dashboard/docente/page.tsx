'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { coursesApi, moodleApi, enrollmentsApi, usersApi } from '@/lib/api';
import type { AuthorizedCourse, EnrollmentRequest } from '@/types';
import { LaunchCourseButton } from '@/components/moodle/LaunchCourseButton';
import { MoodleSyncBadge } from '@/components/moodle/MoodleSyncBadge';
import { CampusShell } from '@/components/campus-tech/CampusShell';
import {
  closeMoodleLaunchWindow,
  navigateMoodleLaunchWindow,
  openMoodleLaunchWindow,
} from '@/lib/moodle-window';
import {
  IconTeachers,
  IconGroups,
  IconStudents,
  IconGrades,
  IconExternalLink,
  IconSearch,
  IconRefresh,
  IconSettings,
  IconCheck,
  IconAlertTriangle,
  IconClose,
  IconBookOpen,
  IconClock,
  IconAnnouncements,
} from '@/components/campus-tech/Icons';

type TeacherTab = 'materias' | 'estudiantes' | 'calificaciones' | 'moodle' | 'perfil';

interface StudentUnenrollTarget {
  id: string;
  studentName: string;
  courseName: string;
}

export default function DocenteDashboardPage() {
  const router = useRouter();
  const { user, loading: authLoading, refreshUser } = useAuth();

  const [activeTab, setActiveTab] = useState<TeacherTab>('materias');
  const [courses, setCourses] = useState<AuthorizedCourse[]>([]);
  const [enrollments, setEnrollments] = useState<EnrollmentRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCourseFilter, setSelectedCourseFilter] = useState('');
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Modales interactivos
  const [unenrollTarget, setUnenrollTarget] = useState<StudentUnenrollTarget | null>(null);
  const [selectedCourseDetail, setSelectedCourseDetail] = useState<AuthorizedCourse | null>(null);
  const [editProfileOpen, setEditProfileOpen] = useState(false);
  const [profileForm, setProfileForm] = useState({
    first_name: '',
    last_name: '',
    phone: '',
    bio: '',
  });

  const [moodleCourseOverviews, setMoodleCourseOverviews] = useState<Record<number, any>>({});

  const loadTeacherData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [coursesData, enrollmentsData] = await Promise.all([
        coursesApi.getAuthorizedCourses(),
        enrollmentsApi.getAllEnrollments(),
      ]);
      setCourses(coursesData);
      setEnrollments(enrollmentsData);

      // Cargar resumen de Moodle para cada curso
      if (coursesData.length > 0) {
        const overviews: Record<number, any> = {};
        await Promise.all(
          coursesData.map(async (c) => {
            if (c.moodle_course_id) {
              try {
                const ov = await moodleApi.getCourseTeacherOverview(c.moodle_course_id);
                if (ov) overviews[c.moodle_course_id] = ov;
              } catch {
                // Silencioso
              }
            }
          }),
        );
        setMoodleCourseOverviews(overviews);
      }
    } catch (err: any) {
      setError(err.message || 'No fue posible cargar tus asignaturas.');
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
    if (!user.roles.includes('profesor') && !user.roles.includes('superadministrador')) {
      router.replace('/dashboard');
      return;
    }

    loadTeacherData();
  }, [user, authLoading, router]);

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
      setNotice('Sesión docente iniciada en Moodle LMS vía SSO en una nueva pestaña.');
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
      setError(err.message || 'Error al acceder al aula de Moodle.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleOpenGradebook = (moodleCourseId: number) => {
    const base = process.env.NEXT_PUBLIC_MOODLE_URL || 'http://192.168.191.171/moodle';
    window.open(`${base}/grade/report/grader/index.php?id=${moodleCourseId}`, '_blank', 'noopener,noreferrer');
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
      setNotice('Tus credenciales y datos de perfil docente han sido actualizados con éxito.');
      setEditProfileOpen(false);
    } catch (err: any) {
      setError(err.message || 'No fue posible actualizar tu perfil docente.');
    } finally {
      setActionLoading(null);
    }
  };

  // Desasignar / dar de baja alumno de la materia
  const handleConfirmUnenroll = async () => {
    if (!unenrollTarget) return;

    setActionLoading(`unenroll-${unenrollTarget.id}`);
    setNotice(null);
    setError(null);

    try {
      await enrollmentsApi.deleteEnrollment(unenrollTarget.id);
      setNotice(
        `El estudiante ${unenrollTarget.studentName} ha sido desasignado exitosamente de ${unenrollTarget.courseName}.`,
      );
      setUnenrollTarget(null);
      await loadTeacherData();
    } catch (err: any) {
      setError(err.message || 'Error al desasignar al estudiante.');
    } finally {
      setActionLoading(null);
    }
  };

  // Filtrado de cursos del profesor
  const filteredCourses = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return courses;
    return courses.filter((c) => {
      const name = (c.course_name || '').toLowerCase();
      const code = (c.course_code || '').toLowerCase();
      const mId = String(c.moodle_course_id || '');
      return name.includes(q) || code.includes(q) || mId.includes(q);
    });
  }, [courses, searchQuery]);

  // Alumnos inscritos en las materias del profesor
  const teacherCourseMappingIds = useMemo(() => {
    return new Set(courses.map((c) => c.course_mapping_id));
  }, [courses]);

  const enrolledStudents = useMemo(() => {
    return enrollments.filter(
      (enr) =>
        teacherCourseMappingIds.has(enr.course_mapping_id) &&
        (enr.status === 'sincronizada' || enr.status === 'autorizada') &&
        enr.moodle_role !== 'teacher',
    );
  }, [enrollments, teacherCourseMappingIds]);

  const filteredStudents = useMemo(() => {
    let list = enrolledStudents;
    if (selectedCourseFilter) {
      list = list.filter((e) => e.course_mapping_id === selectedCourseFilter);
    }
    const q = searchQuery.toLowerCase().trim();
    if (q) {
      list = list.filter((e) => {
        const cName = (e.course_mappings?.courses?.name || '').toLowerCase();
        const cCode = (e.course_mappings?.code || '').toLowerCase();
        const sFirst = (e.profiles?.first_name || '').toLowerCase();
        const sLast = (e.profiles?.last_name || '').toLowerCase();
        const sEmail = (e.profiles?.email || '').toLowerCase();
        return (
          cName.includes(q) ||
          cCode.includes(q) ||
          sFirst.includes(q) ||
          sLast.includes(q) ||
          sEmail.includes(q)
        );
      });
    }
    return list;
  }, [enrolledStudents, selectedCourseFilter, searchQuery]);

  const getBreadcrumbs = (tab: TeacherTab) => {
    switch (tab) {
      case 'materias':
        return ['INICIA', 'Portal Docente', 'Mis Asignaturas'];
      case 'estudiantes':
        return ['INICIA', 'Portal Docente', 'Alumnos y Grupos'];
      case 'calificaciones':
        return ['INICIA', 'Portal Docente', 'Libro de Calificaciones'];
      case 'perfil':
        return ['INICIA', 'Portal Docente', 'Perfil Institucional'];
      default:
        return ['INICIA', 'Portal Docente'];
    }
  };

  if (authLoading || loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <p className="text-xs font-medium text-muted">Cargando panel del profesor...</p>
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
          setActiveTab(tabId as TeacherTab);
        }
      }}
      breadcrumbs={getBreadcrumbs(activeTab)}
      counts={{
        courses: courses.length,
      }}
      onLaunchCampusSSO={handleLaunchCampusSSO}
    >
      <div className="space-y-6">
        {/* Header Docente */}
        <div className="rounded-[10px] border border-border bg-surface p-5 sm:p-6 shadow-minimal transition-all">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1.5">
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
                Gestión de asignaturas, actas de evaluación, alumnos inscritos y acceso con privilegios de edición en Moodle LMS.
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={handleLaunchCampusSSO}
                disabled={actionLoading === 'launch-campus'}
                className="inline-flex items-center justify-center gap-1.5 rounded-[6px] bg-primary-action text-white font-medium px-3.5 py-2 text-xs shadow-minimal hover:bg-primary-action/90 active:scale-[0.98] transition-all disabled:opacity-50"
                title="Abrir Moodle como Profesor con sesión iniciada al instante"
              >
                {actionLoading === 'launch-campus' ? (
                  <>
                    <span className="h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    <span>Iniciando SSO...</span>
                  </>
                ) : (
                  <>
                    <IconExternalLink className="w-3.5 h-3.5 text-accent-lime" />
                    <span>Abrir Campus Virtual (SSO)</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={loadTeacherData}
                className="h-8 w-8 rounded-[6px] border border-border bg-surface hover:bg-surface-muted text-muted hover:text-foreground flex items-center justify-center transition-all"
                title="Actualizar datos"
              >
                <IconRefresh className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Tarjetas de Métricas Operativas */}
          <div className="mt-5 grid grid-cols-1 gap-3 border-t border-border pt-4 sm:grid-cols-3">
            <div className="rounded-[8px] border border-border bg-surface-muted/30 p-3.5">
              <span className="text-[11px] font-mono uppercase tracking-wider text-muted">Cuenta Moodle</span>
              <p className="mt-1 font-mono text-sm font-semibold text-foreground">
                {user?.moodle_username || 'profesor'}
              </p>
              <span className="text-[11px] text-muted mt-0.5 block">Identificador de acceso oficial</span>
            </div>

            <div className="rounded-[8px] border border-border bg-surface-muted/30 p-3.5">
              <span className="text-[11px] font-mono uppercase tracking-wider text-muted">Cursos a Cargo</span>
              <p className="mt-1 text-sm font-semibold text-foreground">
                {courses.length} asignatura(s) asignadas
              </p>
              <span className="text-[11px] text-muted mt-0.5 block">Con permisos de edición de aula</span>
            </div>

            <div className="rounded-[8px] border border-border bg-surface-muted/30 p-3.5">
              <span className="text-[11px] font-mono uppercase tracking-wider text-muted">Alumnos Asignados</span>
              <p className="mt-1 text-sm font-semibold text-foreground">
                {enrolledStudents.length} estudiante(s) activo(s)
              </p>
              <span className="text-[11px] text-muted mt-0.5 block">Distribuidos en tus grupos</span>
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
        {/* PESTAÑA 1: MIS ASIGNATURAS                                                */}
        {/* ========================================================================= */}
        {activeTab === 'materias' && (
          <div className="space-y-4">
            <div className="rounded-[10px] border border-border bg-surface p-5 shadow-minimal">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
                    <IconGroups className="w-5 h-5 text-primary" />
                    <span>Cursos Asignados para Impartir</span>
                  </h2>
                  <p className="text-xs text-muted mt-0.5">
                    Accede a las aulas de Moodle para editar materiales, configurar tareas y calificar actividades.
                  </p>
                </div>

                <div className="relative w-full sm:w-64">
                  <input
                    type="text"
                    placeholder="Filtrar por código o nombre..."
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

            {filteredCourses.length === 0 ? (
              <div className="rounded-[10px] border border-dashed border-border bg-surface p-10 text-center">
                <IconGroups className="w-8 h-8 text-muted mx-auto mb-2 opacity-50" />
                <p className="text-xs font-medium text-foreground">
                  {searchQuery
                    ? 'No se encontraron materias que coincidan con la búsqueda.'
                    : 'No tienes cursos asignados actualmente.'}
                </p>
                <p className="text-[11px] text-muted mt-1 max-w-sm mx-auto">
                  Comunícate con la coordinación académica para vincular tus grupos asignados.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {filteredCourses.map((course, index) => {
                  const courseKey = course.course_mapping_id || `teacher-course-${index}`;
                  const studentCount = enrollments.filter(
                    (e) =>
                      e.course_mapping_id === course.course_mapping_id &&
                      (e.status === 'sincronizada' || e.status === 'autorizada') &&
                      e.moodle_role !== 'teacher',
                  ).length;

                  return (
                    <div
                      key={courseKey}
                      className="flex flex-col justify-between rounded-[10px] border border-border bg-surface p-5 shadow-minimal hover:border-primary/40 transition-all"
                    >
                      <div>
                        <div className="flex items-center justify-between">
                          <span className="rounded-[4px] bg-primary/10 px-2 py-0.5 font-mono text-[11px] font-semibold text-primary">
                            {course.course_code}
                          </span>
                          <span className="rounded-[4px] bg-surface-muted px-2 py-0.5 text-[11px] font-medium text-muted border border-border">
                            {(() => {
                              const ov = moodleCourseOverviews[course.moodle_course_id];
                              const count = ov?.total_students != null ? ov.total_students : studentCount;
                              return `${count} alumno(s) Moodle`;
                            })()}
                          </span>
                        </div>

                        <h3 className="mt-3 text-base font-semibold text-foreground">
                          {course.course_name}
                        </h3>

                        <p className="mt-1 text-xs text-muted font-mono">
                          Moodle ID: #{course.moodle_course_id} • Rol: Docente Titular
                        </p>

                        {/* Indicadores en vivo de Moodle */}
                        {(() => {
                          const ov = moodleCourseOverviews[course.moodle_course_id];
                          if (!ov) return null;
                          return (
                            <div className="mt-3 grid grid-cols-2 gap-2 rounded-[6px] bg-surface-muted/30 p-2 text-[10px] text-muted border border-border/50 font-mono">
                              <div>
                                <span>Actividades: </span>
                                <strong className="text-foreground">{ov.total_activities ?? 0}</strong>
                              </div>
                              <div>
                                <span>Secciones: </span>
                                <strong className="text-foreground">{ov.total_sections ?? 0}</strong>
                              </div>
                            </div>
                          );
                        })()}

                        {/* Accesos rápidos docentes de Moodle */}
                        <div className="mt-4 flex flex-wrap gap-2 text-[11px]">
                          <a
                            href={`${process.env.NEXT_PUBLIC_MOODLE_URL || 'http://192.168.191.171/moodle'}/grade/report/grader/index.php?id=${course.moodle_course_id}`}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 rounded-[4px] border border-border bg-surface-muted/40 hover:bg-surface-muted px-2.5 py-1 text-muted hover:text-foreground transition-all"
                          >
                            <IconGrades className="w-3 h-3 text-primary" />
                            <span>Calificador Moodle ↗</span>
                          </a>
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedCourseFilter(course.course_mapping_id);
                              setActiveTab('estudiantes');
                            }}
                            className="inline-flex items-center gap-1 rounded-[4px] border border-border bg-surface-muted/40 hover:bg-surface-muted px-2.5 py-1 text-muted hover:text-foreground transition-all"
                          >
                            <IconStudents className="w-3 h-3 text-primary" />
                            <span>Ver Alumnos ({studentCount})</span>
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
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ========================================================================= */}
        {/* PESTAÑA 2: ALUMNOS Y GRUPOS (CON OPCIÓN DE DESASIGNAR / DAR DE BAJA)      */}
        {/* ========================================================================= */}
        {activeTab === 'estudiantes' && (
          <div className="space-y-4">
            <div className="rounded-[10px] border border-border bg-surface p-5 shadow-minimal">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
                    <IconStudents className="w-5 h-5 text-primary" />
                    <span>Directorio de Alumnos Inscritos</span>
                  </h2>
                  <p className="text-xs text-muted mt-0.5">
                    Estudiantes activos en tus materias. Puedes consultar sus expedientes o desasignarlos del grupo si cambiaron de materia o se dieron de baja.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2.5">
                  <select
                    value={selectedCourseFilter}
                    onChange={(e) => setSelectedCourseFilter(e.target.value)}
                    className="rounded-[6px] border border-border bg-surface-muted/40 px-3 py-1.5 text-xs text-foreground focus:border-primary focus:outline-none transition-all"
                  >
                    <option value="">Todas mis asignaturas</option>
                    {courses.map((c) => (
                      <option key={c.course_mapping_id} value={c.course_mapping_id}>
                        {c.course_code} - {c.course_name}
                      </option>
                    ))}
                  </select>

                  <div className="relative w-full sm:w-56">
                    <input
                      type="text"
                      placeholder="Buscar por nombre o correo..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full rounded-[6px] border border-border bg-surface-muted/40 px-3 py-1.5 text-xs text-foreground placeholder:text-muted focus:border-primary focus:outline-none transition-all"
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
            </div>

            <div className="rounded-[10px] border border-border bg-surface overflow-hidden shadow-minimal">
              {filteredStudents.length === 0 ? (
                <div className="p-8 text-center text-xs text-muted">
                  No se encontraron estudiantes registrados para los filtros seleccionados.
                </div>
              ) : (
                <table className="w-full text-left text-xs">
                  <thead className="bg-surface-muted/60 text-muted font-medium border-b border-border">
                    <tr>
                      <th className="px-5 py-3.5">Estudiante</th>
                      <th className="px-5 py-3.5">Asignatura</th>
                      <th className="px-5 py-3.5">Estado Moodle</th>
                      <th className="px-5 py-3.5">Fecha Alta</th>
                      <th className="px-5 py-3.5 text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {filteredStudents.map((enr) => {
                      const studentName =
                        enr.profiles?.first_name || enr.profiles?.last_name
                          ? `${enr.profiles?.first_name || ''} ${enr.profiles?.last_name || ''}`.trim()
                          : 'Estudiante Registrado';
                      const studentEmail = enr.profiles?.email || 'Sin correo disponible';
                      const courseName =
                        enr.course_mappings?.courses?.name ||
                        enr.course_mappings?.portal_course_code ||
                        'Materia Asignada';

                      return (
                        <tr key={enr.id} className="hover:bg-surface-muted/30 transition-colors">
                          <td className="px-5 py-3.5">
                            <span className="font-semibold text-foreground block">
                              {studentName}
                            </span>
                            <span className="font-mono text-[11px] text-muted">
                              {studentEmail}
                            </span>
                          </td>
                          <td className="px-5 py-3.5">
                            <span className="font-medium text-foreground block">
                              {courseName}
                            </span>
                            <span className="font-mono text-[11px] text-muted">
                              {enr.course_mappings?.code || enr.course_mappings?.portal_course_code}
                            </span>
                          </td>
                          <td className="px-5 py-3.5">
                            <MoodleSyncBadge status={enr.moodle_sync_status} />
                          </td>
                          <td className="px-5 py-3.5 font-mono text-[11px] text-muted">
                            {new Date(enr.created_at).toLocaleDateString('es-MX')}
                          </td>
                          <td className="px-5 py-3.5 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <a
                                href={`mailto:${studentEmail}`}
                                className="rounded-[4px] border border-border bg-surface px-2 py-1 text-[11px] font-medium text-foreground hover:bg-surface-muted transition-all"
                                title="Enviar correo institucional"
                              >
                                Contactar
                              </a>
                              <button
                                type="button"
                                onClick={() =>
                                  setUnenrollTarget({
                                    id: enr.id,
                                    studentName,
                                    courseName,
                                  })
                                }
                                className="rounded-[4px] border border-danger/30 bg-danger/10 px-2 py-1 text-[11px] font-medium text-danger hover:bg-danger/20 transition-all"
                                title="Desasignar a este alumno de la materia"
                              >
                                Desasignar
                              </button>
                            </div>
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
        {/* PESTAÑA 3: ACTAS Y LIBRO DE CALIFICACIONES                                */}
        {/* ========================================================================= */}
        {activeTab === 'calificaciones' && (
          <div className="space-y-4">
            <div className="rounded-[10px] border border-border bg-surface p-5 shadow-minimal">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
                    <IconGrades className="w-5 h-5 text-primary" />
                    <span>Libro de Calificaciones y Evaluaciones</span>
                  </h2>
                  <p className="text-xs text-muted mt-0.5">
                    El libro de calificaciones oficial y las actas académicas se asientan directamente en Moodle LMS.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2.5">
                  <select
                    value={selectedCourseFilter}
                    onChange={(e) => setSelectedCourseFilter(e.target.value)}
                    className="rounded-[6px] border border-border bg-surface-muted/40 px-3 py-1.5 text-xs text-foreground focus:border-primary focus:outline-none transition-all"
                  >
                    <option value="">Todas mis asignaturas</option>
                    {courses.map((c) => (
                      <option key={c.course_mapping_id} value={c.course_mapping_id}>
                        {c.course_code} - {c.course_name}
                      </option>
                    ))}
                  </select>

                  {courses.length > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        const target = selectedCourseFilter
                          ? courses.find((c) => c.course_mapping_id === selectedCourseFilter)
                          : courses[0];
                        if (target?.moodle_course_id) {
                          handleOpenGradebook(target.moodle_course_id);
                        }
                      }}
                      className="inline-flex items-center gap-1.5 rounded-[6px] bg-primary-action px-3 py-1.5 text-xs font-semibold text-white shadow-minimal hover:bg-primary-action/90 transition-all"
                    >
                      <IconExternalLink className="w-3.5 h-3.5 text-accent-lime" />
                      <span>Abrir Calificador en Moodle ↗</span>
                    </button>
                  )}
                </div>
              </div>

              <div className="mt-4 rounded-[8px] bg-surface-muted/50 border border-border/70 p-3 text-xs text-muted leading-relaxed">
                <p>
                  <strong className="text-foreground">Lineamiento académico oficial:</strong> Las calificaciones, ponderaciones de rúbricas y actas se administran en Moodle LMS. Desde aquí puedes consultar tus grupos y abrir el calificador oficial de cada asignatura.
                </p>
              </div>
            </div>

            <div className="rounded-[10px] border border-border bg-surface overflow-hidden shadow-minimal">
              {filteredStudents.length === 0 ? (
                <div className="p-8 text-center text-xs text-muted">
                  No hay estudiantes matriculados para calificar en esta asignatura.
                </div>
              ) : (
                <table className="w-full text-left text-xs">
                  <thead className="bg-surface-muted/60 text-muted font-medium border-b border-border">
                    <tr>
                      <th className="px-5 py-3.5">Estudiante</th>
                      <th className="px-5 py-3.5">Materia</th>
                      <th className="px-5 py-3.5">Estado Moodle</th>
                      <th className="px-5 py-3.5">Calificaciones oficiales</th>
                      <th className="px-5 py-3.5 text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {filteredStudents.map((enr) => {
                      const studentName =
                        enr.profiles?.first_name || enr.profiles?.last_name
                          ? `${enr.profiles?.first_name || ''} ${enr.profiles?.last_name || ''}`.trim()
                          : 'Estudiante Registrado';
                      const courseName =
                        enr.course_mappings?.courses?.name || 'Materia';
                      const moodleCourseId = enr.course_mappings?.moodle_course_id;
                      const courseMappingId = enr.course_mapping_id;

                      return (
                        <tr key={enr.id} className="hover:bg-surface-muted/30 transition-colors">
                          <td className="px-5 py-3.5">
                            <span className="font-semibold text-foreground block">
                              {studentName}
                            </span>
                            <span className="font-mono text-[11px] text-muted">
                              {enr.profiles?.email}
                            </span>
                          </td>
                          <td className="px-5 py-3.5 font-medium text-foreground">
                            {courseName}
                          </td>
                          <td className="px-5 py-3.5">
                            <MoodleSyncBadge
                              status={enr.moodle_sync_status}
                              moodleId={enr.profiles?.moodle_user_id}
                            />
                          </td>
                          <td className="px-5 py-3.5 font-mono text-xs">
                            <span className="text-muted text-[11px]">Consulta el calificador de Moodle</span>
                          </td>
                          <td className="px-5 py-3.5 text-right">
                            <div className="inline-flex items-center gap-2">
                              {courseMappingId && (
                                <button
                                  type="button"
                                  onClick={() => handleLaunchCourseSSO(courseMappingId)}
                                  disabled={actionLoading === `launch-${courseMappingId}`}
                                  className="rounded-[4px] border border-border bg-surface-muted/40 hover:bg-surface-muted px-2 py-1 text-[11px] font-medium text-foreground transition-all"
                                >
                                  Aula SSO ↗
                                </button>
                              )}
                              {moodleCourseId && (
                                <button
                                  type="button"
                                  onClick={() => handleOpenGradebook(moodleCourseId)}
                                  className="rounded-[4px] border border-border bg-surface-muted/40 hover:bg-surface-muted px-2 py-1 text-[11px] font-medium text-primary transition-all"
                                >
                                  Calificador ↗
                                </button>
                              )}
                            </div>
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
        {/* PESTAÑA 4: PERFIL INSTITUCIONAL DEL DOCENTE                                */}
        {/* ========================================================================= */}
        {activeTab === 'perfil' && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-[10px] border border-border bg-surface p-5 shadow-minimal">
              <div>
                <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
                  <IconSettings className="w-5 h-5 text-primary" />
                  <span>Perfil Institucional y Credenciales Docentes</span>
                </h2>
                <p className="text-xs text-muted mt-0.5">
                  Datos de identidad académica registrados en INICIA y vinculación con el campus virtual.
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
                  Identidad en el Portal
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
                    <span className="text-muted">Rol Académico</span>
                    <span className="font-medium text-primary">Docente Titular / Profesor</span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-muted">Estado en Portal</span>
                    <span className="capitalize text-emerald-600 dark:text-emerald-400 font-medium">
                      {user?.status || 'activo'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="rounded-[10px] border border-border bg-surface p-5 space-y-3 shadow-minimal">
                <span className="text-[11px] font-mono uppercase tracking-wider text-muted">
                  Enlace con Moodle LMS
                </span>
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between py-1 border-b border-border/50">
                    <span className="text-muted">Usuario en Moodle</span>
                    <span className="font-mono text-foreground">
                      {user?.moodle_username || user?.email?.split('@')[0] || 'docente'}
                    </span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-border/50">
                    <span className="text-muted">Moodle ID Numérico</span>
                    <span className="font-mono text-foreground">
                      {user?.moodle_user_id ? `#${user.moodle_user_id}` : 'Vinculado vía correo'}
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
                    <span className="text-muted">Mecanismo de Salto SSO</span>
                    <span className="font-mono text-emerald-600 dark:text-emerald-400 font-medium">
                      auth_userkey (SSO Directo)
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* MODAL: CONFIRMACIÓN PARA DESASIGNAR ESTUDIANTE DE LA MATERIA */}
        {unenrollTarget && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="w-full max-w-md rounded-[14px] border border-border bg-surface p-6 shadow-xl space-y-4 animate-in fade-in zoom-in-95">
              <div className="flex items-center gap-3 text-danger">
                <div className="grid h-10 w-10 place-items-center rounded-full bg-danger/10 border border-danger/20">
                  <IconAlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-foreground">
                    Desasignar estudiante
                  </h3>
                  <p className="text-xs text-muted">Confirmación de baja en la materia</p>
                </div>
              </div>

              <div className="rounded-[8px] bg-surface-muted/50 border border-border p-3.5 text-xs text-muted space-y-1">
                <p>
                  ¿Estás seguro de que deseas desasignar a{' '}
                  <strong className="text-foreground">{unenrollTarget.studentName}</strong> de la materia{' '}
                  <strong className="text-foreground">{unenrollTarget.courseName}</strong>?
                </p>
                <p className="text-[11px] text-danger/90 pt-1">
                  Esta acción revocará su acceso al aula virtual en Moodle LMS y desvinculará su matrícula.
                </p>
              </div>

              <div className="flex justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setUnenrollTarget(null)}
                  disabled={actionLoading === `unenroll-${unenrollTarget.id}`}
                  className="rounded-[6px] border border-border bg-surface px-4 py-2 text-xs font-semibold text-foreground hover:bg-surface-muted transition-all"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleConfirmUnenroll}
                  disabled={actionLoading === `unenroll-${unenrollTarget.id}`}
                  className="rounded-[6px] bg-danger px-4 py-2 text-xs font-semibold text-white shadow-minimal hover:bg-danger/90 transition-all disabled:opacity-50"
                >
                  {actionLoading === `unenroll-${unenrollTarget.id}`
                    ? 'Desasignando...'
                    : 'Sí, desasignar alumno'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* MODAL: EDITAR INFORMACIÓN DE PERFIL DOCENTE */}
        {editProfileOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="w-full max-w-md rounded-[14px] border border-border bg-surface p-6 shadow-xl space-y-4 animate-in fade-in zoom-in-95">
              <div className="flex items-center justify-between border-b border-border pb-3">
                <div className="flex items-center gap-2">
                  <IconSettings className="w-5 h-5 text-primary" />
                  <h3 className="text-base font-bold text-foreground">
                    Editar Datos del Docente
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
                  <label className="block text-muted font-medium mb-1">Semblanza académica o síntesis curricular</label>
                  <textarea
                    rows={3}
                    placeholder="Grados académicos, líneas de investigación o áreas de especialidad..."
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
