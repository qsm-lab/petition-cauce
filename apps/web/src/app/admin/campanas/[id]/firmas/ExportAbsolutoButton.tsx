"use client";

import { useState } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8011";

interface Props {
  campaignId: string;
  total: number;
}

/** Descarga de PII sin enmascarar (nombre, cédula, email en claro) para armar
 *  el documento de entrega oficial. Excluye siempre las firmas secretas.
 *  Re-valida la contraseña del admin y notifica a la org + a la plataforma. */
export default function ExportAbsolutoButton({ campaignId, total }: Props) {
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const disabled = total === 0;

  async function handleConfirm() {
    if (!password) {
      setError("Ingresa tu contraseña para continuar");
      return;
    }
    setSending(true);
    setError(null);
    try {
      const res = await fetch(
        `${API_URL}/v1/admin/campaigns/${campaignId}/signatures/export-absoluto`,
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ password }),
        },
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: "Error desconocido" }));
        const detail = typeof err.detail === "string" ? err.detail : "No se pudo completar la descarga";
        // El backend usa 401 tanto para "contraseña incorrecta" (re-validación
        // de este paso) como para sesión vencida (get_current_user) — solo la
        // segunda debe mandar a relogueáse; la primera se muestra inline para
        // que el admin reintente la contraseña.
        if (res.status === 401 && detail !== "Contraseña incorrecta") {
          window.location.href = "/login";
          return;
        }
        throw new Error(detail);
      }
      const blob = await res.blob();
      const disposition = res.headers.get("Content-Disposition") ?? "";
      const match = disposition.match(/filename="?([^"]+)"?/);
      const filename = match?.[1] ?? `firmas-entrega-absoluta-${campaignId}.csv`;

      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);

      setPassword("");
      setOpen(false);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error al descargar");
    } finally {
      setSending(false);
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        disabled={disabled}
        aria-disabled={disabled}
        className="flex items-center gap-1.5 font-semibold text-[13px] rounded-[9px] px-4"
        style={{
          minHeight: "34px",
          backgroundColor: disabled ? "var(--bbord)" : "color-mix(in srgb, #b45309 12%, transparent)",
          color: disabled ? "var(--bmut)" : "#b45309",
          border: `1px solid ${disabled ? "var(--bbord)" : "color-mix(in srgb, #b45309 30%, transparent)"}`,
          cursor: disabled ? "not-allowed" : "pointer",
        }}
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M7 1v8M4 6l3 3 3-3" />
          <path d="M1 10v1a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2v-1" />
          <circle cx="7" cy="7" r="6.25" />
        </svg>
        Descarga absoluta
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: "rgba(20,24,18,0.5)" }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="export-absoluto-title"
        >
          <div
            className="w-full max-w-[440px] rounded-[16px] p-6"
            style={{ backgroundColor: "var(--bsurf)", border: "1px solid var(--bbord)" }}
          >
            <h2 id="export-absoluto-title" className="font-display font-bold text-[17px] mb-2" style={{ color: "#b45309" }}>
              Descarga absoluta de datos
            </h2>
            <p className="text-[13px] leading-relaxed mb-3" style={{ color: "var(--bink)" }}>
              Vas a descargar <strong>toda la información sin enmascarar</strong> (nombre, cédula
              y correo en claro) de las firmas públicas y anónimas de esta campaña —
              confirmadas y también las que aún no completaron la confirmación por email
              (la columna "estado" del archivo distingue cuáles), para armar el documento de
              entrega oficial. Las firmas secretas nunca se incluyen.
            </p>
            <p className="text-[12.5px] leading-relaxed mb-4" style={{ color: "var(--bmut)" }}>
              El resguardo de este archivo es tu responsabilidad desde el momento de la descarga.
              Esta acción queda registrada y se notifica automáticamente a la organización
              responsable de la campaña y a la plataforma.
            </p>

            <label className="block text-[12px] font-semibold mb-1.5" style={{ color: "var(--bmut)" }}>
              Confirma tu contraseña
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleConfirm()}
              autoFocus
              className="w-full px-3 py-2 rounded-[9px] text-[13px] mb-1"
              style={{ border: "1px solid var(--bbord)", backgroundColor: "var(--bbg)", color: "var(--bink)" }}
            />
            {error && (
              <p className="text-[12px] mb-2" style={{ color: "#c2410c" }}>{error}</p>
            )}

            <div className="flex items-center justify-end gap-2 mt-4">
              <button
                type="button"
                onClick={() => { setOpen(false); setPassword(""); setError(null); }}
                disabled={sending}
                className="px-4 py-2 rounded-[9px] text-[13px] font-semibold"
                style={{ color: "var(--bmut)" }}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirm}
                disabled={sending}
                className="px-4 py-2 rounded-[9px] text-[13px] font-semibold text-white"
                style={{ backgroundColor: "#b45309", opacity: sending ? 0.6 : 1 }}
              >
                {sending ? "Descargando…" : "Confirmar y descargar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
