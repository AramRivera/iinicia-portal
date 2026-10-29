'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { BrandWordmark } from '@/components/BrandWordmark';
import {
  IconDashboard,
  IconStudents,
  IconTeachers,
  IconGroups,
  IconSchedule,
  IconAttendance,
  IconGrades,
  IconReports,
  IconAnnouncements,
  IconSettings,
  IconMoodle,
  IconAudit,
  IconMenu,
  IconClose,
  IconChevronLeft,
  IconChevronRight,
} from './Icons';

export interface SidebarItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  badge?: number | string;
  href?: string;
  onClick?: () => void;
}

export interface SidebarSection {
  title: string;
  items: SidebarItem[];
}

interface CampusSidebarProps {
  currentTab: string;
  onSelectTab: (tabId: string) => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
  counts?: {
    users?: number;
    courses?: number;
    enrollments?: number;
    programs?: number;
    audit?: number;
  };
  onLaunchCampusSSO?: () => void;
  customSections?: SidebarSection[];
}

export function CampusSidebar({
  currentTab,
  onSelectTab,
  collapsed,
  onToggleCollapse,
  mobileOpen,
  onCloseMobile,
  counts = {},
  onLaunchCampusSSO,
  customSections,
}: CampusSidebarProps) {
  const { user, logout } = useAuth();
  const router = useRouter();

  const userRoles = (user?.roles || []) as string[];
  const isSuperOrAdmin = userRoles.some((r) =>
    ['superadministrador', 'superadmin', 'administrador', 'admin', 'coordinador', 'coordinator'].includes(r)
  );
  const isTeacher = !isSuperOrAdmin && userRoles.some((r) => ['profesor', 'teacher', 'docente'].includes(r));
  const isStudent = !isSuperOrAdmin && userRoles.some((r) => ['estudiante', 'student', 'alumno'].includes(r));
  const isApplicant = !isSuperOrAdmin && !isStudent && userRoles.some((r) => ['aspirante', 'applicant'].includes(r));

  const defaultRoleSections: SidebarSection[] = isTeacher
    ? [
        {
          title: 'Docencia',
          items: [
            {
              id: 'materias',
              label: 'Mis Asignaturas',
              icon: <IconGroups className="w-4 h-4 shrink-0" />,
              badge: counts.courses,
            },
            {
              id: 'estudiantes',
              label: 'Alumnos y Grupos',
              icon: <IconStudents className="w-4 h-4 shrink-0" />,
            },
            {
              id: 'calificaciones',
              label: 'Actas y Evaluaciones',
              icon: <IconGrades className="w-4 h-4 shrink-0" />,
            },
          ],
        },
        {
          title: 'Plataforma',
          items: [
            {
              id: 'moodle',
              label: 'Aula Virtual Moodle',
              icon: <IconMoodle className="w-4 h-4 shrink-0" />,
              onClick: onLaunchCampusSSO,
            },
            {
              id: 'perfil',
              label: 'Perfil y Credenciales',
              icon: <IconSettings className="w-4 h-4 shrink-0" />,
            },
          ],
        },
      ]
    : isStudent
    ? [
        {
          title: 'Mi Aula',
          items: [
            {
              id: 'cursos',
              label: 'Materias Activas',
              icon: <IconGroups className="w-4 h-4 shrink-0" />,
              href: '/dashboard/estudiante',
              badge: counts.courses,
            },
            {
              id: 'inscripciones',
              label: 'Catálogo e Inscripción',
              icon: <IconStudents className="w-4 h-4 shrink-0" />,
            },
            {
              id: 'calificaciones',
              label: 'Kárdex y Avance',
              icon: <IconGrades className="w-4 h-4 shrink-0" />,
            },
          ],
        },
        {
          title: 'Campus Virtual',
          items: [
            {
              id: 'moodle',
              label: 'Aula Virtual Moodle',
              icon: <IconMoodle className="w-4 h-4 shrink-0" />,
              onClick: onLaunchCampusSSO,
            },
            {
              id: 'perfil',
              label: 'Expediente y Perfil',
              icon: <IconSettings className="w-4 h-4 shrink-0" />,
            },
          ],
        },
      ]
    : isApplicant
    ? [
        {
          title: 'Admisiones',
          items: [
            {
              id: 'ofertas',
              label: 'Oferta Académica',
              icon: <IconGroups className="w-4 h-4 shrink-0" />,
              href: '/dashboard/aspirante',
            },
            {
              id: 'solicitudes',
              label: 'Mis Trámites',
              icon: <IconAttendance className="w-4 h-4 shrink-0" />,
              badge: counts.enrollments,
            },
          ],
        },
      ]
    : [
        {
          title: 'Academia & Operación',
          items: [
            {
              id: 'asignaciones',
              label: 'Asignaciones & Cursos',
              icon: <IconDashboard className="w-4 h-4 shrink-0" />,
              badge: counts.users,
            },
            {
              id: 'usuarios',
              label: 'Directorio Estudiantes',
              icon: <IconStudents className="w-4 h-4 shrink-0" />,
              badge: counts.users,
            },
            {
              id: 'docentes',
              label: 'Cuerpo Docente',
              icon: <IconTeachers className="w-4 h-4 shrink-0" />,
            },
            {
              id: 'cursos',
              label: 'Grupos y Asignaturas',
              icon: <IconGroups className="w-4 h-4 shrink-0" />,
              badge: counts.courses,
            },
            {
              id: 'matriculas',
              label: 'Solicitudes y Matrículas',
              icon: <IconAttendance className="w-4 h-4 shrink-0" />,
              badge: counts.enrollments,
            },
            {
              id: 'admisiones',
              label: 'Postulaciones',
              icon: <IconAttendance className="w-4 h-4 shrink-0" />,
            },
            {
              id: 'programas',
              label: 'Programas Académicos',
              icon: <IconGrades className="w-4 h-4 shrink-0" />,
              badge: counts.programs,
            },
          ],
        },
        {
          title: 'Sistemas & Gestión',
          items: [
            {
              id: 'moodle',
              label: 'Integración Moodle LMS',
              icon: <IconMoodle className="w-4 h-4 shrink-0" />,
            },
            {
              id: 'auditoria',
              label: 'Bitácora & Reportes',
              icon: <IconAudit className="w-4 h-4 shrink-0" />,
              badge: counts.audit,
            },
            {
              id: 'configuracion',
              label: 'Configuración OS',
              icon: <IconSettings className="w-4 h-4 shrink-0" />,
            },
          ],
        },
      ];

  const navigationSections = customSections || defaultRoleSections;

  const renderNavList = () => (
    <div className="space-y-4 py-2">
      {navigationSections.map((sec, secIdx) => (
        <div key={secIdx} className="space-y-1">
          {!collapsed && (
            <p className="px-3 text-[10px] font-semibold uppercase tracking-wider text-muted/70">
              {sec.title}
            </p>
          )}
          {sec.items.map((item) => {
            const isActive = currentTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  if (item.href) router.push(item.href);
                  else if (item.onClick) item.onClick();
                  else onSelectTab(item.id);
                  onCloseMobile();
                }}
                className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium rounded-[6px] transition-all text-left group relative ${
                  isActive
                    ? 'bg-primary-action text-white shadow-minimal font-semibold'
                    : 'text-foreground/80 hover:bg-surface-muted hover:text-foreground'
                } ${collapsed ? 'justify-center px-0' : ''}`}
                title={item.label}
              >
                {/* Active Indicator Accent Line */}
                {isActive && (
                  <span className="absolute left-0 top-1/2 -translate-y-1/2 h-4 w-1 rounded-r bg-accent-lime" />
                )}
                <span>{item.icon}</span>
                {!collapsed && (
                  <>
                    <span className="truncate flex-1">{item.label}</span>
                    {item.badge !== undefined && item.badge !== 0 && (
                      <span
                        className={`rounded-[4px] px-1.5 py-0.5 text-[10px] font-mono font-semibold ${
                          isActive
                            ? 'bg-white/20 text-white'
                            : 'bg-surface-muted text-muted'
                        }`}
                      >
                        {item.badge}
                      </span>
                    )}
                  </>
                )}
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );

  return (
    <>
      {/* DESKTOP SIDEBAR */}
      <aside
        className={`hidden lg:flex flex-col shrink-0 border-r border-border bg-surface transition-all duration-200 sticky top-14 h-[calc(100vh-3.5rem)] z-30 ${
          collapsed ? 'w-16' : 'w-64'
        }`}
      >
        {/* Sidebar Header Brand */}
        <div className="h-13 border-b border-border flex items-center justify-between px-3.5 shrink-0">
          {!collapsed ? (
            <div className="flex items-center gap-2 min-w-0">
              <div className="leading-none truncate">
                <BrandWordmark className="text-[16px] text-foreground" />
                <span className="text-[10px] text-muted">
                  Portal Académico
                </span>
              </div>
            </div>
          ) : (
            <div className="mx-auto h-7 w-7 rounded-[6px] bg-primary-action flex items-center justify-center text-accent-lime">
              <span className="relative pt-1 text-[16px] font-black leading-none">I<sup className="absolute -top-1 left-0 text-[8px]">2</sup></span>
            </div>
          )}

          <button
            type="button"
            onClick={onToggleCollapse}
            className="h-6 w-6 rounded-[4px] border border-border/80 bg-surface-muted hover:bg-border text-muted hover:text-foreground flex items-center justify-center transition-colors"
            title={collapsed ? 'Expandir menú lateral' : 'Colapsar menú lateral'}
          >
            {collapsed ? (
              <IconChevronRight className="w-3.5 h-3.5" />
            ) : (
              <IconChevronLeft className="w-3.5 h-3.5" />
            )}
          </button>
        </div>

        {/* Navigation list */}
        <div className="flex-1 overflow-y-auto px-2 pt-2">
          {renderNavList()}
        </div>

        {/* Sidebar Footer User & SSO shortcut */}
        <div className="border-t border-border p-2.5 shrink-0 space-y-2">
          {!collapsed && onLaunchCampusSSO && (
            <button
              type="button"
              onClick={onLaunchCampusSSO}
              className="w-full flex items-center justify-center gap-1.5 rounded-[6px] border border-primary/30 bg-primary/5 hover:bg-primary/10 text-primary px-3 py-1.5 text-xs font-semibold transition-all"
            >
              <IconMoodle className="w-3.5 h-3.5" />
              <span>Campus Virtual SSO</span>
            </button>
          )}

          <div
            className={`flex items-center justify-between rounded-[6px] border border-border/80 bg-surface-muted/40 p-2 ${
              collapsed ? 'justify-center p-1' : ''
            }`}
          >
            {!collapsed ? (
              <>
                <div className="flex items-center gap-2 min-w-0">
                  <div className="h-6 w-6 rounded-[4px] bg-primary/15 text-primary text-[11px] font-bold flex items-center justify-center shrink-0">
                    {(user?.first_name || 'U')[0]}
                  </div>
                  <div className="truncate text-[11px] leading-tight">
                    <p className="font-semibold text-foreground truncate">
                      {user?.first_name} {user?.last_name}
                    </p>
                    <p className="text-[10px] text-muted truncate">{user?.email}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={logout}
                  className="text-xs text-muted hover:text-danger p-1"
                  title="Cerrar sesión"
                >
                  <IconClose className="w-3.5 h-3.5" />
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={logout}
                className="h-6 w-6 text-muted hover:text-danger text-xs flex items-center justify-center"
                title="Cerrar sesión"
              >
                <IconClose className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </aside>

      {/* MOBILE DRAWER */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-xs transition-opacity"
            onClick={onCloseMobile}
          />
          <aside className="fixed inset-y-0 left-0 z-50 w-72 bg-surface border-r border-border p-4 shadow-2xl flex flex-col justify-between animate-in slide-in-from-left duration-200">
            <div className="space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-border">
                <div className="flex items-center gap-2">
                  <BrandWordmark className="text-[16px] text-foreground" />
                </div>
                <button
                  type="button"
                  onClick={onCloseMobile}
                  className="h-7 w-7 rounded-[6px] border border-border text-muted hover:text-foreground flex items-center justify-center"
                >
                  <IconClose className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="overflow-y-auto max-h-[70vh]">
                {renderNavList()}
              </div>
            </div>

            <div className="pt-3 border-t border-border">
              {onLaunchCampusSSO && (
                <button
                  type="button"
                  onClick={() => {
                    onCloseMobile();
                    onLaunchCampusSSO();
                  }}
                  className="w-full flex items-center justify-center gap-1.5 rounded-[6px] bg-primary-action text-white px-3 py-2 text-xs font-semibold mb-2"
                >
                  <IconMoodle className="w-4 h-4 text-accent-lime" />
                  <span>Entrar al Aula Moodle SSO</span>
                </button>
              )}
              <button
                type="button"
                onClick={logout}
                className="w-full rounded-[6px] border border-border bg-surface-muted text-foreground px-3 py-1.5 text-xs font-medium"
              >
                Cerrar Sesión
              </button>
            </div>
          </aside>
        </div>
      )}
    </>
  );
}
