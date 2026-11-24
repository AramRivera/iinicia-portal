// IINICIA Portal · portal Next.js · page.tsx
/** Dirige a la sección institucional de la portada. */
import { redirect } from 'next/navigation';

/** Conserva la ruta pública de la universidad y dirige a la sección institucional de la portada. */
export default function UniversidadPage() {
  redirect('/#universidad');
}
