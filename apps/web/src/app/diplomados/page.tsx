/** Dirige a los diplomados publicados en la portada. */
import { redirect } from 'next/navigation';

export default function DiplomadosPage() {
  redirect('/#diplomados');
}
