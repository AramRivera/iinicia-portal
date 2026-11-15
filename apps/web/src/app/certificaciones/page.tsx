/** Dirige al visitante a las certificaciones publicadas en la portada. */
import { redirect } from 'next/navigation';

export default function CertificacionesPage() {
  redirect('/#certificaciones');
}
