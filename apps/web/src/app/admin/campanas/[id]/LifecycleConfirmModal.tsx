"use client";

const STAGE_NAMES = ["Lanzada", "Recolección", "Entrega", "Diálogo", "Decisión"];

interface Props {
  currentStage: number;
  targetStage: number;
  notes: string;
  orgName: string | null;
  orgHasContactEmail: boolean;
  notifyOrg: boolean;
  onNotifyOrgChange: (v: boolean) => void;
  onConfirm: () => void;
  onCancel: () => void;
  loading: boolean;
  error: string | null;
}

export default function LifecycleConfirmModal({
  currentStage,
  targetStage,
  notes,
  orgName,
  orgHasContactEmail,
  notifyOrg,
  onNotifyOrgChange,
  onConfirm,
  onCancel,
  loading,
  error,
}: Props) {
  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 50,
        display: "flex", alignItems: "center", justifyContent: "center",
        background: "rgba(22,38,31,0.5)", padding: "0 16px",
      }}
    >
      <div style={{ width: "100%", maxWidth: 440, background: "#fff", borderRadius: 20, padding: "28px 28px 24px", boxShadow: "0 12px 40px rgba(22,38,31,0.18)" }}>
        <p style={{ margin: "0 0 2px", fontSize: 13, color: "rgba(22,38,31,0.5)", letterSpacing: "0.06em", textTransform: "uppercase" }}>Confirmar cambio</p>
        <h2 style={{ margin: "0 0 16px", fontSize: 18, fontWeight: 800, color: "#16261F" }}>Cambio de etapa de la campaña</h2>

        <div style={{ display: "flex", alignItems: "center", gap: 10, background: "var(--bbg)", borderRadius: 12, padding: "10px 14px", marginBottom: 16 }}>
          <span style={{ fontSize: 14, color: "rgba(22,38,31,0.55)", fontWeight: 500 }}>{STAGE_NAMES[currentStage]}</span>
          <span style={{ color: "rgba(22,38,31,0.35)", fontSize: 16 }}>→</span>
          <span style={{ fontSize: 14, fontWeight: 700, color: "#16261F" }}>{STAGE_NAMES[targetStage]}</span>
        </div>

        {notes && (
          <div style={{ border: "1px solid var(--bbord)", borderRadius: 12, padding: "10px 14px", marginBottom: 16 }}>
            <p style={{ margin: "0 0 4px", fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "rgba(22,38,31,0.45)" }}>Nota</p>
            <p style={{ margin: 0, fontSize: 14, color: "#16261F", lineHeight: 1.5 }}>{notes}</p>
          </div>
        )}

        <label
          style={{
            display: "flex", alignItems: "flex-start", gap: 10,
            marginBottom: 20, cursor: orgHasContactEmail ? "pointer" : "not-allowed",
            opacity: orgHasContactEmail ? 1 : 0.4,
          }}
        >
          <input
            type="checkbox"
            checked={notifyOrg}
            onChange={(e) => orgHasContactEmail && onNotifyOrgChange(e.target.checked)}
            disabled={!orgHasContactEmail}
            style={{ marginTop: 2, accentColor: "var(--bink)", width: 15, height: 15, flexShrink: 0 }}
          />
          <span style={{ fontSize: 14, color: "#16261F", lineHeight: 1.45 }}>
            Notificar a <strong>{orgName ?? "la organización vinculada"}</strong>
            {!orgHasContactEmail && (
              <span style={{ display: "block", fontSize: 12, color: "rgba(22,38,31,0.5)", marginTop: 2 }}>
                Esta organización no tiene email de contacto registrado.
              </span>
            )}
          </span>
        </label>

        {error && (
          <p style={{ margin: "0 0 14px", fontSize: 13, color: "#c2410c", padding: "8px 12px", background: "color-mix(in srgb,#c2410c 8%,transparent)", borderRadius: 8 }}>
            {error}
          </p>
        )}

        <div style={{ display: "flex", gap: 10 }}>
          <button
            onClick={onCancel}
            disabled={loading}
            style={{
              flex: 1, padding: "10px 0", borderRadius: 10, fontSize: 14, fontWeight: 600, cursor: "pointer",
              background: "transparent", border: "1.5px solid var(--bbord)", color: "#16261F",
              opacity: loading ? 0.5 : 1,
            }}
          >
            Cancelar
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            style={{
              flex: 1, padding: "10px 0", borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: loading ? "not-allowed" : "pointer",
              background: loading ? "rgba(22,38,31,0.4)" : "#16261F", color: "#fff",
              border: "none",
            }}
          >
            {loading ? "Guardando…" : "Confirmar"}
          </button>
        </div>
      </div>
    </div>
  );
}
