'use client';

import Link from 'next/link';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { IconClose, IconHelp } from '@/components/campus-tech/Icons';
import { askPortalHelp, helpTopics, type HelpAnswer } from '@/lib/portal-help';

const maximumLength = 300;

type Turn = {
  question: string;
  answer: HelpAnswer;
};

export function PortalHelpChat() {
  const dialog = useRef<HTMLDialogElement>(null);
  const log = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const [question, setQuestion] = useState('');
  const [turns, setTurns] = useState<Turn[]>([]);
  const [pendingQuestion, setPendingQuestion] = useState<string | null>(null);

  useEffect(() => {
    if (log.current) log.current.scrollTop = log.current.scrollHeight;
  }, [turns, pendingQuestion]);

  const ask = async (message: string) => {
    const cleaned = message.trim();
    if (!cleaned || pendingQuestion) return;
    setPendingQuestion(cleaned);
    let answer: HelpAnswer;
    try {
      answer = await askPortalHelp(cleaned);
    } catch (error) {
      answer = {
        text: error instanceof Error && !(error instanceof TypeError)
          ? error.message
          : 'No se pudo conectar con el asistente de IA.',
        action: { href: '/#contacto', label: 'Abrir Contacto' },
      };
    }
    setTurns((current) => [...current, { question: cleaned, answer }]);
    setPendingQuestion(null);
  };

  const send = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!question.trim() || pendingQuestion) return;
    void ask(question);
    setQuestion('');
    input.current?.focus();
  };

  return (
    <>
      <button
        type="button"
        aria-haspopup="dialog"
        aria-controls="iinicia-help-chat"
        onClick={() => dialog.current?.showModal()}
        className="fixed end-4 bottom-[max(1rem,env(safe-area-inset-bottom))] z-40 flex min-h-12 items-center gap-2 rounded-full bg-primary-action px-4 text-sm font-semibold text-white shadow-soft hover:bg-accent-strong focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-primary sm:end-6 sm:bottom-6"
      >
        <span aria-hidden="true"><IconHelp className="size-5" /></span>
        Ayuda IINICIA
      </button>

      <dialog
        ref={dialog}
        id="iinicia-help-chat"
        aria-labelledby="iinicia-help-title"
        aria-describedby="iinicia-help-description"
        className="fixed inset-auto end-3 bottom-[max(.75rem,env(safe-area-inset-bottom))] m-0 h-[min(38rem,calc(100dvh-1.5rem))] max-h-none w-[min(26rem,calc(100vw-1.5rem))] max-w-none overflow-hidden rounded-3xl border border-border bg-surface p-0 text-foreground shadow-xl backdrop:bg-black/35 sm:end-6 sm:bottom-6 sm:max-h-[calc(100dvh-3rem)]"
      >
        <div className="flex h-full min-h-0 flex-col">
          <header className="flex shrink-0 items-center justify-between gap-3 border-b border-border bg-accent-soft px-4 py-2.5">
            <div>
              <h2 id="iinicia-help-title" className="text-base font-semibold">Ayuda IINICIA</h2>
              <p id="iinicia-help-description" className="text-xs text-muted">Asistente de IA sobre el portal</p>
            </div>
            <button
              type="button"
              aria-label="Cerrar chat de ayuda"
              onClick={() => dialog.current?.close()}
              className="grid size-11 shrink-0 place-items-center rounded-full border border-border bg-surface text-primary hover:bg-surface-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              <span aria-hidden="true"><IconClose className="size-5" /></span>
            </button>
          </header>

          <div ref={log} className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain px-4 py-4">
            <div className="space-y-3">
              <p className="max-w-[95%] rounded-2xl rounded-ss-sm bg-surface-muted p-3 text-sm leading-relaxed">
                Hola. ¿Necesitas ayuda con tu cuenta, una postulación o el aula virtual?
              </p>
              <div className="flex flex-wrap gap-2" role="group" aria-label="Preguntas sugeridas">
                {helpTopics.map((suggestion) => (
                  <button
                    key={suggestion}
                    type="button"
                    onClick={() => void ask(suggestion)}
                    disabled={pendingQuestion !== null}
                    className="min-h-11 rounded-xl border border-border px-3 py-1.5 text-start text-sm font-medium text-primary hover:bg-accent-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:opacity-60"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>

            <div role="log" aria-label="Conversación de ayuda" aria-relevant="additions" className="space-y-4">
              {turns.map(({ question: asked, answer }, index) => (
                <div key={index} className="flex flex-col gap-2">
                  <p className="max-w-[90%] self-end rounded-2xl rounded-se-sm bg-accent-soft px-3 py-2 text-sm wrap-anywhere">
                    <span className="sr-only">Tú: </span>{asked}
                  </p>
                  <div className="max-w-[95%] self-start rounded-2xl rounded-ss-sm bg-surface-muted p-3 text-sm leading-relaxed">
                    <p className="whitespace-pre-line wrap-anywhere"><span className="sr-only">Ayuda IINICIA: </span>{answer.text}</p>
                    {answer.sources?.length ? <p className="mt-3 text-xs font-semibold text-muted">Referencias del portal</p> : null}
                    <ul className="mt-1">
                      {(answer.sources?.length ? answer.sources : [answer.action]).map((link) => (
                        <li key={link.href}>
                          <Link
                            href={link.href}
                            prefetch={false}
                            onClick={() => dialog.current?.close()}
                            className="inline-flex min-h-11 items-center gap-2 font-semibold text-primary underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                          >
                            {link.label} <span aria-hidden="true">→</span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              ))}
              {pendingQuestion && (
                <div className="flex flex-col gap-2">
                  <p className="max-w-[90%] self-end rounded-2xl rounded-se-sm bg-accent-soft px-3 py-2 text-sm wrap-anywhere">{pendingQuestion}</p>
                  <p className="px-1 text-sm text-muted">Buscando en la guía de IINICIA…</p>
                </div>
              )}
            </div>
          </div>

          <form onSubmit={send} className="shrink-0 space-y-2 border-t border-border px-4 py-3">
            <div className="flex items-stretch gap-2">
              <label htmlFor="iinicia-help-question" className="sr-only">Escribe tu pregunta</label>
              <input
                ref={input}
                id="iinicia-help-question"
                value={question}
                maxLength={maximumLength}
                autoComplete="off"
                aria-describedby="iinicia-help-input-hint"
                onChange={(event) => setQuestion(event.target.value)}
                placeholder="Escribe tu pregunta"
                className="min-h-11 min-w-0 flex-1 rounded-xl border border-primary/55 bg-background px-3 text-base placeholder:text-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              />
              <button
                type="submit"
                disabled={!question.trim() || pendingQuestion !== null}
                className="min-h-11 shrink-0 rounded-xl bg-primary-action px-3 text-sm font-semibold text-white hover:bg-accent-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:opacity-50"
              >
                Enviar
              </button>
            </div>
            <p id="iinicia-help-input-hint" className="text-xs text-muted">Las consultas pertinentes se envían a DeepSeek. Evita incluir datos personales, contraseñas o códigos.</p>
          </form>
        </div>
      </dialog>
    </>
  );
}
