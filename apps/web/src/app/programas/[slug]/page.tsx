// IINICIA Portal · portal Next.js · page.tsx
/** Resuelve el identificador de la URL y delega la consulta del programa al componente de detalle. */
import { Suspense } from 'react';
import ProgramDetail from '@/components/programs/ProgramDetail';

// Resuelve los parámetros asíncronos dentro del límite de Suspense.
/** Resuelve el parámetro de la ruta y lo entrega al componente que consulta y presenta el programa. */
async function ProgramContent({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <ProgramDetail slug={slug} />;
}

/** Prepara la vista de la ficha y su estado de espera mientras se resuelven los datos de la ruta. */
export default function ProgramPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  return (
    <Suspense fallback={<div className="mx-auto w-full max-w-6xl px-6 py-16" aria-label="Cargando programa" />}>
      <ProgramContent params={params} />
    </Suspense>
  );
}
