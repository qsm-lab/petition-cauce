"use client";

import { useEffect, useState } from "react";

interface Props {
  estado: string; // "1" (confirmada) | "expirada"
}

/** Banner mostrado al volver del enlace de confirmación del email (?confirmada=…). */
export default function ConfirmationBanner({ estado }: Props) {
  const [visible, setVisible] = useState(true);

  // Limpia el query param sin recargar, para que el banner no reaparezca al navegar
  useEffect(() => {
    const url = new URL(window.location.href);
    url.searchParams.delete("confirmada");
    window.history.replaceState(null, "", url.toString());
  }, []);

  if (!visible) return null;

  const ok = estado === "1" || estado === "visibilidad";
  const message =
    estado === "1"
      ? "¡Tu firma quedó confirmada! Gracias por sumar tu voz — compartí la campaña para que llegue más lejos."
      : estado === "visibilidad"
      ? "El cambio de visibilidad de tu firma quedó confirmado y aplicado."
      : "El enlace de confirmación expiró. Volvé a firmar para recibir un enlace nuevo, o pedí el reenvío desde el formulario.";

  return (
    <div
      role="status"
      className="sticky top-0 z-50 flex items-start gap-3 px-5 py-3.5"
      style={{
        background: ok ? "var(--bp, #D7F24C)" : "#FEF3C7",
        color: "var(--bink, #16261F)",
      }}
    >
      <span className="text-[15px] leading-none mt-0.5">{ok ? "✓" : "⚠"}</span>
      <p className="flex-1 text-[13.5px] leading-snug font-medium">{message}</p>
      <button
        onClick={() => setVisible(false)}
        aria-label="Cerrar aviso"
        className="text-[16px] leading-none opacity-60 hover:opacity-100"
      >
        ×
      </button>
    </div>
  );
}
