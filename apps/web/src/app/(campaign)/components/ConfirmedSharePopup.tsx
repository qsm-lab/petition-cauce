"use client";

import { useEffect, useState } from "react";
import ShareSection from "./ShareSection";

interface Props {
  /** Nombre del firmante (solo llega si la firma es pública) */
  name?: string | null;
  title: string;
  url: string;
  status: string;
  showQr?: boolean;
  qrCodeData?: string | null;
  shareText?: string | null;
}

/** Popup mostrado al volver del email de confirmación (?confirmada=1):
    agradece por nombre y motiva a compartir la campaña recién apoyada. */
export default function ConfirmedSharePopup({
  name,
  title,
  url,
  status,
  showQr = false,
  qrCodeData,
  shareText,
}: Props) {
  const [open, setOpen] = useState(true);

  // Limpia los query params sin recargar, para que el popup no reaparezca al navegar
  useEffect(() => {
    const u = new URL(window.location.href);
    u.searchParams.delete("confirmada");
    u.searchParams.delete("nombre");
    window.history.replaceState(null, "", u.toString());
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  if (!open) return null;

  const firstName = (name ?? "").trim().split(" ")[0];
  const FONT_DISPLAY = "var(--font-anton, 'Anton', sans-serif)";
  const FONT_BODY = "var(--font-work-sans, 'Work Sans', sans-serif)";

  return (
    <div
      className="fixed inset-0 z-[110] flex items-end md:items-center md:justify-center"
      style={{ background: "rgba(18,34,46,.55)", backdropFilter: "blur(3px)" }}
      onClick={(e) => e.target === e.currentTarget && setOpen(false)}
      role="dialog"
      aria-modal="true"
      aria-label="Firma confirmada — comparte la campaña"
    >
      <div
        className="w-full md:max-w-[440px] rounded-t-[24px] md:rounded-[20px] max-h-[88vh] overflow-y-auto"
        style={{
          background: "#EDF4F1",
          padding: 24,
          position: "relative",
          boxShadow: "0 20px 60px rgba(22,38,31,.3)",
          boxSizing: "border-box",
          fontFamily: FONT_BODY,
        }}
      >
        {/* Cerrar */}
        <button
          onClick={() => setOpen(false)}
          aria-label="Cerrar"
          style={{
            position: "absolute",
            top: 14,
            right: 14,
            width: 34,
            height: 34,
            borderRadius: "50%",
            background: "#fff",
            border: "1.5px solid #16261F",
            fontSize: 15,
            cursor: "pointer",
            color: "#16261F",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          ✕
        </button>

        {/* CTA de agradecimiento */}
        <div style={{ padding: "6px 36px 16px 4px" }}>
          <div
            style={{
              fontFamily: FONT_DISPLAY,
              fontSize: 26,
              lineHeight: 1.15,
              color: "#16261F",
              marginBottom: 8,
            }}
          >
            {firstName ? `¡Gracias, ${firstName}!` : "¡Gracias por tu firma!"}
          </div>
          <p style={{ margin: 0, fontSize: 14.5, lineHeight: 1.55, color: "rgba(22,38,31,0.75)" }}>
            Tu firma quedó confirmada y ya suma. Ahora ayúdala a llegar más lejos:
            comparte la campaña con tu gente — cada voz cuenta.
          </p>
        </div>

        <ShareSection
          title={title}
          url={url}
          status={status}
          showQr={showQr}
          qrCodeData={qrCodeData}
          shareText={shareText}
        />
      </div>
    </div>
  );
}
