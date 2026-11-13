'use client';

import Script from 'next/script';
import { useEffect, useRef, useState } from 'react';

type Turnstile = {
  render: (container: HTMLElement, options: {
    sitekey: string;
    size: 'flexible';
    callback: (token: string) => void;
    'expired-callback': () => void;
    'error-callback': () => void;
  }) => string;
  remove: (id: string) => void;
};

const sitekey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim();
export const captchaEnabled = Boolean(sitekey);

export function AuthCaptcha({ attempt, onToken }: {
  attempt: number;
  onToken: (token: string | undefined) => void;
}) {
  const container = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    const provider = (window as Window & { turnstile?: Turnstile }).turnstile;
    if (!sitekey || !ready || !provider || !container.current) return;
    let active = true;
    const id = provider.render(container.current, {
      sitekey,
      size: 'flexible',
      callback: (token) => { if (active) onToken(token); },
      'expired-callback': () => { if (active) onToken(undefined); },
      'error-callback': () => {
        if (active) {
          onToken(undefined);
          setFailed(true);
        }
      },
    });
    return () => {
      active = false;
      provider.remove(id);
    };
  }, [attempt, ready, retry, onToken]);

  if (!sitekey) return null;
  return (
    <div>
      <Script
        src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
        onReady={() => setReady(true)}
        onError={() => setFailed(true)}
      />
      <div ref={container} />
      {failed && (
        <p role="status" className="text-sm text-muted">
          No se pudo cargar la verificación.{' '}
          {ready ? (
            <button type="button" className="underline" onClick={() => {
              setFailed(false);
              setRetry((value) => value + 1);
            }}>Reintentar</button>
          ) : 'Recarga la página para reintentar.'}
        </p>
      )}
    </div>
  );
}
