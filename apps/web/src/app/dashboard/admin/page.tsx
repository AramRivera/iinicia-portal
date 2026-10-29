'use client';

import React, { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import {
  auditApi,
  admissionsApi,
  authApi,
  coursesApi,
  enrollmentsApi,
  moodleApi,
  programsApi,
  rolesApi,
  usersApi,
} from '@/lib/api';
import type {
  AuditLog,
  AdmissionApplication,
  CourseOffering,
  EnrollmentRequest,
  MoodleStatusResponse,
  Program,
  RoleItem,
  RoleSlug,
  UserProfile,
} from '@/types';
import { MoodleSyncBadge } from '@/components/moodle/MoodleSyncBadge';
import { CampusShell } from '@/components/campus-tech/CampusShell';
import {
  closeMoodleLaunchWindow,
  navigateMoodleLaunchWindow,
  openMoodleLaunchWindow,
} from '@/lib/moodle-window';
import {
  IconPlus,
  IconRefresh,
  IconExternalLink,
  IconCheck,
  IconAlertTriangle,
  IconSearch,
  IconFilter,
  IconStudents,
  IconTeachers,
  IconGroups,
  IconAttendance,
  IconGrades,
  IconAudit,
  IconSettings,
  IconClose,
} from '@/components/campus-tech/Icons';

type AdminTab =
  | 'asignaciones'
  | 'usuarios'
  | 'docentes'
  | 'cursos'
  | 'matriculas'
  | 'admisiones'
  | 'programas'
  | 'moodle'
  | 'auditoria'
  | 'configuracion';

export default function AdminDashboardPage() {
  const router = useRouter();
  const { user, loading: authLoading, hasRole } = useAuth();

  // Estados de pestañas y carga
  const [activeTab, setActiveTab] = useState<AdminTab>('asignaciones');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
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
  const [applications, setApplications] = useState<AdmissionApplication[]>([]);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);

  // Filtros de asignaciones
  const [assignSearch, setAssignSearch] = useState('');
  const [assignRoleFilter, setAssignRoleFilter] = useState('');
  const [assignCourseFilter, setAssignCourseFilter] = useState('');
  const [assignUserModalSearch, setAssignUserModalSearch] = useState('');

  // Filtros de usuarios
  const [userSearch, setUserSearch] = useState('');
  const [userRoleFilter, setUserRoleFilter] = useState('');
  const [userStatusFilter, setUserStatusFilter] = useState('');

  // Filtros de matrículas
  const [enrollmentStatusFilter, setEnrollmentStatusFilter] = useState('');

  // Modales existentes
  const [selectedUserForRole, setSelectedUserForRole] = useState<UserProfile | null>(null);
  const [roleToAssign, setRoleToAssign] = useState<number>(5);

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

  // Nuevos Modales: Crear Usuario y Crear Programa
  const [showCreateUserModal, setShowCreateUserModal] = useState(false);
  const [newFirstName, setNewFirstName] = useState('');
  const [newLastName, setNewLastName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newInitialRole, setNewInitialRole] = useState<number>(5); // Estudiante

  const [showCreateProgramModal, setShowCreateProgramModal] = useState(false);
  const [newProgName, setNewProgName] = useState('');
  const [newProgCode, setNewProgCode] = useState('');
  const [newProgSlug, setNewProgSlug] = useState('');
  const [newProgType, setNewProgType] = useState<any>('licenciatura');
  const [newProgModality, setNewProgModality] = useState<any>('en_linea');
  const [newProgDuration, setNewProgDuration] = useState('3 años');
  const [newProgHours, setNewProgHours] = useState<number>(1800);
  const [newProgDesc, setNewProgDesc] = useState('');

  const isAdminOrCoordinator =
    hasRole('superadministrador') || hasRole('administrador');

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      const [statusRes, usersRes, rolesRes, coursesRes, enrollRes, progRes, auditRes, admissionsRes] =
        await Promise.all([
          moodleApi.getStatus().catch(() => ({ ok: false, message: 'No disponible' })),
          usersApi.getUsers({ limit: 50 }).catch(() => ({ data: [], meta: {} })),
          rolesApi.getRoles().catch(() => []),
          coursesApi.getOfferings().catch(() => []),
          enrollmentsApi.getAllEnrollments().catch(() => []),
          programsApi.getPrograms().catch(() => []),
          auditApi.getLogs({ limit: 30 }).catch(() => []),
          admissionsApi.getMyApplications().catch(() => []),
        ]);

      setMoodleStatus(statusRes);
      setUsers(Array.isArray(usersRes?.data) ? usersRes.data : Array.isArray(usersRes) ? usersRes : []);
      setRoles(Array.isArray(rolesRes) ? rolesRes : (rolesRes as any)?.data || []);
      setCourses(Array.isArray(coursesRes) ? coursesRes : (coursesRes as any)?.data || []);
      const enrollList = Array.isArray(enrollRes) ? enrollRes : ((enrollRes as any)?.data || []);
      setEnrollments(enrollList);
      setApplications(admissionsRes);
      setPrograms(Array.isArray(progRes) ? progRes : (progRes as any)?.data || []);
      const auditList = Array.isArray(auditRes)
        ? auditRes
        : Array.isArray((auditRes as any)?.data)
        ? (auditRes as any).data
        : [];
      setAuditLogs(auditList);
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
      router.push('/dashboard');
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

      const userRoles = ((u.active_roles || u.roles || []) as string[]).map((r) => r.toLowerCase());
      const matchesRole =
        userRoleFilter === '' ||
        (userRoleFilter === 'profesor'
          ? userRoles.some((r) => ['profesor', 'teacher', 'docente', 'editingteacher'].includes(r))
          : userRoleFilter === 'estudiante'
          ? userRoles.some((r) => ['estudiante', 'student'].includes(r))
          : userRoles.includes(userRoleFilter.toLowerCase()));

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

  const handleReviewApplication = async (applicationId: string, status: 'en_revision' | 'admitido' | 'rechazado') => {
    setActionLoading(`admission-${applicationId}`);
    setError(null);
    setNotice(null);
    try {
      await admissionsApi.reviewApplication(applicationId, status);
      setApplications(await admissionsApi.getMyApplications());
      setNotice('El dictamen de admisión se guardó correctamente.');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'No fue posible actualizar la postulación.');
    } finally {
      setActionLoading(null);
    }
  };

  // Acciones: Roles
  const handleAssignRole = async () => {
    if (!selectedUserForRole) return;
    setActionLoading('assign-role');
    setNotice(null);
    setError(null);

    try {
      await rolesApi.assignRole(selectedUserForRole.id, Number(roleToAssign));
      setNotice(`Rol asignado con éxito a ${selectedUserForRole.email}.`);
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
      setNotice(`Rol "${roleName}" retirado exitosamente.`);
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
      setNotice(`Estado de ${selectedUserForStatus.email} actualizado a "${newStatus}".`);
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
          ? 'Matrícula autorizada y sincronizada con Moodle LMS.'
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
          ? 'Sincronización con Moodle ejecutada exitosamente.'
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
      setNotice('Curso asignado y matriculado en Moodle LMS exitosamente.');
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

  // Acciones: Desasignar curso de usuario
  const handleDeleteEnrollment = async (enrollmentId: string, studentName: string, courseName: string) => {
    if (!window.confirm(`¿Estás seguro de que deseas desasignar a ${studentName} del curso "${courseName}"? Esta acción revocará su matrícula en Moodle LMS.`)) {
      return;
    }

    setActionLoading(`delete-enr-${enrollmentId}`);
    setNotice(null);
    setError(null);

    try {
      await enrollmentsApi.deleteEnrollment(enrollmentId);
      setNotice(`Matrícula desasignada exitosamente para ${studentName}.`);
      await loadData();
    } catch (err: any) {
      setError(err.message || 'Error al desasignar matrícula.');
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

      setNotice(`Curso "${newCourseName}" vinculado exitosamente con Moodle (ID #${newMoodleCourseId}).`);
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

  // Acciones: Crear Usuario Administrativo
  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmail || !newPassword || !newFirstName || !newLastName) {
      setError('Completa todos los campos obligatorios del nuevo usuario.');
      return;
    }

    setActionLoading('create-user');
    setNotice(null);
    setError(null);

    try {
      await usersApi.createUser({
        email: newEmail.trim(),
        password: newPassword,
        first_name: newFirstName.trim(),
        last_name: newLastName.trim(),
        phone: newPhone.trim() || undefined,
        role_id: Number(newInitialRole),
      });

      setNotice(`Usuario "${newEmail}" creado exitosamente con su rol asignado.`);
      setShowCreateUserModal(false);
      setNewFirstName('');
      setNewLastName('');
      setNewEmail('');
      setNewPassword('');
      setNewPhone('');
      await loadData();
    } catch (err: any) {
      setError(err.message || 'Error al crear el nuevo usuario.');
    } finally {
      setActionLoading(null);
    }
  };

  // Acciones: Crear Programa Académico
  const handleCreateProgram = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProgName || !newProgCode) {
      setError('Completa el código y nombre del programa.');
      return;
    }

    setActionLoading('create-program');
    setNotice(null);
    setError(null);

    try {
      await programsApi.createProgram({
        code: newProgCode.trim().toUpperCase(),
        name: newProgName.trim(),
        slug: newProgSlug.trim() || newProgCode.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-'),
        type: newProgType,
        modality: newProgModality,
        duration_text: newProgDuration.trim() || '120 horas',
        duration_hours: Number(newProgHours) || 120,
        description: newProgDesc.trim() || undefined,
        is_active: true,
      });

      setNotice(`Programa académico "${newProgName}" creado exitosamente.`);
      setShowCreateProgramModal(false);
      setNewProgCode('');
      setNewProgName('');
      setNewProgSlug('');
      setNewProgDesc('');
      await loadData();
    } catch (err: any) {
      setError(err.message || 'Error al registrar el programa.');
    } finally {
      setActionLoading(null);
    }
  };

  // Acciones: Sincronización y Acceso SSO a Moodle
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
      setNotice('Sesión iniciada con éxito en Moodle vía SSO (abierta en nueva pestaña).');
    } catch (err: any) {
      closeMoodleLaunchWindow(launchWindow);
      setError(err.message || 'Error al iniciar sesión SSO en Moodle.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleBulkMoodleSync = async () => {
    setActionLoading('bulk-sync');
    setNotice(null);
    setError(null);

    try {
      const res = await moodleApi.syncAllUsers();
      setNotice(
        `Sincronización masiva finalizada: ${res.synced} usuarios vinculados en Moodle LMS (${res.failed} errores).`,
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
      setNotice('Usuario sincronizado con éxito en Moodle LMS.');
      await loadData();
    } catch (err: any) {
      setError(err.message || 'Error al sincronizar usuario con Moodle.');
    } finally {
      setActionLoading(null);
    }
  };

  // Mapeo O(1) de usuario a matrículas/cursos
  const userEnrollmentsMap = useMemo(() => {
    const map: Record<string, EnrollmentRequest[]> = {};
    for (const enr of enrollments) {
      if (!map[enr.user_id]) map[enr.user_id] = [];
      map[enr.user_id].push(enr);
    }
    return map;
  }, [enrollments]);

  // Filtro de usuarios para la pestaña de Asignación de Cursos y Roles
  const filteredAssignmentUsers = useMemo(() => {
    return users.filter((u) => {
      const fullName = `${u.first_name || ''} ${u.last_name || ''}`.toLowerCase();
      const email = (u.email || '').toLowerCase();
      const username = (u.moodle_username || '').toLowerCase();
      const q = assignSearch.toLowerCase().trim();

      const matchesQuery = !q || fullName.includes(q) || email.includes(q) || username.includes(q);

      const userRoles = ((u.active_roles || u.roles || []) as string[]).map((r) => r.toLowerCase());
      const matchesRole =
        !assignRoleFilter ||
        (assignRoleFilter === 'profesor'
          ? userRoles.some((r) => ['profesor', 'teacher', 'docente', 'editingteacher'].includes(r))
          : assignRoleFilter === 'estudiante'
          ? userRoles.some((r) => ['estudiante', 'student'].includes(r))
          : userRoles.some((r) => r.includes(assignRoleFilter.toLowerCase())));

      const userEnrs = userEnrollmentsMap[u.id] || [];
      const matchesCourse =
        !assignCourseFilter ||
        (assignCourseFilter === 'con_cursos' && userEnrs.length > 0) ||
        (assignCourseFilter === 'sin_cursos' && userEnrs.length === 0);

      return matchesQuery && matchesRole && matchesCourse;
    });
  }, [users, assignSearch, assignRoleFilter, assignCourseFilter, userEnrollmentsMap]);

  // Búsqueda de usuarios dentro del modal interactivo
  const matchingModalUsers = useMemo(() => {
    if (!assignUserModalSearch.trim()) return users.slice(0, 8);
    const q = assignUserModalSearch.toLowerCase().trim();
    return users
      .filter((u) => {
        const fullName = `${u.first_name || ''} ${u.last_name || ''}`.toLowerCase();
        const email = (u.email || '').toLowerCase();
        return fullName.includes(q) || email.includes(q);
      })
      .slice(0, 10);
  }, [users, assignUserModalSearch]);

  const openAssignModalForUser = (targetUser: UserProfile) => {
    setAssignTargetUserId(targetUser.id);
    const defaultCourseId = courses[0]?.id || (courses[0] as any)?.course_mapping_id || '';
    setAssignCourseId(defaultCourseId);
    setAssignMoodleRole('student');
    setShowAssignCourseModal(true);
  };

  const openRolesModalForUser = (targetUser: UserProfile) => {
    setSelectedUserForRole(targetUser);
    setRoleToAssign(5);
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

  const getTabLabel = (tab: AdminTab) => {
    switch (tab) {
      case 'asignaciones':
        return 'Asignaciones & Cursos';
      case 'usuarios':
        return 'Directorio de Estudiantes';
      case 'docentes':
        return 'Cuerpo Docente';
      case 'cursos':
        return 'Grupos y Asignaturas';
      case 'matriculas':
        return 'Solicitudes y Matrículas';
      case 'programas':
        return 'Programas Académicos';
      case 'moodle':
        return 'Moodle LMS 5.3+';
      case 'auditoria':
        return 'Bitácora & Reportes';
      case 'configuracion':
        return 'Configuración OS';
      default:
        return 'Control Maestro';
    }
  };

  return (
    <>
      <CampusShell
      currentTab={activeTab}
      onSelectTab={(tabId) => setActiveTab(tabId as AdminTab)}
      breadcrumbs={['INICIA', 'Control Maestro', getTabLabel(activeTab)]}
      counts={{
        users: users.length,
        courses: courses.length,
        enrollments: enrollments.length,
        programs: programs.length,
        audit: Array.isArray(auditLogs) ? auditLogs.length : 0,
      }}
      onLaunchCampusSSO={handleLaunchCampusSSO}
    >
      <div className="space-y-6">
        {/* Header Principal de Control Maestro */}
        <div className="rounded-[10px] border border-border bg-surface p-5 sm:p-6 transition-all shadow-minimal">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-[4px] bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-mono font-medium text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Moodle LMS 5.3+ Activo (auth_userkey SSO)
                </span>
                <span className="rounded-[4px] bg-primary/10 px-2.5 py-0.5 text-[11px] font-mono font-semibold text-primary border border-primary/20">
                  Superadministrador
                </span>
              </div>
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
                Panel de Control Maestro
              </h1>
              <p className="text-xs sm:text-sm text-muted max-w-2xl leading-relaxed">
                Gestión unificada de estudiantes, docentes, materias, roles y salto automático sin contraseñas a Moodle LMS.
              </p>
            </div>

            {/* Acciones Rápidas */}
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleLaunchCampusSSO}
                disabled={actionLoading === 'launch-campus'}
                className="inline-flex items-center justify-center gap-1.5 rounded-[6px] bg-primary-action text-white font-medium px-3.5 py-2 text-xs shadow-minimal hover:bg-primary-action/90 active:scale-[0.98] transition-all disabled:opacity-50"
                title="Abrir Moodle como Administrador con sesión iniciada al instante"
              >
                {actionLoading === 'launch-campus' ? (
                  <>
                    <span className="h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    <span>Iniciando SSO...</span>
                  </>
                ) : (
                  <>
                    <IconExternalLink className="w-3.5 h-3.5 text-accent-lime" />
                    <span>Entrar al Campus (SSO)</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => setShowCreateUserModal(true)}
                className="inline-flex items-center justify-center gap-1.5 rounded-[6px] border border-border bg-surface hover:bg-surface-muted px-3 py-2 text-xs font-medium text-foreground transition-all shadow-minimal"
              >
                <IconPlus className="w-3.5 h-3.5 text-primary" />
                <span>Nuevo Usuario</span>
              </button>

              <button
                type="button"
                onClick={() => setShowAssignCourseModal(true)}
                className="inline-flex items-center justify-center gap-1.5 rounded-[6px] bg-primary-action text-white hover:bg-primary-action/90 px-3 py-2 text-xs font-semibold transition-all shadow-minimal"
              >
                <IconPlus className="w-3.5 h-3.5 text-accent-lime" />
                <span>Asignar Curso</span>
              </button>

              <button
                type="button"
                onClick={handleBulkMoodleSync}
                disabled={actionLoading === 'bulk-sync'}
                className="inline-flex items-center justify-center gap-1.5 rounded-[6px] border border-border bg-surface hover:bg-surface-muted px-3 py-2 text-xs font-medium text-muted hover:text-foreground transition-all shadow-minimal disabled:opacity-50"
              >
                {actionLoading === 'bulk-sync' ? (
                  <>
                    <span className="h-3 w-3 animate-spin rounded-full border-2 border-foreground border-t-transparent" />
                    <span>Sincronizando...</span>
                  </>
                ) : (
                  <>
                    <IconRefresh className="w-3.5 h-3.5" />
                    <span>Sync Moodle</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Operational Metrics Grid */}
          <div className="mt-5 grid grid-cols-2 gap-3 sm:gap-4 sm:grid-cols-4 border-t border-border pt-4">
            <div className="rounded-[8px] border border-border bg-surface-muted/30 p-3.5 hover:bg-surface-muted/60 transition-colors">
              <span className="text-[11px] font-mono uppercase tracking-wider text-muted">Usuarios Registrados</span>
              <p className="mt-1 text-2xl font-bold tracking-tight text-foreground">{users.length}</p>
              <span className="text-[11px] text-muted flex items-center gap-1 mt-1 font-normal">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                {users.filter((u) => u.moodle_sync_status === 'sincronizado').length} en Moodle LMS
              </span>
            </div>

            <div className="rounded-[8px] border border-border bg-surface-muted/30 p-3.5 hover:bg-surface-muted/60 transition-colors">
              <span className="text-[11px] font-mono uppercase tracking-wider text-muted">Cursos Vinculados</span>
              <p className="mt-1 text-2xl font-bold tracking-tight text-foreground">{courses.length}</p>
              <span className="text-[11px] text-muted flex items-center gap-1 mt-1 font-normal">
                <span className="h-1.5 w-1.5 rounded-full bg-primary-action" />
                Catálogo activo oficial
              </span>
            </div>

            <div className="rounded-[8px] border border-border bg-surface-muted/30 p-3.5 hover:bg-surface-muted/60 transition-colors">
              <span className="text-[11px] font-mono uppercase tracking-wider text-muted">Solicitudes Matrícula</span>
              <p className="mt-1 text-2xl font-bold tracking-tight text-foreground">{enrollments.length}</p>
              <span className="text-[11px] text-muted flex items-center gap-1 mt-1 font-normal">
                <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                {enrollments.filter((e) => e.status === 'pendiente').length} pendientes
              </span>
            </div>

            <div className="rounded-[8px] border border-border bg-surface-muted/30 p-3.5 hover:bg-surface-muted/60 transition-colors">
              <span className="text-[11px] font-mono uppercase tracking-wider text-muted">Campus Virtual</span>
              <p className="mt-1 text-sm font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                Conectado
              </p>
              <button
                type="button"
                onClick={handleLaunchCampusSSO}
                className="text-[11px] text-primary hover:underline inline-block mt-1 font-medium text-left"
              >
                Abrir campus con SSO ↗
              </button>
            </div>
          </div>
        </div>

        {/* Alertas Operativas */}
        {notice && (
          <div className="rounded-[8px] border border-emerald-500/25 bg-emerald-500/10 p-3.5 text-xs font-medium text-emerald-700 dark:text-emerald-400 flex items-center justify-between shadow-minimal">
            <div className="flex items-center gap-2">
              <IconCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span>{notice}</span>
            </div>
            <button type="button" onClick={() => setNotice(null)} className="text-xs opacity-70 hover:opacity-100"><IconClose className="w-3.5 h-3.5" /></button>
          </div>
        )}

        {error && (
          <div className="rounded-[8px] border border-rose-500/25 bg-rose-500/10 p-3.5 text-xs font-medium text-rose-700 dark:text-rose-400 flex items-center justify-between shadow-minimal">
            <div className="flex items-center gap-2">
              <IconAlertTriangle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
              <span>{error}</span>
            </div>
            <button type="button" onClick={() => setError(null)} className="text-xs opacity-70 hover:opacity-100"><IconClose className="w-3.5 h-3.5" /></button>
          </div>
        )}

      {/* ========================================================================= */}
      {/* PESTAÑA PRINCIPAL: ASIGNACIÓN DE CURSOS Y ROLES (FILTRADO AVANZADO)       */}
      {/* ========================================================================= */}
      {activeTab === 'asignaciones' && (
        <div className="space-y-4">
          {/* Header y Filtros Apple SaaS Style */}
          <div className="rounded-[24px] border border-border/60 bg-surface/75 backdrop-blur-xl p-5 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold tracking-tight text-foreground flex items-center gap-2">
                  <IconGroups className="w-5 h-5 text-primary" />
                  <span>Tabla Maestra de Asignación de Cursos y Roles</span>
                </h2>
                <p className="mt-0.5 text-xs text-muted">
                  Filtra usuarios instantáneamente por nombre o correo para asignar materias en Moodle LMS y gestionar roles.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setAssignTargetUserId('');
                    setAssignUserModalSearch('');
                    setAssignCourseId(courses[0]?.id || (courses[0] as any)?.course_mapping_id || '');
                    setShowAssignCourseModal(true);
                  }}
                  className="rounded-xl bg-accent px-4 py-2 text-xs font-medium text-white shadow-xs hover:bg-accent-strong active:scale-[0.98] transition-all flex items-center gap-1.5"
                >
                  <span>+</span>
                  <span>Asignar Curso a Usuario</span>
                </button>
              </div>
            </div>

            {/* Barra de Búsqueda y Filtros en Tiempo Real */}
            <div className="mt-4 grid grid-cols-1 gap-2.5 sm:grid-cols-4 border-t border-border/40 pt-4">
              <div className="sm:col-span-2 relative">
                <input
                  type="text"
                  placeholder="Buscar por nombre, apellido, correo o usuario Moodle..."
                  value={assignSearch}
                  onChange={(e) => setAssignSearch(e.target.value)}
                  className="w-full rounded-xl border border-border/70 bg-foreground/[0.03] focus:bg-surface focus:border-accent px-4 py-2.5 text-xs text-foreground placeholder:text-muted/60 transition-all outline-none"
                />
                {assignSearch && (
                  <button
                    type="button"
                    onClick={() => setAssignSearch('')}
                    className="absolute right-3 top-2.5 text-xs text-muted hover:text-foreground"
                  ><IconClose className="w-3.5 h-3.5" /></button>
                )}
              </div>

              <select
                value={assignRoleFilter}
                onChange={(e) => setAssignRoleFilter(e.target.value)}
                className="rounded-xl border border-border/70 bg-foreground/[0.03] focus:bg-surface focus:border-accent px-3 py-2 text-xs text-foreground transition-all outline-none"
              >
                <option value="">Todos los Roles</option>
                <option value="estudiante">Estudiantes</option>
                <option value="profesor">Docentes / Profesores</option>
                <option value="aspirante">Aspirantes</option>
                <option value="coordinador">Coordinadores</option>
                <option value="administrador">Administradores</option>
                <option value="superadministrador">Superadministradores</option>
              </select>

              <select
                value={assignCourseFilter}
                onChange={(e) => setAssignCourseFilter(e.target.value)}
                className="rounded-xl border border-border/70 bg-foreground/[0.03] focus:bg-surface focus:border-accent px-3 py-2 text-xs text-foreground transition-all outline-none"
              >
                <option value="">Todos los Cursos</option>
                <option value="con_cursos">Con cursos matriculados</option>
                <option value="sin_cursos">Sin cursos asignados</option>
              </select>
            </div>

            <div className="mt-2 text-[11px] text-muted flex items-center justify-between">
              <span>
                Mostrando <strong className="text-foreground">{filteredAssignmentUsers.length}</strong> de <strong className="text-foreground">{users.length}</strong> usuarios
              </span>
              {(assignSearch || assignRoleFilter || assignCourseFilter) && (
                <button
                  type="button"
                  onClick={() => {
                    setAssignSearch('');
                    setAssignRoleFilter('');
                    setAssignCourseFilter('');
                  }}
                  className="text-accent hover:underline font-medium"
                >
                  Restablecer filtros
                </button>
              )}
            </div>
          </div>

          {/* Tabla de Asignaciones Apple Style */}
          <div className="overflow-hidden rounded-[24px] border border-border/60 bg-surface/80 backdrop-blur-2xl shadow-apple">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-border/40 bg-foreground/[0.015] text-muted uppercase tracking-wider text-[10px] font-semibold">
                  <tr>
                    <th className="px-6 py-3.5">Usuario</th>
                    <th className="px-6 py-3.5">Roles en Portal</th>
                    <th className="px-6 py-3.5">Materias Asignadas en Moodle</th>
                    <th className="px-6 py-3.5 text-right">Acciones Rápidas</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {filteredAssignmentUsers.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="p-8 text-center text-muted">
                        No se encontraron usuarios con los criterios de búsqueda especificados.
                      </td>
                    </tr>
                  ) : (
                    filteredAssignmentUsers.map((u) => {
                      const userEnrs = userEnrollmentsMap[u.id] || [];
                      const initials = `${(u.first_name || 'U')[0]}${(u.last_name || 'U')[0]}`.toUpperCase();
                      const userRoles = (u.active_roles || u.roles || []) as string[];

                      return (
                        <tr key={u.id} className="hover:bg-foreground/[0.015] transition-colors">
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-tr from-accent/20 to-accent/5 font-semibold text-accent text-xs ring-1 ring-accent/20">
                                {initials}
                              </div>
                              <div>
                                <p className="font-semibold text-foreground text-sm tracking-tight">
                                  {u.first_name} {u.last_name}
                                </p>
                                <p className="text-xs text-muted font-mono">
                                  {u.email}
                                </p>
                                <div className="mt-1 flex items-center gap-1.5">
                                  <MoodleSyncBadge status={u.moodle_sync_status} moodleId={u.moodle_user_id} />
                                  {u.moodle_username && (
                                    <span className="text-[10px] text-muted font-mono">
                                      (@{u.moodle_username})
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          </td>

                          <td className="px-6 py-4">
                            <div className="flex flex-wrap items-center gap-1.5 max-w-xs">
                              {userRoles.map((role) => (
                                <span
                                  key={role}
                                  className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium border ${
                                    role === 'superadministrador'
                                      ? 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20'
                                      : role === 'administrador'
                                      ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20'
                                      : role === 'coordinador'
                                      ? 'bg-primary/10 text-primary border-primary/20'
                                      : role === 'profesor'
                                      ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                                      : role === 'estudiante'
                                      ? 'bg-accent/10 text-accent border-accent/20'
                                      : 'bg-foreground/[0.04] text-muted border-border/80'
                                  }`}
                                >
                                  {role}
                                </span>
                              ))}
                              <button
                                type="button"
                                onClick={() => openRolesModalForUser(u)}
                                className="rounded-full border border-border/80 bg-surface px-2.5 py-0.5 text-[11px] font-medium text-accent hover:bg-foreground/[0.04] transition-colors"
                                title="Agregar o revocar roles de este usuario"
                              >
                                Roles
                              </button>
                            </div>
                          </td>

                          <td className="px-6 py-4">
                            {userEnrs.length === 0 ? (
                              <span className="text-xs text-muted/70 italic">
                                Sin cursos asignados
                              </span>
                            ) : (
                              <div className="flex flex-col gap-1.5 max-w-md">
                                {userEnrs.map((enr) => {
                                  const cName =
                                    enr.course_mappings?.course_name ||
                                    enr.course_mappings?.courses?.name ||
                                    enr.course_mappings?.moodle_shortname ||
                                    'Materia';
                                  const cCode =
                                    enr.course_mappings?.portal_course_code ||
                                    enr.course_mappings?.code ||
                                    '';
                                  const mId = enr.course_mappings?.moodle_course_id;

                                  return (
                                    <div
                                      key={enr.id}
                                      className="flex items-center justify-between rounded-xl border border-border/50 bg-foreground/[0.015] px-3 py-1.5"
                                    >
                                      <div className="flex items-center gap-1.5">
                                        {cCode && (
                                          <span className="font-mono text-[10px] font-semibold text-accent">
                                            [{cCode}]
                                          </span>
                                        )}
                                        <span className="font-medium text-foreground text-xs">
                                          {cName}
                                        </span>
                                        {mId && (
                                          <span className="text-[10px] text-muted">
                                            (Moodle #{mId})
                                          </span>
                                        )}
                                      </div>
                                      <span
                                        className={`rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider ${
                                          enr.status === 'sincronizada' || enr.status === 'autorizada'
                                            ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                                            : enr.status === 'pendiente'
                                            ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20'
                                            : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20'
                                        }`}
                                      >
                                        {enr.status}
                                      </span>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </td>

                          <td className="px-6 py-4 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <button
                                type="button"
                                onClick={() => openAssignModalForUser(u)}
                                className="rounded-xl bg-accent hover:bg-accent-strong text-white px-3.5 py-1.5 text-xs font-medium shadow-xs transition-all active:scale-[0.98]"
                              >
                                + Asignar Curso
                              </button>
                              <button
                                type="button"
                                onClick={() => openRolesModalForUser(u)}
                                className="rounded-xl border border-border/80 bg-surface hover:bg-foreground/[0.04] text-foreground/80 px-2.5 py-1.5 text-xs font-medium transition-all"
                              >
                                Roles
                              </button>
                              {!u.moodle_user_id && (
                                <button
                                  type="button"
                                  onClick={() => handleSyncSingleUser(u.id)}
                                  disabled={actionLoading === `user-sync-${u.id}`}
                                  className="rounded-xl border border-accent/30 bg-accent/10 px-2.5 py-1.5 text-xs font-medium text-accent hover:bg-accent/20 transition-all"
                                  title="Crear cuenta de este usuario en Moodle"
                                >
                                  Sync Moodle
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* PESTAÑA 2: GESTIÓN DE USUARIOS                                            */}
      {/* ========================================================================= */}
      {activeTab === 'usuarios' && (
        <div className="space-y-4">
          {/* Header y Filtros Apple SaaS Style */}
          <div className="rounded-[24px] border border-border/60 bg-surface/75 backdrop-blur-xl p-5 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold tracking-tight text-foreground flex items-center gap-2">
                  <IconStudents className="w-5 h-5 text-primary" />
                  <span>Directorio de Usuarios y Accesos</span>
                </h2>
                <p className="mt-0.5 text-xs text-muted">
                  Consulta de identidades registradas, estados de cuenta y sincronización directa con Moodle LMS.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setShowCreateUserModal(true)}
                className="rounded-xl bg-accent px-4 py-2 text-xs font-medium text-white shadow-xs hover:bg-accent-strong active:scale-[0.98] transition-all flex items-center gap-1.5 self-start sm:self-auto"
              >
                <span>+</span>
                <span>Crear Usuario</span>
              </button>
            </div>

            {/* Barra de Filtros */}
            <div className="mt-4 grid grid-cols-1 gap-2.5 sm:grid-cols-4 border-t border-border/40 pt-4">
              <div className="sm:col-span-2 relative">
                <input
                  type="text"
                  placeholder="Buscar por nombre, apellido, correo o usuario Moodle..."
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  className="w-full rounded-xl border border-border/70 bg-foreground/[0.03] focus:bg-surface focus:border-accent px-4 py-2.5 text-xs text-foreground placeholder:text-muted/60 transition-all outline-none"
                />
                {userSearch && (
                  <button
                    type="button"
                    onClick={() => setUserSearch('')}
                    className="absolute right-3 top-2.5 text-xs text-muted hover:text-foreground"
                  ><IconClose className="w-3.5 h-3.5" /></button>
                )}
              </div>

              <select
                value={userRoleFilter}
                onChange={(e) => setUserRoleFilter(e.target.value)}
                className="rounded-xl border border-border/70 bg-foreground/[0.03] focus:bg-surface focus:border-accent px-3 py-2 text-xs text-foreground transition-all outline-none"
              >
                <option value="">Todos los Roles</option>
                <option value="estudiante">Estudiantes</option>
                <option value="profesor">Docentes / Profesores</option>
                <option value="aspirante">Aspirantes</option>
                <option value="coordinador">Coordinadores</option>
                <option value="administrador">Administradores</option>
                <option value="superadministrador">Superadministradores</option>
              </select>

              <select
                value={userStatusFilter}
                onChange={(e) => setUserStatusFilter(e.target.value)}
                className="rounded-xl border border-border/70 bg-foreground/[0.03] focus:bg-surface focus:border-accent px-3 py-2 text-xs text-foreground transition-all outline-none"
              >
                <option value="">Todos los Estados</option>
                <option value="activo">Activo</option>
                <option value="pendiente">Pendiente</option>
                <option value="suspendido">Suspendido</option>
                <option value="inactivo">Inactivo</option>
                <option value="baja">Baja</option>
              </select>
            </div>

            <div className="mt-2 text-[11px] text-muted flex items-center justify-between">
              <span>
                Mostrando <strong className="text-foreground">{filteredUsers.length}</strong> de <strong className="text-foreground">{users.length}</strong> usuarios
              </span>
              {(userSearch || userRoleFilter || userStatusFilter) && (
                <button
                  type="button"
                  onClick={() => {
                    setUserSearch('');
                    setUserRoleFilter('');
                    setUserStatusFilter('');
                  }}
                  className="text-accent hover:underline font-medium"
                >
                  Restablecer filtros
                </button>
              )}
            </div>
          </div>

          {/* Tabla de Usuarios Apple Style */}
          <div className="overflow-hidden rounded-[24px] border border-border/60 bg-surface/80 backdrop-blur-2xl shadow-apple">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-border/40 bg-foreground/[0.015] text-muted uppercase tracking-wider text-[10px] font-semibold">
                  <tr>
                    <th className="px-6 py-3.5">Usuario / Correo</th>
                    <th className="px-6 py-3.5">Roles Activos</th>
                    <th className="px-6 py-3.5">Estado Portal</th>
                    <th className="px-6 py-3.5">Vinculación Moodle</th>
                    <th className="px-6 py-3.5 text-right">Acciones de Control</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {filteredUsers.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="p-8 text-center text-muted">
                        No se encontraron usuarios con los criterios de búsqueda especificados.
                      </td>
                    </tr>
                  ) : (
                    filteredUsers.map((u) => {
                      const initials = `${(u.first_name || 'U')[0]}${(u.last_name || 'U')[0]}`.toUpperCase();
                      const userRoles = (u.active_roles || u.roles || []) as string[];

                      return (
                        <tr key={u.id} className="hover:bg-foreground/[0.015] transition-colors">
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-tr from-accent/20 to-accent/5 font-semibold text-accent text-xs ring-1 ring-accent/20">
                                {initials}
                              </div>
                              <div>
                                <p className="font-semibold text-foreground text-sm tracking-tight">
                                  {u.first_name} {u.last_name}
                                </p>
                                <p className="text-xs text-muted font-mono">{u.email}</p>
                                {u.phone && <p className="text-[10px] text-muted/70 mt-0.5">Tel: {u.phone}</p>}
                              </div>
                            </div>
                          </td>

                          <td className="px-6 py-4">
                            <div className="flex flex-wrap items-center gap-1.5 max-w-xs">
                              {userRoles.length > 0 ? (
                                userRoles.map((r: string) => (
                                  <span
                                    key={r}
                                    className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium border ${
                                      r === 'superadministrador'
                                        ? 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20'
                                        : r === 'administrador'
                                        ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20'
                                        : r === 'coordinador'
                                        ? 'bg-primary/10 text-primary border-primary/20'
                                        : r === 'profesor'
                                        ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                                        : r === 'estudiante'
                                        ? 'bg-accent/10 text-accent border-accent/20'
                                        : 'bg-foreground/[0.04] text-muted border-border/80'
                                    }`}
                                  >
                                    {r}
                                  </span>
                                ))
                              ) : (
                                <span className="text-[11px] text-muted italic">Sin roles</span>
                              )}
                            </div>
                          </td>

                          <td className="px-6 py-4">
                            <span
                              className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium capitalize border ${
                                u.status === 'activo'
                                  ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                                  : u.status === 'pendiente'
                                  ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20'
                                  : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20'
                              }`}
                            >
                              {u.status}
                            </span>
                          </td>

                          <td className="px-6 py-4">
                            <MoodleSyncBadge status={u.moodle_sync_status} moodleId={u.moodle_user_id} />
                            {u.moodle_username && (
                              <p className="mt-1 font-mono text-[10px] text-muted">
                                @{u.moodle_username}
                              </p>
                            )}
                          </td>

                          <td className="px-6 py-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                type="button"
                                onClick={() => setSelectedUserForRole(u)}
                                className="rounded-xl border border-border/80 bg-surface hover:bg-foreground/[0.04] text-foreground/80 px-2.5 py-1 text-xs font-medium transition-all"
                                title="Gestionar roles"
                              >
                                Roles
                              </button>

                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedUserForStatus(u);
                                  setNewStatus(u.status || 'activo');
                                }}
                                className="rounded-xl border border-border/80 bg-surface hover:bg-foreground/[0.04] text-foreground/80 px-2.5 py-1 text-xs font-medium transition-all"
                                title="Modificar estado de cuenta"
                              >
                                Estado
                              </button>

                              {!u.moodle_user_id && (
                                <button
                                  type="button"
                                  disabled={actionLoading === `user-sync-${u.id}`}
                                  onClick={() => handleSyncSingleUser(u.id)}
                                  className="rounded-xl border border-accent/30 bg-accent/10 px-2.5 py-1 text-xs font-medium text-accent hover:bg-accent/20 transition-all disabled:opacity-50"
                                  title="Sincronizar a Moodle"
                                >
                                  {actionLoading === `user-sync-${u.id}` ? '...' : 'Sync Moodle'}
                                </button>
                              )}

                              <button
                                type="button"
                                onClick={() => {
                                  setAssignTargetUserId(u.id);
                                  setShowAssignCourseModal(true);
                                }}
                                className="rounded-xl bg-accent hover:bg-accent-strong text-white px-3 py-1 text-xs font-medium shadow-xs transition-all active:scale-[0.98]"
                                title="Asignar curso directamente"
                              >
                                + Curso
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* PESTAÑA 3: CURSOS & ASIGNACIÓN A MOODLE                                    */}
      {/* ========================================================================= */}
      {activeTab === 'cursos' && (
        <div className="space-y-4">
          <div className="rounded-[24px] border border-border/60 bg-surface/75 backdrop-blur-xl p-5 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold tracking-tight text-foreground flex items-center gap-2">
                  <IconGroups className="w-5 h-5 text-primary" />
                  <span>Catálogo de Cursos Vinculados con Moodle</span>
                </h2>
                <p className="mt-0.5 text-xs text-muted">
                  Cada materia se enlaza a un curso en Moodle LMS con enrolamiento automático y salto SSO sin contraseña.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowCreateCourseModal(true)}
                  className="rounded-xl bg-accent px-4 py-2 text-xs font-medium text-white shadow-xs hover:bg-accent-strong active:scale-[0.98] transition-all flex items-center gap-1.5"
                >
                  <span>+</span>
                  <span>Vincular Nuevo Curso Moodle</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowAssignCourseModal(true)}
                  className="rounded-xl border border-border/80 bg-surface hover:bg-foreground/[0.04] px-3.5 py-2 text-xs font-medium text-foreground transition-all shadow-xs"
                >
                  + Asignar Curso
                </button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {courses.length === 0 ? (
              <div className="col-span-full rounded-[24px] border border-dashed border-border/70 p-12 text-center text-muted">
                No hay cursos vinculados actualmente. Pulsa &quot;Vincular Nuevo Curso Moodle&quot; para registrar uno.
              </div>
            ) : (
              courses.map((course) => (
                <div
                  key={course.id}
                  className="rounded-[24px] border border-border/60 bg-surface/80 backdrop-blur-2xl p-6 shadow-apple hover:border-accent/40 hover:shadow-lg transition-all flex flex-col justify-between group"
                >
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="rounded-full bg-accent/10 px-2.5 py-0.5 font-mono text-[10px] font-semibold text-accent border border-accent/20">
                        {course.portal_course_code || course.code || 'CUR-00'}
                      </span>
                      <span className="rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-[10px] font-medium text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                        Moodle #{course.moodle_course_id}
                      </span>
                    </div>

                    <h3 className="mt-3.5 font-semibold text-foreground text-sm tracking-tight leading-snug group-hover:text-accent transition-colors">
                      {course.course_name || course.name}
                    </h3>
                    <p className="mt-1 font-mono text-[11px] text-muted">
                      Shortname: {course.moodle_shortname || 'N/A'}
                    </p>
                    {course.programs?.name && (
                      <p className="mt-1.5 text-[11px] text-muted/80 flex items-center gap-1">
                        <IconGrades className="w-5 h-5 text-primary" />
                        <span>{course.programs.name}</span>
                      </p>
                    )}
                  </div>

                  <div className="mt-6 border-t border-border/40 pt-4 flex items-center justify-between gap-2">
                    <a
                      href={`${process.env.NEXT_PUBLIC_MOODLE_URL || 'http://192.168.191.171/moodle'}/course/view.php?id=${course.moodle_course_id}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs text-accent font-medium hover:underline inline-flex items-center gap-1"
                    >
                      Abrir en Moodle ↗
                    </a>
                    <button
                      type="button"
                      onClick={() => {
                        setAssignCourseId(course.id);
                        setShowAssignCourseModal(true);
                      }}
                      className="rounded-xl border border-border/80 bg-surface hover:bg-foreground/[0.04] px-3 py-1.5 text-xs font-medium text-foreground transition-all shadow-xs"
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
      {/* PESTAÑA 4: MATRÍCULAS & APROBACIONES                                      */}
      {/* ========================================================================= */}
      {activeTab === 'matriculas' && (
        <div className="space-y-4">
          <div className="rounded-[24px] border border-border/60 bg-surface/75 backdrop-blur-xl p-5 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold tracking-tight text-foreground flex items-center gap-2">
                  <IconAttendance className="w-5 h-5 text-primary" />
                  <span>Solicitudes y Autorizaciones de Matrícula</span>
                </h2>
                <p className="mt-0.5 text-xs text-muted">
                  Al autorizar una inscripción, NestJS invoca automáticamente el Web Service de Moodle para enrolar al estudiante.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2.5">
                <select
                  value={enrollmentStatusFilter}
                  onChange={(e) => setEnrollmentStatusFilter(e.target.value)}
                  className="rounded-xl border border-border/70 bg-foreground/[0.03] focus:bg-surface focus:border-accent px-3 py-2 text-xs text-foreground transition-all outline-none"
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
                  className="rounded-xl bg-accent px-4 py-2 text-xs font-medium text-white shadow-xs hover:bg-accent-strong active:scale-[0.98] transition-all flex items-center gap-1.5"
                >
                  <span>+</span>
                  <span>Nueva Matrícula</span>
                </button>
              </div>
            </div>
          </div>

          <div className="overflow-hidden rounded-[24px] border border-border/60 bg-surface/80 backdrop-blur-2xl shadow-apple">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-border/40 bg-foreground/[0.015] text-muted uppercase tracking-wider text-[10px] font-semibold">
                  <tr>
                    <th className="px-6 py-3.5">Aspirante / Estudiante</th>
                    <th className="px-6 py-3.5">Materia / Curso</th>
                    <th className="px-6 py-3.5">Rol Aula</th>
                    <th className="px-6 py-3.5">Estado</th>
                    <th className="px-6 py-3.5 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {filteredEnrollments.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="p-8 text-center text-muted">
                        No hay solicitudes de matrícula que coincidan con el filtro seleccionado.
                      </td>
                    </tr>
                  ) : (
                    filteredEnrollments.map((enr) => {
                      const studentName = `${enr.profiles?.first_name || 'Estudiante'} ${enr.profiles?.last_name || ''}`.trim();
                      const initials = `${(enr.profiles?.first_name || 'E')[0]}${(enr.profiles?.last_name || '')[0] || ''}`.toUpperCase();

                      return (
                        <tr key={enr.id} className="hover:bg-foreground/[0.015] transition-colors">
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-tr from-accent/20 to-accent/5 font-semibold text-accent text-xs ring-1 ring-accent/20">
                                {initials}
                              </div>
                              <div>
                                <p className="font-semibold text-foreground text-sm tracking-tight">
                                  {studentName}
                                </p>
                                <p className="text-xs text-muted font-mono">{enr.profiles?.email}</p>
                              </div>
                            </div>
                          </td>

                          <td className="px-6 py-4">
                            <p className="font-semibold text-foreground text-xs">
                              {enr.course_mappings?.course_name || enr.course_mappings?.courses?.name || enr.course_mappings?.moodle_shortname || 'Curso INICIA'}
                            </p>
                            <p className="font-mono text-[10px] text-muted mt-0.5">
                              ID Moodle: #{enr.course_mappings?.moodle_course_id || 'N/A'}
                            </p>
                          </td>

                          <td className="px-6 py-4">
                            <span className="font-mono text-xs font-semibold text-accent">
                              {enr.moodle_role || 'student'}
                            </span>
                          </td>

                          <td className="px-6 py-4">
                            <span
                              className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium capitalize border ${
                                enr.status === 'sincronizada' || enr.status === 'autorizada'
                                  ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                                  : enr.status === 'pendiente'
                                  ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20'
                                  : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20'
                              }`}
                            >
                              {enr.status}
                            </span>
                          </td>

                          <td className="px-6 py-4 text-right">
                            <div className="inline-flex items-center justify-end gap-1.5">
                              {enr.status === 'pendiente' && (
                                <>
                                  <button
                                    type="button"
                                    disabled={actionLoading === `enr-${enr.id}`}
                                    onClick={() => handleAuthorizeEnrollment(enr.id, 'autorizada')}
                                    className="rounded-xl bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-500 transition-all shadow-xs disabled:opacity-50 active:scale-[0.98]"
                                  >
                                    {actionLoading === `enr-${enr.id}` ? '...' : 'Aprobar & Matricular'}
                                  </button>
                                  <button
                                    type="button"
                                    disabled={actionLoading === `enr-${enr.id}`}
                                    onClick={() => handleAuthorizeEnrollment(enr.id, 'rechazada')}
                                    className="rounded-xl border border-rose-500/20 bg-rose-500/10 px-2.5 py-1.5 text-xs font-medium text-rose-600 dark:text-rose-400 hover:bg-rose-500/20 transition-all disabled:opacity-50"
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
                                  className="rounded-xl border border-accent/30 bg-accent/10 px-3 py-1.5 text-xs font-medium text-accent hover:bg-accent/20 transition-all disabled:opacity-50"
                                >
                                  {actionLoading === `sync-enr-${enr.id}` ? 'Sincronizando...' : 'Reintentar Moodle'}
                                </button>
                              )}

                              <button
                                type="button"
                                disabled={actionLoading === `delete-enr-${enr.id}`}
                                onClick={() =>
                                  handleDeleteEnrollment(
                                    enr.id,
                                    studentName,
                                    enr.course_mappings?.course_name || 'Curso',
                                  )
                                }
                                className="rounded-[6px] border border-rose-500/20 bg-rose-500/10 px-2.5 py-1.5 text-xs font-medium text-rose-600 dark:text-rose-400 hover:bg-rose-500/20 transition-all disabled:opacity-50"
                                title="Desasignar curso al usuario"
                              >
                                {actionLoading === `delete-enr-${enr.id}` ? '...' : 'Desasignar'}
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* PESTAÑA 5: PROGRAMAS ACADÉMICOS                                           */}
      {/* ========================================================================= */}
      {activeTab === 'admisiones' && (
        <section className="space-y-4 rounded-xl border border-border bg-surface p-5 shadow-minimal">
          <div>
            <h2 className="text-lg font-semibold text-foreground">Postulaciones a programas</h2>
            <p className="mt-1 text-sm text-muted">Revisa cada solicitud y registra el dictamen. Admitir activa el perfil del aspirante según las reglas de la API.</p>
          </div>
          {applications.length === 0 ? <p className="text-sm text-muted">No hay postulaciones registradas.</p> : (
            <ul className="space-y-3">
              {applications.map((application) => (
                <li key={application.id} className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-border p-4">
                  <div className="min-w-0 text-sm">
                    <p className="font-semibold text-foreground">{application.profiles ? `${application.profiles.first_name} ${application.profiles.last_name}` : application.applicant_id}</p>
                    <p className="text-muted">{application.profiles?.email} · {application.programs?.name || 'Programa académico'}</p>
                    <p className="mt-1 text-xs capitalize text-primary">Estado: {application.status.replace('_', ' ')}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {(['en_revision', 'admitido', 'rechazado'] as const).map((status) => (
                      <button key={status} type="button" disabled={actionLoading === `admission-${application.id}` || application.status === status} onClick={() => handleReviewApplication(application.id, status)} className="rounded-md border border-border px-3 py-1.5 text-xs font-medium capitalize text-foreground hover:border-primary disabled:opacity-50">
                        {status.replace('_', ' ')}
                      </button>
                    ))}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {activeTab === 'programas' && (
        <div className="space-y-4">
          <div className="rounded-[24px] border border-border/60 bg-surface/75 backdrop-blur-xl p-5 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold tracking-tight text-foreground flex items-center gap-2">
                  <IconGrades className="w-5 h-5 text-primary" />
                  <span>Programas Académicos Oficiales</span>
                </h2>
                <p className="mt-0.5 text-xs text-muted">
                  Licenciaturas, Maestrías, Diplomados y Certificaciones que estructuran los cursos del campus.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowCreateProgramModal(true)}
                className="rounded-xl bg-accent px-4 py-2 text-xs font-medium text-white shadow-xs hover:bg-accent-strong active:scale-[0.98] transition-all flex items-center gap-1.5 self-start sm:self-auto"
              >
                <span>+</span>
                <span>Nuevo Programa</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {programs.map((prog) => (
              <div
                key={prog.id}
                className="rounded-[24px] border border-border/60 bg-surface/80 backdrop-blur-2xl p-6 shadow-apple hover:shadow-lg transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="rounded-full bg-accent/10 px-2.5 py-0.5 text-[10px] font-semibold text-accent uppercase border border-accent/20">
                      {prog.type}
                    </span>
                    <span className="text-[11px] text-muted capitalize font-medium">{prog.modality}</span>
                  </div>
                  <h3 className="mt-3.5 font-semibold text-foreground text-sm tracking-tight">{prog.name}</h3>
                  <p className="mt-1.5 text-xs text-muted leading-relaxed line-clamp-2">{prog.description}</p>
                </div>
                <div className="mt-5 border-t border-border/40 pt-4 flex items-center justify-between text-[11px] text-muted">
                  <span className="font-mono font-medium text-foreground/80">Código: {prog.code}</span>
                  <span>{prog.duration_text || `${prog.duration_hours} hrs`}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* PESTAÑA 6: DIAGNÓSTICO E INTEGRACIÓN MOODLE                               */}
      {/* ========================================================================= */}
      {activeTab === 'moodle' && (
        <div className="space-y-6">
          <div className="rounded-[28px] border border-border/60 bg-surface/80 backdrop-blur-2xl p-6 sm:p-8 shadow-apple space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-3 py-0.5 text-[11px] font-medium text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    Enlace Bidireccional Activo
                  </span>
                </div>
                <h2 className="text-xl font-semibold tracking-tight text-foreground">
                  Diagnóstico e Integración con Moodle LMS
                </h2>
                <p className="text-xs text-muted max-w-2xl mt-0.5">
                  Conexión REST mediante Web Services oficiales y autenticación transparente vía token seguro (<code>auth_userkey</code>).
                </p>
              </div>

              <button
                type="button"
                onClick={handleLaunchCampusSSO}
                disabled={actionLoading === 'launch-campus'}
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-foreground text-background font-medium px-5 py-2.5 text-xs shadow-xs hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-50 self-start sm:self-auto"
              >
                {actionLoading === 'launch-campus' ? (
                  <>
                    <span className="h-3 w-3 animate-spin rounded-full border-2 border-background border-t-transparent" />
                    <span>Iniciando SSO...</span>
                  </>
                ) : (
                  <>
                    <IconExternalLink className="w-4 h-4 text-accent-lime" />
                    <span>Abrir Campus con SSO Admin</span>
                  </>
                )}
              </button>
            </div>

            {/* Tarjetas de Telemetría Bento */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 border-t border-border/40 pt-6">
              <div className="rounded-2xl border border-border/50 bg-foreground/[0.015] p-5">
                <span className="text-[11px] font-medium tracking-wide uppercase text-muted">URL del Campus</span>
                <p className="mt-1 font-mono text-sm font-semibold text-foreground">{process.env.NEXT_PUBLIC_MOODLE_URL || 'http://192.168.191.171/moodle'}</p>
                <span className="text-[11px] text-muted mt-1 block">Acceso local y de intranet</span>
              </div>
              <div className="rounded-2xl border border-border/50 bg-foreground/[0.015] p-5">
                <span className="text-[11px] font-medium tracking-wide uppercase text-muted">Versión del Core</span>
                <p className="mt-1 text-sm font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  Moodle 5.3+ (Build 20261021)
                </p>
                <span className="text-[11px] text-muted mt-1 block">Compatibilidad REST total</span>
              </div>
              <div className="rounded-2xl border border-border/50 bg-foreground/[0.015] p-5">
                <span className="text-[11px] font-medium tracking-wide uppercase text-muted">Mecanismo SSO</span>
                <p className="mt-1 text-sm font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  auth_userkey (One-Time Key)
                </p>
                <span className="text-[11px] text-muted mt-1 block">Cero contraseñas compartidas</span>
              </div>
            </div>

            <div className="border-t border-border/40 pt-6 space-y-3">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted">
                Funciones Web Services Oficiales Habilitadas
              </h3>
              <div className="flex flex-wrap gap-2">
                {[
                  'auth_userkey_request_login_url (SSO)',
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
                    className="rounded-xl bg-foreground/[0.025] border border-border/60 px-3 py-1.5 font-mono text-[11px] text-foreground/80 flex items-center gap-1.5"
                  >
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                    <span>{fn}</span>
                  </span>
                ))}
              </div>
            </div>

            <div className="border-t border-border/40 pt-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <p className="text-xs text-muted max-w-xl">
                La sincronización opera en tiempo real con tolerancia a fallos transitorios y registro auditable en PostgreSQL.
              </p>
              <button
                type="button"
                onClick={handleBulkMoodleSync}
                disabled={actionLoading === 'bulk-sync'}
                className="rounded-xl border border-border/80 bg-surface hover:bg-foreground/[0.04] px-4 py-2 text-xs font-medium text-foreground transition-all shadow-xs disabled:opacity-50 active:scale-[0.98] flex items-center gap-2 self-start sm:self-auto"
              >
                {actionLoading === 'bulk-sync' ? (
                  <>
                    <span className="h-3 w-3 animate-spin rounded-full border-2 border-foreground border-t-transparent" />
                    <span>Ejecutando...</span>
                  </>
                ) : (
                  <>
                    <IconRefresh className="w-4 h-4 text-primary" />
                    <span>Sincronización Masiva</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* PESTAÑA 7: AUDITORÍA & LOGS                                               */}
      {/* ========================================================================= */}
      {activeTab === 'auditoria' && (
        <div className="space-y-4">
          <div className="rounded-[24px] border border-border/60 bg-surface/75 backdrop-blur-xl p-5 shadow-xs">
            <h2 className="text-lg font-semibold tracking-tight text-foreground flex items-center gap-2">
              <IconAudit className="w-5 h-5 text-primary" />
              <span>Bitácora Inmutable de Auditoría</span>
            </h2>
            <p className="mt-0.5 text-xs text-muted">
              Trazabilidad completa de operaciones administrativas, cambios de roles, accesos por SSO y sincronizaciones.
            </p>
          </div>

          <div className="overflow-hidden rounded-[24px] border border-border/60 bg-surface/80 backdrop-blur-2xl shadow-apple">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-border/40 bg-foreground/[0.015] text-muted uppercase tracking-wider text-[10px] font-semibold">
                  <tr>
                    <th className="px-6 py-3.5">Fecha / Hora</th>
                    <th className="px-6 py-3.5">Acción Registrada</th>
                    <th className="px-6 py-3.5">Entidad / ID</th>
                    <th className="px-6 py-3.5">Detalle Operacional</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {!Array.isArray(auditLogs) || auditLogs.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="p-8 text-center text-muted">
                        No hay registros de auditoría acumulados.
                      </td>
                    </tr>
                  ) : (
                    (Array.isArray(auditLogs) ? auditLogs : []).map((log) => (
                      <tr key={log.id} className="hover:bg-foreground/[0.015] transition-colors">
                        <td className="px-6 py-4 font-mono text-xs text-muted whitespace-nowrap">
                          {new Date(log.created_at).toLocaleString()}
                        </td>
                        <td className="px-6 py-4">
                          <span className="rounded-full bg-accent/10 px-2.5 py-0.5 font-mono text-[11px] font-medium text-accent border border-accent/20">
                            {log.action}
                          </span>
                        </td>
                        <td className="px-6 py-4 font-mono text-xs text-foreground/80">
                          {log.entity_name} {log.entity_id ? `(#${log.entity_id.slice(0, 8)})` : ''}
                        </td>
                        <td className="px-6 py-4 font-mono text-[11px] text-muted truncate max-w-md">
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
      {/* PESTAÑA: CUERPO DOCENTE                                                   */}
      {/* ========================================================================= */}
      {activeTab === 'docentes' && (
        <div className="space-y-4">
          <div className="rounded-[10px] border border-border bg-surface p-5 shadow-minimal">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h2 className="text-base font-semibold tracking-tight text-foreground flex items-center gap-2">
                  <IconTeachers className="w-5 h-5 text-primary" />
                  <span>Cuerpo Docente y Titulares de Asignatura</span>
                </h2>
                <p className="mt-0.5 text-xs text-muted">
                  Profesores registrados con permisos de edición y gestión de grupos en Moodle LMS.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowCreateUserModal(true)}
                  className="rounded-[6px] bg-primary-action px-3.5 py-2 text-xs font-semibold text-white shadow-minimal hover:bg-primary-action/90 flex items-center gap-1.5 transition-all active:scale-[0.98]"
                >
                  <IconPlus className="w-3.5 h-3.5" />
                  <span>Registrar Profesor</span>
                </button>
              </div>
            </div>
          </div>

          <div className="rounded-[10px] border border-border bg-surface overflow-hidden shadow-minimal">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-surface-muted/60 text-muted font-medium border-b border-border">
                  <tr>
                    <th className="px-5 py-3.5">Profesor / Titular</th>
                    <th className="px-5 py-3.5">Identificador & Usuario</th>
                    <th className="px-5 py-3.5">Estado en Portal</th>
                    <th className="px-5 py-3.5">Moodle LMS</th>
                    <th className="px-5 py-3.5 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {users
                    .filter((u) => {
                      const userRoles = ((u.active_roles || u.roles || []) as string[]).map((r) => r.toLowerCase());
                      return userRoles.some((r) => ['profesor', 'teacher', 'docente', 'editingteacher'].includes(r));
                    })
                    .map((prof) => (
                      <tr key={prof.id} className="hover:bg-surface-muted/30 transition-colors">
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-3">
                            <div className="h-8 w-8 rounded-[6px] bg-primary/10 text-primary flex items-center justify-center font-bold text-xs">
                              {prof.first_name?.[0] || 'P'}
                            </div>
                            <div>
                              <p className="font-semibold text-foreground text-xs">
                                Prof. {prof.first_name} {prof.last_name}
                              </p>
                              <p className="text-[11px] text-muted">{prof.email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-4 font-mono text-[11px] text-muted">
                          {prof.moodle_username || prof.email.split('@')[0]}
                        </td>
                        <td className="px-5 py-4">
                          <span
                            className={`inline-flex items-center gap-1.5 rounded-[4px] px-2 py-0.5 text-[11px] font-medium border ${
                              prof.status === 'activo'
                                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                                : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20'
                            }`}
                          >
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                            {prof.status}
                          </span>
                        </td>
                        <td className="px-5 py-4">
                          <MoodleSyncBadge status={prof.moodle_sync_status} moodleId={prof.moodle_user_id} />
                        </td>
                        <td className="px-5 py-4 text-right">
                          <button
                            type="button"
                            onClick={() => openAssignModalForUser(prof)}
                            className="rounded-[6px] border border-border bg-surface hover:bg-surface-muted px-2.5 py-1 text-[11px] font-medium text-foreground transition-all shadow-minimal"
                          >
                            Asignar Materia
                          </button>
                        </td>
                      </tr>
                    ))}
                  {users.filter((u) => {
                    const userRoles = ((u.active_roles || u.roles || []) as string[]).map((r) => r.toLowerCase());
                    return userRoles.some((r) => ['profesor', 'teacher', 'docente', 'editingteacher'].includes(r));
                  }).length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-5 py-8 text-center text-muted">
                        No hay profesores registrados con el rol de docente aún.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* PESTAÑA: CONFIGURACIÓN OS                                                 */}
      {/* ========================================================================= */}
      {activeTab === 'configuracion' && (
        <div className="space-y-4">
          <div className="rounded-[10px] border border-border bg-surface p-5 shadow-minimal">
            <h2 className="text-base font-semibold tracking-tight text-foreground flex items-center gap-2">
              <IconSettings className="w-5 h-5 text-primary" />
              <span>Configuración del Sistema INICIA</span>
            </h2>
            <p className="mt-0.5 text-xs text-muted">
              Parámetros de entorno institucional, sincronización y arquitectura.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="rounded-[10px] border border-border bg-surface p-5 space-y-3 shadow-minimal">
              <span className="text-[11px] font-mono uppercase tracking-wider text-muted">Infraestructura & Stack</span>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between py-1 border-b border-border/50">
                  <span className="text-muted">Frontend Framework</span>
                  <span className="font-mono font-medium text-foreground">Next.js 16.4 (App Router)</span>
                </div>
                <div className="flex justify-between py-1 border-b border-border/50">
                  <span className="text-muted">Backend API</span>
                  <span className="font-mono font-medium text-foreground">NestJS (Modular REST)</span>
                </div>
                <div className="flex justify-between py-1 border-b border-border/50">
                  <span className="text-muted">Base de Datos</span>
                  <span className="font-mono font-medium text-foreground">PostgreSQL 17 / Supabase</span>
                </div>
                <div className="flex justify-between py-1 border-b border-border/50">
                  <span className="text-muted">LMS Core</span>
                  <span className="font-mono font-medium text-foreground">Moodle 5.3+ (Web Services REST)</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-muted">SSO Provider</span>
                  <span className="font-mono font-medium text-emerald-600 dark:text-emerald-400">auth_userkey (Sin contraseñas)</span>
                </div>
              </div>
            </div>

            <div className="rounded-[10px] border border-border bg-surface p-5 space-y-3 shadow-minimal">
              <span className="text-[11px] font-mono uppercase tracking-wider text-muted">Diseño & Tokens</span>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between py-1 border-b border-border/50">
                  <span className="text-muted">Sistema de Diseño</span>
                  <span className="font-medium text-foreground">INICIA</span>
                </div>
                <div className="flex justify-between py-1 border-b border-border/50">
                  <span className="text-muted">Color Primario</span>
                  <span className="font-mono text-primary font-bold">#456B19 (Verde institucional)</span>
                </div>
                <div className="flex justify-between py-1 border-b border-border/50">
                  <span className="text-muted">Acento de Marca</span>
                  <span className="font-mono text-foreground font-bold bg-accent-lime px-1.5 py-0.5 rounded-[3px]">#BEF264 (Verde lima)</span>
                </div>
                <div className="flex justify-between py-1 border-b border-border/50">
                  <span className="text-muted">Radios de Componente</span>
                  <span className="font-mono text-foreground">Controles: 6px | Superficies: 10px | Paneles: 14px</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-muted">Tema Actual</span>
                  <span className="font-mono text-foreground">Soporte Dinámico Claro & Oscuro</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
        </div>
      </CampusShell>

      {/* ========================================================================= */}
      {/* MODAL 1: GESTIÓN DE ROLES                                                 */}
      {/* ========================================================================= */}
      {selectedUserForRole && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-md p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-md rounded-[28px] border border-border/80 bg-surface/95 dark:bg-surface/90 backdrop-blur-2xl p-6 sm:p-7 shadow-2xl">
            <div className="flex items-center justify-between border-b border-border/40 pb-4">
              <h3 className="text-base font-semibold tracking-tight text-foreground">Gestionar Roles de Usuario</h3>
              <button
                type="button"
                onClick={() => setSelectedUserForRole(null)}
                className="h-8 w-8 rounded-full bg-foreground/[0.05] hover:bg-foreground/[0.1] text-foreground/70 flex items-center justify-center transition-colors text-xs"
              ><IconClose className="w-3.5 h-3.5" /></button>
            </div>

            <div className="mt-5 space-y-4">
              <div className="rounded-2xl border border-border/50 bg-foreground/[0.02] p-3.5">
                <span className="text-[11px] font-medium text-muted uppercase tracking-wider">Usuario Seleccionado</span>
                <p className="font-semibold text-foreground text-sm tracking-tight mt-0.5">
                  {selectedUserForRole.first_name} {selectedUserForRole.last_name}
                </p>
                <p className="font-mono text-xs text-muted">{selectedUserForRole.email}</p>
              </div>

              <div>
                <p className="text-xs font-medium text-muted mb-2">Roles Actuales Asignados:</p>
                <div className="flex flex-wrap gap-1.5">
                  {(((selectedUserForRole.active_roles || selectedUserForRole.roles || []) as string[])).map((r: string) => {
                    const roleObj = roles.find((item) => item.slug === r);
                    return (
                      <span
                        key={r}
                        className="inline-flex items-center gap-1.5 rounded-full bg-foreground/[0.04] border border-border/60 px-3 py-1 text-xs font-medium text-foreground"
                      >
                        <span>{r}</span>
                        {roleObj && (
                          <button
                            type="button"
                            disabled={actionLoading === `revoke-${selectedUserForRole.id}-${roleObj.id}`}
                            onClick={() => handleRevokeRole(selectedUserForRole.id, roleObj.id, r)}
                            className="text-rose-500 hover:text-rose-600 font-bold ml-0.5 text-xs"
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

              <div className="border-t border-border/40 pt-4">
                <label className="block text-xs font-medium text-foreground mb-1.5">
                  Asignar Nuevo Rol:
                </label>
                <select
                  value={roleToAssign}
                  onChange={(e) => setRoleToAssign(Number(e.target.value))}
                  className="w-full rounded-xl border border-border/70 bg-surface focus:border-accent px-3.5 py-2.5 text-xs text-foreground transition-all outline-none"
                >
                  {roles.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name} ({r.slug})
                    </option>
                  ))}
                </select>
              </div>

              <div className="mt-6 flex justify-end gap-2 border-t border-border/40 pt-4">
                <button
                  type="button"
                  onClick={() => setSelectedUserForRole(null)}
                  className="rounded-xl border border-border/80 bg-surface hover:bg-foreground/[0.04] px-4 py-2 text-xs font-medium text-foreground transition-all"
                >
                  Cerrar
                </button>
                <button
                  type="button"
                  disabled={actionLoading === 'assign-role'}
                  onClick={handleAssignRole}
                  className="rounded-xl bg-accent hover:bg-accent-strong text-white px-5 py-2 text-xs font-medium shadow-xs transition-all active:scale-[0.98] disabled:opacity-50"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-md p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-md rounded-[28px] border border-border/80 bg-surface/95 dark:bg-surface/90 backdrop-blur-2xl p-6 sm:p-7 shadow-2xl">
            <div className="flex items-center justify-between border-b border-border/40 pb-4">
              <h3 className="text-base font-semibold tracking-tight text-foreground">Modificar Estado de Usuario</h3>
              <button
                type="button"
                onClick={() => setSelectedUserForStatus(null)}
                className="h-8 w-8 rounded-full bg-foreground/[0.05] hover:bg-foreground/[0.1] text-foreground/70 flex items-center justify-center transition-colors text-xs"
              ><IconClose className="w-3.5 h-3.5" /></button>
            </div>

            <div className="mt-5 space-y-4">
              <div className="rounded-2xl border border-border/50 bg-foreground/[0.02] p-3.5">
                <p className="font-semibold text-foreground text-sm tracking-tight">
                  {selectedUserForStatus.first_name} {selectedUserForStatus.last_name}
                </p>
                <p className="font-mono text-xs text-muted">{selectedUserForStatus.email}</p>
              </div>

              <div>
                <label className="block text-xs font-medium text-foreground mb-1.5">
                  Nuevo Estado en el Portal:
                </label>
                <select
                  value={newStatus}
                  onChange={(e) => setNewStatus(e.target.value)}
                  className="w-full rounded-xl border border-border/70 bg-surface focus:border-accent px-3.5 py-2.5 text-xs text-foreground transition-all outline-none"
                >
                  <option value="activo">Activo (Habilitado)</option>
                  <option value="pendiente">Pendiente de Aprobación</option>
                  <option value="suspendido">Suspendido (Sin acceso a cursos)</option>
                  <option value="inactivo">Inactivo</option>
                  <option value="baja">Baja Definitiva</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-foreground mb-1.5">
                  Motivo o justificación administrativa:
                </label>
                <input
                  type="text"
                  placeholder="Ej: Aprobación de admisión o baja administrativa"
                  value={statusReason}
                  onChange={(e) => setStatusReason(e.target.value)}
                  className="w-full rounded-xl border border-border/70 bg-foreground/[0.03] focus:bg-surface focus:border-accent px-3.5 py-2.5 text-xs text-foreground placeholder:text-muted/60 transition-all outline-none"
                />
              </div>

              <div className="mt-6 flex justify-end gap-2 border-t border-border/40 pt-4">
                <button
                  type="button"
                  onClick={() => setSelectedUserForStatus(null)}
                  className="rounded-xl border border-border/80 bg-surface hover:bg-foreground/[0.04] px-4 py-2 text-xs font-medium text-foreground transition-all"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={actionLoading === 'update-status'}
                  onClick={handleUpdateUserStatus}
                  className="rounded-xl bg-accent hover:bg-accent-strong text-white px-5 py-2 text-xs font-medium shadow-xs transition-all active:scale-[0.98] disabled:opacity-50"
                >
                  {actionLoading === 'update-status' ? 'Guardando...' : 'Actualizar Estado'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 3: CREAR NUEVO USUARIO (ADMINISTRATIVO)                             */}
      {/* ========================================================================= */}
      {showCreateUserModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-md p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-lg rounded-[28px] border border-border/80 bg-surface/95 dark:bg-surface/90 backdrop-blur-2xl p-6 sm:p-7 shadow-2xl">
            <div className="flex items-center justify-between border-b border-border/40 pb-4">
              <h3 className="text-base font-semibold tracking-tight text-foreground">Crear Nuevo Usuario</h3>
              <button
                type="button"
                onClick={() => setShowCreateUserModal(false)}
                className="h-8 w-8 rounded-full bg-foreground/[0.05] hover:bg-foreground/[0.1] text-foreground/70 flex items-center justify-center transition-colors text-xs"
              ><IconClose className="w-3.5 h-3.5" /></button>
            </div>

            <form onSubmit={handleCreateUser} className="mt-5 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1.5">Nombre(s):</label>
                  <input
                    type="text"
                    required
                    placeholder="Ej: Laura"
                    value={newFirstName}
                    onChange={(e) => setNewFirstName(e.target.value)}
                    className="w-full rounded-xl border border-border/70 bg-foreground/[0.03] focus:bg-surface focus:border-accent px-3.5 py-2.5 text-xs text-foreground placeholder:text-muted/60 transition-all outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1.5">Apellidos:</label>
                  <input
                    type="text"
                    required
                    placeholder="Ej: Gómez Pérez"
                    value={newLastName}
                    onChange={(e) => setNewLastName(e.target.value)}
                    className="w-full rounded-xl border border-border/70 bg-foreground/[0.03] focus:bg-surface focus:border-accent px-3.5 py-2.5 text-xs text-foreground placeholder:text-muted/60 transition-all outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-foreground mb-1.5">Correo Electrónico:</label>
                <input
                  type="email"
                  required
                  placeholder="correo@iinicia.org"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  className="w-full rounded-xl border border-border/70 bg-foreground/[0.03] focus:bg-surface focus:border-accent px-3.5 py-2.5 text-xs text-foreground placeholder:text-muted/60 transition-all outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1.5">Contraseña Inicial:</label>
                  <input
                    type="password"
                    required
                    minLength={8}
                    placeholder="Mínimo 8 caracteres"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full rounded-xl border border-border/70 bg-foreground/[0.03] focus:bg-surface focus:border-accent px-3.5 py-2.5 text-xs text-foreground placeholder:text-muted/60 transition-all outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1.5">Teléfono (opcional):</label>
                  <input
                    type="tel"
                    placeholder="5500000000"
                    value={newPhone}
                    onChange={(e) => setNewPhone(e.target.value)}
                    className="w-full rounded-xl border border-border/70 bg-foreground/[0.03] focus:bg-surface focus:border-accent px-3.5 py-2.5 text-xs text-foreground placeholder:text-muted/60 transition-all outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-foreground mb-1.5">Rol Inicial Asignado:</label>
                <select
                  value={newInitialRole}
                  onChange={(e) => setNewInitialRole(Number(e.target.value))}
                  className="w-full rounded-xl border border-border/70 bg-surface focus:border-accent px-3.5 py-2.5 text-xs text-foreground transition-all outline-none"
                >
                  <option value={5}>Estudiante (student)</option>
                  <option value={4}>Profesor (editingteacher)</option>
                  <option value={3}>Coordinador Académico</option>
                  <option value={2}>Administrador</option>
                  <option value={7}>Aspirante</option>
                </select>
              </div>

              <div className="mt-6 flex justify-end gap-2 border-t border-border/40 pt-4">
                <button
                  type="button"
                  onClick={() => setShowCreateUserModal(false)}
                  className="rounded-xl border border-border/80 bg-surface hover:bg-foreground/[0.04] px-4 py-2 text-xs font-medium text-foreground transition-all"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={actionLoading === 'create-user'}
                  className="rounded-xl bg-accent hover:bg-accent-strong text-white px-5 py-2 text-xs font-medium shadow-xs transition-all active:scale-[0.98] disabled:opacity-50"
                >
                  {actionLoading === 'create-user' ? 'Creando...' : 'Crear Usuario'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 4: ASIGNAR CURSO A ALUMNO O PROFESOR                                */}
      {/* ========================================================================= */}
      {showAssignCourseModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-md p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-lg rounded-[28px] border border-border/80 bg-surface/95 dark:bg-surface/90 backdrop-blur-2xl p-6 sm:p-7 shadow-2xl">
            <div className="flex items-center justify-between border-b border-border/40 pb-4">
              <h3 className="text-base font-semibold tracking-tight text-foreground">Asignar Materia y Matricular en Moodle</h3>
              <button
                type="button"
                onClick={() => setShowAssignCourseModal(false)}
                className="h-8 w-8 rounded-full bg-foreground/[0.05] hover:bg-foreground/[0.1] text-foreground/70 flex items-center justify-center transition-colors text-xs"
              ><IconClose className="w-3.5 h-3.5" /></button>
            </div>

            <form onSubmit={handleDirectCourseAssignment} className="mt-5 space-y-4">
              <div>
                <label className="block text-xs font-medium text-foreground mb-1.5">
                  Alumno o Docente a Matricular:
                </label>
                {assignTargetUserId ? (
                  <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-3.5 flex items-center justify-between">
                    <div>
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                        Usuario Seleccionado
                      </span>
                      <p className="font-semibold text-foreground text-xs mt-0.5">
                        {users.find((u) => u.id === assignTargetUserId)?.first_name}{' '}
                        {users.find((u) => u.id === assignTargetUserId)?.last_name}
                      </p>
                      <p className="text-[11px] text-muted font-mono">
                        {users.find((u) => u.id === assignTargetUserId)?.email}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setAssignTargetUserId('')}
                      className="rounded-xl border border-border/80 bg-surface hover:bg-foreground/[0.04] px-3 py-1 text-xs font-medium text-foreground transition-all shadow-xs"
                    >
                      Cambiar
                    </button>
                  </div>
                ) : (
                  <div>
                    <input
                      type="text"
                      placeholder="Escribe el nombre o correo del usuario para filtrar..."
                      value={assignUserModalSearch}
                      onChange={(e) => setAssignUserModalSearch(e.target.value)}
                      className="w-full rounded-xl border border-border/70 bg-foreground/[0.03] focus:bg-surface focus:border-accent px-3.5 py-2.5 text-xs text-foreground placeholder:text-muted/60 transition-all outline-none mb-2"
                    />
                    <div className="max-h-44 overflow-y-auto divide-y divide-border/40 rounded-2xl border border-border/60 bg-surface/60">
                      {matchingModalUsers.length === 0 ? (
                        <div className="p-4 text-center text-xs text-muted">
                          No se encontraron usuarios coincidentes.
                        </div>
                      ) : (
                        matchingModalUsers.map((u) => (
                          <button
                            key={u.id}
                            type="button"
                            onClick={() => {
                              setAssignTargetUserId(u.id);
                              setAssignUserModalSearch('');
                            }}
                            className="w-full text-left px-3.5 py-2.5 hover:bg-foreground/[0.03] flex items-center justify-between transition-colors text-xs"
                          >
                            <div>
                              <p className="font-semibold text-foreground">
                                {u.first_name} {u.last_name}
                              </p>
                              <p className="text-[11px] text-muted font-mono">
                                {u.email}
                              </p>
                            </div>
                            <span className="rounded-full bg-foreground/[0.05] px-2.5 py-0.5 text-[10px] text-muted font-medium">
                              {((u.active_roles || u.roles || []) as string[]).join(', ') || 'Sin rol'}
                            </span>
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-foreground mb-1.5">
                  Seleccionar Curso Vinculado a Moodle:
                </label>
                <select
                  required
                  value={assignCourseId}
                  onChange={(e) => setAssignCourseId(e.target.value)}
                  className="w-full rounded-xl border border-border/70 bg-surface focus:border-accent px-3.5 py-2.5 text-xs text-foreground transition-all outline-none"
                >
                  <option value="">-- Elige un curso --</option>
                  {courses.map((c) => {
                    const cId = c.id || (c as any).course_mapping_id;
                    return (
                      <option key={cId} value={cId}>
                        {c.portal_course_code || c.code} - {c.course_name || c.name} (Moodle #{c.moodle_course_id})
                      </option>
                    );
                  })}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-foreground mb-1.5">
                  Rol en el Aula de Moodle:
                </label>
                <select
                  value={assignMoodleRole}
                  onChange={(e) => setAssignMoodleRole(e.target.value as any)}
                  className="w-full rounded-xl border border-border/70 bg-surface focus:border-accent px-3.5 py-2.5 text-xs text-foreground transition-all outline-none"
                >
                  <option value="student">Estudiante (student)</option>
                  <option value="editingteacher">Profesor con Edición (editingteacher)</option>
                </select>
              </div>

              <div className="rounded-2xl border border-primary/20 bg-primary/5 p-3.5 text-xs text-muted leading-relaxed">
                ℹ️ Esta acción crea la autorización inmediata e invoca el Web Service oficial de Moodle (<code>enrol_manual_enrol_users</code>).
              </div>

              <div className="mt-6 flex justify-end gap-2 border-t border-border/40 pt-4">
                <button
                  type="button"
                  onClick={() => setShowAssignCourseModal(false)}
                  className="rounded-xl border border-border/80 bg-surface hover:bg-foreground/[0.04] px-4 py-2 text-xs font-medium text-foreground transition-all"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={actionLoading === 'assign-course'}
                  className="rounded-xl bg-accent hover:bg-accent-strong text-white px-5 py-2 text-xs font-medium shadow-xs transition-all active:scale-[0.98] disabled:opacity-50"
                >
                  {actionLoading === 'assign-course' ? 'Matriculando en Moodle...' : 'Asignar & Matricular'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 5: VINCULAR NUEVO CURSO MOODLE                                      */}
      {/* ========================================================================= */}
      {showCreateCourseModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-md p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-lg rounded-[28px] border border-border/80 bg-surface/95 dark:bg-surface/90 backdrop-blur-2xl p-6 sm:p-7 shadow-2xl">
            <div className="flex items-center justify-between border-b border-border/40 pb-4">
              <h3 className="text-base font-semibold tracking-tight text-foreground">Vincular Nuevo Curso con Moodle</h3>
              <button
                type="button"
                onClick={() => setShowCreateCourseModal(false)}
                className="h-8 w-8 rounded-full bg-foreground/[0.05] hover:bg-foreground/[0.1] text-foreground/70 flex items-center justify-center transition-colors text-xs"
              ><IconClose className="w-3.5 h-3.5" /></button>
            </div>

            <form onSubmit={handleCreateCourseMapping} className="mt-5 space-y-4">
              <div>
                <label className="block text-xs font-medium text-foreground mb-1.5">
                  Nombre del Curso en el Portal:
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ej: Curso 3. Inteligencia Artificial Aplicada"
                  value={newCourseName}
                  onChange={(e) => setNewCourseName(e.target.value)}
                  className="w-full rounded-xl border border-border/70 bg-foreground/[0.03] focus:bg-surface focus:border-accent px-3.5 py-2.5 text-xs text-foreground placeholder:text-muted/60 transition-all outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1.5">
                    Código en Portal:
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ej: CUR-MOO-003"
                    value={newCourseCode}
                    onChange={(e) => setNewCourseCode(e.target.value)}
                    className="w-full rounded-xl border border-border/70 bg-foreground/[0.03] focus:bg-surface focus:border-accent px-3.5 py-2.5 text-xs text-foreground placeholder:text-muted/60 transition-all outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-foreground mb-1.5">
                    Slug / URL:
                  </label>
                  <input
                    type="text"
                    placeholder="curso-3-ia"
                    value={newCourseSlug}
                    onChange={(e) => setNewCourseSlug(e.target.value)}
                    className="w-full rounded-xl border border-border/70 bg-foreground/[0.03] focus:bg-surface focus:border-accent px-3.5 py-2.5 text-xs text-foreground placeholder:text-muted/60 transition-all outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1.5">
                    ID del Curso en Moodle:
                  </label>
                  <input
                    type="number"
                    required
                    min={1}
                    placeholder="Ej: 3"
                    value={newMoodleCourseId}
                    onChange={(e) => setNewMoodleCourseId(Number(e.target.value))}
                    className="w-full rounded-xl border border-border/70 bg-foreground/[0.03] focus:bg-surface focus:border-accent px-3.5 py-2.5 text-xs text-foreground placeholder:text-muted/60 transition-all outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-foreground mb-1.5">
                    Shortname en Moodle:
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ej: INICIA-IA-103"
                    value={newMoodleShortname}
                    onChange={(e) => setNewMoodleShortname(e.target.value)}
                    className="w-full rounded-xl border border-border/70 bg-foreground/[0.03] focus:bg-surface focus:border-accent px-3.5 py-2.5 text-xs text-foreground placeholder:text-muted/60 transition-all outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-foreground mb-1.5">
                  Programa Académico Asociado:
                </label>
                <select
                  value={newCourseProgramId}
                  onChange={(e) => setNewCourseProgramId(e.target.value)}
                  className="w-full rounded-xl border border-border/70 bg-surface focus:border-accent px-3.5 py-2.5 text-xs text-foreground transition-all outline-none"
                >
                  <option value="">-- Sin programa asignado --</option>
                  {programs.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.code})
                    </option>
                  ))}
                </select>
              </div>

              <div className="mt-6 flex justify-end gap-2 border-t border-border/40 pt-4">
                <button
                  type="button"
                  onClick={() => setShowCreateCourseModal(false)}
                  className="rounded-xl border border-border/80 bg-surface hover:bg-foreground/[0.04] px-4 py-2 text-xs font-medium text-foreground transition-all"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={actionLoading === 'create-course'}
                  className="rounded-xl bg-accent hover:bg-accent-strong text-white px-5 py-2 text-xs font-medium shadow-xs transition-all active:scale-[0.98] disabled:opacity-50"
                >
                  {actionLoading === 'create-course' ? 'Guardando...' : 'Crear Vinculación'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 6: CREAR NUEVO PROGRAMA ACADÉMICO                                   */}
      {/* ========================================================================= */}
      {showCreateProgramModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-md p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-lg rounded-[28px] border border-border/80 bg-surface/95 dark:bg-surface/90 backdrop-blur-2xl p-6 sm:p-7 shadow-2xl">
            <div className="flex items-center justify-between border-b border-border/40 pb-4">
              <h3 className="text-base font-semibold tracking-tight text-foreground">Crear Programa Académico</h3>
              <button
                type="button"
                onClick={() => setShowCreateProgramModal(false)}
                className="h-8 w-8 rounded-full bg-foreground/[0.05] hover:bg-foreground/[0.1] text-foreground/70 flex items-center justify-center transition-colors text-xs"
              ><IconClose className="w-3.5 h-3.5" /></button>
            </div>

            <form onSubmit={handleCreateProgram} className="mt-5 space-y-4">
              <div>
                <label className="block text-xs font-medium text-foreground mb-1.5">Nombre del Programa:</label>
                <input
                  type="text"
                  required
                  placeholder="Ej: Licenciatura en Tecnologías de la Información"
                  value={newProgName}
                  onChange={(e) => setNewProgName(e.target.value)}
                  className="w-full rounded-xl border border-border/70 bg-foreground/[0.03] focus:bg-surface focus:border-accent px-3.5 py-2.5 text-xs text-foreground placeholder:text-muted/60 transition-all outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1.5">Código Oficial:</label>
                  <input
                    type="text"
                    required
                    placeholder="Ej: LIC-TI-2026"
                    value={newProgCode}
                    onChange={(e) => setNewProgCode(e.target.value)}
                    className="w-full rounded-xl border border-border/70 bg-foreground/[0.03] focus:bg-surface focus:border-accent px-3.5 py-2.5 text-xs text-foreground placeholder:text-muted/60 transition-all outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1.5">Slug / URL:</label>
                  <input
                    type="text"
                    placeholder="licenciatura-ti"
                    value={newProgSlug}
                    onChange={(e) => setNewProgSlug(e.target.value)}
                    className="w-full rounded-xl border border-border/70 bg-foreground/[0.03] focus:bg-surface focus:border-accent px-3.5 py-2.5 text-xs text-foreground placeholder:text-muted/60 transition-all outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1.5">Tipo de Oferta:</label>
                  <select
                    value={newProgType}
                    onChange={(e) => setNewProgType(e.target.value as any)}
                    className="w-full rounded-xl border border-border/70 bg-surface focus:border-accent px-3.5 py-2.5 text-xs text-foreground transition-all outline-none"
                  >
                    <option value="licenciatura">Licenciatura</option>
                    <option value="maestria">Maestría</option>
                    <option value="diplomado">Diplomado</option>
                    <option value="certificacion">Certificación</option>
                    <option value="curso">Curso Especializado</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1.5">Modalidad:</label>
                  <select
                    value={newProgModality}
                    onChange={(e) => setNewProgModality(e.target.value as any)}
                    className="w-full rounded-xl border border-border/70 bg-surface focus:border-accent px-3.5 py-2.5 text-xs text-foreground transition-all outline-none"
                  >
                    <option value="en_linea">En Línea (Online)</option>
                    <option value="presencial">Presencial</option>
                    <option value="hibrido">Híbrido</option>
                    <option value="autogestivo">Autogestivo</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1.5">Texto de Duración:</label>
                  <input
                    type="text"
                    placeholder="Ej: 3 años / 6 semestres"
                    value={newProgDuration}
                    onChange={(e) => setNewProgDuration(e.target.value)}
                    className="w-full rounded-xl border border-border/70 bg-foreground/[0.03] focus:bg-surface focus:border-accent px-3.5 py-2.5 text-xs text-foreground placeholder:text-muted/60 transition-all outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1.5">Total de Horas:</label>
                  <input
                    type="number"
                    min={1}
                    value={newProgHours}
                    onChange={(e) => setNewProgHours(Number(e.target.value))}
                    className="w-full rounded-xl border border-border/70 bg-foreground/[0.03] focus:bg-surface focus:border-accent px-3.5 py-2.5 text-xs text-foreground placeholder:text-muted/60 transition-all outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-foreground mb-1.5">Descripción Breve:</label>
                <textarea
                  rows={2}
                  placeholder="Síntesis del perfil de egreso y objetivos..."
                  value={newProgDesc}
                  onChange={(e) => setNewProgDesc(e.target.value)}
                  className="w-full rounded-xl border border-border/70 bg-foreground/[0.03] focus:bg-surface focus:border-accent px-3.5 py-2.5 text-xs text-foreground placeholder:text-muted/60 transition-all outline-none"
                />
              </div>

              <div className="mt-6 flex justify-end gap-2 border-t border-border/40 pt-4">
                <button
                  type="button"
                  onClick={() => setShowCreateProgramModal(false)}
                  className="rounded-xl border border-border/80 bg-surface hover:bg-foreground/[0.04] px-4 py-2 text-xs font-medium text-foreground transition-all"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={actionLoading === 'create-program'}
                  className="rounded-xl bg-accent hover:bg-accent-strong text-white px-5 py-2 text-xs font-medium shadow-xs transition-all active:scale-[0.98] disabled:opacity-50"
                >
                  {actionLoading === 'create-program' ? 'Guardando...' : 'Crear Programa'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
