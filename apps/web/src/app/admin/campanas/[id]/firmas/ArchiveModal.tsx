"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import type { AdminSignatureItem } from "@/lib/admin-signatures-api";

interface Props {
  campaignId: string;
  signature: AdminSignatureItem;
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("es-EC", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "America/Guayaquil",
  });
}

/** Botón "Archivar" con confirmación de 2 pasos (R1), o "Restaurar" dentro de la ventana (R5, R6). */
export default function ArchiveModal({ campaignId, signature }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<1 | 2>(1);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (signature.anonymized_at) {
    return (
      <span
        className="inline-flex items-center font-semibold text-[11px]"
        style={{ background: "var(--bbg)", color: "var(--bmut)", padding: "3px 8px", borderRadius: "99px" }}
      >
        Suprimida
      </span>
    );
  }

  async function handleRestore() {
    if (!window.confirm("¿Restaurar esta firma? Se cancelará la purga programada.")) return;
    setSending(true);
    setError(null);
    try {
      await api.post(`/v1/admin/campaigns/${campaignId}/signatures/${signature.id}/unarchive`, {});
      router.refresh();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error al restaurar");
    } finally {
      setSending(false);
    }
  }

  async function handleArchive() {
    setSending(true);
    setError(null);
    try {
      await api.post(`/v1/admin/campaigns/${campaignId}/signatures/${signature.id}/archive`, {});
      setOpen(false);
      setStep(1);
      router.refresh();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error al archivar");
    } finally {
      setSending(false);
    }
  }

  if (signature.archived_at) {
    return (
      <div className="flex flex-col gap-1">
        <span
          className="inline-flex items-center font-semibold text-[11px]"
          style={{ background: "color-mix(in srgb,#b45309 12%,transparent)", color: "#b45309", padding: "3px 8px", borderRadius: "99px" }}
        >
          Archivada — purga el {signature.purge_after ? fmtDate(signature.purge_after) : "—"}
        </span>
        <button
          type="button"
          onClick={handleRestore}
          disabled={sending}
          className="text-[11px] font-semibold underline-offset-2 hover:underline text-left disabled:opacity-40"
          style={{ color: "var(--bmut)" }}
        >
          {sending ? "…" : "Restaurar"}
        </button>
        {error && <span className="text-[10.5px]" style={{ color: "#c2410c" }}>{error}</span>}
      </div>
    );
  }

  if (signature.status !== "confirmed") return null;

  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-[11px] font-semibold underline-offset-2 hover:underline text-left"
        style={{ color: "var(--bmut)" }}
      >
        Archivar
      </button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,.45)" }}
        >
          <div
            className="w-full max-w-[420px] rounded-[16px] p-6"
            style={{ background: "var(--bsurf)", border: "1px solid var(--bbord)" }}
          >
            {step === 1 ? (
              <>
                <h2 className="font-display font-bold text-[16px] mb-2" style={{ color: "var(--bink)" }}>
                  Archivar firma
                </h2>
                <p className="text-[13px] mb-4" style={{ color: "var(--bmut)" }}>
                  Esta acción es para solicitudes de supresión recibidas por un canal no digital
                  (email, en territorio). Al confirmar:
                </p>
                <ul className="text-[13px] mb-5 pl-4 list-disc space-y-1" style={{ color: "var(--bmut)" }}>
                  <li>Se notificará al firmante por email.</li>
                  <li>Sus datos personales se eliminarán definitivamente en 15 días.</li>
                  <li>Su apoyo seguirá contando de forma anónima en el total de la campaña.</li>
                  <li>Puede revertirse dentro de esos 15 días.</li>
                </ul>
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => { setOpen(false); setStep(1); }}
                    className="px-4 py-2 rounded-[10px] text-[13px] font-semibold"
                    style={{ border: "1px solid var(--bbord)", color: "var(--bink)" }}
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={() => setStep(2)}
                    className="px-4 py-2 rounded-[10px] text-[13px] font-semibold text-white"
                    style={{ background: "#c2410c" }}
                  >
                    Continuar
                  </button>
                </div>
              </>
            ) : (
              <>
                <h2 className="font-display font-bold text-[16px] mb-2" style={{ color: "var(--bink)" }}>
                  ¿Confirmar el archivado?
                </h2>
                <p className="text-[13px] mb-5" style={{ color: "var(--bmut)" }}>
                  Esta acción notificará al firmante ahora mismo. ¿Continuar?
                </p>
                {error && (
                  <p className="text-[12.5px] mb-3" style={{ color: "#c2410c" }}>{error}</p>
                )}
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setStep(1)}
                    disabled={sending}
                    className="px-4 py-2 rounded-[10px] text-[13px] font-semibold disabled:opacity-40"
                    style={{ border: "1px solid var(--bbord)", color: "var(--bink)" }}
                  >
                    Atrás
                  </button>
                  <button
                    type="button"
                    onClick={handleArchive}
                    disabled={sending}
                    className="px-4 py-2 rounded-[10px] text-[13px] font-semibold text-white disabled:opacity-60"
                    style={{ background: "#c2410c" }}
                  >
                    {sending ? "Archivando…" : "Archivar firma"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
