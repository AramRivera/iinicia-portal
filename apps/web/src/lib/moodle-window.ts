const MOODLE_BASE_URL =
  process.env.NEXT_PUBLIC_MOODLE_URL || 'http://192.168.191.171/moodle';

export function openMoodleLaunchWindow(): Window | null {
  const popup = window.open('about:blank', '_blank');
  if (popup) popup.opener = null;
  return popup;
}

export function navigateMoodleLaunchWindow(popup: Window, accessUrl: string): void {
  const baseUrl = new URL(MOODLE_BASE_URL);
  const targetUrl = new URL(accessUrl);
  const moodlePath = baseUrl.pathname.replace(/\/+$/, '');
  const expectedLoginPath = `${moodlePath}/auth/userkey/login.php`;

  if (
    (targetUrl.protocol !== 'http:' && targetUrl.protocol !== 'https:') ||
    targetUrl.origin !== baseUrl.origin ||
    targetUrl.pathname !== expectedLoginPath
  ) {
    throw new Error('La API devolvió un enlace SSO de Moodle no válido.');
  }

  popup.location.replace(targetUrl.href);
}

export function closeMoodleLaunchWindow(popup: Window): void {
  if (!popup.closed) popup.close();
}
