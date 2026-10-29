'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { coursesApi, usersApi } from '@/lib/api';
import type { CourseOffering, RoleSlug, UserProfile } from '@/types';
import { CampusShell } from '@/components/campus-tech/CampusShell';
import type { SidebarSection } from '@/components/campus-tech/CampusSidebar';
import { IconDashboard, IconGroups, IconSettings } from '@/components/campus-tech/Icons';

type Props = { role: Extract<RoleSlug, 'coordinador' | 'soporte'> };

export function RoleWorkspace({ role }: Props) {
  const router = useRouter();
  const { user, loading } = useAuth();
  const [courses, setCourses] = useState<CourseOffering[]>([]);
  const [coursesError, setCoursesError] = useState<string | null>(null);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [search, setSearch] = useState('');
  const [directoryError, setDirectoryError] = useState<string | null>(null);
  const isCoordinator = role === 'coordinador';
  const title = isCoordinator ? 'Coordinación académica' : 'Soporte';

  useEffect(() => {
    if (loading) return;
    if (!user) { router.replace('/login'); return; }
    if (!user.roles.includes(role) && !user.roles.includes('superadministrador')) {
      router.replace('/dashboard');
      return;
    }
    if (!isCoordinator) return;
    coursesApi.getOfferings()
      .then(setCourses)
      .catch(() => setCoursesError('No fue posible cargar el catálogo de cursos.'));
  }, [loading, user, role, isCoordinator, router]);

  useEffect(() => {
    if (loading || !user || isCoordinator || !user.permissions?.includes('users.read')) return;
    usersApi.getUsers({ search: search.trim() || undefined, limit: 20 })
      .then((result) => { setUsers(result.data); setDirectoryError(null); })
      .catch(() => setDirectoryError('No fue posible consultar el directorio.'));
  }, [loading, user, isCoordinator, search]);

  if (loading || !user || (!user.roles.includes(role) && !user.roles.includes('superadministrador'))) {
    return <div className="grid min-h-[60vh] place-items-center text-sm text-muted">Verificando acceso...</div>;
  }

  const sections: SidebarSection[] = [{
    title: title,
    items: [{ id: 'resumen', label: 'Mi espacio', icon: <IconDashboard className="h-4 w-4" /> }],
  }];
  if (isCoordinator) {
    sections[0].items.push({ id: 'cursos', label: 'Catálogo de cursos', icon: <IconGroups className="h-4 w-4" /> });
  } else if (user.permissions?.includes('users.read')) {
    sections[0].items.push({ id: 'directorio', label: 'Directorio', icon: <IconGroups className="h-4 w-4" /> });
  }
  sections[0].items.push({ id: 'perfil', label: 'Mi perfil', icon: <IconSettings className="h-4 w-4" /> });

  return (
    <CampusShell currentTab="resumen" onSelectTab={(tab) => document.getElementById(tab)?.scrollIntoView({ behavior: 'smooth' })} breadcrumbs={['INICIA', title]} customSections={sections}>
      <div id="resumen" className="mx-auto max-w-5xl space-y-6">
        <header className="rounded-xl border border-border bg-surface p-6 shadow-minimal">
          <p className="text-xs font-semibold uppercase tracking-wide text-primary">Panel de {title.toLowerCase()}</p>
          <h1 className="mt-2 text-2xl font-bold text-foreground">Hola, {user.first_name}</h1>
          <p className="mt-2 text-sm text-muted">Tu acceso se muestra según los permisos asignados a tu cuenta.</p>
        </header>

        {isCoordinator && (
          <section id="cursos" className="rounded-xl border border-border bg-surface p-6 shadow-minimal">
            <h2 className="text-lg font-semibold text-foreground">Catálogo de cursos</h2>
            {coursesError ? <p className="mt-3 text-sm text-danger">{coursesError}</p> : courses.length ? (
              <ul className="mt-4 grid gap-3 sm:grid-cols-2">
                {courses.map((course) => <li key={course.course_mapping_id} className="rounded-lg border border-border bg-surface-muted/40 p-4 text-sm text-foreground">{course.name}</li>)}
              </ul>
            ) : <p className="mt-3 text-sm text-muted">Todavía no hay cursos publicados.</p>}
          </section>
        )}

        {!isCoordinator && user.permissions?.includes('users.read') && (
          <section id="directorio" className="rounded-xl border border-border bg-surface p-6 shadow-minimal">
            <h2 className="text-lg font-semibold text-foreground">Directorio de usuarios</h2>
            <label className="mt-4 block text-sm text-muted">Buscar por nombre o correo
              <input value={search} onChange={(event) => setSearch(event.target.value)} className="mt-1 w-full rounded-md border border-border bg-surface px-3 py-2 text-foreground" />
            </label>
            {directoryError ? <p className="mt-3 text-sm text-danger">{directoryError}</p> : (
              <ul className="mt-4 divide-y divide-border text-sm">
                {users.map((person) => <li key={person.id} className="flex flex-wrap justify-between gap-2 py-3"><span className="font-medium">{person.first_name} {person.last_name}</span><span className="text-muted">{person.email}</span></li>)}
                {users.length === 0 && <li className="py-3 text-muted">No hay resultados.</li>}
              </ul>
            )}
          </section>
        )}

        <section id="perfil" className="rounded-xl border border-border bg-surface p-6 shadow-minimal">
          <h2 className="text-lg font-semibold text-foreground">Mi perfil</h2>
          <dl className="mt-4 grid gap-4 text-sm sm:grid-cols-2">
            <div><dt className="text-muted">Nombre</dt><dd className="font-medium text-foreground">{user.first_name} {user.last_name}</dd></div>
            <div><dt className="text-muted">Correo</dt><dd className="font-medium text-foreground">{user.email}</dd></div>
            <div><dt className="text-muted">Estado</dt><dd className="font-medium capitalize text-foreground">{user.status}</dd></div>
            <div><dt className="text-muted">Rol</dt><dd className="font-medium capitalize text-foreground">{title}</dd></div>
          </dl>
        </section>
      </div>
    </CampusShell>
  );
}
