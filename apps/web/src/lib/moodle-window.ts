// IINICIA Portal · portal Next.js · moodle-window.ts
/** Administra la apertura, navegación y cierre de la ventana usada para los saltos SSO a Moodle. */
const MOODLE_BASE_URL =
  process.env.NEXT_PUBLIC_MOODLE_URL || 'http://192.168.191.171/moodle';

// Abre la ventana durante el clic, antes de esperar la respuesta del servidor.
/** Reserva una ventana durante la interacción y separa su referencia al origen antes de recibir el enlace de la API. */
export function openMoodleLaunchWindow(): Window | null {
  const popup = window.open('about:blank', '_blank');
  if (popup) popup.opener = null;
  return popup;
}

/** Solo navega la ventana reservada después de que el enlace supera la validación del campus configurado. */
export function navigateMoodleLaunchWindow(popup: Window, accessUrl: string): void {
  popup.location.replace(validateMoodleLaunchUrl(accessUrl, MOODLE_BASE_URL));
}

/** Verifica el origen, la ruta de SSO, la clave y el destino posterior. Devuelve el enlace validado o interrumpe la apertura con un error. */
export function validateMoodleLaunchUrl(accessUrl: string, campusUrl: string): string {
  const baseUrl = new URL(campusUrl);
  const targetUrl = new URL(accessUrl);
  const moodlePath = baseUrl.pathname.replace(/\/+$/, '');
  // Restringe el salto a la ruta de SSO en el origen Moodle configurado.
  const expectedLoginPath = `${moodlePath}/auth/userkey/login.php`;

  if (
    (targetUrl.protocol !== 'http:' && targetUrl.protocol !== 'https:') ||
    targetUrl.origin !== baseUrl.origin ||
    targetUrl.pathname !== expectedLoginPath ||
    targetUrl.username || targetUrl.password || targetUrl.hash ||
    targetUrl.searchParams.getAll('key').length !== 1 ||
    !targetUrl.searchParams.get('key')
  ) {
    throw new Error('La API devolvió un enlace SSO de Moodle no válido.');
  }

  // Moodle interpreta wantsurl tras iniciar sesión. Se verifica ese segundo salto antes de navegar.
  const destinations = targetUrl.searchParams.getAll('wantsurl');
  if (destinations.length > 1) throw new Error('El enlace SSO contiene varios destinos.');
  if (destinations.length === 1) {
    const destination = new URL(destinations[0]);
    const allowedPaths = [
      moodlePath || '/',
      `${moodlePath}/`,
      `${moodlePath}/course/view.php`,
      `${moodlePath}/grade/report/grader/index.php`,
    ];
    if (
      destination.protocol !== baseUrl.protocol || destination.origin !== baseUrl.origin ||
      destination.username || destination.password || !allowedPaths.includes(destination.pathname)
    ) {
      throw new Error('El destino del enlace SSO está fuera del campus Moodle.');
    }
  }
  return targetUrl.href;
}

/** Cierra la ventana que el portal reservó si sigue abierta cuando debe cancelar el salto. */
export function closeMoodleLaunchWindow(popup: Window): void {
  if (!popup.closed) popup.close();
}
