"use client";

import { useEffect, useRef, useState } from "react";

interface Props {
  count: number;
  goal: number | null;
  authority: string | null;
  showAuthority?: boolean;
  showGoal?: boolean;
  status: string;
  categoryColor: string;
  onSign: () => void;
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
}: Props) {
  const [pctW, setPctW] = useState(0);
  const [showFloat, setShowFloat] = useState(false);
  const blockRef = useRef<HTMLDivElement>(null);

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
    if (!blockRef.current) return;
    const io = new IntersectionObserver(
      ([entry]) => setShowFloat(!entry.isIntersecting),
      { threshold: 0 }
    );
    io.observe(blockRef.current);
    return () => io.disconnect();
  }, []);

  const FONT_DISPLAY = "var(--font-anton, 'Anton', sans-serif)";
  const FONT_BODY = "var(--font-work-sans, 'Work Sans', sans-serif)";

  return (
    <>
      {/* Main card */}
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
            {/* Flag icon */}
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
                position: "relative",
              }}
            >
              <span style={{ width: 2, height: 16, background: "#FBF0E6", position: "absolute", left: 11, top: 7, borderRadius: 1 }} />
              <span style={{ width: 11, height: 8, background: "#FBF0E6", position: "absolute", left: 13, top: 7, borderRadius: "0 3px 3px 0" }} />
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

        {/* Counter */}
        <div>
          <div style={{ fontFamily: FONT_DISPLAY, fontSize: 40, lineHeight: 1, color: "#16261F" }}>
            {count.toLocaleString("es-EC")}
          </div>
          {effectiveGoal && (
            <div style={{ fontSize: 15, fontWeight: 500, color: "rgba(22,38,31,0.78)" }}>
              de {effectiveGoal.toLocaleString("es-EC")} firmas objetivo
            </div>
          )}
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

        {/* CTA button */}
        <button
          onClick={canSign ? onSign : undefined}
          disabled={!canSign}
          style={{
            fontFamily: FONT_BODY,
            fontSize: 18,
            fontWeight: 700,
            color: canSign ? "var(--bop, #16261F)" : "rgba(22,38,31,0.4)",
            background: canSign ? "var(--bp, #D7F24C)" : "rgba(22,38,31,0.1)",
            border: "none",
            borderRadius: 30,
            padding: "18px 24px",
            cursor: canSign ? "pointer" : "not-allowed",
            width: "100%",
            opacity: isClosed ? 0.5 : 1,
            transition: "opacity .2s",
          }}
        >
          {ctaLabel}
        </button>

        <div style={{ fontSize: 13, fontWeight: 500, color: "rgba(22,38,31,0.72)", lineHeight: 1.55, textAlign: "center" }}>
          Confirmamos tu firma por correo. Por defecto es privada — vos elegís cómo aparece.
        </div>
      </div>

      {/* Floating CTA — solo móvil. El display va en clases (flex + md:hidden):
          un display inline anularía el md:hidden */}
      {showFloat && canSign && (
        <div
          className="flex items-center gap-3 md:hidden animate-pc-float-in"
          style={{
            position: "fixed",
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 50,
            padding: "14px 16px calc(14px + env(safe-area-inset-bottom))",
            background: "#EDF4F1",
            borderTop: "1.5px solid #16261F",
            boxShadow: "0 -4px 16px rgba(22,38,31,0.1)",
          }}
        >
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#16261F" }}>
              {count.toLocaleString("es-EC")} firmas
            </div>
            {effectiveGoal && (
              <div style={{ fontSize: 11, color: "rgba(22,38,31,0.55)" }}>
                de {effectiveGoal.toLocaleString("es-EC")}
              </div>
            )}
          </div>
          <button
            onClick={onSign}
            style={{
              fontFamily: FONT_BODY,
              fontSize: 15,
              fontWeight: 700,
              color: "var(--bop, #16261F)",
              background: "var(--bp, #D7F24C)",
              border: "none",
              borderRadius: 26,
              padding: "14px 22px",
              cursor: "pointer",
            }}
          >
            {ctaLabel}
          </button>
        </div>
      )}
    </>
  );
}
