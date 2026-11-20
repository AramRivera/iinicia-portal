import { ConfigService } from '@nestjs/config';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { HelpChatService } from './help-chat.service.js';

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

  it('no consulta al proveedor si la búsqueda no recupera entradas', async () => {
    const provider = mockSelection('{}');
    expect((await service.reply('¿Me ayudas a saber qué clima hará mañana?')).action.href).toBe('/#contacto');
    expect(provider).not.toHaveBeenCalled();
  });

  it.each([
    '{"answer":"Prueba","source_ids":["moodle"]}',
    '{"answer":"Prueba","source_ids":["password","moodle"]}',
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
