/** Dirige al catálogo de cursos que se muestra en la portada. */
import { redirect } from 'next/navigation';

export default function CursosPage() {
  redirect('/#cursos');
}
