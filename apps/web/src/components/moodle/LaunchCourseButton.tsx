'use client';

import React, { useState } from 'react';
import { coursesApi } from '@/lib/api';

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

    try {
      setLoading(true);
      setError(null);

      const data = await coursesApi.launchCourse(courseMappingId);

      // Abrir curso en Moodle en nueva pestaña
      window.open(data.access_url, '_blank', 'noopener,noreferrer');
    } catch (err: any) {
      setError(err.message || 'No fue posible acceder al aula virtual.');
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
        className={`inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-xs font-semibold text-white shadow-md transition-all ${
          isAuthorized
            ? 'bg-blue-600 hover:bg-blue-500 shadow-blue-500/20 hover:shadow-blue-500/30 active:scale-[0.98]'
            : 'bg-zinc-700 text-zinc-400 cursor-not-allowed opacity-60'
        } ${className}`}
      >
        {loading ? (
          <>
            <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
            <span>Abriendo Aula Moodle...</span>
          </>
        ) : (
          <>
            <svg
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
              <polyline points="15 3 21 3 21 9" />
              <line x1="10" y1="14" x2="21" y2="3" />
            </svg>
            <span>Entrar al Aula: {courseName}</span>
          </>
        )}
      </button>

      {error && (
        <span className="text-[11px] font-medium text-red-400">
          {error}
        </span>
      )}
    </div>
  );
}
