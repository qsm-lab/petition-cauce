"use client";

import { useState } from "react";
import type { LifecycleEventOut } from "@/lib/admin-campaigns-api";
import { advanceLifecycleStage } from "@/lib/admin-lifecycle-api";
import LifecycleConfirmModal from "./LifecycleConfirmModal";
import AdherentCommsModal from "./AdherentCommsModal";

const STAGE_NAMES = ["Lanzada", "Recolección", "Entrega", "Diálogo", "Decisión"];

interface LifecycleConfig {
  dialogo: boolean;
  decision: boolean;
}

interface Props {
  campaignId: string;
  initialStage: number;
  initialEvents: LifecycleEventOut[];
  orgName: string | null;
  orgHasContactEmail: boolean;
  lifecycleConfig?: LifecycleConfig;
  onLifecycleConfigChange?: (config: LifecycleConfig) => void;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("es-EC", { day: "2-digit", month: "short", year: "numeric", timeZone: "America/Guayaquil" });
}

export default function LifecyclePanelAdmin({
  campaignId,
  initialStage,
  initialEvents,
  orgName,
  orgHasContactEmail,
  lifecycleConfig = { dialogo: true, decision: true },
  onLifecycleConfigChange,
}: Props) {
  const [currentStage, setCurrentStage] = useState(initialStage);
  // Índices visibles: 3=Diálogo y 4=Decisión son opcionales por campaña
  const visibleStages = [0, 1, 2, ...(lifecycleConfig.dialogo ? [3] : []), ...(lifecycleConfig.decision ? [4] : [])];
  const [events, setEvents] = useState<LifecycleEventOut[]>(initialEvents);
  const [targetStage, setTargetStage] = useState<number | null>(null);
  const [notes, setNotes] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [notifyOrg, setNotifyOrg] = useState(false);
  const [saving, setSaving] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // — Comunicación con adherentes (invitación al evento, aviso de cierre, mensaje libre)
  const [showAdherentComms, setShowAdherentComms] = useState(false);

  async function handleConfirm() {
    if (targetStage === null) return;
    setSaving(true);
    setModalError(null);
    try {
      const res = await advanceLifecycleStage(campaignId, targetStage, notes || null, notifyOrg);
      // éxito: cerrar modal y mostrar resultado en panel
      setCurrentStage(res.lifecycle_stage);
      setEvents((prev) => [res.event, ...prev].slice(0, 20));
      setNotes("");
      setTargetStage(null);
      setNotifyOrg(false);
      setShowModal(false);
      setModalError(null);

      const sent = res.notifications_sent;
      const notifMsg = sent.includes("org")
        ? `Email enviado a ${orgName ?? "la organización"}.`
        : sent.includes("admins")
        ? "Admins notificados."
        : "";
      setSuccessMsg(`✓ Etapa actualizada a ${STAGE_NAMES[res.lifecycle_stage]}.${notifMsg ? " " + notifMsg : ""}`);
      setTimeout(() => setSuccessMsg(null), 5000);
    } catch (e: unknown) {
      setModalError(e instanceof Error ? e.message : "Error al cambiar la etapa");
    } finally {
      setSaving(false);
    }
  }

  function handleCancelModal() {
    setShowModal(false);
    setNotifyOrg(false);
    setModalError(null);
  }

  return (
    <div style={{ borderTop: "1px solid var(--bbord)", paddingTop: 20, marginTop: 4 }}>
      <p style={{ margin: "0 0 14px", fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "rgba(22,38,31,0.5)" }}>
        Ciclo de vida
      </p>

      {/* Indicador visual de etapas habilitadas */}
      <div style={{ display: "flex", alignItems: "flex-start", marginBottom: 20 }}>
        {visibleStages.map((stageIdx, pos) => {
          const label   = STAGE_NAMES[stageIdx];
          const done    = stageIdx < currentStage;
          const current = stageIdx === currentStage;
          const isLast  = pos === visibleStages.length - 1;
          const dotBg     = done ? "#16261F" : current ? "var(--bp)" : "#fff";
          const dotColor  = done ? "#fff" : current ? "var(--bop)" : "#16261F";
          const dotBorder = done || current ? "none" : "2px solid rgba(22,38,31,0.25)";

          return (
            <div key={label} style={{ display: "flex", alignItems: "center", flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 5, flexShrink: 0 }}>
                <div
                  style={{
                    width: 28, height: 28, borderRadius: "50%",
                    background: dotBg, border: dotBorder, color: dotColor,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 11, fontWeight: 700,
                  }}
                >
                  {done ? "✓" : pos + 1}
                </div>
                <div style={{ fontSize: 10, fontWeight: current ? 700 : 500, opacity: current ? 1 : 0.5, textAlign: "center", whiteSpace: "nowrap", color: "#16261F" }}>
                  {label}
                </div>
              </div>
              {!isLast && (
                <div style={{ height: 2, flex: 1, background: done ? "#16261F" : "rgba(22,38,31,0.15)", margin: "0 4px", marginBottom: 18 }} />
              )}
            </div>
          );
        })}
      </div>

      {/* Etapas opcionales por campaña */}
      <div style={{ display: "flex", gap: 14, marginBottom: 14, padding: "8px 10px", background: "var(--bbg)", borderRadius: 8 }}>
        {([["dialogo", 3, "Diálogo"], ["decision", 4, "Decisión"]] as const).map(([key, idx, label]) => {
          const locked = currentStage >= idx; // no se puede quitar una etapa alcanzada
          return (
            <label key={key} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: locked ? "rgba(22,38,31,0.35)" : "#16261F", cursor: locked ? "not-allowed" : "pointer" }}>
              <input
                type="checkbox"
                checked={lifecycleConfig[key]}
                disabled={locked}
                onChange={(e) => onLifecycleConfigChange?.({ ...lifecycleConfig, [key]: e.target.checked })}
              />
              Incluir {label}
            </label>
          );
        })}
      </div>
      <p style={{ margin: "0 0 12px", fontSize: 11, color: "rgba(22,38,31,0.45)" }}>
        Las etapas desmarcadas no aparecen en la landing. Se aplica al Guardar cambios.
      </p>

      {/* Selector de etapa destino */}
      <p style={{ margin: "0 0 8px", fontSize: 12, color: "rgba(22,38,31,0.55)" }}>Cambiar a:</p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
        {visibleStages.map((stageIdx) => {
          const label = STAGE_NAMES[stageIdx];
          const isSelected = targetStage === stageIdx;
          const isCurrent  = stageIdx === currentStage;
          return (
            <button
              key={label}
              type="button"
              onClick={() => !isCurrent && setTargetStage(isSelected ? null : stageIdx)}
              disabled={isCurrent}
              style={{
                padding: "5px 12px", borderRadius: 8, fontSize: 12, fontWeight: 600,
                cursor: isCurrent ? "not-allowed" : "pointer",
                background: isSelected ? "#16261F" : isCurrent ? "rgba(22,38,31,0.07)" : "var(--bbg)",
                color: isSelected ? "#fff" : isCurrent ? "rgba(22,38,31,0.35)" : "#16261F",
                border: isSelected ? "none" : "1.5px solid var(--bbord)",
                opacity: isCurrent ? 0.55 : 1,
              }}
            >
              {label}
            </button>
          );
        })}
      </div>

      {/* Nota opcional */}
      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        maxLength={500}
        placeholder="Nota opcional (máx. 500 caracteres)"
        rows={2}
        style={{
          width: "100%", boxSizing: "border-box", padding: "8px 10px", borderRadius: 10,
          border: "1.5px solid var(--bbord)", fontSize: 13, color: "#16261F", resize: "none",
          fontFamily: "inherit", marginBottom: 10, outline: "none",
        }}
      />

      {successMsg && (
        <p style={{ fontSize: 12, color: "#3d6b35", marginBottom: 8, padding: "8px 10px", background: "color-mix(in srgb,#3d6b35 8%,transparent)", borderRadius: 8 }}>
          {successMsg}
        </p>
      )}

      {/* Botón confirmar cambio */}
      <button
        type="button"
        onClick={() => { setModalError(null); setShowModal(true); }}
        disabled={targetStage === null || targetStage === currentStage}
        style={{
          width: "100%", padding: "10px 0", borderRadius: 10, fontSize: 13, fontWeight: 700,
          background: targetStage !== null && targetStage !== currentStage ? "var(--bp)" : "rgba(22,38,31,0.08)",
          color: targetStage !== null && targetStage !== currentStage ? "var(--bop)" : "rgba(22,38,31,0.35)",
          border: "none", cursor: targetStage !== null && targetStage !== currentStage ? "pointer" : "not-allowed",
          marginBottom: 6,
        }}
      >
        Confirmar cambio
      </button>

      {/* Historial de eventos */}
      {events.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <p style={{ margin: "0 0 8px", fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "rgba(22,38,31,0.4)" }}>Historial</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {events.map((ev) => (
              <div key={ev.id} style={{ background: "var(--bbg)", borderRadius: 8, padding: "8px 10px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: ev.notes ? 4 : 0 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: "#16261F" }}>
                    {STAGE_NAMES[ev.stage_index] ?? ev.stage}
                  </span>
                  <span style={{ fontSize: 11, color: "rgba(22,38,31,0.45)" }}>{formatDate(ev.registered_at)}</span>
                </div>
                {ev.notes && <p style={{ margin: 0, fontSize: 12, color: "rgba(22,38,31,0.65)", lineHeight: 1.4 }}>{ev.notes}</p>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Comunicación con adherentes: invitación al evento, aviso de cierre, mensaje libre */}
      <div style={{ marginTop: 20, borderTop: "1px solid var(--bbord)", paddingTop: 16 }}>
        <button
          type="button"
          onClick={() => setShowAdherentComms(true)}
          style={{
            width: "100%", padding: "8px 0", borderRadius: 10, fontSize: 12, fontWeight: 600, cursor: "pointer",
            background: "transparent", border: "1.5px solid var(--bbord)", color: "rgba(22,38,31,0.7)",
          }}
        >
          Comunicación con adherentes ↗
        </button>
      </div>

      {/* Modal de confirmación */}
      {showModal && targetStage !== null && (
        <LifecycleConfirmModal
          currentStage={currentStage}
          targetStage={targetStage}
          notes={notes}
          orgName={orgName}
          orgHasContactEmail={orgHasContactEmail}
          notifyOrg={notifyOrg}
          onNotifyOrgChange={setNotifyOrg}
          onConfirm={handleConfirm}
          onCancel={handleCancelModal}
          loading={saving}
          error={modalError}
        />
      )}

      {showAdherentComms && (
        <AdherentCommsModal campaignId={campaignId} onClose={() => setShowAdherentComms(false)} />
      )}
    </div>
  );
}
