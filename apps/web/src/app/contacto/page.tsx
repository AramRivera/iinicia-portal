// IINICIA Portal · portal Next.js · page.tsx
/** Conserva el acceso directo a la sección pública de contacto. */
import { redirect } from 'next/navigation';

/** Traslada la ruta pública antigua de contacto a la sección de contacto en la portada. */
export default function ContactoPage() {
  redirect('/#contacto');
}
