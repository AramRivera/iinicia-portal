/** Conserva el acceso directo a la sección pública de contacto. */
import { redirect } from 'next/navigation';

export default function ContactoPage() {
  redirect('/#contacto');
}
