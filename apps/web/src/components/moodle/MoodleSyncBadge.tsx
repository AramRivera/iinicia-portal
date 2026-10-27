'use client';

import React from 'react';
import type { MoodleSyncStatus } from '@/types';

interface MoodleSyncBadgeProps {
  status?: MoodleSyncStatus | string | null;
  moodleId?: number | null;
  className?: string;
}

export function MoodleSyncBadge({ status, moodleId, className = '' }: MoodleSyncBadgeProps) {
  let label = 'No vinculado';
  let badgeStyle = 'bg-surface-muted text-muted border-border';

  switch (status) {
    case 'sincronizado':
      label = moodleId ? `Moodle ID #${moodleId}` : 'Sincronizado';
      badgeStyle = 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20';
      break;
    case 'pendiente':
      label = 'Sincronización pendiente';
      badgeStyle = 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20';
      break;
    case 'error':
      label = 'Error Moodle';
      badgeStyle = 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20';
      break;
    case 'suspendido_en_moodle':
      label = 'Suspendido en Moodle';
      badgeStyle = 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20';
      break;
    default:
      label = 'Sin vincular';
      badgeStyle = 'bg-surface-muted text-muted border-border';
      break;
  }

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-[4px] border px-2 py-0.5 text-[11px] font-mono font-medium tracking-tight ${badgeStyle} ${className}`}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${
          status === 'sincronizado'
            ? 'bg-emerald-500'
            : status === 'pendiente'
            ? 'bg-amber-500 animate-pulse'
            : status === 'error' || status === 'suspendido_en_moodle'
            ? 'bg-rose-500'
            : 'bg-muted'
        }`}
      />
      {label}
    </span>
  );
}
