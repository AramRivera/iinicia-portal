/** Conserva la URL de admisiones y dirige al visitante a esa sección de la portada. */
import { redirect } from 'next/navigation';

export default function AdmisionesPage() {
  redirect('/#admisiones');
}
