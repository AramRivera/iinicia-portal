'use client';

import React, { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { usersApi, coursesApi, rolesApi, enrollmentsApi, moodleApi } from '@/lib/api';
import type { UserProfile, CourseOffering, RoleItem, EnrollmentRequest } from '@/types';
import { CampusShell } from '@/components/campus-tech/CampusShell';
import { MoodleSyncBadge } from '@/components/moodle/MoodleSyncBadge';
import {
  IconStudents,
  IconTeachers,
  IconGroups,
  IconShield,
  IconSearch,
  IconPlus,
  IconCheck,
  IconAlertTriangle,
  IconClose,
  IconRefresh,
  IconExternalLink,
} from '@/components/campus-tech/Icons';

export default function AsignacionesPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  const [users, setUsers] = useState<UserProfile[]>([]);
  const [courses, setCourses] = useState<CourseOffering[]>([]);
  const [roles, setRoles] = useState<RoleItem[]>([]);
  const [enrollments, setEnrollments] = useState<EnrollmentRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Filtros
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('todos');
  const [statusFilter, setStatusFilter] = useState('todos');

  // Notificaciones
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Modales
  const [assignCourseUser, setAssignCourseUser] = useState<UserProfile | null>(null);
  const [selectedCourseId, setSelectedCourseId] = useState('');
  const [selectedMoodleRole, setSelectedMoodleRole] = useState<'student' | 'teacher'>('student');
  const [assignNotes, setAssignNotes] = useState('');

  const [roleTargetUser, setRoleTargetUser] = useState<UserProfile | null>(null);
  const [selectedRoleId, setSelectedRoleId] = useState('');

  const [unenrollTarget, setUnenrollTarget] = useState<{
    enrollmentId: string;
    userName: string;
    courseName: string;
  } | null>(null);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [usersRes, coursesData, rolesData, enrollmentsData] = await Promise.all([
        usersApi.getUsers({ limit: 100 }),
        coursesApi.getOfferings().catch(() => []),
        rolesApi.getRoles().catch(() => []),
        enrollmentsApi.getAllEnrollments().catch(() => []),
      ]);
      setUsers(usersRes.data || []);
      setCourses(coursesData);
      setRoles(rolesData);
      setEnrollments(enrollmentsData);
    } catch (err: any) {
      setError(err.message || 'Error al cargar datos de asignaciones.');
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
    const hasAdminAccess = user.roles.some((r) =>
      ['superadministrador', 'administrador', 'coordinador'].includes(r),
    );
    if (!hasAdminAccess) {
      router.push('/dashboard');
      return;
    }

    loadData();
  }, [user, authLoading, router]);

  // Mapa de matrículas por usuario
  const userEnrollmentsMap = useMemo(() => {
    const map = new Map<string, EnrollmentRequest[]>();
    for (const enr of enrollments) {
      if (!map.has(enr.user_id)) {
        map.set(enr.user_id, []);
      }
      map.get(enr.user_id)!.push(enr);
    }
    return map;
  }, [enrollments]);

  // Usuarios filtrados
  const filteredUsers = useMemo(() => {
    let list = users;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter((u) => {
        const full = `${u.first_name || ''} ${u.last_name || ''}`.toLowerCase();
        const email = (u.email || '').toLowerCase();
        return full.includes(q) || email.includes(q);
      });
    }

    if (roleFilter !== 'todos') {
      list = list.filter((u) => u.roles?.includes(roleFilter as any));
    }

    if (statusFilter !== 'todos') {
      list = list.filter((u) => u.status === statusFilter);
    }

    return list;
  }, [users, searchQuery, roleFilter, statusFilter]);

  // Asignar curso
  const handleAssignCourse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assignCourseUser || !selectedCourseId) {
      setError('Debes seleccionar un curso para asignar.');
      return;
    }

    setActionLoading('assign-course');
    setNotice(null);
    setError(null);

    try {
      await enrollmentsApi.requestEnrollment(selectedCourseId, {
        user_id: assignCourseUser.id,
        moodle_role: selectedMoodleRole,
        notes: assignNotes || 'Asignado administrativamente desde panel de Asignaciones',
      });
      setNotice(
        `Curso asignado y matriculado exitosamente para ${assignCourseUser.first_name} ${assignCourseUser.last_name} (${assignCourseUser.email}).`,
      );
      setAssignCourseUser(null);
      setSelectedCourseId('');
      setAssignNotes('');
      await loadData();
    } catch (err: any) {
      setError(err.message || 'Error al asignar curso al usuario.');
    } finally {
      setActionLoading(null);
    }
  };

  // Desasignar curso
  const handleConfirmUnenroll = async () => {
    if (!unenrollTarget) return;

    setActionLoading(`unenroll-${unenrollTarget.enrollmentId}`);
    setNotice(null);
    setError(null);

    try {
      await enrollmentsApi.deleteEnrollment(unenrollTarget.enrollmentId);
      setNotice(
        `Materia "${unenrollTarget.courseName}" desasignada correctamente para ${unenrollTarget.userName}. Se actualizó Moodle LMS.`,
      );
      setUnenrollTarget(null);
      await loadData();
    } catch (err: any) {
      setError(err.message || 'Error al desasignar curso.');
    } finally {
      setActionLoading(null);
    }
  };

  // Asignar rol
  const handleAssignRole = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!roleTargetUser || !selectedRoleId) {
      setError('Selecciona un rol válido.');
      return;
    }

    setActionLoading('assign-role');
    setNotice(null);
    setError(null);

    try {
      await rolesApi.assignRole(roleTargetUser.id, Number(selectedRoleId));
      setNotice(
        `Rol asignado exitosamente a ${roleTargetUser.first_name} ${roleTargetUser.last_name}. Si contaba con rol provisional de aspirante, se desactivó automáticamente.`,
      );
      setRoleTargetUser(null);
      setSelectedRoleId('');
      await loadData();
    } catch (err: any) {
      setError(err.message || 'Error al asignar rol.');
    } finally {
      setActionLoading(null);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <p className="text-xs font-medium text-muted">Cargando módulo de asignaciones...</p>
        </div>
      </div>
    );
  }

  return (
    <CampusShell
      currentTab="asignaciones"
      onSelectTab={(tab) => {
        if (tab === 'usuarios' || tab === 'cursos' || tab === 'auditoria') {
          router.push('/dashboard/admin');
        }
      }}
      breadcrumbs={['IINICIA', 'Administración', 'Asignación de Cursos y Roles']}
    >
      <div className="space-y-6">
        {/* Header Asignaciones */}
        <div className="rounded-[10px] border border-border bg-surface p-5 sm:p-6 shadow-minimal">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="rounded-[4px] bg-primary/10 px-2 py-0.5 text-[11px] font-mono font-semibold text-primary border border-primary/20">
                  Gestión Curricular Centralizada
                </span>
                <span className="rounded-[4px] bg-accent-lime/20 px-2 py-0.5 text-[11px] font-mono font-semibold text-foreground border border-accent-lime/40">
                  Control de Matrícula y Roles
                </span>
              </div>
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
                Asignación de Cursos y Roles de Usuario
              </h1>
              <p className="text-xs sm:text-sm text-muted">
                Filtra alumnos, docentes y aspirantes por nombre o correo para asignar materias en Moodle LMS, vincular roles y desasignar cursos.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <Link
                href="/dashboard/admin"
                className="rounded-[6px] border border-border bg-surface hover:bg-surface-muted px-3 py-1.5 text-xs font-medium text-foreground transition-all"
              >
                ← Volver al Panel Admin
              </Link>
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

          {/* Estadísticas de Asignaciones */}
          <div className="mt-5 grid grid-cols-1 gap-3 border-t border-border pt-4 sm:grid-cols-4">
            <div className="rounded-[8px] border border-border bg-surface-muted/30 p-3">
              <span className="text-[11px] font-mono uppercase tracking-wider text-muted">Usuarios Registrados</span>
              <p className="mt-1 font-mono text-base font-bold text-foreground">{users.length}</p>
            </div>
            <div className="rounded-[8px] border border-border bg-surface-muted/30 p-3">
              <span className="text-[11px] font-mono uppercase tracking-wider text-muted">Cursos Ofertados</span>
              <p className="mt-1 font-mono text-base font-bold text-foreground">{courses.length}</p>
            </div>
            <div className="rounded-[8px] border border-border bg-surface-muted/30 p-3">
              <span className="text-[11px] font-mono uppercase tracking-wider text-muted">Matrículas Totales</span>
              <p className="mt-1 font-mono text-base font-bold text-foreground">{enrollments.length}</p>
            </div>
            <div className="rounded-[8px] border border-border bg-surface-muted/30 p-3">
              <span className="text-[11px] font-mono uppercase tracking-wider text-muted">Sincronizadas Moodle</span>
              <p className="mt-1 font-mono text-base font-bold text-emerald-600 dark:text-emerald-400">
                {enrollments.filter((e) => e.status === 'sincronizada').length}
              </p>
            </div>
          </div>
        </div>

        {/* Notificaciones */}
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

        {/* Barra de Filtros y Búsqueda */}
        <div className="rounded-[10px] border border-border bg-surface p-4 shadow-minimal flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="relative w-full sm:w-80">
            <input
              type="text"
              placeholder="Filtrar por nombre o correo..."
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

          <div className="flex flex-wrap items-center gap-2 text-xs">
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="rounded-[6px] border border-border bg-surface-muted/40 px-3 py-1.5 text-xs text-foreground focus:border-primary focus:outline-none"
            >
              <option value="todos">Todos los roles</option>
              <option value="estudiante">Estudiantes</option>
              <option value="profesor">Profesores</option>
              <option value="aspirante">Aspirantes</option>
              <option value="administrador">Administradores</option>
              <option value="coordinador">Coordinadores</option>
            </select>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded-[6px] border border-border bg-surface-muted/40 px-3 py-1.5 text-xs text-foreground focus:border-primary focus:outline-none"
            >
              <option value="todos">Todos los estados</option>
              <option value="activo">Activo</option>
              <option value="pendiente">Pendiente</option>
              <option value="suspendido">Suspendido</option>
            </select>
          </div>
        </div>

        {/* Tabla Central de Asignaciones */}
        <div className="rounded-[10px] border border-border bg-surface overflow-hidden shadow-minimal">
          {filteredUsers.length === 0 ? (
            <div className="p-10 text-center text-xs text-muted">
              No se encontraron usuarios que coincidan con los criterios de búsqueda.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-surface-muted/60 text-muted font-medium border-b border-border">
                  <tr>
                    <th className="px-5 py-3.5">Usuario / Correo</th>
                    <th className="px-5 py-3.5">Roles Activos</th>
                    <th className="px-5 py-3.5">Cursos Asignados</th>
                    <th className="px-5 py-3.5">Moodle LMS</th>
                    <th className="px-5 py-3.5 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredUsers.map((u) => {
                    const userEnrs = userEnrollmentsMap.get(u.id) || [];
                    const activeRoles = u.roles || [];

                    return (
                      <tr key={u.id} className="hover:bg-surface-muted/30 transition-colors">
                        <td className="px-5 py-3.5">
                          <span className="font-semibold text-foreground block">
                            {u.first_name} {u.last_name}
                          </span>
                          <span className="font-mono text-[11px] text-muted">{u.email}</span>
                        </td>

                        <td className="px-5 py-3.5">
                          <div className="flex flex-wrap gap-1">
                            {activeRoles.map((r) => (
                              <span
                                key={r}
                                className={`rounded-[4px] px-2 py-0.5 text-[10px] font-mono font-medium border ${
                                  r === 'profesor'
                                    ? 'bg-primary/10 text-primary border-primary/20 font-bold'
                                    : r === 'estudiante'
                                    ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                                    : r === 'aspirante'
                                    ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20'
                                    : 'bg-surface-muted text-foreground border-border'
                                }`}
                              >
                                {r}
                              </span>
                            ))}
                          </div>
                        </td>

                        <td className="px-5 py-3.5">
                          {userEnrs.length === 0 ? (
                            <span className="text-[11px] text-muted italic">Sin materias asignadas</span>
                          ) : (
                            <div className="flex flex-wrap gap-1.5">
                              {userEnrs.map((enr) => {
                                const courseName =
                                  enr.course_mappings?.courses?.name ||
                                  enr.course_mappings?.portal_course_code ||
                                  'Materia';

                                return (
                                  <span
                                    key={enr.id}
                                    className="inline-flex items-center gap-1.5 rounded-[4px] bg-surface-muted px-2 py-1 text-[11px] border border-border"
                                  >
                                    <span className="font-medium text-foreground">{courseName}</span>
                                    <span className="font-mono text-[9px] text-primary">
                                      ({enr.moodle_role || 'student'})
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setUnenrollTarget({
                                          enrollmentId: enr.id,
                                          userName: `${u.first_name} ${u.last_name}`,
                                          courseName,
                                        })
                                      }
                                      className="text-muted hover:text-danger ml-0.5"
                                      title="Desasignar curso"
                                    >
                                      <IconClose className="w-2.5 h-2.5" />
                                    </button>
                                  </span>
                                );
                              })}
                            </div>
                          )}
                        </td>

                        <td className="px-5 py-3.5">
                          <MoodleSyncBadge status={u.moodle_sync_status} moodleId={u.moodle_user_id} />
                        </td>

                        <td className="px-5 py-3.5 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => {
                                setAssignCourseUser(u);
                                setSelectedCourseId(courses[0]?.course_mapping_id || '');
                                setSelectedMoodleRole(
                                  u.roles.includes('profesor') ? 'teacher' : 'student',
                                );
                              }}
                              className="rounded-[4px] bg-primary/10 border border-primary/20 px-2.5 py-1 text-[11px] font-semibold text-primary hover:bg-primary/20 transition-all"
                            >
                              + Asignar Curso
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                setRoleTargetUser(u);
                                setSelectedRoleId(String(roles[0]?.id || '5'));
                              }}
                              className="rounded-[4px] border border-border bg-surface px-2.5 py-1 text-[11px] font-medium text-foreground hover:bg-surface-muted transition-all"
                            >
                              Roles
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* MODAL: ASIGNAR CURSO AL USUARIO */}
        {assignCourseUser && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="w-full max-w-md rounded-[14px] border border-border bg-surface p-6 shadow-xl space-y-4 animate-in fade-in zoom-in-95">
              <div className="flex items-center justify-between border-b border-border pb-3">
                <div className="flex items-center gap-2">
                  <IconGroups className="w-5 h-5 text-primary" />
                  <h3 className="text-base font-bold text-foreground">
                    Asignar Curso a Usuario
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setAssignCourseUser(null)}
                  className="text-muted hover:text-foreground"
                >
                  <IconClose className="w-4 h-4" />
                </button>
              </div>

              <div className="text-xs space-y-1">
                <div>
                  <span className="text-muted">Destinatario: </span>
                  <strong className="text-foreground">
                    {assignCourseUser.first_name} {assignCourseUser.last_name}
                  </strong>{' '}
                  <span className="font-mono text-muted">({assignCourseUser.email})</span>
                </div>
              </div>

              <form onSubmit={handleAssignCourse} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1">
                    Seleccionar Asignatura *
                  </label>
                  <select
                    value={selectedCourseId}
                    onChange={(e) => setSelectedCourseId(e.target.value)}
                    className="w-full rounded-[6px] border border-border bg-surface-muted/40 px-3 py-2 text-xs text-foreground focus:border-primary focus:bg-surface focus:outline-none transition-all"
                  >
                    {courses.map((c) => (
                      <option key={c.course_mapping_id} value={c.course_mapping_id}>
                        {c.code} - {c.name} (Moodle #{c.moodle_course_id})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-foreground mb-1">
                    Rol en Moodle LMS *
                  </label>
                  <select
                    value={selectedMoodleRole}
                    onChange={(e) => setSelectedMoodleRole(e.target.value as any)}
                    className="w-full rounded-[6px] border border-border bg-surface-muted/40 px-3 py-2 text-xs text-foreground focus:border-primary focus:bg-surface focus:outline-none transition-all"
                  >
                    <option value="student">Estudiante (student)</option>
                    <option value="teacher">Profesor Titular (editingteacher)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-foreground mb-1">
                    Nota o Justificación Administrativa
                  </label>
                  <input
                    type="text"
                    value={assignNotes}
                    onChange={(e) => setAssignNotes(e.target.value)}
                    placeholder="Ej. Asignación para ciclo 2026-A"
                    className="w-full rounded-[6px] border border-border bg-surface-muted/40 px-3 py-2 text-xs text-foreground focus:border-primary focus:bg-surface focus:outline-none transition-all"
                  />
                </div>

                <div className="flex justify-end gap-2.5 pt-2 border-t border-border">
                  <button
                    type="button"
                    onClick={() => setAssignCourseUser(null)}
                    disabled={actionLoading === 'assign-course'}
                    className="rounded-[6px] border border-border bg-surface px-4 py-2 text-xs font-semibold text-foreground hover:bg-surface-muted transition-all"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={actionLoading === 'assign-course'}
                    className="rounded-[6px] bg-primary-action px-4 py-2 text-xs font-semibold text-white shadow-minimal hover:bg-primary-action/90 transition-all disabled:opacity-50"
                  >
                    {actionLoading === 'assign-course' ? 'Matriculando en Moodle...' : 'Asignar y Matricular'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* MODAL: CONFIRMACIÓN DE DESASIGNACIÓN DE CURSO */}
        {unenrollTarget && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="w-full max-w-md rounded-[14px] border border-border bg-surface p-6 shadow-xl space-y-4 animate-in fade-in zoom-in-95">
              <div className="flex items-center gap-3 text-danger">
                <div className="grid h-10 w-10 place-items-center rounded-full bg-danger/10 border border-danger/20">
                  <IconAlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-foreground">
                    Desasignar materia a usuario
                  </h3>
                  <p className="text-xs text-muted">Revocación de matrícula y acceso Moodle</p>
                </div>
              </div>

              <div className="rounded-[8px] bg-surface-muted/50 border border-border p-3.5 text-xs text-muted space-y-1">
                <p>
                  ¿Estás seguro de que deseas desasignar el curso{' '}
                  <strong className="text-foreground">{unenrollTarget.courseName}</strong> a{' '}
                  <strong className="text-foreground">{unenrollTarget.userName}</strong>?
                </p>
                <p className="text-[11px] text-danger/90 pt-1">
                  Esta acción revocará su matrícula en Moodle LMS y retirará el aula virtual de su panel.
                </p>
              </div>

              <div className="flex justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setUnenrollTarget(null)}
                  disabled={actionLoading === `unenroll-${unenrollTarget.enrollmentId}`}
                  className="rounded-[6px] border border-border bg-surface px-4 py-2 text-xs font-semibold text-foreground hover:bg-surface-muted transition-all"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleConfirmUnenroll}
                  disabled={actionLoading === `unenroll-${unenrollTarget.enrollmentId}`}
                  className="rounded-[6px] bg-danger px-4 py-2 text-xs font-semibold text-white shadow-minimal hover:bg-danger/90 transition-all disabled:opacity-50"
                >
                  {actionLoading === `unenroll-${unenrollTarget.enrollmentId}`
                    ? 'Desasignando...'
                    : 'Sí, desasignar materia'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* MODAL: ASIGNAR ROL */}
        {roleTargetUser && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="w-full max-w-md rounded-[14px] border border-border bg-surface p-6 shadow-xl space-y-4 animate-in fade-in zoom-in-95">
              <div className="flex items-center justify-between border-b border-border pb-3">
                <div className="flex items-center gap-2">
                  <IconShield className="w-5 h-5 text-primary" />
                  <h3 className="text-base font-bold text-foreground">
                    Asignar Rol a Usuario
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setRoleTargetUser(null)}
                  className="text-muted hover:text-foreground"
                >
                  <IconClose className="w-4 h-4" />
                </button>
              </div>

              <div className="text-xs space-y-1">
                <div>
                  <span className="text-muted">Usuario: </span>
                  <strong className="text-foreground">
                    {roleTargetUser.first_name} {roleTargetUser.last_name}
                  </strong>{' '}
                  <span className="font-mono text-muted">({roleTargetUser.email})</span>
                </div>
                <div>
                  <span className="text-muted">Roles Actuales: </span>
                  <span className="font-mono text-foreground font-semibold">
                    {roleTargetUser.roles.join(', ')}
                  </span>
                </div>
              </div>

              <form onSubmit={handleAssignRole} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1">
                    Seleccionar Rol a Otorgar *
                  </label>
                  <select
                    value={selectedRoleId}
                    onChange={(e) => setSelectedRoleId(e.target.value)}
                    className="w-full rounded-[6px] border border-border bg-surface-muted/40 px-3 py-2 text-xs text-foreground focus:border-primary focus:bg-surface focus:outline-none transition-all"
                  >
                    {roles.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name} ({r.slug})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="rounded-[6px] bg-primary/10 border border-primary/20 p-3 text-[11px] text-muted">
                  Al asignar un rol formal (profesor, estudiante, etc.), el rol provisional de aspirante se desactivará automáticamente para evitar duplicidades.
                </div>

                <div className="flex justify-end gap-2.5 pt-2 border-t border-border">
                  <button
                    type="button"
                    onClick={() => setRoleTargetUser(null)}
                    disabled={actionLoading === 'assign-role'}
                    className="rounded-[6px] border border-border bg-surface px-4 py-2 text-xs font-semibold text-foreground hover:bg-surface-muted transition-all"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={actionLoading === 'assign-role'}
                    className="rounded-[6px] bg-primary-action px-4 py-2 text-xs font-semibold text-white shadow-minimal hover:bg-primary-action/90 transition-all disabled:opacity-50"
                  >
                    {actionLoading === 'assign-role' ? 'Guardando...' : 'Asignar Rol'}
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
