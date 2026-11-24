// IINICIA Portal · portal Next.js · page.tsx
/** Dirige al catálogo de cursos que se muestra en la portada. */
import { redirect } from 'next/navigation';

/** Conserva el enlace a la oferta de cursos y lo dirige al catálogo dentro de la portada. */
export default function CursosPage() {
  redirect('/#cursos');
}
