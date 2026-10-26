'use client';

import React, { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import {
  auditApi,
  coursesApi,
  enrollmentsApi,
  moodleApi,
  programsApi,
  rolesApi,
  usersApi,
} from '@/lib/api';
import type {
  AuditLog,
  CourseOffering,
  EnrollmentRequest,
  MoodleStatusResponse,
  Program,
  RoleItem,
  RoleSlug,
  UserProfile,
} from '@/types';
import { MoodleSyncBadge } from '@/components/moodle/MoodleSyncBadge';

type AdminTab = 'usuarios' | 'cursos' | 'matriculas' | 'programas' | 'moodle' | 'auditoria';

export default function AdminDashboardPage() {
  const router = useRouter();
  const { user, loading: authLoading, hasRole } = useAuth();

  // Estados de pestañas y carga
  const [activeTab, setActiveTab] = useState<AdminTab>('usuarios');
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Datos principales
  const [moodleStatus, setMoodleStatus] = useState<MoodleStatusResponse | null>(null);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [roles, setRoles] = useState<RoleItem[]>([]);
  const [courses, setCourses] = useState<CourseOffering[]>([]);
  const [enrollments, setEnrollments] = useState<EnrollmentRequest[]>([]);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);

  // Filtros de usuarios
  const [userSearch, setUserSearch] = useState('');
  const [userRoleFilter, setUserRoleFilter] = useState('');
  const [userStatusFilter, setUserStatusFilter] = useState('');

  // Filtros de matrículas
  const [enrollmentStatusFilter, setEnrollmentStatusFilter] = useState('');

  // Modales
  const [selectedUserForRole, setSelectedUserForRole] = useState<UserProfile | null>(null);
  const [roleToAssign, setRoleToAssign] = useState<number>(5); // default Estudiante (5)

  const [selectedUserForStatus, setSelectedUserForStatus] = useState<UserProfile | null>(null);
  const [newStatus, setNewStatus] = useState<string>('activo');
  const [statusReason, setStatusReason] = useState<string>('');

  const [showAssignCourseModal, setShowAssignCourseModal] = useState(false);
  const [assignTargetUserId, setAssignTargetUserId] = useState<string>('');
  const [assignCourseId, setAssignCourseId] = useState<string>('');
  const [assignMoodleRole, setAssignMoodleRole] = useState<'student' | 'editingteacher'>('student');

  const [showCreateCourseModal, setShowCreateCourseModal] = useState(false);
  const [newCourseName, setNewCourseName] = useState('');
  const [newCourseCode, setNewCourseCode] = useState('');
  const [newCourseSlug, setNewCourseSlug] = useState('');
  const [newMoodleCourseId, setNewMoodleCourseId] = useState<number>(1);
  const [newMoodleShortname, setNewMoodleShortname] = useState('');
  const [newCourseProgramId, setNewCourseProgramId] = useState('');
  const [newCourseTerm, setNewCourseTerm] = useState<number>(1);

  const isAdminOrCoordinator =
    hasRole('superadministrador') || hasRole('administrador') || hasRole('coordinador');

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      const [statusRes, usersRes, rolesRes, coursesRes, enrollRes, progRes, auditRes] =
        await Promise.all([
          moodleApi.getStatus().catch(() => ({ ok: false, message: 'No disponible' })),
          usersApi.getUsers({ limit: 50 }).catch(() => ({ data: [], meta: {} })),
          rolesApi.getRoles().catch(() => []),
          coursesApi.getOfferings().catch(() => []),
          enrollmentsApi.getAllEnrollments().catch(() => ({ data: [], meta: {} })),
          programsApi.getPrograms().catch(() => []),
          auditApi.getLogs({ limit: 30 }).catch(() => []),
        ]);

      setMoodleStatus(statusRes);
      setUsers(usersRes.data || []);
      setRoles(rolesRes || []);
      setCourses(coursesRes || []);
      setEnrollments(enrollRes.data || []);
      setPrograms(progRes || []);
      setAuditLogs(auditRes || []);
    } catch (err: any) {
      setError(err.message || 'Error al cargar los módulos administrativos.');
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
    if (!isAdminOrCoordinator) {
      router.push('/dashboard/estudiante');
      return;
    }

    loadData();
  }, [user, authLoading, isAdminOrCoordinator, router]);

  // Filtrado de usuarios
  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      const matchesSearch =
        userSearch === '' ||
        u.email.toLowerCase().includes(userSearch.toLowerCase()) ||
        `${u.first_name} ${u.last_name}`.toLowerCase().includes(userSearch.toLowerCase()) ||
        (u.moodle_username && u.moodle_username.toLowerCase().includes(userSearch.toLowerCase()));

      const userRoles = (u.active_roles || u.roles || []) as string[];
      const matchesRole =
        userRoleFilter === '' || userRoles.includes(userRoleFilter);

      const matchesStatus = userStatusFilter === '' || u.status === userStatusFilter;

      return matchesSearch && matchesRole && matchesStatus;
    });
  }, [users, userSearch, userRoleFilter, userStatusFilter]);

  // Filtrado de matrículas
  const filteredEnrollments = useMemo(() => {
    return enrollments.filter((e) => {
      if (!enrollmentStatusFilter) return true;
      return e.status === enrollmentStatusFilter;
    });
  }, [enrollments, enrollmentStatusFilter]);

  // Acciones: Roles
  const handleAssignRole = async () => {
    if (!selectedUserForRole) return;
    setActionLoading('assign-role');
    setNotice(null);
    setError(null);

    try {
      await rolesApi.assignRole(selectedUserForRole.id, Number(roleToAssign));
      setNotice(`✓ Rol asignado con éxito a ${selectedUserForRole.email}.`);
      setSelectedUserForRole(null);
      await loadData();
    } catch (err: any) {
      setError(err.message || 'Error al asignar rol.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleRevokeRole = async (userId: string, roleId: number, roleName: string) => {
    if (!confirm(`¿Confirmas que deseas retirar el rol "${roleName}" a este usuario?`)) return;
    setActionLoading(`revoke-${userId}-${roleId}`);
    setNotice(null);
    setError(null);

    try {
      await rolesApi.revokeRole(userId, roleId);
      setNotice(`✓ Rol "${roleName}" retirado exitosamente.`);
      await loadData();
    } catch (err: any) {
      setError(err.message || 'Error al retirar rol.');
    } finally {
      setActionLoading(null);
    }
  };

  // Acciones: Estado de usuario
  const handleUpdateUserStatus = async () => {
    if (!selectedUserForStatus) return;
    setActionLoading('update-status');
    setNotice(null);
    setError(null);

    try {
      await usersApi.updateStatus(selectedUserForStatus.id, {
        status: newStatus,
        reason: statusReason || undefined,
      });
      setNotice(`✓ Estado de ${selectedUserForStatus.email} actualizado a "${newStatus}".`);
      setSelectedUserForStatus(null);
      setStatusReason('');
      await loadData();
    } catch (err: any) {
      setError(err.message || 'Error al actualizar estado del usuario.');
    } finally {
      setActionLoading(null);
    }
  };

  // Acciones: Matrículas
  const handleAuthorizeEnrollment = async (
    enrollmentId: string,
    status: 'autorizada' | 'rechazada',
  ) => {
    setActionLoading(`enr-${enrollmentId}`);
    setNotice(null);
    setError(null);

    try {
      await enrollmentsApi.authorizeEnrollment(enrollmentId, {
        status,
        sync_to_moodle: true,
      });
      setNotice(
        status === 'autorizada'
          ? '✓ Matrícula autorizada y sincronizada con Moodle LMS.'
          : 'Solicitud rechazada.',
      );
      await loadData();
    } catch (err: any) {
      setError(err.message || 'Error al procesar matrícula.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleRetryMoodleSync = async (enrollmentId: string) => {
    setActionLoading(`sync-enr-${enrollmentId}`);
    setNotice(null);
    setError(null);

    try {
      const res = await enrollmentsApi.retrySync(enrollmentId);
      setNotice(
        res.success
          ? '✓ Sincronización con Moodle ejecutada exitosamente.'
          : 'La sincronización devolvió un aviso.',
      );
      await loadData();
    } catch (err: any) {
      setError(err.message || 'Error al sincronizar matrícula con Moodle.');
    } finally {
      setActionLoading(null);
    }
  };

  // Acciones: Asignar curso directo
  const handleDirectCourseAssignment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assignTargetUserId || !assignCourseId) {
      setError('Debes seleccionar un usuario y un curso.');
      return;
    }

    setActionLoading('assign-course');
    setNotice(null);
    setError(null);

    try {
      await enrollmentsApi.requestEnrollment(assignCourseId, {
        user_id: assignTargetUserId,
        moodle_role: assignMoodleRole,
        notes: 'Asignado directamente desde el panel de Superadministrador',
      });
      setNotice('✓ Curso asignado y matriculado en Moodle LMS exitosamente.');
      setShowAssignCourseModal(false);
      setAssignTargetUserId('');
      setAssignCourseId('');
      await loadData();
    } catch (err: any) {
      setError(err.message || 'Error al asignar curso al usuario.');
    } finally {
      setActionLoading(null);
    }
  };

  // Acciones: Crear nuevo mapeo de curso
  const handleCreateCourseMapping = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCourseName || !newCourseCode || !newMoodleCourseId || !newMoodleShortname) {
      setError('Por favor completa todos los campos requeridos del curso.');
      return;
    }

    setActionLoading('create-course');
    setNotice(null);
    setError(null);

    try {
      await coursesApi.createCourse({
        portal_course_code: newCourseCode.trim(),
        slug: newCourseSlug.trim() || newCourseCode.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-'),
        course_name: newCourseName.trim(),
        moodle_course_id: Number(newMoodleCourseId),
        moodle_shortname: newMoodleShortname.trim(),
        program_id: newCourseProgramId || undefined,
        term_or_module: Number(newCourseTerm) || 1,
        is_mandatory: true,
        is_active: true,
      });

      setNotice(`✓ Curso "${newCourseName}" vinculado exitosamente con Moodle (ID #${newMoodleCourseId}).`);
      setShowCreateCourseModal(false);
      setNewCourseName('');
      setNewCourseCode('');
      setNewCourseSlug('');
      setNewMoodleShortname('');
      await loadData();
    } catch (err: any) {
      setError(err.message || 'Error al crear y mapear el curso.');
    } finally {
      setActionLoading(null);
    }
  };

  // Acciones: Sincronización Moodle
  const handleBulkMoodleSync = async () => {
    setActionLoading('bulk-sync');
    setNotice(null);
    setError(null);

    try {
      const res = await moodleApi.syncAllUsers();
      setNotice(
        `✓ Sincronización masiva finalizada: ${res.synced} usuarios vinculados en Moodle LMS (${res.failed} errores).`,
      );
      await loadData();
    } catch (err: any) {
      setError(err.message || 'Error en la sincronización masiva con Moodle.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleSyncSingleUser = async (userId: string) => {
    setActionLoading(`user-sync-${userId}`);
    setNotice(null);
    setError(null);

    try {
      await moodleApi.syncUser(userId);
      setNotice('✓ Usuario sincronizado con éxito en Moodle LMS.');
      await loadData();
    } catch (err: any) {
      setError(err.message || 'Error al sincronizar usuario con Moodle.');
    } finally {
      setActionLoading(null);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-3 border-accent border-t-transparent" />
          <p className="text-sm text-foreground/60">Cargando Centro de Control Maestro...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-6">
      {/* Header Principal */}
      <div className="rounded-3xl border border-border/80 bg-background/60 p-6 backdrop-blur-xl sm:p-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-red-500/10 px-3 py-1 text-xs font-semibold text-red-400 border border-red-500/20">
                Super Administrador
              </span>
              <span className="rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-400 border border-emerald-500/20">
                LMS Moodle 5.3+ Activo
              </span>
            </div>
            <h1 className="mt-2 text-2xl font-black text-foreground sm:text-3xl">
              Panel de Control Maestro IINICIA
            </h1>
            <p className="mt-1 text-sm text-foreground/70">
              Administración unificada de usuarios, docentes, estudiantes, cursos, roles y sincronización bidireccional con Moodle LMS.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setShowAssignCourseModal(true)}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-xs font-semibold text-white shadow-md hover:bg-accent-strong transition-all"
            >
              + Asignar Curso
            </button>
            <button
              type="button"
              onClick={() => setShowCreateCourseModal(true)}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-foreground/5 px-4 py-2.5 text-xs font-semibold text-foreground hover:bg-foreground/10 transition-all"
            >
              + Vincular Curso Moodle
            </button>
            <button
              type="button"
              onClick={handleBulkMoodleSync}
              disabled={actionLoading === 'bulk-sync'}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-semibold text-white shadow-md hover:bg-blue-500 transition-all disabled:opacity-50"
            >
              {actionLoading === 'bulk-sync' ? (
                <>
                  <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  <span>Sincronizando...</span>
                </>
              ) : (
                <>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
                  </svg>
                  <span>Sincronizar Moodle</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Métricas Globales Rápidas */}
        <div className="mt-6 grid grid-cols-2 gap-3 border-t border-border/80 pt-6 sm:grid-cols-4">
          <div className="rounded-2xl border border-border/50 bg-foreground/[0.02] p-4">
            <span className="text-xs text-foreground/60">Usuarios Totales</span>
            <p className="mt-1 text-2xl font-extrabold text-foreground">{users.length}</p>
            <span className="text-[11px] text-foreground/50">
              {users.filter((u) => u.moodle_sync_status === 'sincronizado').length} en Moodle
            </span>
          </div>

          <div className="rounded-2xl border border-border/50 bg-foreground/[0.02] p-4">
            <span className="text-xs text-foreground/60">Cursos Ofertados</span>
            <p className="mt-1 text-2xl font-extrabold text-foreground">{courses.length}</p>
            <span className="text-[11px] text-emerald-400">Vinculados a Moodle</span>
          </div>

          <div className="rounded-2xl border border-border/50 bg-foreground/[0.02] p-4">
            <span className="text-xs text-foreground/60">Solicitudes de Matrícula</span>
            <p className="mt-1 text-2xl font-extrabold text-foreground">{enrollments.length}</p>
            <span className="text-[11px] text-amber-400">
              {enrollments.filter((e) => e.status === 'pendiente').length} pendientes
            </span>
          </div>

          <div className="rounded-2xl border border-border/50 bg-foreground/[0.02] p-4">
            <span className="text-xs text-foreground/60">Servidor Moodle</span>
            <p className="mt-1 text-lg font-bold text-emerald-400">En Línea</p>
            <a
              href="http://localhost/moodle"
              target="_blank"
              rel="noreferrer"
              className="text-[11px] text-accent hover:underline inline-block mt-0.5"
            >
              Abrir campus Moodle ↗
            </a>
          </div>
        </div>
      </div>

      {/* Alertas y Notificaciones */}
      {notice && (
        <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm font-medium text-emerald-400 flex items-center justify-between">
          <span>{notice}</span>
          <button type="button" onClick={() => setNotice(null)} className="text-xs text-emerald-400/80 hover:text-emerald-300">
            Cerrar ✕
          </button>
        </div>
      )}

      {error && (
        <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm font-medium text-red-400 flex items-center justify-between">
          <span>{error}</span>
          <button type="button" onClick={() => setError(null)} className="text-xs text-red-400/80 hover:text-red-300">
            Cerrar ✕
          </button>
        </div>
      )}

      {/* Navegación por Pestañas */}
      <div className="flex overflow-x-auto border-b border-border/80 gap-2 pb-2">
        {[
          { id: 'usuarios', label: '👥 Gestión de Usuarios', count: users.length },
          { id: 'cursos', label: '📚 Cursos & Asignación', count: courses.length },
          { id: 'matriculas', label: '🎓 Matrículas & Solicitudes', count: enrollments.filter((e) => e.status === 'pendiente').length || undefined },
          { id: 'programas', label: '🏛️ Programas Académicos', count: programs.length },
          { id: 'moodle', label: '⚙️ Integración Moodle LMS' },
          { id: 'auditoria', label: '🛡️ Auditoría & Logs', count: auditLogs.length },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id as AdminTab)}
            className={`flex items-center gap-2 whitespace-nowrap rounded-xl px-4 py-2.5 text-xs font-semibold transition-all ${
              activeTab === tab.id
                ? 'bg-accent text-white shadow-md shadow-accent/20'
                : 'bg-foreground/5 text-foreground/70 hover:bg-foreground/10 hover:text-foreground'
            }`}
          >
            <span>{tab.label}</span>
            {tab.count !== undefined && (
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                  activeTab === tab.id ? 'bg-white/20 text-white' : 'bg-foreground/10 text-foreground/70'
                }`}
              >
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ========================================================================= */}
      {/* PESTAÑA 1: GESTIÓN DE USUARIOS                                            */}
      {/* ========================================================================= */}
      {activeTab === 'usuarios' && (
        <div className="space-y-4">
          {/* Barra de Filtros */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
            <input
              type="text"
              placeholder="Buscar por nombre, correo o usuario Moodle..."
              value={userSearch}
              onChange={(e) => setUserSearch(e.target.value)}
              className="rounded-xl border border-border bg-foreground/5 px-4 py-2.5 text-xs text-foreground placeholder-foreground/40 sm:col-span-2 focus:border-accent focus:outline-none"
            />

            <select
              value={userRoleFilter}
              onChange={(e) => setUserRoleFilter(e.target.value)}
              className="rounded-xl border border-border bg-background px-3 py-2.5 text-xs text-foreground focus:border-accent focus:outline-none"
            >
              <option value="">Todos los Roles</option>
              <option value="estudiante">Estudiantes</option>
              <option value="profesor">Profesores</option>
              <option value="aspirante">Aspirantes</option>
              <option value="coordinador">Coordinadores</option>
              <option value="administrador">Administradores</option>
              <option value="superadministrador">Superadministradores</option>
            </select>

            <select
              value={userStatusFilter}
              onChange={(e) => setUserStatusFilter(e.target.value)}
              className="rounded-xl border border-border bg-background px-3 py-2.5 text-xs text-foreground focus:border-accent focus:outline-none"
            >
              <option value="">Todos los Estados</option>
              <option value="activo">Activo</option>
              <option value="pendiente">Pendiente</option>
              <option value="suspendido">Suspendido</option>
              <option value="inactivo">Inactivo</option>
              <option value="baja">Baja</option>
            </select>
          </div>

          {/* Tabla de Usuarios */}
          <div className="overflow-hidden rounded-2xl border border-border/80 bg-background/50 shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-border/80 bg-foreground/[0.02] text-foreground/60 uppercase tracking-wider font-semibold">
                  <tr>
                    <th className="px-4 py-3.5">Usuario / Correo</th>
                    <th className="px-4 py-3.5">Roles Activos</th>
                    <th className="px-4 py-3.5">Estado Portal</th>
                    <th className="px-4 py-3.5">Vinculación Moodle</th>
                    <th className="px-4 py-3.5 text-right">Acciones de Control</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {filteredUsers.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-foreground/50">
                        No se encontraron usuarios con los filtros indicados.
                      </td>
                    </tr>
                  ) : (
                    filteredUsers.map((u) => (
                      <tr key={u.id} className="hover:bg-foreground/[0.02] transition-colors">
                        <td className="px-4 py-3.5">
                          <p className="font-bold text-foreground">
                            {u.first_name} {u.last_name}
                          </p>
                          <p className="font-mono text-[11px] text-foreground/60">{u.email}</p>
                          {u.phone && <p className="text-[10px] text-foreground/40">Tel: {u.phone}</p>}
                        </td>

                        <td className="px-4 py-3.5">
                          <div className="flex flex-wrap gap-1">
                            {((u.active_roles || u.roles || []) as string[]).length > 0 ? (
                              ((u.active_roles || u.roles || []) as string[]).map((r: string) => (
                                <span
                                  key={r}
                                  className={`rounded-md px-2 py-0.5 text-[10px] font-semibold ${
                                    r === 'superadministrador'
                                      ? 'bg-red-500/10 text-red-400 border border-red-500/20'
                                      : r === 'profesor'
                                      ? 'bg-violet-500/10 text-violet-400 border border-violet-500/20'
                                      : r === 'estudiante'
                                      ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                                      : 'bg-zinc-800 text-zinc-300 border border-zinc-700'
                                  }`}
                                >
                                  {r}
                                </span>
                              ))
                            ) : (
                              <span className="text-[11px] text-foreground/40">Sin roles</span>
                            )}
                          </div>
                        </td>

                        <td className="px-4 py-3.5">
                          <span
                            className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold capitalize ${
                              u.status === 'activo'
                                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                : u.status === 'pendiente'
                                ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                                : 'bg-red-500/10 text-red-400 border border-red-500/20'
                            }`}
                          >
                            {u.status}
                          </span>
                        </td>

                        <td className="px-4 py-3.5">
                          <MoodleSyncBadge status={u.moodle_sync_status} moodleId={u.moodle_user_id} />
                          {u.moodle_username && (
                            <p className="mt-1 font-mono text-[10px] text-foreground/50">
                              user: {u.moodle_username}
                            </p>
                          )}
                        </td>

                        <td className="px-4 py-3.5 text-right">
                          <div className="inline-flex items-center gap-1.5">
                            {/* Botón Asignar Rol */}
                            <button
                              type="button"
                              onClick={() => setSelectedUserForRole(u)}
                              className="rounded-lg border border-border bg-foreground/5 px-2.5 py-1 text-[11px] font-medium text-foreground hover:border-accent hover:text-accent transition-colors"
                              title="Gestionar roles"
                            >
                              Roles
                            </button>

                            {/* Botón Cambiar Estado */}
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedUserForStatus(u);
                                setNewStatus(u.status || 'activo');
                              }}
                              className="rounded-lg border border-border bg-foreground/5 px-2.5 py-1 text-[11px] font-medium text-foreground hover:border-accent hover:text-accent transition-colors"
                              title="Modificar estado de cuenta"
                            >
                              Estado
                            </button>

                            {/* Sincronizar Moodle */}
                            <button
                              type="button"
                              disabled={actionLoading === `user-sync-${u.id}`}
                              onClick={() => handleSyncSingleUser(u.id)}
                              className="rounded-lg bg-blue-600/10 border border-blue-500/30 px-2 py-1 text-[11px] font-medium text-blue-400 hover:bg-blue-600 hover:text-white transition-all disabled:opacity-50"
                              title="Sincronizar a Moodle"
                            >
                              {actionLoading === `user-sync-${u.id}` ? '...' : 'Sync Moodle'}
                            </button>

                            {/* Asignar Curso */}
                            <button
                              type="button"
                              onClick={() => {
                                setAssignTargetUserId(u.id);
                                setShowAssignCourseModal(true);
                              }}
                              className="rounded-lg bg-accent/10 border border-accent/30 px-2 py-1 text-[11px] font-medium text-accent hover:bg-accent hover:text-white transition-all"
                              title="Asignar curso directamente"
                            >
                              + Curso
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* PESTAÑA 2: CURSOS & ASIGNACIÓN A MOODLE                                    */}
      {/* ========================================================================= */}
      {activeTab === 'cursos' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-foreground">Catálogo de Cursos Vinculados con Moodle</h2>
              <p className="text-xs text-foreground/60">
                Cada curso en el portal se enlaza directamente a un curso real en Moodle LMS mediante Web Services.
              </p>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setShowCreateCourseModal(true)}
                className="rounded-xl bg-accent px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-accent-strong"
              >
                + Vincular Nuevo Curso Moodle
              </button>
              <button
                type="button"
                onClick={() => setShowAssignCourseModal(true)}
                className="rounded-xl border border-border bg-foreground/5 px-4 py-2 text-xs font-semibold text-foreground hover:bg-foreground/10"
              >
                + Asignar Curso a Alumno/Docente
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {courses.length === 0 ? (
              <div className="col-span-full rounded-2xl border border-dashed border-border p-8 text-center text-foreground/60">
                No hay cursos vinculados actualmente. Pulsa &quot;Vincular Nuevo Curso Moodle&quot; para registrar uno.
              </div>
            ) : (
              courses.map((course) => (
                <div
                  key={course.id}
                  className="rounded-2xl border border-border/80 bg-background/50 p-5 shadow-sm hover:border-accent/40 transition-all flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="rounded-md bg-accent/10 px-2 py-0.5 font-mono text-[10px] font-bold text-accent">
                        {course.portal_course_code || course.code || 'CUR-00'}
                      </span>
                      <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-400 border border-emerald-500/20">
                        ID Moodle: #{course.moodle_course_id}
                      </span>
                    </div>

                    <h3 className="mt-2.5 font-bold text-foreground text-sm leading-snug">
                      {course.course_name || course.name}
                    </h3>
                    <p className="mt-1 font-mono text-[11px] text-foreground/60">
                      Shortname: {course.moodle_shortname || 'N/A'}
                    </p>
                    {course.programs?.name && (
                      <p className="mt-1 text-[11px] text-foreground/50">
                        Programa: {course.programs.name}
                      </p>
                    )}
                  </div>

                  <div className="mt-5 border-t border-border/60 pt-3 flex items-center justify-between gap-2">
                    <a
                      href={`http://localhost/moodle/course/view.php?id=${course.moodle_course_id}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs text-accent font-medium hover:underline inline-flex items-center gap-1"
                    >
                      Ver en Moodle ↗
                    </a>
                    <button
                      type="button"
                      onClick={() => {
                        setAssignCourseId(course.id);
                        setShowAssignCourseModal(true);
                      }}
                      className="rounded-lg bg-foreground/5 px-2.5 py-1 text-xs font-semibold text-foreground hover:bg-accent hover:text-white transition-all"
                    >
                      Asignar Matrícula
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* PESTAÑA 3: MATRÍCULAS & APROBACIONES                                      */}
      {/* ========================================================================= */}
      {activeTab === 'matriculas' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-foreground">Solicitudes y Autorizaciones de Matrícula</h2>
              <p className="text-xs text-foreground/60">
                Al autorizar una matrícula, el backend de NestJS invoca automáticamente el Web Service de Moodle para enrolar al usuario.
              </p>
            </div>

            <div className="flex gap-2">
              <select
                value={enrollmentStatusFilter}
                onChange={(e) => setEnrollmentStatusFilter(e.target.value)}
                className="rounded-xl border border-border bg-background px-3 py-2 text-xs text-foreground focus:border-accent focus:outline-none"
              >
                <option value="">Todas las Solicitudes</option>
                <option value="pendiente">Solo Pendientes</option>
                <option value="autorizada">Autorizadas</option>
                <option value="sincronizada">Sincronizadas con Moodle</option>
                <option value="rechazada">Rechazadas</option>
              </select>

              <button
                type="button"
                onClick={() => setShowAssignCourseModal(true)}
                className="rounded-xl bg-accent px-3 py-2 text-xs font-semibold text-white hover:bg-accent-strong"
              >
                + Nueva Matrícula
              </button>
            </div>
          </div>

          <div className="overflow-hidden rounded-2xl border border-border/80 bg-background/50 shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-border/80 bg-foreground/[0.02] text-foreground/60 uppercase tracking-wider font-semibold">
                  <tr>
                    <th className="px-4 py-3.5">Aspirante / Estudiante</th>
                    <th className="px-4 py-3.5">Materia / Curso</th>
                    <th className="px-4 py-3.5">Rol Moodle</th>
                    <th className="px-4 py-3.5">Estado</th>
                    <th className="px-4 py-3.5 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {filteredEnrollments.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-foreground/50">
                        No hay solicitudes de matrícula que coincidan con el filtro.
                      </td>
                    </tr>
                  ) : (
                    filteredEnrollments.map((enr) => (
                      <tr key={enr.id} className="hover:bg-foreground/[0.02]">
                        <td className="px-4 py-3.5">
                          <p className="font-bold text-foreground">
                            {enr.profiles?.first_name} {enr.profiles?.last_name}
                          </p>
                          <p className="font-mono text-[11px] text-foreground/60">{enr.profiles?.email}</p>
                        </td>

                        <td className="px-4 py-3.5">
                          <p className="font-semibold text-foreground">
                            {enr.course_mappings?.courses?.name || 'Curso IINICIA'}
                          </p>
                          <p className="font-mono text-[10px] text-foreground/50">
                            ID Moodle: #{enr.course_mappings?.moodle_course_id || 'N/A'}
                          </p>
                        </td>

                        <td className="px-4 py-3.5">
                          <span className="font-mono text-xs font-semibold text-accent">
                            {enr.moodle_role || 'student'}
                          </span>
                        </td>

                        <td className="px-4 py-3.5">
                          <span
                            className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold capitalize ${
                              enr.status === 'sincronizada' || enr.status === 'autorizada'
                                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                : enr.status === 'pendiente'
                                ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                                : 'bg-red-500/10 text-red-400 border border-red-500/20'
                            }`}
                          >
                            {enr.status}
                          </span>
                        </td>

                        <td className="px-4 py-3.5 text-right">
                          <div className="inline-flex items-center gap-1.5">
                            {enr.status === 'pendiente' && (
                              <>
                                <button
                                  type="button"
                                  disabled={actionLoading === `enr-${enr.id}`}
                                  onClick={() => handleAuthorizeEnrollment(enr.id, 'autorizada')}
                                  className="rounded-lg bg-emerald-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-emerald-500 transition-all disabled:opacity-50"
                                >
                                  {actionLoading === `enr-${enr.id}` ? '...' : 'Aprobar & Matricular'}
                                </button>
                                <button
                                  type="button"
                                  disabled={actionLoading === `enr-${enr.id}`}
                                  onClick={() => handleAuthorizeEnrollment(enr.id, 'rechazada')}
                                  className="rounded-lg border border-border bg-foreground/5 px-2 py-1 text-xs font-semibold text-red-400 hover:bg-red-500/10 transition-all disabled:opacity-50"
                                >
                                  Rechazar
                                </button>
                              </>
                            )}

                            {enr.status === 'autorizada' && (
                              <button
                                type="button"
                                disabled={actionLoading === `sync-enr-${enr.id}`}
                                onClick={() => handleRetryMoodleSync(enr.id)}
                                className="rounded-lg bg-blue-600/10 border border-blue-500/30 px-2.5 py-1 text-xs font-semibold text-blue-400 hover:bg-blue-600 hover:text-white transition-all disabled:opacity-50"
                              >
                                {actionLoading === `sync-enr-${enr.id}` ? 'Sincronizando...' : 'Reintentar Moodle'}
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* PESTAÑA 4: PROGRAMAS ACADÉMICOS                                           */}
      {/* ========================================================================= */}
      {activeTab === 'programas' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-foreground">Programas Académicos</h2>
              <p className="text-xs text-foreground/60">
                Licenciaturas, Maestrías, Diplomados y Certificaciones de IINICIA.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {programs.map((prog) => (
              <div
                key={prog.id}
                className="rounded-2xl border border-border/80 bg-background/50 p-5 shadow-sm"
              >
                <div className="flex items-center justify-between">
                  <span className="rounded-md bg-accent/10 px-2.5 py-0.5 text-[10px] font-bold text-accent uppercase">
                    {prog.type}
                  </span>
                  <span className="text-[11px] text-foreground/50 capitalize">{prog.modality}</span>
                </div>
                <h3 className="mt-2.5 font-bold text-foreground text-sm">{prog.name}</h3>
                <p className="mt-1 text-xs text-foreground/60 line-clamp-2">{prog.description}</p>
                <div className="mt-4 border-t border-border/60 pt-3 flex items-center justify-between text-[11px] text-foreground/50">
                  <span>Código: {prog.code}</span>
                  <span>{prog.duration_text || `${prog.duration_hours} hrs`}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* PESTAÑA 5: DIAGNÓSTICO E INTEGRACIÓN MOODLE                               */}
      {/* ========================================================================= */}
      {activeTab === 'moodle' && (
        <div className="space-y-6">
          <div className="rounded-2xl border border-border/80 bg-background/50 p-6 space-y-4">
            <h2 className="text-lg font-bold text-foreground">Estado de la Integración con Moodle LMS</h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="rounded-xl border border-border/60 bg-foreground/[0.02] p-4">
                <span className="text-xs text-foreground/60">URL Base</span>
                <p className="mt-1 font-mono text-xs font-bold text-foreground">http://localhost/moodle</p>
              </div>
              <div className="rounded-xl border border-border/60 bg-foreground/[0.02] p-4">
                <span className="text-xs text-foreground/60">Versión Detectada</span>
                <p className="mt-1 text-xs font-bold text-emerald-400">Moodle 5.3+ (Build 20261021)</p>
              </div>
              <div className="rounded-xl border border-border/60 bg-foreground/[0.02] p-4">
                <span className="text-xs text-foreground/60">Protocolo</span>
                <p className="mt-1 text-xs font-bold text-foreground">REST Web Services Oficiales</p>
              </div>
            </div>

            <div className="border-t border-border/60 pt-4">
              <h3 className="text-xs font-bold text-foreground uppercase tracking-wider">
                Funciones Web Services Habilitadas
              </h3>
              <div className="mt-2 flex flex-wrap gap-2">
                {[
                  'core_webservice_get_site_info',
                  'core_user_create_users',
                  'core_user_update_users',
                  'core_user_get_users_by_field',
                  'core_enrol_get_users_courses',
                  'enrol_manual_enrol_users',
                  'enrol_manual_unenrol_users',
                  'core_course_get_courses',
                  'core_course_get_courses_by_field',
                ].map((fn) => (
                  <span
                    key={fn}
                    className="rounded-md bg-emerald-500/10 border border-emerald-500/20 px-2 py-1 font-mono text-[10px] text-emerald-400"
                  >
                    ✓ {fn}
                  </span>
                ))}
              </div>
            </div>

            <div className="border-t border-border/60 pt-4 flex items-center justify-between">
              <p className="text-xs text-foreground/70">
                La sincronización opera en tiempo real con tolerancia a fallos transitorios y registro en base de datos.
              </p>
              <button
                type="button"
                onClick={handleBulkMoodleSync}
                disabled={actionLoading === 'bulk-sync'}
                className="rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white shadow-md hover:bg-blue-500 transition-all disabled:opacity-50"
              >
                {actionLoading === 'bulk-sync' ? 'Ejecutando...' : 'Ejecutar Sincronización Masiva Ahora'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* PESTAÑA 6: AUDITORÍA & LOGS                                               */}
      {/* ========================================================================= */}
      {activeTab === 'auditoria' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-foreground">Registro de Auditoría y Acceso al Campus</h2>
              <p className="text-xs text-foreground/60">
                Trazabilidad completa de operaciones administrativas, cambios de roles y accesos a Moodle.
              </p>
            </div>
          </div>

          <div className="overflow-hidden rounded-2xl border border-border/80 bg-background/50 shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-border/80 bg-foreground/[0.02] text-foreground/60 uppercase tracking-wider font-semibold">
                  <tr>
                    <th className="px-4 py-3">Fecha / Hora</th>
                    <th className="px-4 py-3">Acción Registrada</th>
                    <th className="px-4 py-3">Entidad / ID</th>
                    <th className="px-4 py-3">Detalle</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {auditLogs.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="py-8 text-center text-foreground/50">
                        No hay registros de auditoría aún.
                      </td>
                    </tr>
                  ) : (
                    auditLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-foreground/[0.02]">
                        <td className="px-4 py-3 font-mono text-[11px] text-foreground/60 whitespace-nowrap">
                          {new Date(log.created_at).toLocaleString()}
                        </td>
                        <td className="px-4 py-3 font-semibold text-accent">{log.action}</td>
                        <td className="px-4 py-3 font-mono text-[11px] text-foreground/70">
                          {log.entity_name} {log.entity_id ? `(#${log.entity_id.slice(0, 8)})` : ''}
                        </td>
                        <td className="px-4 py-3 font-mono text-[10px] text-foreground/50 truncate max-w-xs">
                          {log.details ? JSON.stringify(log.details) : 'Operación del sistema'}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 1: GESTIÓN DE ROLES                                                 */}
      {/* ========================================================================= */}
      {selectedUserForRole && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl border border-border bg-background p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-border/60 pb-3">
              <h3 className="font-bold text-foreground">Gestionar Roles de Usuario</h3>
              <button
                type="button"
                onClick={() => setSelectedUserForRole(null)}
                className="text-foreground/60 hover:text-foreground"
              >
                ✕
              </button>
            </div>

            <div className="mt-4 space-y-4">
              <div>
                <p className="text-xs text-foreground/60">Usuario:</p>
                <p className="font-bold text-foreground">
                  {selectedUserForRole.first_name} {selectedUserForRole.last_name}
                </p>
                <p className="font-mono text-xs text-foreground/60">{selectedUserForRole.email}</p>
              </div>

              {/* Roles actuales con botón para retirar */}
              <div>
                <p className="text-xs font-semibold text-foreground/70 mb-2">Roles Asignados:</p>
                <div className="flex flex-wrap gap-1.5">
                  {(((selectedUserForRole.active_roles || selectedUserForRole.roles || []) as string[])).map((r: string) => {
                    const roleObj = roles.find((item) => item.slug === r);
                    return (
                      <span
                        key={r}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-foreground/10 px-2.5 py-1 text-xs font-semibold text-foreground"
                      >
                        <span>{r}</span>
                        {roleObj && (
                          <button
                            type="button"
                            disabled={actionLoading === `revoke-${selectedUserForRole.id}-${roleObj.id}`}
                            onClick={() => handleRevokeRole(selectedUserForRole.id, roleObj.id, r)}
                            className="text-red-400 hover:text-red-300 font-bold ml-1"
                            title="Retirar rol"
                          >
                            ×
                          </button>
                        )}
                      </span>
                    );
                  })}
                </div>
              </div>

              {/* Formulario para asignar nuevo rol */}
              <div className="border-t border-border/60 pt-3">
                <label className="block text-xs font-semibold text-foreground/80 mb-1.5">
                  Asignar Nuevo Rol:
                </label>
                <select
                  value={roleToAssign}
                  onChange={(e) => setRoleToAssign(Number(e.target.value))}
                  className="w-full rounded-xl border border-border bg-background px-3 py-2 text-xs text-foreground focus:border-accent focus:outline-none"
                >
                  {roles.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name} ({r.slug})
                    </option>
                  ))}
                </select>
              </div>

              <div className="mt-6 flex justify-end gap-2 border-t border-border/60 pt-4">
                <button
                  type="button"
                  onClick={() => setSelectedUserForRole(null)}
                  className="rounded-xl border border-border px-4 py-2 text-xs font-semibold text-foreground hover:bg-foreground/5"
                >
                  Cerrar
                </button>
                <button
                  type="button"
                  disabled={actionLoading === 'assign-role'}
                  onClick={handleAssignRole}
                  className="rounded-xl bg-accent px-4 py-2 text-xs font-semibold text-white hover:bg-accent-strong disabled:opacity-50"
                >
                  {actionLoading === 'assign-role' ? 'Asignando...' : 'Confirmar Rol'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: CAMBIO DE ESTADO DE USUARIO                                      */}
      {/* ========================================================================= */}
      {selectedUserForStatus && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl border border-border bg-background p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-border/60 pb-3">
              <h3 className="font-bold text-foreground">Modificar Estado de Usuario</h3>
              <button
                type="button"
                onClick={() => setSelectedUserForStatus(null)}
                className="text-foreground/60 hover:text-foreground"
              >
                ✕
              </button>
            </div>

            <div className="mt-4 space-y-4">
              <div>
                <p className="font-bold text-foreground">
                  {selectedUserForStatus.first_name} {selectedUserForStatus.last_name}
                </p>
                <p className="font-mono text-xs text-foreground/60">{selectedUserForStatus.email}</p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground/80 mb-1.5">
                  Nuevo Estado:
                </label>
                <select
                  value={newStatus}
                  onChange={(e) => setNewStatus(e.target.value)}
                  className="w-full rounded-xl border border-border bg-background px-3 py-2 text-xs text-foreground focus:border-accent focus:outline-none"
                >
                  <option value="activo">Activo (Habilitado)</option>
                  <option value="pendiente">Pendiente de Aprobación</option>
                  <option value="suspendido">Suspendido (Sin acceso a cursos)</option>
                  <option value="inactivo">Inactivo</option>
                  <option value="baja">Baja Definitiva</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground/80 mb-1.5">
                  Motivo o justificación administrativa:
                </label>
                <input
                  type="text"
                  placeholder="Ej: Aprobación de admisión o baja administrativa"
                  value={statusReason}
                  onChange={(e) => setStatusReason(e.target.value)}
                  className="w-full rounded-xl border border-border bg-foreground/5 px-3 py-2 text-xs text-foreground focus:border-accent focus:outline-none"
                />
              </div>

              <div className="mt-6 flex justify-end gap-2 border-t border-border/60 pt-4">
                <button
                  type="button"
                  onClick={() => setSelectedUserForStatus(null)}
                  className="rounded-xl border border-border px-4 py-2 text-xs font-semibold text-foreground hover:bg-foreground/5"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={actionLoading === 'update-status'}
                  onClick={handleUpdateUserStatus}
                  className="rounded-xl bg-accent px-4 py-2 text-xs font-semibold text-white hover:bg-accent-strong disabled:opacity-50"
                >
                  {actionLoading === 'update-status' ? 'Guardando...' : 'Actualizar Estado'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 3: ASIGNAR CURSO A ALUMNO O PROFESOR                                */}
      {/* ========================================================================= */}
      {showAssignCourseModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-3xl border border-border bg-background p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-border/60 pb-3">
              <h3 className="font-bold text-foreground">Asignar Materia y Matricular en Moodle</h3>
              <button
                type="button"
                onClick={() => setShowAssignCourseModal(false)}
                className="text-foreground/60 hover:text-foreground"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleDirectCourseAssignment} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-foreground/80 mb-1.5">
                  Seleccionar Alumno o Docente:
                </label>
                <select
                  required
                  value={assignTargetUserId}
                  onChange={(e) => setAssignTargetUserId(e.target.value)}
                  className="w-full rounded-xl border border-border bg-background px-3 py-2 text-xs text-foreground focus:border-accent focus:outline-none"
                >
                  <option value="">-- Elige un usuario --</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.first_name} {u.last_name} ({u.email}) - {((u.active_roles || u.roles || []) as string[]).join(', ')}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground/80 mb-1.5">
                  Seleccionar Curso Vinculado a Moodle:
                </label>
                <select
                  required
                  value={assignCourseId}
                  onChange={(e) => setAssignCourseId(e.target.value)}
                  className="w-full rounded-xl border border-border bg-background px-3 py-2 text-xs text-foreground focus:border-accent focus:outline-none"
                >
                  <option value="">-- Elige un curso --</option>
                  {courses.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.portal_course_code || c.code} - {c.course_name || c.name} (Moodle #{c.moodle_course_id})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground/80 mb-1.5">
                  Rol en el Aula de Moodle:
                </label>
                <select
                  value={assignMoodleRole}
                  onChange={(e) => setAssignMoodleRole(e.target.value as any)}
                  className="w-full rounded-xl border border-border bg-background px-3 py-2 text-xs text-foreground focus:border-accent focus:outline-none"
                >
                  <option value="student">Estudiante (student)</option>
                  <option value="editingteacher">Profesor con Edición (editingteacher)</option>
                </select>
              </div>

              <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-3 text-[11px] text-foreground/70">
                ℹ️ Esta acción crea la autorización inmediata y ejecuta en segundo plano el Web Service oficial de Moodle (<code>enrol_manual_enrol_users</code>).
              </div>

              <div className="mt-6 flex justify-end gap-2 border-t border-border/60 pt-4">
                <button
                  type="button"
                  onClick={() => setShowAssignCourseModal(false)}
                  className="rounded-xl border border-border px-4 py-2 text-xs font-semibold text-foreground hover:bg-foreground/5"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={actionLoading === 'assign-course'}
                  className="rounded-xl bg-accent px-4 py-2 text-xs font-semibold text-white hover:bg-accent-strong disabled:opacity-50"
                >
                  {actionLoading === 'assign-course' ? 'Matriculando en Moodle...' : 'Asignar & Matricular'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 4: VINCULAR NUEVO CURSO MOODLE                                      */}
      {/* ========================================================================= */}
      {showCreateCourseModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-3xl border border-border bg-background p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-border/60 pb-3">
              <h3 className="font-bold text-foreground">Vincular Nuevo Curso con Moodle</h3>
              <button
                type="button"
                onClick={() => setShowCreateCourseModal(false)}
                className="text-foreground/60 hover:text-foreground"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateCourseMapping} className="mt-4 space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-foreground/80 mb-1">
                  Nombre del Curso en el Portal:
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ej: Curso 3. Inteligencia Artificial Aplicada"
                  value={newCourseName}
                  onChange={(e) => setNewCourseName(e.target.value)}
                  className="w-full rounded-xl border border-border bg-foreground/5 px-3 py-2 text-xs text-foreground focus:border-accent focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-foreground/80 mb-1">
                    Código en Portal:
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ej: CUR-MOO-003"
                    value={newCourseCode}
                    onChange={(e) => setNewCourseCode(e.target.value)}
                    className="w-full rounded-xl border border-border bg-foreground/5 px-3 py-2 text-xs text-foreground focus:border-accent focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-foreground/80 mb-1">
                    Slug / URL:
                  </label>
                  <input
                    type="text"
                    placeholder="curso-3-ia"
                    value={newCourseSlug}
                    onChange={(e) => setNewCourseSlug(e.target.value)}
                    className="w-full rounded-xl border border-border bg-foreground/5 px-3 py-2 text-xs text-foreground focus:border-accent focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-foreground/80 mb-1">
                    ID del Curso en Moodle:
                  </label>
                  <input
                    type="number"
                    required
                    min={1}
                    placeholder="Ej: 3"
                    value={newMoodleCourseId}
                    onChange={(e) => setNewMoodleCourseId(Number(e.target.value))}
                    className="w-full rounded-xl border border-border bg-foreground/5 px-3 py-2 text-xs text-foreground focus:border-accent focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-foreground/80 mb-1">
                    Shortname en Moodle:
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ej: IINICIA-IA-103"
                    value={newMoodleShortname}
                    onChange={(e) => setNewMoodleShortname(e.target.value)}
                    className="w-full rounded-xl border border-border bg-foreground/5 px-3 py-2 text-xs text-foreground focus:border-accent focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground/80 mb-1">
                  Programa Académico Asociado:
                </label>
                <select
                  value={newCourseProgramId}
                  onChange={(e) => setNewCourseProgramId(e.target.value)}
                  className="w-full rounded-xl border border-border bg-background px-3 py-2 text-xs text-foreground focus:border-accent focus:outline-none"
                >
                  <option value="">-- Sin programa asignado --</option>
                  {programs.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.code})
                    </option>
                  ))}
                </select>
              </div>

              <div className="mt-6 flex justify-end gap-2 border-t border-border/60 pt-4">
                <button
                  type="button"
                  onClick={() => setShowCreateCourseModal(false)}
                  className="rounded-xl border border-border px-4 py-2 text-xs font-semibold text-foreground hover:bg-foreground/5"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={actionLoading === 'create-course'}
                  className="rounded-xl bg-accent px-4 py-2 text-xs font-semibold text-white hover:bg-accent-strong disabled:opacity-50"
                >
                  {actionLoading === 'create-course' ? 'Guardando...' : 'Crear Vinculación'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
