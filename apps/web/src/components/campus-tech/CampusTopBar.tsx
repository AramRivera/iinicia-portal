'use client';

import React from 'react';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import {
  IconSearch,
  IconSun,
  IconMoon,
  IconAnnouncements,
  IconHelp,
  IconMoodle,
} from './Icons';

interface CampusTopBarProps {
  breadcrumbs?: string[];
  onOpenSearch?: () => void;
  onLaunchMoodleSSO?: () => void;
  moodleActive?: boolean;
}

export function CampusTopBar({
  breadcrumbs = ['IINICIA', 'Panel de Control'],
  onOpenSearch,
  onLaunchMoodleSSO,
  moodleActive = true,
}: CampusTopBarProps) {
  const { theme, toggleTheme } = useTheme();
  const { user } = useAuth();

  return (
    <header className="sticky top-0 z-40 h-14 w-full border-b border-border bg-surface/90 backdrop-blur-md px-4 sm:px-6 flex items-center justify-between gap-4 transition-colors">
      {/* Context Breadcrumbs */}
      <div className="flex items-center gap-2 text-xs font-medium min-w-0">
        <div className="flex items-center gap-1.5 shrink-0">
          <span className="h-2 w-2 rounded-sm bg-accent-lime ring-2 ring-primary/20" />
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
      <div className="flex items-center gap-2 shrink-0">
        {/* Search Input Bar Shortcut */}
        <button
          type="button"
          onClick={onOpenSearch}
          className="hidden md:flex items-center gap-2.5 rounded-[6px] border border-border bg-surface-muted/60 px-3 py-1.5 text-xs text-muted hover:border-primary/50 hover:text-foreground transition-all"
        >
          <IconSearch className="w-3.5 h-3.5 text-muted" />
          <span>Buscar estudiante, curso o ID...</span>
          <kbd className="rounded border border-border bg-surface px-1.5 py-0.5 font-mono text-[10px] text-muted">
            ⌘K
          </kbd>
        </button>

        {/* Moodle Quick SSO Action */}
        {onLaunchMoodleSSO && (
          <button
            type="button"
            onClick={onLaunchMoodleSSO}
            className="flex items-center gap-1.5 rounded-[6px] bg-primary-action text-white hover:bg-primary-action/90 px-2.5 py-1.5 text-xs font-medium transition-all shadow-minimal"
            title="Abrir Moodle LMS con sesión iniciada (auth_userkey)"
          >
            <IconMoodle className="w-3.5 h-3.5 text-accent-lime" />
            <span className="hidden sm:inline">Aula Moodle</span>
          </button>
        )}

        {/* Theme Switcher Button */}
        <button
          type="button"
          onClick={toggleTheme}
          className="h-8 w-8 rounded-[6px] border border-border bg-surface hover:bg-surface-muted text-foreground flex items-center justify-center transition-all"
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
          <div className="flex items-center gap-2 pl-1 border-l border-border">
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
