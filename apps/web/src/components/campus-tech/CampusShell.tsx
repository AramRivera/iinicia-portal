'use client';

import React, { useState, useEffect } from 'react';
import { CampusTopBar } from './CampusTopBar';
import { CampusSidebar, type SidebarSection } from './CampusSidebar';
import { CampusSearch, type CampusSearchItem } from './CampusSearch';
import { IconMenu } from './Icons';

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
    <div className="min-h-screen bg-background text-foreground flex flex-col font-sans transition-colors duration-150">
      {/* TopBar with Global Search, Theme Switch */}
      <CampusTopBar
        breadcrumbs={breadcrumbs}
        onOpenSearch={() => setSearchOpen(true)}
        onLaunchMoodleSSO={onLaunchCampusSSO}
      />

      <CampusSearch open={searchOpen} onClose={() => setSearchOpen(false)} items={searchItems} onSelectTab={onSelectTab} />
      <div className="flex flex-1 min-h-[calc(100vh-3.5rem)]">
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

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
          {/* Mobile hamburger bar */}
          <div className="lg:hidden flex items-center justify-between border-b border-border bg-surface px-4 py-2">
            <button
              type="button"
              onClick={() => setMobileSidebarOpen(true)}
              className="flex items-center gap-2 text-xs font-medium text-foreground bg-surface-muted px-2.5 py-1.5 rounded-[6px] border border-border"
            >
              <IconMenu className="w-3.5 h-3.5" />
              <span>Menú Campus</span>
            </button>
            <span className="text-xs text-muted font-medium">INICIA</span>
          </div>

          <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-[1600px] w-full mx-auto">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
