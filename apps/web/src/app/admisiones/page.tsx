// IINICIA Portal · portal Next.js · page.tsx
/** Conserva la URL de admisiones y dirige al visitante a esa sección de la portada. */
import { redirect } from 'next/navigation';

/** Conserva la ruta pública de admisiones y la dirige a la sección correspondiente de la portada. */
export default function AdmisionesPage() {
  redirect('/#admisiones');
}
