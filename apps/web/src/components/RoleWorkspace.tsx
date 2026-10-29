'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { coursesApi, moodleApi, usersApi } from '@/lib/api';
import type { CourseOffering, RoleSlug, UserProfile, UserStatus } from '@/types';
import { CampusShell } from '@/components/campus-tech/CampusShell';
import type { SidebarSection } from '@/components/campus-tech/CampusSidebar';
import { IconDashboard, IconGroups, IconSettings } from '@/components/campus-tech/Icons';

type Props = { role: Extract<RoleSlug, 'coordinador' | 'soporte'> };

const roleLabels: Record<string, string> = {
  superadministrador: 'Superadministrador',
  administrador: 'Administrador',
  coordinador: 'Coordinador',
  profesor: 'Profesor',
  estudiante: 'Estudiante',
  aspirante: 'Aspirante',
  soporte: 'Soporte',
};

const statusLabels: Record<UserStatus, string> = {
  activo: 'Activo',
  inactivo: 'Inactivo',
  suspendido: 'Suspendido',
  pendiente: 'Pendiente',
  baja: 'Baja',
};

export function RoleWorkspace({ role }: Props) {
  const router = useRouter();
  const { user, loading } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [courses, setCourses] = useState<CourseOffering[]>([]);
  const [coursesError, setCoursesError] = useState<string | null>(null);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [usersError, setUsersError] = useState<string | null>(null);
  const [hasMoreUsers, setHasMoreUsers] = useState(false);
  const [moodleStatus, setMoodleStatus] = useState<{ ok: boolean; message: string } | null>(null);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const isCoordinator = role === 'coordinador';
  const title = isCoordinator ? 'Coordinación académica' : 'Soporte';
  const canReadUsers = Boolean(user?.permissions?.includes('users.read'));
  const userPrograms = profile?.programs ?? [];

  useEffect(() => {
    if (loading) return;
    if (!user) { router.replace('/login'); return; }
    if (!user.roles.includes(role) && !user.roles.includes('superadministrador')) {
      router.replace('/dashboard');
      return;
    }

    usersApi.getUserById(user.id).then(setProfile).catch(() => setProfile(null));

    if (isCoordinator) {
      coursesApi.getOfferings()
        .then(setCourses)
        .catch(() => setCoursesError('No fue posible cargar el catálogo de cursos.'));
    } else {
      moodleApi.getStatus().then(setMoodleStatus).catch(() => setMoodleStatus({ ok: false, message: 'No fue posible consultar Moodle.' }));
    }
  }, [loading, user, role, isCoordinator, router]);

  useEffect(() => {
    if (loading || !user || !canReadUsers) return;
    usersApi.getUsers({
      search: search.trim() || undefined,
      role: roleFilter || undefined,
      status: statusFilter || undefined,
      limit: 50,
    })
      .then((result) => {
        setUsers(result.data);
        setHasMoreUsers(Boolean(result.meta?.hasMore));
        setUsersError(null);
      })
      .catch(() => setUsersError('No fue posible consultar el directorio autorizado para tu cuenta.'));
  }, [loading, user, canReadUsers, search, roleFilter, statusFilter]);

  const scopedCourses = useMemo(() => {
    if (!isCoordinator || userPrograms.length === 0) return [];
    const programIds = new Set(userPrograms.map((program) => program.program_id));
    return courses.filter((course) => course.program_id && programIds.has(course.program_id));
  }, [courses, isCoordinator, userPrograms]);

  if (loading || !user || (!user.roles.includes(role) && !user.roles.includes('superadministrador'))) {
    return <div className="grid min-h-[60vh] place-items-center text-sm text-muted">Verificando acceso…</div>;
  }

  const directoryId = isCoordinator ? 'usuarios' : 'directorio';
  const sections: SidebarSection[] = [{
    title,
    items: [
      { id: 'resumen', label: 'Resumen', icon: <IconDashboard className="h-4 w-4" /> },
      ...(isCoordinator ? [
        { id: 'programas', label: 'Mis programas', icon: <IconGroups className="h-4 w-4" /> },
        { id: 'cursos', label: 'Cursos asignados', icon: <IconGroups className="h-4 w-4" /> },
      ] : [
        { id: 'moodle', label: 'Estado de Moodle', icon: <IconDashboard className="h-4 w-4" /> },
      ]),
      ...(canReadUsers ? [{ id: directoryId, label: isCoordinator ? 'Usuarios del ámbito' : 'Directorio y cuentas', icon: <IconGroups className="h-4 w-4" /> }] : []),
      { id: 'perfil', label: 'Mi perfil', icon: <IconSettings className="h-4 w-4" /> },
    ],
  }];

  const directorySection = (
    <section id={directoryId} className="scroll-mt-20 rounded-xl border border-border bg-surface p-5 shadow-minimal sm:p-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-primary">{isCoordinator ? 'Consulta académica' : 'Atención de cuentas'}</p>
        <h2 className="mt-1 text-lg font-semibold text-foreground">{isCoordinator ? 'Usuarios del ámbito autorizado' : 'Directorio y estado de cuenta'}</h2>
        <p className="mt-1 text-sm text-muted">La API determina qué registros puede consultar tu cuenta. Esta vista no asigna roles ni cambia estados.</p>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_12rem_12rem]">
        <label className="text-xs font-medium text-muted">Buscar usuario
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Nombre o correo" className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground" />
        </label>
        <label className="text-xs font-medium text-muted">Rol
          <select value={roleFilter} onChange={(event) => setRoleFilter(event.target.value)} className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground">
            <option value="">Todos</option>
            <option value="estudiante">Estudiante</option>
            <option value="profesor">Profesor</option>
            <option value="aspirante">Aspirante</option>
            <option value="coordinador">Coordinador</option>
          </select>
        </label>
        <label className="text-xs font-medium text-muted">Estado
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground">
            <option value="">Todos</option>
            {Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
      </div>
      {usersError ? <p className="mt-4 text-sm text-danger">{usersError}</p> : (
        <div className="mt-4 overflow-x-auto rounded-lg border border-border">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="bg-surface-muted text-xs uppercase text-muted"><tr><th className="px-3 py-3">Usuario</th><th className="px-3 py-3">Rol</th><th className="px-3 py-3">Programa</th><th className="px-3 py-3">Estado</th><th className="px-3 py-3">Moodle</th><th className="px-3 py-3">Alta</th></tr></thead>
            <tbody className="divide-y divide-border">
              {users.map((person) => (
                <tr key={person.id} className="align-top">
                  <td className="px-3 py-3"><span className="font-medium text-foreground">{person.first_name} {person.last_name}</span><span className="block text-xs text-muted">{person.email}</span></td>
                  <td className="px-3 py-3 text-foreground">{(person.active_roles || person.roles).map((item) => roleLabels[item] || item).join(', ') || 'Sin rol'}</td>
                  <td className="px-3 py-3 text-foreground">{person.programs?.map((program) => program.name).join(', ') || 'Sin programa'}</td>
                  <td className="px-3 py-3"><span className="rounded-full bg-surface-muted px-2 py-1 text-xs text-foreground">{statusLabels[person.status] || person.status}</span></td>
                  <td className="px-3 py-3"><span className={`rounded-full px-2 py-1 text-xs ${person.moodle_sync_status === 'sincronizado' ? 'bg-success/10 text-success' : 'bg-warning/10 text-warning'}`}>{person.moodle_sync_status || 'No vinculado'}</span>{person.moodle_last_sync_at && <span className="mt-1 block text-[11px] text-muted">{new Date(person.moodle_last_sync_at).toLocaleDateString('es-MX')}</span>}</td>
                  <td className="px-3 py-3 text-muted">{person.created_at ? new Date(person.created_at).toLocaleDateString('es-MX') : '—'}</td>
                </tr>
              ))}
              {users.length === 0 && <tr><td colSpan={6} className="px-3 py-8 text-center text-sm text-muted">No se encontraron usuarios para esos filtros.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
      {hasMoreUsers && <p className="mt-3 text-xs text-muted">Se muestran los primeros 50 resultados. Refina la búsqueda para encontrar otra cuenta.</p>}
    </section>
  );

  return (
    <CampusShell currentTab="resumen" onSelectTab={(tab) => document.getElementById(tab)?.scrollIntoView({ behavior: 'smooth' })} breadcrumbs={['INICIA', title]} customSections={sections}>
      <div className="mx-auto max-w-6xl space-y-6">
        <header id="resumen" className="scroll-mt-20 rounded-xl border border-border bg-surface p-6 shadow-minimal">
          <p className="text-xs font-semibold uppercase tracking-wide text-primary">Panel de {title.toLowerCase()}</p>
          <h1 className="mt-2 text-2xl font-bold text-foreground">Hola, {user.first_name}</h1>
          <p className="mt-2 max-w-3xl text-sm text-muted">{isCoordinator ? 'Consulta los programas, cursos y usuarios que la API habilita para tu cuenta.' : 'Revisa la vinculación de cuentas y el estado del campus con las herramientas de consulta disponibles para soporte.'}</p>
        </header>

        {isCoordinator ? (
          <>
            <section id="programas" className="scroll-mt-20 rounded-xl border border-border bg-surface p-5 shadow-minimal sm:p-6">
              <h2 className="text-lg font-semibold text-foreground">Programas asociados a tu perfil</h2>
              {userPrograms.length ? <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{userPrograms.map((program) => <article key={program.program_id} className="rounded-lg border border-border bg-surface-muted/30 p-4"><p className="font-mono text-xs text-primary">{program.code} · {program.academic_status}</p><h3 className="mt-2 font-semibold text-foreground">{program.name}</h3><p className="mt-1 text-xs text-muted">Cohorte: {program.cohort || 'No especificada'}</p></article>)}</div> : <p className="mt-3 rounded-lg bg-surface-muted/40 p-4 text-sm text-muted">Tu perfil no contiene asociaciones a programas. Solicita al administrador que revise la asignación de ámbito.</p>}
            </section>

            <section id="cursos" className="scroll-mt-20 rounded-xl border border-border bg-surface p-5 shadow-minimal sm:p-6">
              <h2 className="text-lg font-semibold text-foreground">Cursos vinculados a tus programas</h2>
              {coursesError ? <p className="mt-3 text-sm text-danger">{coursesError}</p> : scopedCourses.length ? <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{scopedCourses.map((course) => <li key={course.course_mapping_id} className="rounded-lg border border-border bg-surface-muted/30 p-4"><p className="font-mono text-xs text-primary">{course.code}</p><p className="mt-1 font-medium text-foreground">{course.name}</p><p className="mt-1 text-xs text-muted">{course.program_name} · Moodle #{course.moodle_course_id}</p></li>)}</ul> : <p className="mt-3 rounded-lg bg-surface-muted/40 p-4 text-sm text-muted">No hay cursos visibles dentro de los programas asociados a tu perfil.</p>}
            </section>
          </>
        ) : (
          <section id="moodle" className="scroll-mt-20 rounded-xl border border-border bg-surface p-5 shadow-minimal sm:p-6">
            <p className="text-xs font-semibold uppercase tracking-wide text-primary">Integración del campus</p>
            <h2 className="mt-1 text-lg font-semibold text-foreground">Estado de Moodle</h2>
            <div className="mt-4 flex flex-wrap items-center gap-3 rounded-lg bg-surface-muted/40 p-4">
              <span className={`h-3 w-3 rounded-full ${moodleStatus?.ok ? 'bg-success' : 'bg-danger'}`} />
              <span className="font-medium text-foreground">{moodleStatus ? (moodleStatus.ok ? 'Conectado' : 'No disponible') : 'Consultando…'}</span>
              {moodleStatus?.message && <span className="text-sm text-muted">{moodleStatus.message}</span>}
            </div>
          </section>
        )}

        {canReadUsers ? directorySection : <section className="rounded-xl border border-border bg-surface p-5"><h2 className="font-semibold text-foreground">Directorio no habilitado</h2><p className="mt-2 text-sm text-muted">Tu cuenta no tiene el permiso `users.read`; el portal no consultará ni mostrará datos de otros usuarios.</p></section>}

        <section id="perfil" className="scroll-mt-20 rounded-xl border border-border bg-surface p-5 shadow-minimal sm:p-6">
          <h2 className="text-lg font-semibold text-foreground">Mi perfil</h2>
          <dl className="mt-4 grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
            <div><dt className="text-muted">Nombre</dt><dd className="font-medium text-foreground">{user.first_name} {user.last_name}</dd></div>
            <div><dt className="text-muted">Correo</dt><dd className="font-medium text-foreground">{user.email}</dd></div>
            <div><dt className="text-muted">Estado</dt><dd className="font-medium capitalize text-foreground">{statusLabels[user.status] || user.status}</dd></div>
            <div><dt className="text-muted">Programas asociados</dt><dd className="font-medium text-foreground">{userPrograms.map((program) => program.name).join(', ') || 'Sin programa'}</dd></div>
          </dl>
        </section>
      </div>
    </CampusShell>
  );
}
