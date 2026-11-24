// IINICIA Portal · portal Next.js · page.tsx
/** Dirige al visitante a las certificaciones publicadas en la portada. */
import { redirect } from 'next/navigation';

/** Mantiene una dirección pública estable para la sección de certificaciones de la portada. */
export default function CertificacionesPage() {
  redirect('/#certificaciones');
}
