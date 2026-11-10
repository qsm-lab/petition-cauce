"use client";

import { useEffect, useRef } from "react";
import type { ReviewRow } from "@/lib/review-rows";

interface Props {
  firstName: string;
  rows: ReviewRow[];
  /** Firmando: los dos botones quedan inertes para que un doble clic no envíe dos veces. */
  busy: boolean;
  onSign: () => void;
  onEdit: () => void;
}

const FONT_DISPLAY = "var(--font-anton, 'Anton', sans-serif)";
const FONT_BODY = "var(--font-work-sans, 'Work Sans', sans-serif)";
const INFO = "#1d5fa8";

/** revision-datos-al-firmar R4: resumen de lo que se va a enviar, con «Firmar» y «Editar datos». No envía nada por sí mismo. */
export default function StepReview({ firstName, rows, busy, onSign, onEdit }: Props) {
  const titleRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => { titleRef.current?.focus(); }, []);

  return (
    <div style={{ fontFamily: FONT_BODY, color: "#16261F" }}>
      <h2
        ref={titleRef}
        tabIndex={-1}
        style={{ fontFamily: FONT_DISPLAY, fontWeight: 400, fontSize: 26, lineHeight: 1.15, margin: "0 0 8px", paddingRight: 36, outline: "none" }}
      >
        {firstName && <span style={{ color: INFO }}>{firstName}</span>}
        {firstName ? ", verifique" : "Verifique"} que su información sea correcta
      </h2>
      <p style={{ fontSize: 15, lineHeight: 1.5, margin: "0 0 16px", color: "rgba(22,38,31,0.72)" }}>
        Revise los datos antes de firmar. Si algo no está bien, vuelva y corríjalo.
      </p>

      <dl style={{ margin: 0, padding: 0 }}>
        {rows.map((r, i) => (
          <div
            key={r.id}
            style={{
              display: "grid", gridTemplateColumns: "112px minmax(0,1fr)", gap: "4px 12px", padding: "11px 0",
              borderTop: i === 0 ? 0 : "1px solid rgba(22,38,31,0.15)",
            }}
          >
            <dt style={{ fontSize: 13, lineHeight: 1.4, fontWeight: 600, color: "rgba(22,38,31,0.72)", paddingTop: 2 }}>{r.label}</dt>
            <dd style={{ margin: 0, fontSize: 16, lineHeight: 1.4, fontWeight: 600, overflowWrap: "anywhere" }}>
              {r.empty ? <span style={{ fontWeight: 400, fontStyle: "italic", color: "rgba(22,38,31,0.72)" }}>{r.value}</span> : r.value}
              {r.note && (
                <small style={{ display: "block", fontSize: 13.5, fontWeight: 400, color: "rgba(22,38,31,0.72)", marginTop: 2, lineHeight: 1.45 }}>
                  {r.note}
                </small>
              )}
            </dd>
          </div>
        ))}
      </dl>

      <p style={{ fontSize: 14, lineHeight: 1.5, color: "rgba(22,38,31,0.72)", margin: "16px 0 0" }}>
        Después de firmar le enviaremos un enlace para confirmar su correo. Consulte el{" "}
        <a href="/aviso-de-privacidad" target="_blank" rel="noopener noreferrer" style={{ color: "#16261F", fontWeight: 600 }}>aviso de privacidad</a>.
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: 10, padding: "16px 0 4px" }}>
        <button
          type="button"
          onClick={onSign}
          aria-disabled={busy}
          style={{
            minHeight: 56, fontSize: 18, fontWeight: 700, borderRadius: 30, border: "1.5px solid #16261F", fontFamily: FONT_BODY,
            color: busy ? "rgba(22,38,31,0.6)" : "var(--bop, #16261F)", background: busy ? "rgba(22,38,31,0.1)" : "var(--bp, #D7F24C)",
            cursor: busy ? "progress" : "pointer",
          }}
        >
          {busy ? "Firmando…" : "Firmar"}
        </button>
        <button
          type="button"
          onClick={onEdit}
          disabled={busy}
          style={{
            minHeight: 48, fontSize: 16, fontWeight: 600, borderRadius: 30, border: "1.5px solid rgba(22,38,31,0.15)", background: "#fff",
            color: "#16261F", cursor: busy ? "default" : "pointer", fontFamily: FONT_BODY,
          }}
        >
          Editar datos
        </button>
      </div>
    </div>
  );
}
