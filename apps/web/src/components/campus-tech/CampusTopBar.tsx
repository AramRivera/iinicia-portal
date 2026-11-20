/** Muestra el encabezado de la sesión, los controles de tema y el acceso a la búsqueda. */
'use client';

import React from 'react';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import {
  IconSearch,
  IconSun,
  IconMoon,
  IconMenu,
  IconMoodle,
} from './Icons';

interface CampusTopBarProps {
  breadcrumbs?: string[];
  onOpenSearch?: () => void;
  onOpenNavigation: () => void;
  navigationOpen: boolean;
  onLaunchMoodleSSO?: () => void;
}

export function CampusTopBar({
  breadcrumbs = ['INICIA', 'Panel de Control'],
  onOpenSearch,
  onOpenNavigation,
  navigationOpen,
  onLaunchMoodleSSO,
}: CampusTopBarProps) {
  const { theme, toggleTheme } = useTheme();
  const { user } = useAuth();

  return (
    <header className="sticky top-[4.375rem] z-40 flex h-14 w-full items-center justify-between gap-2 border-b border-border bg-surface/95 px-3 backdrop-blur-md transition-colors sm:gap-4 sm:px-6">
      {/* Context Breadcrumbs */}
      <div className="flex min-w-0 items-center gap-2 text-xs font-medium">
        <button
          type="button"
          onClick={onOpenNavigation}
          aria-label="Abrir menú del campus"
          aria-expanded={navigationOpen}
          className="grid size-10 shrink-0 place-items-center rounded-full border border-border bg-surface-muted text-primary lg:hidden"
        >
          <IconMenu className="size-4" />
        </button>
        <div className="flex items-center gap-1.5 shrink-0">
          <span className="h-2 w-2 rounded-sm bg-accent-sky ring-2 ring-primary/20" />
          <span className="font-semibold tracking-tight text-foreground">
            {breadcrumbs[0]}
          </span>
        </div>
        {breadcrumbs.slice(1).map((crumb, idx) => (
          <React.Fragment key={idx}>
            <span className="text-muted/60">/</span>
            <span className="text-muted truncate hover:text-foreground transition-colors cursor-default">
              {crumb}
            </span>
          </React.Fragment>
        ))}
      </div>

      {/* Global Actions */}
      <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
        {/* Search Input Bar Shortcut */}
        <button
          type="button"
          onClick={onOpenSearch}
          aria-label="Buscar en mi panel"
          className="flex h-10 min-w-10 items-center justify-center gap-2.5 rounded-full border border-border bg-surface-muted/60 text-xs text-primary transition-colors hover:border-primary/50 sm:px-3"
        >
          <IconSearch className="w-3.5 h-3.5 text-muted" />
          <span className="hidden sm:inline">Buscar en mi panel</span>
          <kbd className="hidden rounded border border-border bg-surface px-1.5 py-0.5 font-mono text-[10px] text-muted lg:inline">
            Ctrl/⌘ K
          </kbd>
        </button>

        {/* Moodle Quick SSO Action */}
        {onLaunchMoodleSSO && (
          <button
            type="button"
            onClick={onLaunchMoodleSSO}
            aria-label="Abrir aula Moodle"
            className="flex h-10 min-w-10 items-center justify-center gap-1.5 rounded-full bg-primary-action text-xs font-semibold text-white shadow-minimal transition-colors hover:bg-accent-strong sm:px-3"
            title="Abrir Moodle LMS con sesión iniciada (auth_userkey)"
          >
            <IconMoodle className="w-3.5 h-3.5 text-accent-sky" />
            <span className="hidden sm:inline">Aula Moodle</span>
          </button>
        )}

        {/* Theme Switcher Button */}
        <button
          type="button"
          onClick={toggleTheme}
          className="grid size-10 place-items-center rounded-full border border-border bg-surface text-foreground transition-colors hover:bg-surface-muted"
          title={theme === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
          aria-label="Alternar tema"
        >
          {theme === 'dark' ? (
            <IconSun className="w-4 h-4 text-warning" />
          ) : (
            <IconMoon className="w-4 h-4 text-primary" />
          )}
        </button>

        {/* User Avatar Chip */}
        {user && (
          <div className="hidden items-center gap-2 border-l border-border pl-2 sm:flex">
            <div className="h-7 w-7 rounded-[6px] bg-primary/10 border border-primary/20 flex items-center justify-center font-semibold text-primary text-xs">
              {(user.first_name || 'U')[0]}
            </div>
            <div className="hidden lg:block text-left text-xs leading-none">
              <p className="font-semibold text-foreground truncate max-w-[110px]">
                {user.first_name} {user.last_name}
              </p>
              <p className="text-[10px] text-muted capitalize mt-0.5">
                {user.roles?.[0] || 'Usuario'}
              </p>
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
