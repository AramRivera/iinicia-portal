'use client';
// IINICIA Portal · portal Next.js · CoordinatorRequests.tsx

import { useEffect, useState } from 'react';
import { admissionsApi, enrollmentsApi } from '@/lib/api';
// El panel muestra las solicitudes que la API autorizó para el ámbito de la coordinación.
import type { AdmissionApplication, EnrollmentRequest } from '@/types';

const buttonClass = 'rounded-md border border-border px-3 py-1.5 text-sm hover:border-primary disabled:opacity-50';

type Props = { canReview: boolean; canAuthorize: boolean };

/** Carga por separado las postulaciones y solicitudes de matrícula. Después de una decisión vuelve a consultar sus estados. */
export function CoordinatorRequests({ canReview, canAuthorize }: Props) {
  const [admissions, setAdmissions] = useState<AdmissionApplication[]>([]);
  const [enrollments, setEnrollments] = useState<EnrollmentRequest[]>([]);
  const [admissionsError, setAdmissionsError] = useState(false);
  const [enrollmentsError, setEnrollmentsError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);

  // Admisiones y matrículas se consultan por separado. Un fallo de lectura conserva el resultado disponible de la otra lista.
  useEffect(() => {
    let current = true;
    void Promise.allSettled([
      canReview ? admissionsApi.getMyApplications() : Promise.resolve([]),
      canAuthorize ? enrollmentsApi.getMyEnrollments() : Promise.resolve([]),
    ]).then(([applications, requests]) => {
      if (!current) return;
      setAdmissionsError(applications.status === 'rejected');
      setEnrollmentsError(requests.status === 'rejected');
      setAdmissions(applications.status === 'fulfilled' ? applications.value : []);
      setEnrollments(requests.status === 'fulfilled' ? requests.value : []);
      setLoading(false);
    });
    return () => { current = false; };
  }, [canReview, canAuthorize, revision]);

  // Después de registrar una decisión, la revisión invalida las listas para volver a consultar su estado en el servidor.
  /** Controla el estado de escritura de una decisión de coordinación, publica el resultado y solicita actualizar las listas si tiene éxito. */
  async function run(action: () => Promise<string>) {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      setNotice(await action());
      setLoading(true);
      setRevision((value) => value + 1);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'No fue posible guardar el cambio.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section id="solicitudes" className="scroll-mt-20 space-y-4 rounded-xl border border-border bg-surface p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">Solicitudes académicas</h2>
        <button type="button" className={buttonClass} disabled={busy || loading} onClick={() => {
          setLoading(true);
          setRevision((value) => value + 1);
        }}>Actualizar</button>
      </div>
      {notice && <p role="status" className="text-sm">{notice}</p>}
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
      {loading && <p role="status" className="text-sm text-muted">Cargando solicitudes…</p>}
      {canReview && (
        <div>
          <h3 className="mb-2 font-medium">Postulaciones</h3>
          {admissionsError ? <p className="text-sm text-danger">No se pudieron cargar las postulaciones.</p> :
            !loading && admissions.length === 0 && <p className="text-sm text-muted">Sin postulaciones en tus programas.</p>}
          <ul className="divide-y divide-border">
            {admissions.map((item) => (
              <li key={item.id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm">
                <div>
                  <p className="font-medium">{item.profiles?.first_name} {item.profiles?.last_name} · {item.programs?.name || 'Programa'}</p>
                  <p className="text-muted">{item.profiles?.email} · {item.status.replaceAll('_', ' ')}</p>
                </div>
                {(item.status === 'postulado' || item.status === 'en_revision') && (
                  <div className="flex gap-2">
                    {(['admitido', 'rechazado'] as const).map((status) => (
                      <button key={status} type="button" className={buttonClass} disabled={busy || loading} onClick={() => void run(async () => {
                        const result = await admissionsApi.reviewApplication(item.id, status, item.reviewer_notes ?? undefined);
                        if (result.enrollment_summary?.state === 'incomplete') return 'Dictamen guardado. Hay matrículas pendientes de sincronizar con Moodle.';
                        return 'Dictamen guardado.';
                      })}>{status === 'admitido' ? 'Admitir' : 'Rechazar'}</button>
                    ))}
                  </div>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
      {canAuthorize && (
        <div>
          <h3 className="mb-2 font-medium">Matrículas</h3>
          {enrollmentsError ? <p className="text-sm text-danger">No se pudieron cargar las matrículas.</p> :
            !loading && enrollments.length === 0 && <p className="text-sm text-muted">Sin matrículas en tus programas.</p>}
          <ul className="divide-y divide-border">
            {enrollments.map((item) => (
              <li key={item.id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm">
                <div>
                  <p className="font-medium">{item.profiles?.first_name} {item.profiles?.last_name} · {item.course_mappings?.course_name || 'Curso'}</p>
                  <p className="text-muted">{item.profiles?.email} · {item.status.replaceAll('_', ' ')}</p>
                </div>
                {item.status === 'pendiente' && item.course_mappings && (
                  <div className="flex gap-2">
                    {(['autorizada', 'rechazada'] as const).map((status) => (
                      <button key={status} type="button" className={buttonClass} disabled={busy || loading} onClick={() => void run(async () => {
                        const result = await enrollmentsApi.authorizeEnrollment(item.id, { status, sync_to_moodle: status === 'autorizada' });
                        return result.enrollment?.status === 'error_sincronizacion'
                          ? 'Matrícula autorizada. Moodle no confirmó la sincronización.'
                          : 'Decisión de matrícula guardada.';
                      })}>{status === 'autorizada' ? 'Autorizar' : 'Rechazar'}</button>
                    ))}
                  </div>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
