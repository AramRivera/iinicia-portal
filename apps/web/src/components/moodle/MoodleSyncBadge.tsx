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
  let badgeStyle = 'bg-zinc-800 text-zinc-400 border-zinc-700';

  switch (status) {
    case 'sincronizado':
      label = moodleId ? `Moodle ID #${moodleId}` : 'Sincronizado';
      badgeStyle = 'bg-emerald-950/60 text-emerald-300 border-emerald-800/80';
      break;
    case 'pendiente':
      label = 'Sincronización pendiente';
      badgeStyle = 'bg-amber-950/60 text-amber-300 border-amber-800/80';
      break;
    case 'error':
      label = 'Error Moodle';
      badgeStyle = 'bg-rose-950/60 text-rose-300 border-rose-800/80';
      break;
    case 'suspendido_en_moodle':
      label = 'Suspendido en Moodle';
      badgeStyle = 'bg-red-950/60 text-red-300 border-red-800/80';
      break;
    default:
      label = 'Sin vincular';
      badgeStyle = 'bg-zinc-800 text-zinc-400 border-zinc-700';
      break;
  }

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold tracking-wide ${badgeStyle} ${className}`}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${
          status === 'sincronizado'
            ? 'bg-emerald-400'
            : status === 'pendiente'
            ? 'bg-amber-400 animate-pulse'
            : status === 'error'
            ? 'bg-rose-400'
            : 'bg-zinc-400'
        }`}
      />
      {label}
    </span>
  );
}
