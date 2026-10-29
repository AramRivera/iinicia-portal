import { Suspense } from 'react';
import ProgramDetail from '@/components/programs/ProgramDetail';

async function ProgramContent({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <ProgramDetail slug={slug} />;
}

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
