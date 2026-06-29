"use client";

import { useEffect, useRef } from "react";
import Script from "next/script";

interface Props {
  onVerify: (token: string) => void;
  onExpire: () => void;
  onError: () => void;
}

declare global {
  interface Window {
    turnstile?: {
      render: (el: HTMLElement, opts: Record<string, unknown>) => string;
      reset: (id: string) => void;
      remove: (id: string) => void;
    };
  }
}

export default function TurnstileWidget({ onVerify, onExpire, onError }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);
  const onVerifyRef = useRef(onVerify);
  const onExpireRef = useRef(onExpire);
  const onErrorRef = useRef(onError);

  // Mantener refs actualizadas sin re-renderizar el widget
  useEffect(() => { onVerifyRef.current = onVerify; }, [onVerify]);
  useEffect(() => { onExpireRef.current = onExpire; }, [onExpire]);
  useEffect(() => { onErrorRef.current = onError; }, [onError]);

  function renderWidget() {
    if (!containerRef.current || !window.turnstile) return;
    if (widgetIdRef.current !== null) {
      window.turnstile.remove(widgetIdRef.current);
      widgetIdRef.current = null;
    }
    const sitekey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
    if (!sitekey) {
      console.error("[Turnstile] NEXT_PUBLIC_TURNSTILE_SITE_KEY no está definida");
      onErrorRef.current();
      return;
    }
    widgetIdRef.current = window.turnstile.render(containerRef.current, {
      sitekey,
      callback: (token: string) => onVerifyRef.current(token),
      "expired-callback": () => onExpireRef.current(),
      "error-callback": () => onErrorRef.current(),
    });
  }

  useEffect(() => {
    // Si el script ya estaba cargado de una visita anterior, renderizar de inmediato
    if (window.turnstile) renderWidget();

    return () => {
      if (widgetIdRef.current !== null && window.turnstile) {
        window.turnstile.remove(widgetIdRef.current);
        widgetIdRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <>
      {/*
        Sin ?render=explicit: Turnstile usa su canal postMessage estándar.
        La inicialización explícita con render() se hace desde JS; el div no
        lleva data-sitekey ni clase cf-turnstile para evitar auto-detección duplicada.
      */}
      <Script
        src="https://challenges.cloudflare.com/turnstile/v0/api.js"
        strategy="afterInteractive"
        onLoad={renderWidget}
      />
      <div ref={containerRef} />
    </>
  );
}
