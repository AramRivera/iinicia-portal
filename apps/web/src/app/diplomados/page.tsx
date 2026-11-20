/** Conserva el acceso desde enlaces anteriores y dirige a la oferta principal. */
import { redirect } from 'next/navigation';

export default function DiplomadosPage() {
  redirect('/#cursos');
}
