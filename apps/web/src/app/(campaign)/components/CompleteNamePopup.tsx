"use client";

import { useEffect, useState } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8011";

interface Props {
  token: string;
}

type Stage = "loading" | "form" | "invalid" | "done";

/** Popup mostrado al volver del email "Completa tu firma" (?completar=<token>):
 *  remediación de firmas con nombre null/incompleto. Consolida completar el
 *  nombre + confirmar la firma (si seguía pendiente) en un solo paso. */
export default function CompleteNamePopup({ token }: Props) {
  const [open, setOpen] = useState(true);
  const [stage, setStage] = useState<Stage>("loading");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [newlyConfirmed, setNewlyConfirmed] = useState(false);

  // Limpia el query param sin recargar, para que el popup no reaparezca al navegar
  useEffect(() => {
    const u = new URL(window.location.href);
    u.searchParams.delete("completar");
    window.history.replaceState(null, "", u.toString());
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetch(`${API_URL}/v1/public-campaign/complete/${token}`)
      .then((res) => {
        if (cancelled) return;
        setStage(res.ok ? "form" : "invalid");
      })
      .catch(() => !cancelled && setStage("invalid"));
    return () => { cancelled = true; };
  }, [token]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  if (!open) return null;

  async function handleSubmit() {
    setSending(true);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/v1/public-campaign/complete/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: "Error desconocido" }));
        throw new Error(typeof err.detail === "string" ? err.detail : "No se pudo guardar tu nombre");
      }
      const data = await res.json();
      setNewlyConfirmed(!!data.newly_confirmed);
      setStage("done");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error al guardar");
    } finally {
      setSending(false);
    }
  }

  const FONT_DISPLAY = "var(--font-anton, 'Anton', sans-serif)";
  const FONT_BODY = "var(--font-work-sans, 'Work Sans', sans-serif)";

  return (
    <div
      className="fixed inset-0 z-[110] flex items-end md:items-center md:justify-center"
      style={{ background: "rgba(18,34,46,.55)", backdropFilter: "blur(3px)" }}
      onClick={(e) => e.target === e.currentTarget && setOpen(false)}
      role="dialog"
      aria-modal="true"
      aria-label="Completar y validar firma"
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
        <button
          onClick={() => setOpen(false)}
          aria-label="Cerrar"
          style={{
            position: "absolute", top: 14, right: 14, width: 34, height: 34,
            borderRadius: "50%", background: "#fff", border: "1.5px solid #16261F",
            fontSize: 15, cursor: "pointer", color: "#16261F",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}
        >
          ✕
        </button>

        <div style={{ padding: "6px 36px 16px 4px" }}>
          <div style={{ fontFamily: FONT_DISPLAY, fontSize: 24, lineHeight: 1.15, color: "#16261F", marginBottom: 8 }}>
            {stage === "done" ? "¡Listo, gracias!" : "Completá tu firma"}
          </div>

          {stage === "loading" && (
            <p style={{ margin: 0, fontSize: 14.5, color: "rgba(22,38,31,0.75)" }}>Verificando enlace…</p>
          )}

          {stage === "invalid" && (
            <p style={{ margin: 0, fontSize: 14.5, lineHeight: 1.55, color: "rgba(22,38,31,0.75)" }}>
              Este enlace ya no es válido (venció o ya fue usado). Si necesitás completar tu firma,
              escribinos a la organización de la campaña.
            </p>
          )}

          {stage === "form" && (
            <>
              <p style={{ margin: "0 0 16px", fontSize: 14.5, lineHeight: 1.55, color: "rgba(22,38,31,0.75)" }}>
                Tu firma quedó registrada sin tu nombre completo. Completalo para validarla —
                tu nombre sigue sin mostrarse públicamente si así lo elegiste al firmar.
              </p>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
                placeholder="Nombre y apellido"
                autoFocus
                className="w-full px-3 py-2.5 rounded-[10px] text-[14.5px] mb-2"
                style={{ border: "1.5px solid #16261F30", background: "#fff", color: "#16261F" }}
              />
              {error && (
                <p style={{ margin: "0 0 8px", fontSize: 12.5, color: "#c2410c" }}>{error}</p>
              )}
              <button
                type="button"
                onClick={handleSubmit}
                disabled={sending}
                className="w-full py-3 rounded-[100px] font-bold text-[15px]"
                style={{ background: "#3d6b35", color: "#fff", opacity: sending ? 0.6 : 1, border: "none", cursor: "pointer" }}
              >
                {sending ? "Guardando…" : "Completar y validar →"}
              </button>
            </>
          )}

          {stage === "done" && (
            <p style={{ margin: 0, fontSize: 14.5, lineHeight: 1.55, color: "rgba(22,38,31,0.75)" }}>
              Guardamos tu nombre.{" "}
              {newlyConfirmed
                ? "Tu firma también quedó confirmada — gracias por tu apoyo."
                : "Gracias por tu apoyo."}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
