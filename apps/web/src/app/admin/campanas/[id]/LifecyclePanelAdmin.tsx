"use client";

import { useState } from "react";
import type { LifecycleEventOut } from "@/lib/admin-campaigns-api";
import { advanceLifecycleStage, notifySigners } from "@/lib/admin-lifecycle-api";
import LifecycleConfirmModal from "./LifecycleConfirmModal";

const STAGE_NAMES = ["Lanzada", "Recolección", "Entrega", "Diálogo", "Decisión"];

interface Props {
  campaignId: string;
  initialStage: number;
  initialEvents: LifecycleEventOut[];
  orgName: string | null;
  orgHasContactEmail: boolean;
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
}: Props) {
  const [currentStage, setCurrentStage] = useState(initialStage);
  const [events, setEvents] = useState<LifecycleEventOut[]>(initialEvents);
  const [targetStage, setTargetStage] = useState<number | null>(null);
  const [notes, setNotes] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [notifyOrg, setNotifyOrg] = useState(false);
  const [saving, setSaving] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // — Notificación a firmantes
  const [showNotifySigners, setShowNotifySigners] = useState(false);
  const [signerMessage, setSignerMessage] = useState("");
  const [sendingSigners, setSendingSigners] = useState(false);
  const [signerResult, setSignerResult] = useState<string | null>(null);

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

  async function handleNotifySigners() {
    if (!signerMessage.trim()) return;
    setSendingSigners(true);
    setSignerResult(null);
    try {
      const res = await notifySigners(campaignId, signerMessage);
      setSignerResult(
        res.sent_count === 0
          ? "Sin firmantes suscritos a notificaciones."
          : `✓ ${res.sent_count} email(s) enviados a firmantes.`
      );
      if (res.sent_count > 0) setSignerMessage("");
    } catch (e: unknown) {
      setSignerResult(e instanceof Error ? e.message : "Error al enviar");
    } finally {
      setSendingSigners(false);
    }
  }

  return (
    <div style={{ borderTop: "1px solid var(--bbord)", paddingTop: 20, marginTop: 4 }}>
      <p style={{ margin: "0 0 14px", fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "rgba(22,38,31,0.5)" }}>
        Ciclo de vida
      </p>

      {/* Indicador visual de 5 etapas */}
      <div style={{ display: "flex", alignItems: "flex-start", marginBottom: 20 }}>
        {STAGE_NAMES.map((label, i) => {
          const done    = i < currentStage;
          const current = i === currentStage;
          const isLast  = i === STAGE_NAMES.length - 1;
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
                  {done ? "✓" : i + 1}
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

      {/* Selector de etapa destino */}
      <p style={{ margin: "0 0 8px", fontSize: 12, color: "rgba(22,38,31,0.55)" }}>Cambiar a:</p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
        {STAGE_NAMES.map((label, i) => {
          const isSelected = targetStage === i;
          const isCurrent  = i === currentStage;
          return (
            <button
              key={label}
              type="button"
              onClick={() => !isCurrent && setTargetStage(isSelected ? null : i)}
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

      {/* Notificar a firmantes (acción secundaria) */}
      <div style={{ marginTop: 20, borderTop: "1px solid var(--bbord)", paddingTop: 16 }}>
        <button
          type="button"
          onClick={() => { setShowNotifySigners(!showNotifySigners); setSignerResult(null); }}
          style={{
            width: "100%", padding: "8px 0", borderRadius: 10, fontSize: 12, fontWeight: 600, cursor: "pointer",
            background: "transparent", border: "1.5px solid var(--bbord)", color: "rgba(22,38,31,0.7)",
          }}
        >
          {showNotifySigners ? "Cerrar ▲" : "Notificar a firmantes ▼"}
        </button>

        {showNotifySigners && (
          <div style={{ marginTop: 10 }}>
            <p style={{ margin: "0 0 8px", fontSize: 12, color: "rgba(22,38,31,0.55)" }}>
              Solo se envía a firmantes que consintieron recibir novedades.
            </p>
            <textarea
              value={signerMessage}
              onChange={(e) => setSignerMessage(e.target.value)}
              placeholder="Escribe el mensaje para los firmantes…"
              rows={3}
              style={{
                width: "100%", boxSizing: "border-box", padding: "8px 10px", borderRadius: 10,
                border: "1.5px solid var(--bbord)", fontSize: 13, color: "#16261F", resize: "none",
                fontFamily: "inherit", marginBottom: 8, outline: "none",
              }}
            />
            {signerResult && (
              <p style={{
                fontSize: 12, marginBottom: 8,
                color: signerResult.startsWith("✓") ? "#3d6b35" : "#c2410c",
                padding: "6px 10px",
                background: signerResult.startsWith("✓") ? "color-mix(in srgb,#3d6b35 8%,transparent)" : "color-mix(in srgb,#c2410c 8%,transparent)",
                borderRadius: 8,
              }}>
                {signerResult}
              </p>
            )}
            <button
              type="button"
              onClick={handleNotifySigners}
              disabled={sendingSigners || !signerMessage.trim()}
              style={{
                width: "100%", padding: "9px 0", borderRadius: 10, fontSize: 13, fontWeight: 700,
                cursor: sendingSigners || !signerMessage.trim() ? "not-allowed" : "pointer",
                background: sendingSigners || !signerMessage.trim() ? "rgba(22,38,31,0.08)" : "#16261F",
                color: sendingSigners || !signerMessage.trim() ? "rgba(22,38,31,0.35)" : "#fff",
                border: "none",
              }}
            >
              {sendingSigners ? "Enviando…" : "Enviar a firmantes"}
            </button>
          </div>
        )}
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
    </div>
  );
}
