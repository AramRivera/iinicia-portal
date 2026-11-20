import { ConfigService } from '@nestjs/config';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { HelpChatService } from './help-chat.service.js';
import { retrieveHelpEntries } from './help-knowledge.js';
import { validate } from 'class-validator';
import { HelpQuestionDto } from './help-chat.controller.js';

describe('HelpChatService', () => {
  const service = new HelpChatService(new ConfigService({ DEEPSEEK_API_KEY: 'unit-test-key' }));

  afterEach(() => vi.unstubAllGlobals());

  function mockSelection(content: string) {
    const provider = vi.fn<typeof fetch>().mockResolvedValue(Response.json({
      choices: [{ finish_reason: 'stop', message: { content } }],
    }));
    vi.stubGlobal('fetch', provider);
    return provider;
  }

  it('envía solo entradas pertinentes y devuelve el texto redactado y su referencia', async () => {
    const text = 'Pide un enlace y ábrelo en el mismo navegador.';
    const provider = mockSelection(JSON.stringify({ answer: text, source_ids: ['password'] }));
    const answer = await service.reply('¿Cómo recupero mi contraseña? Mi correo es persona@example.test y el número es 123456');
    expect(answer.action.href).toBe('/recuperar-password');
    expect(answer.text).toBe(text);
    expect(answer.sources).toEqual([{ href: '/recuperar-password', label: 'Restablecer contraseña' }]);
    const request = provider.mock.calls[0]?.[1]?.body;
    if (typeof request !== 'string') throw new Error('Se esperaba un cuerpo JSON');
    expect(request).toContain('password');
    expect(request).not.toContain('persona@example.test');
    expect(request).not.toContain('123456');
    expect(request).not.toContain('Campus Virtual');
  });

  it('recupera admisiones y matrícula para una pregunta que combina los dos temas', async () => {
    const provider = mockSelection(JSON.stringify({
      answer: 'La admisión y la matrícula son pasos distintos. Revisa Mis cursos cuando se confirme la matrícula.',
      source_ids: ['enrollment', 'admissions'],
    }));
    const answer = await service.reply('Ya me admitieron, ¿por qué no veo mi curso en Moodle?');
    expect(answer.sources?.map((source) => source.href)).toEqual(['/dashboard/estudiante', '/#admisiones']);
    const request = provider.mock.calls[0]?.[1]?.body;
    expect(request).toContain('cursos obligatorios activos del primer módulo');
  });

  it('deja interpretar paráfrasis sin coincidencias literales', async () => {
    const provider = mockSelection('{"answer":"Puedes crear tu cuenta de aspirante.","source_ids":["register"]}');
    const answer = await service.reply('kiero empezar desde cero aki');
    expect(answer.text).toContain('crear tu cuenta');
    expect(provider).toHaveBeenCalledOnce();
    expect(answer.action.href).toBe('/registro');
  });

  it('permite saludar y pedir aclaraciones sin citar una entrada', async () => {
    mockSelection('{"answer":"Hola. ¿Te ayudo con tu cuenta o con el aula?","source_ids":[]}');
    expect((await service.reply('Hola')).text).toBe('Hola. ¿Te ayudo con tu cuenta o con el aula?');
  });

  it('conserva el tema de una pregunta anterior sin enviar datos sensibles', async () => {
    const provider = mockSelection('{"answer":"Revisa el correo no deseado.","source_ids":["password"]}');
    await service.reply('¿Y si no me llega?', ['Olvidé mi contraseña, soy persona@example.test']);
    const request = provider.mock.calls[0]?.[1]?.body;
    if (typeof request !== 'string') throw new Error('Se esperaba un cuerpo JSON');
    expect(request).toContain('previous_questions');
    expect(request).toContain('Olvidé mi contraseña');
    expect(request).not.toContain('persona@example.test');
  });

  it('admite una explicación útil de más de 700 caracteres', async () => {
    const text = 'Consulta tu panel de estudiante. '.repeat(26).trim();
    mockSelection(JSON.stringify({ answer: text, source_ids: ['enrollment'] }));
    expect((await service.reply('Mi matrícula')).text).toBe(text);
  });

  it('recupera orientación de profesores y calificaciones', () => {
    expect(retrieveHelpEntries('Soy profe, ¿dónde califico las tareas?').some((entry) => entry.id === 'teacher')).toBe(true);
  });

  it.each([
    { previous: ['a', 'b', 'c', 'd'] },
    { previous: ['a'.repeat(301)] },
    { previous: [42] },
    { previous: 'historial no válido' },
  ])('valida el tamaño y los tipos del contexto: $previous', async ({ previous }) => {
    const dto = Object.assign(new HelpQuestionDto(), { question: 'Hola', previous_questions: previous });
    expect((await validate(dto)).length).toBeGreaterThan(0);
  });

  it.each([
    '{"answer":"Prueba","source_ids":["fuente-inventada"]}',
    '{"answer":"Prueba","source_ids":["password","fuente-inventada"]}',
    '{"answer":"Entra en https://example.test","source_ids":["password"]}',
    '{"answer":null,"source_ids":[]}',
    'Texto libre que no pertenece a IINICIA',
  ])(
    'descarta las respuestas sin referencias válidas o con enlaces externos: %s',
    async (content) => {
      mockSelection(content);
      const answer = await service.reply('Recuperar contraseña');
      expect(answer.action.href).toBe('/#contacto');
      expect(answer.sources).toEqual([]);
    },
  );

  it('convierte un fallo de DeepSeek en un error controlado', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('Detalle privado', { status: 401 })));
    await expect(service.reply('Recuperar contraseña')).rejects.toMatchObject({ status: 503 });
  });
});
