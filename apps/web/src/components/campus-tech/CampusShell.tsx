// IINICIA Portal · interfaz del campus · CampusShell.tsx
/** Organiza los paneles del campus alrededor de una barra superior y un menú adaptable. */
'use client';

import React, { useState, useEffect } from 'react';
import { CampusTopBar } from './CampusTopBar';
import { CampusSidebar, type SidebarSection } from './CampusSidebar';
import { CampusSearch, type CampusSearchItem } from './CampusSearch';

interface CampusShellProps {
  searchItems?: CampusSearchItem[];
  currentTab: string;
  onSelectTab: (tabId: string) => void;
  breadcrumbs?: string[];
  counts?: {
    users?: number;
    courses?: number;
    enrollments?: number;
    programs?: number;
    audit?: number;
  };
  onLaunchCampusSSO?: () => void;
  customSections?: SidebarSection[];
  children: React.ReactNode;
}

/** Reúne la barra lateral, cabecera y contenido de un panel con la estructura común del campus. */
export function CampusShell({
  searchItems = [],
  currentTab,
  onSelectTab,
  breadcrumbs = ['INICIA', 'Control Maestro'],
  counts,
  onLaunchCampusSSO,
  customSections,
  children,
}: CampusShellProps) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  const [searchOpen, setSearchOpen] = useState(false);
  useEffect(() => {
    const shortcut = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener('keydown', shortcut);
    return () => window.removeEventListener('keydown', shortcut);
  }, []);

  return (
    <div className="campus-backdrop min-h-screen bg-background text-foreground flex flex-col font-sans transition-colors duration-150">
      {/* TopBar with Global Search, Theme Switch */}
      <CampusTopBar
        breadcrumbs={breadcrumbs}
        onOpenNavigation={() => setMobileSidebarOpen(true)}
        navigationOpen={mobileSidebarOpen}
        onOpenSearch={() => setSearchOpen(true)}
        onLaunchMoodleSSO={onLaunchCampusSSO}
      />

      <CampusSearch open={searchOpen} onClose={() => setSearchOpen(false)} items={searchItems} onSelectTab={onSelectTab} />
      <div className="mx-auto flex w-full max-w-[112rem] flex-1 items-start gap-4 lg:px-4 lg:pt-3">
        {/* Persistent Collapsible Sidebar */}
        <CampusSidebar
          currentTab={currentTab}
          onSelectTab={onSelectTab}
          collapsed={sidebarCollapsed}
          onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
          mobileOpen={mobileSidebarOpen}
          onCloseMobile={() => setMobileSidebarOpen(false)}
          counts={counts}
          onLaunchCampusSSO={onLaunchCampusSSO}
          customSections={customSections}
        />

        <div className="mx-auto w-full min-w-0 flex-1 p-4 sm:p-6 lg:pt-0">
          {children}
        </div>
      </div>
    </div>
  );
}
