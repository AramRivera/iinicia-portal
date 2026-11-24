// IINICIA Portal · soporte · page.tsx
/** Carga el espacio de trabajo de soporte con las opciones permitidas para ese rol. */
import { RoleWorkspace } from '@/components/RoleWorkspace';

/** Selecciona las herramientas de soporte en el panel compartido en función de los permisos disponibles. */
export default function SoporteDashboardPage() {
  return <RoleWorkspace role="soporte" />;
}
