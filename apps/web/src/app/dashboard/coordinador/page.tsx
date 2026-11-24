// IINICIA Portal · panel de coordinación · page.tsx
/** Carga el espacio de coordinación para la gestión dentro de los programas asignados. */
import { RoleWorkspace } from '@/components/RoleWorkspace';

/** Selecciona la vista de coordinación del espacio compartido que aplica los permisos de la sesión. */
export default function CoordinadorDashboardPage() {
  return <RoleWorkspace role="coordinador" />;
}
