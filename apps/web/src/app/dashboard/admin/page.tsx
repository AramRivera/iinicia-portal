'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { enrollmentsApi, moodleApi, usersApi } from '@/lib/api';
import type { EnrollmentRequest, MoodleStatusResponse, UserProfile } from '@/types';
import { MoodleSyncBadge } from '@/components/moodle/MoodleSyncBadge';

export default function AdminDashboardPage() {
  const router = useRouter();
  const { user, loading: authLoading, hasRole } = useAuth();

  const [moodleStatus, setMoodleStatus] = useState<MoodleStatusResponse | null>(null);
  const [enrollments, setEnrollments] = useState<EnrollmentRequest[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isAdminOrCoordinator =
    hasRole('superadministrador') || hasRole('administrador') || hasRole('coordinador');

  const loadData = async () => {
    try {
      setLoading(true);
      const [statusRes, enrollRes, usersRes] = await Promise.all([
        moodleApi.getStatus().catch(() => ({ ok: false, message: 'No disponible' })),
        enrollmentsApi.getAllEnrollments().catch(() => ({ data: [], meta: {} })),
        usersApi.getUsers({ limit: 15 }).catch(() => ({ data: [], meta: {} })),
      ]);

      setMoodleStatus(statusRes);
      setEnrollments(enrollRes.data || []);
      setUsers(usersRes.data || []);
    } catch (err: any) {
      setError(err.message || 'Error al cargar panel de administración.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.push('/login');
      return;
    }
    if (!isAdminOrCoordinator) {
      router.push('/dashboard/estudiante');
      return;
    }

    loadData();
  }, [user, authLoading, isAdminOrCoordinator, router]);

  const handleAuthorizeEnrollment = async (enrollmentId: string, status: 'autorizada' | 'rechazada') => {
    setActionLoading(`enr-${enrollmentId}`);
    setNotice(null);
    setError(null);

    try {
      await enrollmentsApi.authorizeEnrollment(enrollmentId, { status });
      setNotice(
        status === 'autorizada'
          ? '✓ Solicitud autorizada y usuario matriculado en Moodle LMS con éxito.'
          : 'Solicitud rechazada.'
      );
      await loadData();
    } catch (err: any) {
      setError(err.message || 'Error al procesar matrícula.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleBulkMoodleSync = async () => {
    setActionLoading('bulk-sync');
    setNotice(null);
    setError(null);

    try {
      const res = await moodleApi.syncAllUsers();
      setNotice(`✓ Sincronización completada: ${res.synced} usuarios vinculados en Moodle LMS.`);
      await loadData();
    } catch (err: any) {
      setError(err.message || 'Error en sincronización masiva.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleSyncSingleUser = async (userId: string) => {
    setActionLoading(`user-${userId}`);
    setNotice(null);
    setError(null);

    try {
      await moodleApi.syncUser(userId);
      setNotice('✓ Usuario sincronizado con éxito en Moodle LMS.');
      await loadData();
    } catch (err: any) {
      setError(err.message || 'Error al sincronizar usuario.');
    } finally {
      setActionLoading(null);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-3 border-accent border-t-transparent" />
          <p className="text-sm text-foreground/60">Cargando panel de administración...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
      {/* Header Admin */}
      <div className="rounded-3xl border border-border/80 bg-background/60 p-6 backdrop-blur-xl sm:p-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-400 border border-emerald-500/20">
                Panel de Administración
              </span>
              <span className="rounded-full bg-zinc-800 px-2.5 py-0.5 text-[11px] font-semibold text-zinc-400 border border-zinc-700">
                {user?.roles?.join(', ')}
              </span>
            </div>
            <h1 className="mt-2 text-2xl font-extrabold text-foreground sm:text-3xl">
              Control Maestro IINICIA & Moodle
            </h1>
            <p className="mt-1 text-sm text-foreground/70">
              Supervisión de usuarios, solicitudes de matrícula y sincronización en tiempo real con Moodle LMS.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleBulkMoodleSync}
              disabled={actionLoading === 'bulk-sync'}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-xs font-semibold text-white shadow-md hover:bg-accent-strong transition-all disabled:opacity-50"
            >
              {actionLoading === 'bulk-sync' ? (
                <>
                  <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  Sincronizando Moodle...
                </>
              ) : (
                'Sincronizar todos en Moodle'
              )}
            </button>
          </div>
        </div>

        {/* Métricas y Estado Moodle */}
        <div className="mt-6 grid grid-cols-1 gap-3 border-t border-border/80 pt-6 sm:grid-cols-3">
          <div className="rounded-2xl border border-border/50 bg-foreground/[0.02] p-4">
            <span className="text-xs text-foreground/60">Estado de Moodle LMS</span>
            <div className="mt-1 flex items-center gap-2">
              <span
                className={`h-2.5 w-2.5 rounded-full ${
                  moodleStatus?.ok ? 'bg-emerald-400 animate-pulse' : 'bg-rose-500'
                }`}
              />
              <p className="text-xs font-bold text-foreground">
                {moodleStatus?.ok ? 'Conectado a Moodle Web Services' : 'Sin conexión'}
              </p>
            </div>
          </div>

          <div className="rounded-2xl border border-border/50 bg-foreground/[0.02] p-4">
            <span className="text-xs text-foreground/60">Solicitudes de Matrícula</span>
            <p className="mt-1 text-sm font-semibold text-foreground">
              {enrollments.filter((e) => e.status === 'pendiente').length} pendiente(s) de autorizar
            </p>
          </div>

          <div className="rounded-2xl border border-border/50 bg-foreground/[0.02] p-4">
            <span className="text-xs text-foreground/60">Usuarios en Plataforma</span>
            <p className="mt-1 text-sm font-semibold text-foreground">
              {users.length} usuarios registrados
            </p>
          </div>
        </div>
      </div>

      {notice && (
        <div className="mt-6 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-300">
          {notice}
        </div>
      )}

      {error && (
        <div className="mt-6 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-400">
          {error}
        </div>
      )}

      {/* Sección 1: Autorización de Matrículas con Moodle */}
      <div className="mt-10">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-foreground">
            Solicitudes de Matrícula a Cursos
          </h2>
          <span className="text-xs text-foreground/60">
            Al autorizar, el sistema matricula automáticamente al alumno en Moodle LMS
          </span>
        </div>

        <div className="mt-4 overflow-hidden rounded-2xl border border-border bg-background/50">
          {enrollments.length === 0 ? (
            <div className="p-8 text-center text-xs text-foreground/60">
              No hay solicitudes de matrícula registradas.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-border bg-foreground/[0.02] text-foreground/70">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Aspirante / Alumno</th>
                    <th className="px-4 py-3 font-semibold">Curso Solicitado</th>
                    <th className="px-4 py-3 font-semibold">Estado Portal</th>
                    <th className="px-4 py-3 font-semibold">Moodle Sync</th>
                    <th className="px-4 py-3 font-semibold text-right">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {enrollments.map((enr) => {
                    const isBusy = actionLoading === `enr-${enr.id}`;

                    return (
                      <tr key={enr.id} className="hover:bg-foreground/[0.01]">
                        <td className="px-4 py-3">
                          <p className="font-semibold text-foreground">
                            {enr.profiles?.first_name} {enr.profiles?.last_name}
                          </p>
                          <p className="text-[11px] text-foreground/60 font-mono">
                            {enr.profiles?.email}
                          </p>
                        </td>

                        <td className="px-4 py-3 font-medium text-foreground">
                          {enr.course_mappings?.courses?.name || enr.course_mappings?.moodle_shortname}
                          <span className="block text-[11px] text-foreground/50">
                            Moodle Course ID #{enr.course_mappings?.moodle_course_id}
                          </span>
                        </td>

                        <td className="px-4 py-3">
                          <span
                            className={`rounded-full px-2 py-0.5 text-[11px] font-semibold capitalize ${
                              enr.status === 'autorizada' || enr.status === 'sincronizada'
                                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                : enr.status === 'rechazada'
                                ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                                : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                            }`}
                          >
                            {enr.status}
                          </span>
                        </td>

                        <td className="px-4 py-3">
                          <MoodleSyncBadge status={enr.moodle_sync_status} />
                        </td>

                        <td className="px-4 py-3 text-right">
                          {enr.status === 'pendiente' ? (
                            <div className="flex items-center justify-end gap-2">
                              <button
                                type="button"
                                onClick={() => handleAuthorizeEnrollment(enr.id, 'autorizada')}
                                disabled={isBusy}
                                className="rounded-lg bg-emerald-600 px-3 py-1.5 text-[11px] font-semibold text-white shadow hover:bg-emerald-500 disabled:opacity-50"
                              >
                                {isBusy ? 'Procesando...' : 'Autorizar y Matricular'}
                              </button>
                              <button
                                type="button"
                                onClick={() => handleAuthorizeEnrollment(enr.id, 'rechazada')}
                                disabled={isBusy}
                                className="rounded-lg border border-border px-2.5 py-1.5 text-[11px] font-medium text-foreground/70 hover:bg-foreground/5"
                              >
                                Rechazar
                              </button>
                            </div>
                          ) : (
                            <span className="text-[11px] text-foreground/40 font-mono">
                              Completado
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Sección 2: Control de Usuarios e Identidad Moodle */}
      <div className="mt-12">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-foreground">
            Directorio de Usuarios y Vínculo Moodle
          </h2>
          <span className="text-xs text-foreground/60">
            Total en vista: {users.length}
          </span>
        </div>

        <div className="mt-4 overflow-hidden rounded-2xl border border-border bg-background/50">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-border bg-foreground/[0.02] text-foreground/70">
                <tr>
                  <th className="px-4 py-3 font-semibold">Usuario</th>
                  <th className="px-4 py-3 font-semibold">Roles</th>
                  <th className="px-4 py-3 font-semibold">Estado Portal</th>
                  <th className="px-4 py-3 font-semibold">ID en Moodle</th>
                  <th className="px-4 py-3 font-semibold">Sync Status</th>
                  <th className="px-4 py-3 font-semibold text-right">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {users.map((usr) => {
                  const isBusy = actionLoading === `user-${usr.id}`;

                  return (
                    <tr key={usr.id} className="hover:bg-foreground/[0.01]">
                      <td className="px-4 py-3">
                        <p className="font-semibold text-foreground">
                          {usr.first_name} {usr.last_name}
                        </p>
                        <p className="text-[11px] text-foreground/60 font-mono">
                          {usr.email}
                        </p>
                      </td>

                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {usr.roles?.map((r) => (
                            <span
                              key={r}
                              className="rounded bg-accent/10 px-1.5 py-0.5 text-[10px] font-medium text-accent"
                            >
                              {r}
                            </span>
                          ))}
                        </div>
                      </td>

                      <td className="px-4 py-3">
                        <span className="capitalize text-foreground/80 font-medium">
                          {usr.status}
                        </span>
                      </td>

                      <td className="px-4 py-3 font-mono text-[11px] text-foreground/80">
                        {usr.moodle_user_id ? `#${usr.moodle_user_id}` : '—'}
                      </td>

                      <td className="px-4 py-3">
                        <MoodleSyncBadge status={usr.moodle_sync_status} moodleId={usr.moodle_user_id} />
                      </td>

                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => handleSyncSingleUser(usr.id)}
                          disabled={isBusy}
                          className="rounded-lg border border-border px-2.5 py-1 text-[11px] font-medium text-foreground hover:border-accent hover:text-accent disabled:opacity-50"
                        >
                          {isBusy ? '...' : 'Sincronizar'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
