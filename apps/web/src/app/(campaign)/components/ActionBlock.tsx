"use client";

import { useEffect, useRef, useState } from "react";
import SignHandIcon from "@/components/ui/SignHandIcon";

interface Props {
  count: number;
  goal: number | null;
  authority: string | null;
  showAuthority?: boolean;
  showGoal?: boolean;
  status: string;
  categoryColor: string;
  onSign: () => void;
  /** Desktop: colapsa todo salvo el botón (la tarjeta viaja por el sidebar) */
  compressed?: boolean;
}

const SIGNABLE = new Set(["draft", "active", "online"]);

export default function ActionBlock({
  count,
  goal,
  authority,
  showAuthority = true,
  showGoal = true,
  status,
  categoryColor,
  onSign,
  compressed = false,
}: Props) {
  const [pctW, setPctW] = useState(0);
  // El botón de firmar salió de vista → mostrar CTA flotante (móvil y desktop)
  const [showFloat, setShowFloat] = useState(false);
  const blockRef = useRef<HTMLDivElement>(null);
  const ctaRef = useRef<HTMLButtonElement>(null);

  const effectiveGoal = showGoal ? goal : null;
  const pct = effectiveGoal && effectiveGoal > 0
    ? Math.min(100, Math.round((count / effectiveGoal) * 100))
    : 0;
  const canSign = SIGNABLE.has(status);
  const isClosed = status === "closed";

  const ctaLabel = isClosed
    ? "Campaña cerrada"
    : status === "draft"
    ? "Firmar (modo prueba)"
    : "Firmar esta petición";

  useEffect(() => {
    const raf = requestAnimationFrame(() => setTimeout(() => setPctW(pct), 60));
    return () => cancelAnimationFrame(raf);
  }, [pct]);

  useEffect(() => {
    // Se observa el BOTÓN, no la tarjeta: en pantallas de 13-14" el botón sale
    // de vista mucho antes que el resto de la tarjeta
    if (!ctaRef.current) return;
    const io = new IntersectionObserver(
      ([entry]) => setShowFloat(!entry.isIntersecting),
      { threshold: 0 }
    );
    io.observe(ctaRef.current);
    return () => io.disconnect();
  }, []);

  const FONT_DISPLAY = "var(--font-anton, 'Anton', sans-serif)";
  const FONT_BODY = "var(--font-work-sans, 'Work Sans', sans-serif)";

  return (
    <>
      {/* Main card — flujo normal; al salir de vista lo releva el CTA compacto */}
      <div
        ref={blockRef}
        id="cauce-action-cta"
        style={{
          background: "#fff",
          border: "1.5px solid #16261F",
          borderRadius: 18,
          padding: 24,
          display: "flex",
          flexDirection: "column",
          gap: 16,
        }}
      >
        {/* CTA button — primero, con animación sutil al hover */}
        <button
          ref={ctaRef}
          onClick={canSign ? onSign : undefined}
          disabled={!canSign}
          className="group transition-all duration-200 ease-out enabled:hover:scale-[1.03] enabled:hover:shadow-[0_6px_18px_rgba(22,38,31,0.18)] enabled:active:scale-[0.99]"
          style={{
            fontFamily: FONT_BODY,
            fontSize: 18,
            fontWeight: 700,
            color: canSign ? "var(--bop, #16261F)" : "rgba(22,38,31,0.4)",
            background: canSign ? "var(--bp, #D7F24C)" : "rgba(22,38,31,0.1)",
            border: "1.5px solid #16261F",
            borderRadius: 30,
            padding: "18px 24px",
            cursor: canSign ? "pointer" : "not-allowed",
            width: "100%",
            opacity: isClosed ? 0.5 : 1,
          }}
        >
          <span className="inline-flex items-center justify-center">
            <SignHandIcon />
            {ctaLabel}
          </span>
        </button>

        {/* Contenido colapsable en desktop: comprimido queda solo el botón.
            En móvil las clases md:* no aplican y nunca se comprime. */}
        <div
          className={`flex flex-col gap-4 overflow-hidden transition-all duration-[650ms] ease-[cubic-bezier(0.22,0.61,0.36,1)] ${
            compressed
              ? "md:max-h-0 md:opacity-0 md:-mt-4"
              : "md:max-h-[560px] md:opacity-100 md:mt-0"
          }`}
        >
        {/* Counter — centrado al bloque */}
        <div style={{ textAlign: "center" }}>
          <div style={{ fontFamily: FONT_DISPLAY, fontSize: 40, lineHeight: 1, color: "#16261F" }}>
            {count.toLocaleString("es-EC")}
          </div>
          <div style={{ fontSize: 14, fontWeight: 500, color: "rgba(22,38,31,0.78)" }}>
            {effectiveGoal
              ? `de ${effectiveGoal.toLocaleString("es-EC")} firmas objetivo`
              : count === 1 ? "firma confirmada" : "firmas confirmadas"}
          </div>
        </div>

        {/* Progress bar */}
        {effectiveGoal && (
          <div
            role="progressbar"
            aria-valuenow={pct}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`${pct}% del objetivo alcanzado`}
            style={{ height: 10, borderRadius: 6, background: "rgba(22,38,31,0.1)" }}
          >
            <div
              style={{
                height: "100%",
                borderRadius: 6,
                background: categoryColor,
                width: `${pctW}%`,
                transition: "width 1.1s cubic-bezier(.22,1,.36,1)",
              }}
            />
          </div>
        )}

        {/* Authority chip — full width */}
        {showAuthority && authority && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              background: "#16261F",
              color: "#FBF0E6",
              borderRadius: 14,
              padding: "14px 18px",
              width: "100%",
              boxSizing: "border-box",
            }}
          >
            {/* Edificio gubernamental */}
            <span
              style={{
                width: 32,
                height: 32,
                borderRadius: "50%",
                background: "rgba(251,240,230,0.15)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <svg
                width="17"
                height="17"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#FBF0E6"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <line x1="3" y1="22" x2="21" y2="22" />
                <line x1="6" y1="18" x2="6" y2="11" />
                <line x1="10" y1="18" x2="10" y2="11" />
                <line x1="14" y1="18" x2="14" y2="11" />
                <line x1="18" y1="18" x2="18" y2="11" />
                <polygon points="12 2 20 7 4 7" fill="#FBF0E6" stroke="none" />
              </svg>
            </span>
            <div style={{ minWidth: 0 }}>
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: "0.07em",
                  textTransform: "uppercase",
                  opacity: 0.6,
                  marginBottom: 3,
                }}
              >
                Dirigida a
              </div>
              <div style={{ fontSize: 15, fontWeight: 700, lineHeight: 1.25 }}>
                {authority}
              </div>
            </div>
          </div>
        )}

        <div style={{ fontSize: 13, fontWeight: 500, color: "rgba(22,38,31,0.72)", lineHeight: 1.55, textAlign: "center" }}>
          Confirmamos su firma por correo. Por defecto es pública — usted elige cómo aparece.
        </div>
        </div>{/* fin contenido colapsable */}
      </div>

      {/* Floating CTA — solo móvil. El display va en clases (flex + md:hidden):
          un display inline anularía el md:hidden. Siempre montado: entra y sale
          deslizándose con transform (animable en ambos sentidos). */}
      {canSign && (
        <div
          className="flex items-center gap-3 md:hidden"
          aria-hidden={!showFloat}
          style={{
            position: "fixed",
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 50,
            padding: "14px 16px calc(14px + env(safe-area-inset-bottom))",
            background: "#2B4EEA",
            borderTop: "1.5px solid #16261F",
            boxShadow: "0 -4px 16px rgba(22,38,31,0.18)",
            transform: showFloat ? "translateY(0)" : "translateY(110%)",
            opacity: showFloat ? 1 : 0,
            transition: "transform 0.45s cubic-bezier(0.22,1,0.36,1), opacity 0.35s ease",
            pointerEvents: showFloat ? "auto" : "none",
          }}
        >
          <button
            onClick={onSign}
            tabIndex={showFloat ? 0 : -1}
            style={{
              fontFamily: FONT_BODY,
              fontSize: 16,
              fontWeight: 700,
              color: "var(--bop, #16261F)",
              background: "var(--bp, #D7F24C)",
              border: "1.5px solid #16261F",
              borderRadius: 26,
              padding: "15px 22px",
              cursor: "pointer",
              width: "100%",
            }}
          >
            {ctaLabel}
          </button>
        </div>
      )}
    </>
  );
}
