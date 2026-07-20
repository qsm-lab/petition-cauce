"use client";

import { useState } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8011";

interface Props {
  campaignId: string;
}

/** Reenvía el email de confirmación a todas las firmas aún pendientes de
 *  la campaña (cualquier visibilidad), de un solo clic (regenera el token). */
export default function RemindPendingButton({ campaignId }: Props) {
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  async function handleClick() {
    if (!window.confirm("Se reenviará el email de confirmación a todas las firmas que aún no confirmaron. ¿Continuar?")) {
      return;
    }
    setSending(true);
    setResult(null);
    try {
      const res = await fetch(
        `${API_URL}/v1/admin/campaigns/${campaignId}/signatures/remind-pending`,
        { method: "POST", credentials: "include" },
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: "Error desconocido" }));
        throw new Error(typeof err.detail === "string" ? err.detail : "No se pudo enviar el recordatorio");
      }
      const data = await res.json();
      setResult(`Enviado a ${data.sent} de ${data.total_pending} pendientes`);
    } catch (e: unknown) {
      setResult(e instanceof Error ? e.message : "Error al enviar");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={handleClick}
        disabled={sending}
        className="flex items-center gap-1.5 font-semibold text-[13px] rounded-[9px] px-4"
        style={{
          minHeight: "34px",
          backgroundColor: "color-mix(in srgb, var(--bp) 12%, transparent)",
          color: "var(--bp)",
          border: "1px solid color-mix(in srgb, var(--bp) 25%, transparent)",
          cursor: sending ? "not-allowed" : "pointer",
          opacity: sending ? 0.6 : 1,
        }}
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M1 3l6 4 6-4M1 3v8h12V3H1z" />
        </svg>
        {sending ? "Enviando…" : "Recordar a pendientes"}
      </button>
      {result && (
        <span className="text-[12px]" style={{ color: "var(--bmut)" }}>{result}</span>
      )}
    </div>
  );
}
