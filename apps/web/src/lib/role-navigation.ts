import type { RoleSlug } from '@/types';

export type RoleDashboard = { role: RoleSlug; label: string; href: string };

const roleDashboards: RoleDashboard[] = [
  { role: 'superadministrador', label: 'Superadministración', href: '/dashboard/admin' },
  { role: 'administrador', label: 'Administración', href: '/dashboard/admin' },
  { role: 'coordinador', label: 'Coordinación', href: '/dashboard/coordinador' },
  { role: 'profesor', label: 'Docencia', href: '/dashboard/docente' },
  { role: 'estudiante', label: 'Estudiante', href: '/dashboard/estudiante' },
  { role: 'soporte', label: 'Soporte', href: '/dashboard/soporte' },
  { role: 'aspirante', label: 'Aspirante', href: '/dashboard/aspirante' },
];

export function getRoleDashboards(roles: RoleSlug[]): RoleDashboard[] {
  const available = new Set(roles);
  const paths = new Set<string>();
  return roleDashboards.filter(({ role, href }) => {
    if (!available.has(role) || paths.has(href)) return false;
    paths.add(href);
    return true;
  });
}

export function getDashboardForPath(roles: RoleSlug[], pathname: string): RoleDashboard | undefined {
  return getRoleDashboards(roles).find(({ href }) => pathname === href || pathname.startsWith(`${href}/`));
}
