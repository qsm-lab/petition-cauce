"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import type { AdminSignatureItem } from "@/lib/admin-signatures-api";

const BADGE: Record<string, { label: string; bg: string; color: string }> = {
  publica: { label: "Pública", bg: "#DCE9E6", color: "#16261F" },
  anonima: { label: "Anónima", bg: "var(--bbg)", color: "var(--bmut)" },
  secreta: { label: "Secreta", bg: "color-mix(in srgb,#c2410c 10%,transparent)", color: "#c2410c" },
};

const VISIBILITIES = ["publica", "anonima", "secreta"] as const;

interface Props {
  campaignId: string;
  signature: AdminSignatureItem;
}

/** Badge de visibilidad + acción de cambio (a pedido verbal del firmante).
 *  El cambio NO se aplica aquí: se envía un email de confirmación al titular. */
export default function VisibilityCell({ campaignId, signature }: Props) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(signature.pending_visibility);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const badge = BADGE[signature.visibility] ?? BADGE.anonima;
  const canChange = signature.status === "confirmed";

  async function requestChange(target: string) {
    if (
      !window.confirm(
        `Se enviará un email al firmante para confirmar el cambio a ${BADGE[target].label}. ` +
          "El cambio solo se aplica cuando el firmante lo confirme. ¿Continuar?"
      )
    ) {
      return;
    }
    setSending(true);
    setError(null);
    try {
      await api.patch(`/v1/admin/campaigns/${campaignId}/signatures/${signature.id}/visibility`, {
        visibility: target,
      });
      setPending(target as AdminSignatureItem["pending_visibility"]);
      setOpen(false);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error al solicitar el cambio");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2">
        <span
          className="inline-flex items-center font-semibold text-[11px]"
          style={{ background: badge.bg, color: badge.color, padding: "3px 8px", borderRadius: "99px" }}
          aria-label={`Visibilidad: ${badge.label}`}
        >
          {badge.label}
        </span>
        {canChange && !pending && (
          <button
            type="button"
            onClick={() => setOpen(!open)}
            className="text-[11px] font-semibold underline-offset-2 hover:underline"
            style={{ color: "var(--bmut)" }}
          >
            {open ? "cancelar" : "cambiar"}
          </button>
        )}
      </div>

      {pending && (
        <span className="text-[10.5px] font-medium" style={{ color: "#b45309" }}>
          → {BADGE[pending]?.label ?? pending} · por confirmar del firmante
        </span>
      )}

      {open && !pending && (
        <div className="flex gap-1.5">
          {VISIBILITIES.filter((v) => v !== signature.visibility).map((v) => (
            <button
              key={v}
              type="button"
              disabled={sending || (v === "publica" && !signature.name)}
              title={v === "publica" && !signature.name ? "Sin nombre almacenado: no puede pasar a pública" : undefined}
              onClick={() => requestChange(v)}
              className="text-[11px] font-semibold px-2 py-0.5 rounded-[6px] disabled:opacity-40 disabled:cursor-not-allowed"
              style={{ border: "1px solid var(--bbord)", color: "var(--bink)", background: "var(--bbg)" }}
            >
              {sending ? "…" : BADGE[v].label}
            </button>
          ))}
        </div>
      )}

      {error && (
        <span className="text-[10.5px]" style={{ color: "#c2410c" }}>
          {error}
        </span>
      )}
    </div>
  );
}
