'use client';

import React, { useState } from 'react';
import { coursesApi } from '@/lib/api';
import { IconExternalLink } from '@/components/campus-tech/Icons';
import {
  closeMoodleLaunchWindow,
  navigateMoodleLaunchWindow,
  openMoodleLaunchWindow,
} from '@/lib/moodle-window';

interface LaunchCourseButtonProps {
  courseMappingId: string;
  courseName: string;
  isAuthorized?: boolean;
  className?: string;
}

export function LaunchCourseButton({
  courseMappingId,
  courseName,
  isAuthorized = true,
  className = '',
}: LaunchCourseButtonProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLaunch = async () => {
    if (!isAuthorized) {
      setError('Aún no tienes matrícula autorizada para este curso.');
      return;
    }

    // Abrir la pestaña durante el gesto del usuario evita que el navegador
    // bloquee la ventana cuando la respuesta de la API llega de forma asíncrona.
    const launchWindow = openMoodleLaunchWindow();
    if (!launchWindow) {
      setError('Permite las ventanas emergentes para abrir el aula virtual.');
      return;
    }
    try {
      setLoading(true);
      setError(null);

      const data = await coursesApi.launchCourse(courseMappingId);
      navigateMoodleLaunchWindow(launchWindow, data.access_url);
    } catch (err: unknown) {
      closeMoodleLaunchWindow(launchWindow);
      setError(err instanceof Error ? err.message : 'No fue posible acceder al aula virtual.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-1.5">
      <button
        type="button"
        onClick={handleLaunch}
        disabled={loading || !isAuthorized}
        className={`inline-flex items-center justify-center gap-2 rounded-[6px] px-3.5 py-2 text-xs font-semibold text-white shadow-minimal transition-all ${
          isAuthorized
            ? 'bg-primary-action hover:bg-primary-action/90 active:scale-[0.98]'
            : 'bg-surface-muted text-muted cursor-not-allowed opacity-60'
        } ${className}`}
      >
        {loading ? (
          <>
            <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
            <span>Abriendo Aula Moodle...</span>
          </>
        ) : (
          <>
            <IconExternalLink className="w-3.5 h-3.5" />
            <span>Entrar al Aula: {courseName}</span>
          </>
        )}
      </button>

      {error && (
        <span className="text-[11px] font-medium text-danger">
          {error}
        </span>
      )}
    </div>
  );
}
