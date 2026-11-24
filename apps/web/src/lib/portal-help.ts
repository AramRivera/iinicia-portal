// IINICIA Portal · portal Next.js · portal-help.ts
/** La ayuda es pública. El navegador envía solo la pregunta y hasta tres preguntas anteriores sin adjuntar credenciales de sesión. */
import { API_URL } from './api';

export type HelpAnswer = {
  text: string;
  action: { href: string; label: string };
  sources?: { href: string; label: string }[];
};

export const helpTopics = [
  '¿Cómo me postulo?',
  'Olvidé mi contraseña',
  '¿Cómo entro a Moodle?',
  'Ya me admitieron, ¿por qué no veo mi curso en Moodle?',
];

/** Envía la pregunta y hasta tres antecedentes sin credenciales. Traduce el límite de frecuencia y los fallos del proveedor a mensajes del diálogo. */
export async function askPortalHelp(question: string, previousQuestions: string[] = []): Promise<HelpAnswer> {
  const response = await fetch(`${API_URL}/help-chat`, {
    method: 'POST',
    credentials: 'omit',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question, previous_questions: previousQuestions.slice(-3) }),
  });

  if (!response.ok) {
    const message = response.status === 429
      ? 'Llegaste al límite temporal de consultas. Intenta de nuevo en un minuto.'
      : 'El asistente de IA no está disponible en este momento.';
    throw new Error(message);
  }

  return response.json() as Promise<HelpAnswer>;
}
