"use client";

import { useEffect, useRef, useState } from "react";
import { providerFor } from "@/lib/mail-providers";
import type { ResendResult } from "@/lib/signatures-api";

export type ResendUi = "idle" | "sending" | ResendResult;

interface Props {
  name: string;
  email: string;
  resend: ResendUi;
  onResend: () => void;
  /** Pasa al popup de compartir. */
  onDone: () => void;
}

const AUTO_CLOSE_SECONDS = 10;
const INFO = "#1d5fa8";
const INFO_INK = "#0f3d6e";

/** revision-datos-al-firmar R20–R26: «Revisa tu correo». Abrir el servicio de correo (si es reconocido), reenviar, y paso automático a compartir. */
export default function StepSuccess({ name, email, resend, onResend, onDone }: Props) {
  const FONT_DISPLAY = "var(--font-anton, 'Anton', sans-serif)";
  const FONT_BODY    = "var(--font-work-sans, 'Work Sans', sans-serif)";

  const provider = providerFor(email);
  const [left, setLeft] = useState(AUTO_CLOSE_SECONDS);
  const [paused, setPaused] = useState(false);
  const doneRef = useRef(onDone);
  doneRef.current = onDone;

  // Reenviar reinicia la cuenta atrás: la persona está esperando el correo nuevo.
  useEffect(() => { if (resend === "ok") { setLeft(AUTO_CLOSE_SECONDS); } }, [resend]);

  useEffect(() => {
    if (paused) return;
    if (left <= 0) { doneRef.current(); return; }
    const t = setTimeout(() => setLeft((n) => n - 1), 1000);
    return () => clearTimeout(t);
  }, [left, paused]);

  const resendLabel = resend === "sending" ? "Enviando…" : "Reenviar correo de confirmación";
  const msg =
    resend === "ok" ? { cls: "#3d6b35", text: "Correo reenviado. Puede tardar un minuto." }
    : resend === "rate_limited" ? { cls: INFO_INK, text: "Ya reenviamos varias veces. Espere un minuto e inténtelo de nuevo." }
    : resend === "error" ? { cls: "#9a3412", text: "No pudimos reenviarlo. Inténtelo de nuevo." }
    : null;
  const resendLocked = resend === "sending" || resend === "rate_limited";

  const btnBase = { width: "100%", borderRadius: 30, fontFamily: FONT_BODY, cursor: "pointer" } as const;

  return (
    <div style={{ display: "flex", flexDirection: "column", textAlign: "center", alignItems: "center", padding: "20px 10px 10px" }}>
      <div
        style={{ width: 56, height: 56, borderRadius: "50%", background: "#DCE9E6", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 20, flexShrink: 0 }}
        aria-hidden="true"
      >
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#16261F" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <rect x="2" y="4" width="20" height="16" rx="2" />
          <polyline points="2,4 12,13 22,4" />
        </svg>
      </div>

      <h2 style={{ fontFamily: FONT_DISPLAY, fontWeight: 400, fontSize: 26, margin: "0 0 10px", color: "#16261F", lineHeight: 1.2 }}>
        {name && <span style={{ color: INFO }}>{name}</span>}
        {name ? ", por favor," : "Por favor,"}<br />confirme su correo
      </h2>

      <div style={{ fontSize: 15, color: "rgba(22,38,31,0.7)", lineHeight: 1.5, marginBottom: 6, fontFamily: FONT_BODY }}>
        Enviamos un enlace de confirmación a:
      </div>
      <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 16, wordBreak: "break-all", color: "#16261F", fontFamily: FONT_BODY }}>{email}</div>

      {/* Aviso de spam: azul y destacado, antes de las acciones */}
      <div
        style={{
          display: "flex", gap: 12, alignItems: "flex-start", textAlign: "left", width: "100%", boxSizing: "border-box", marginBottom: 16,
          background: "rgba(29,95,168,0.10)", color: INFO_INK, border: `1.5px solid ${INFO}`, borderRadius: 14, padding: 16,
          fontSize: 17, lineHeight: 1.45, fontFamily: FONT_BODY,
        }}
      >
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke={INFO} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 1 }} aria-hidden="true">
          <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
        <div>
          <p style={{ margin: 0, fontWeight: 700 }}>Si no lo ve, revise la carpeta de spam o correo no deseado.</p>
          <p style={{ margin: "6px 0 0", fontSize: 15 }}>El enlace vence en 24 horas.</p>
        </div>
      </div>

      {provider && (
        <a
          href={provider.url}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            ...btnBase, boxSizing: "border-box", display: "flex", alignItems: "center", justifyContent: "center", minHeight: 56, fontSize: 18, fontWeight: 700,
            color: "var(--bop, #16261F)", background: "var(--bp, #D7F24C)", border: "1.5px solid #16261F", textDecoration: "none", marginBottom: 10,
          }}
        >
          Abrir {provider.name}
        </a>
      )}

      <button
        type="button"
        onClick={onResend}
        disabled={resendLocked}
        style={{
          ...btnBase, minHeight: 48, fontSize: 15, fontWeight: 600, color: "#16261F", background: "#fff", border: "1.5px solid #16261F",
          cursor: resendLocked ? "default" : "pointer", opacity: resend === "sending" ? 0.6 : 1, marginBottom: 8,
        }}
      >
        {resendLabel}
      </button>
      <p role="status" aria-live="polite" style={{ margin: "0 0 8px", fontSize: 14.5, fontWeight: 600, lineHeight: 1.4, color: msg?.cls, minHeight: msg ? undefined : 0, fontFamily: FONT_BODY }}>
        {msg?.text}
      </p>

      {/* Cuenta atrás: al llegar a 0 se abre el popup de compartir */}
      <div style={{ width: "100%", borderTop: "1px solid rgba(22,38,31,0.15)", paddingTop: 10, fontFamily: FONT_BODY }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
          <span style={{ fontSize: 14.5, color: "rgba(22,38,31,0.72)", fontVariantNumeric: "tabular-nums" }}>
            {paused ? "Cierre automático detenido." : <>Pasamos a compartir la campaña en <b style={{ color: "#16261F" }}>{left} s</b>.</>}
          </span>
          <span style={{ display: "flex", gap: 4 }}>
            {!paused && (
              <button type="button" onClick={() => setPaused(true)} style={linkBtn}>Seguir aquí</button>
            )}
            <button type="button" onClick={onDone} style={linkBtn}>Ir a compartir la campaña</button>
          </span>
        </div>
      </div>
    </div>
  );
}

const linkBtn: React.CSSProperties = {
  background: "none", border: 0, padding: "10px 4px", minHeight: 44, fontSize: 15, fontWeight: 600, color: "#16261F",
  textDecoration: "underline", textUnderlineOffset: 3, cursor: "pointer", fontFamily: "var(--font-work-sans, 'Work Sans', sans-serif)",
};
