// IINICIA Portal · portal Next.js · page.tsx
/** Conserva el acceso desde enlaces anteriores y dirige a la oferta principal. */
import { redirect } from 'next/navigation';

/** Mantiene accesible la ruta de diplomados y la dirige a su bloque de la página pública. */
export default function DiplomadosPage() {
  redirect('/#cursos');
}
