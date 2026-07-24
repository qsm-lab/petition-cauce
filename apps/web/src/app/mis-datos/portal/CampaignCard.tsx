"use client";

import { useState } from "react";
import { arcoApi, type ArcoCampaignSummary } from "@/lib/arco-api";
import { PROVINCIAS } from "@/lib/provincias";

const FONT_BODY = "var(--font-work-sans, 'Work Sans', sans-serif)";

function pillStyle(active: boolean, disabled: boolean): React.CSSProperties {
  return {
    flex: 1,
    padding: "9px 6px",
    fontSize: 12.5,
    borderRadius: 30,
    fontWeight: 700,
    fontFamily: FONT_BODY,
    border: "1.5px solid " + (disabled ? "rgba(22,38,31,.15)" : "#16261F"),
    background: disabled ? "rgba(22,38,31,.06)" : active ? "#2B4EEA" : "#fff",
    color: disabled ? "rgba(22,38,31,.35)" : active ? "#fff" : "#16261F",
    cursor: disabled ? "not-allowed" : "pointer",
  };
}

interface Props {
  campaign: ArcoCampaignSummary;
  portalToken: string;
  onChanged: () => void;
}

export default function CampaignCard({ campaign, portalToken, onChanged }: Props) {
  const [signerType, setSignerType] = useState(campaign.signer_type);
  const [locationMode, setLocationMode] = useState(campaign.location_mode);
  const [provincia, setProvincia] = useState(campaign.provincia || PROVINCIAS[0]);
  const [country, setCountry] = useState(campaign.country || "");
  const [visibility, setVisibilityLocal] = useState(campaign.visibility);
  const [notifyUpdates, setNotifyUpdates] = useState(campaign.consent?.notify_updates ?? false);
  const [subscribeNewsletter, setSubscribeNewsletter] = useState(campaign.consent?.subscribe_newsletter ?? false);

  const [confirming, setConfirming] = useState(false);
  const [savingPrefs, setSavingPrefs] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteStep, setDeleteStep] = useState<1 | 2>(1);
  const [deleting, setDeleting] = useState(false);

  const isConfirmed = campaign.status === "confirmed";

  async function handleConfirm() {
    setConfirming(true);
    setError(null);
    try {
      await arcoApi.confirm(portalToken, campaign.signature_id);
      onChanged();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "No se pudo confirmar la firma");
    } finally {
      setConfirming(false);
    }
  }

  async function handleSavePreferences() {
    setSavingPrefs(true);
    setError(null);
    try {
      const profileData: Record<string, string> = locationMode === "nacional" ? { provincia } : { country };
      if (campaign.profile_editable) {
        profileData.signer_type = signerType;
        profileData.location_mode = locationMode;
      }
      await arcoApi.updateCampaignProfile(portalToken, { signature_id: campaign.signature_id, ...profileData });
      if (visibility !== campaign.visibility) {
        await arcoApi.setVisibility(portalToken, campaign.signature_id, visibility);
      }
      await arcoApi.oppose(portalToken, campaign.signature_id, {
        notify_updates: notifyUpdates,
        subscribe_newsletter: subscribeNewsletter,
      });
      onChanged();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "No se pudieron guardar las preferencias");
    } finally {
      setSavingPrefs(false);
    }
  }

  async function handleDelete() {
    setDeleting(true);
    setError(null);
    try {
      await arcoApi.deleteSubject(portalToken, campaign.signature_id);
      setDeleteOpen(false);
      onChanged();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "No se pudo eliminar");
      setDeleting(false);
    }
  }

  return (
    <section
      style={{
        background: "#fff",
        border: "1.5px solid #2B4EEA",
        borderRadius: 18,
        padding: 24,
        fontFamily: FONT_BODY,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap", marginBottom: 4 }}>
        <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.05em", textTransform: "uppercase", color: "#2B4EEA" }}>
          Estás editando: {campaign.campaign_title}
        </div>
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            fontWeight: 600,
            fontSize: 11,
            padding: "3px 10px",
            borderRadius: 99,
            background: isConfirmed ? "#DCE9E6" : "color-mix(in srgb,#b45309 12%,transparent)",
            color: isConfirmed ? "#16261F" : "#b45309",
          }}
        >
          {isConfirmed ? "Confirmada" : "Pendiente"}
        </span>
      </div>

      {error && <p style={{ fontSize: 12.5, color: "#c2410c", margin: "8px 0 0" }}>{error}</p>}

      <button
        type="button"
        disabled={isConfirmed || !campaign.signable || confirming}
        onClick={handleConfirm}
        style={{
          padding: "8px 14px",
          fontSize: 12,
          borderRadius: 30,
          fontWeight: 700,
          border: "1.5px solid " + (isConfirmed || !campaign.signable ? "rgba(22,38,31,.15)" : "#16261F"),
          background: isConfirmed || !campaign.signable ? "rgba(22,38,31,.06)" : "#D7F24C",
          color: isConfirmed || !campaign.signable ? "rgba(22,38,31,.35)" : "#16261F",
          cursor: isConfirmed || !campaign.signable ? "not-allowed" : "pointer",
          margin: "10px 0 16px",
        }}
      >
        {isConfirmed ? "✓ Firma ya confirmada" : campaign.signable ? (confirming ? "Confirmando…" : "Confirmar mi firma ahora") : "Campaña cerrada — no se puede confirmar"}
      </button>

      <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "rgba(22,38,31,.55)", marginBottom: 6 }}>
        Tipo de firmante y ubicación
      </div>
      <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
        <button
          type="button"
          disabled={!campaign.profile_editable}
          onClick={() => setSignerType("natural")}
          style={pillStyle(signerType === "natural", !campaign.profile_editable)}
        >
          Natural
        </button>
        <button
          type="button"
          disabled={!campaign.profile_editable}
          onClick={() => setSignerType("org")}
          style={pillStyle(signerType === "org", !campaign.profile_editable)}
        >
          Organización
        </button>
      </div>
      <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
        <button
          type="button"
          disabled={!campaign.profile_editable}
          onClick={() => setLocationMode("nacional")}
          style={pillStyle(locationMode === "nacional", !campaign.profile_editable)}
        >
          Ecuador
        </button>
        <button
          type="button"
          disabled={!campaign.profile_editable}
          onClick={() => setLocationMode("internacional")}
          style={pillStyle(locationMode === "internacional", !campaign.profile_editable)}
        >
          Internacional
        </button>
      </div>
      {!campaign.profile_editable && (
        <p style={{ fontSize: 11, color: "rgba(22,38,31,.55)", margin: "0 0 10px", lineHeight: 1.5 }}>
          🔒 Ya confirmaste esta firma — el tipo de firmante y la ubicación quedan fijos. Solo se
          pueden cambiar mientras la firma está pendiente de confirmar y la campaña sigue activa.
        </p>
      )}

      <div style={{ marginBottom: 16 }}>
        {locationMode === "nacional" ? (
          <>
            <label style={{ fontSize: 13, fontWeight: 700, display: "block", marginBottom: 6 }}>Provincia</label>
            <select
              value={provincia}
              onChange={(e) => setProvincia(e.target.value)}
              style={selectStyle}
            >
              {PROVINCIAS.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </>
        ) : (
          <>
            <label style={{ fontSize: 13, fontWeight: 700, display: "block", marginBottom: 6 }}>País</label>
            <input
              type="text"
              autoComplete="country-name"
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              style={selectStyle}
            />
          </>
        )}
        <p style={{ fontSize: 11, color: "rgba(22,38,31,.55)", margin: "6px 0 0" }}>
          Esta sí se puede corregir siempre, aunque la campaña ya haya cerrado.
        </p>
      </div>

      <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "rgba(22,38,31,.55)", marginBottom: 6 }}>
        Visibilidad de tu firma
      </div>
      <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
        {(["publica", "anonima", "secreta"] as const).map((v) => (
          <button
            key={v}
            type="button"
            onClick={() => setVisibilityLocal(v)}
            style={{
              flex: 1,
              padding: "10px 6px",
              fontSize: 13,
              borderRadius: 30,
              fontWeight: 700,
              fontFamily: FONT_BODY,
              border: "1.5px solid #16261F",
              background: visibility === v ? "#2B4EEA" : "#fff",
              color: visibility === v ? "#fff" : "#16261F",
              cursor: "pointer",
            }}
          >
            {v === "publica" ? "Pública" : v === "anonima" ? "Anónima" : "Secreta"}
          </button>
        ))}
      </div>
      <div style={{ fontSize: 12, lineHeight: 1.55, color: "rgba(22,38,31,.65)", background: "#EDF4F1", borderRadius: 10, padding: "10px 14px", marginBottom: 20 }}>
        <strong>Pública:</strong> tu nombre aparece en el listado de apoyos y en el documento de
        entrega. <strong>Anónima:</strong> tu firma se suma al conteo y al documento, pero tu
        nombre no se muestra. <strong>Secreta:</strong> solo se suma al conteo — nunca se muestra
        ni se incluye en la entrega oficial.
      </div>

      <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "rgba(22,38,31,.55)", marginBottom: 6 }}>
        Preferencias de contacto
      </div>
      <Toggle label="Novedades de esta campaña" value={notifyUpdates} onChange={setNotifyUpdates} bordered />
      <div style={{ marginBottom: 20 }}>
        <Toggle label="Boletín de la plataforma" value={subscribeNewsletter} onChange={setSubscribeNewsletter} />
      </div>

      <button
        type="button"
        onClick={handleSavePreferences}
        disabled={savingPrefs}
        style={{
          padding: "11px 20px",
          fontSize: 13,
          borderRadius: 30,
          fontWeight: 700,
          fontFamily: FONT_BODY,
          border: "1.5px solid #16261F",
          background: "#D7F24C",
          color: "#16261F",
          cursor: savingPrefs ? "default" : "pointer",
          marginBottom: 20,
          opacity: savingPrefs ? 0.6 : 1,
        }}
      >
        {savingPrefs ? "Guardando…" : "Guardar preferencias de esta campaña"}
      </button>

      <div style={{ borderTop: "1.5px dashed #c2410c", paddingTop: 16 }}>
        <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "#c2410c", marginBottom: 4 }}>
          Supresión
        </div>
        <p style={{ fontSize: 12.5, color: "rgba(22,38,31,.7)", margin: "0 0 12px", lineHeight: 1.5 }}>
          Elimina tus datos solo de <strong>esta campaña</strong>. Tus otras campañas no se ven afectadas.
        </p>
        <button
          type="button"
          onClick={() => setDeleteOpen(true)}
          style={{
            padding: "10px 18px",
            fontSize: 12.5,
            borderRadius: 30,
            fontWeight: 700,
            fontFamily: FONT_BODY,
            border: "1.5px solid #c2410c",
            background: "#fff",
            color: "#c2410c",
            cursor: "pointer",
          }}
        >
          🗑 Eliminar mis datos de esta campaña
        </button>
      </div>

      {deleteOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,.45)" }}
        >
          <div
            style={{
              width: "100%",
              maxWidth: 420,
              margin: "0 auto",
              borderRadius: 16,
              padding: 26,
              background: "#fff",
              border: "1px solid rgba(22,38,31,.15)",
              fontFamily: FONT_BODY,
            }}
          >
            {deleteStep === 1 ? (
              <>
                <h2 style={{ fontFamily: "var(--font-anton, 'Anton', sans-serif)", fontWeight: 400, fontSize: 16, marginBottom: 8 }}>
                  ¿Eliminar tus datos de &quot;{campaign.campaign_title}&quot;?
                </h2>
                <p style={{ fontSize: 13, color: "rgba(22,38,31,.55)", margin: "0 0 16px", lineHeight: 1.55 }}>
                  Esta acción es inmediata, solo afecta a esta campaña y no se puede deshacer. Tus
                  datos en otras campañas de Cauce no se ven afectados. Al confirmar:
                </p>
                <ul style={{ fontSize: 13, margin: "0 0 20px", paddingLeft: 18, color: "rgba(22,38,31,.55)", lineHeight: 1.7 }}>
                  <li>Tu nombre, correo y cédula se eliminan de forma permanente.</li>
                  <li>Recibirás un correo confirmando la eliminación.</li>
                  <li>Tu apoyo seguirá contando de forma anónima en el total.</li>
                </ul>
                <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
                  <button
                    type="button"
                    onClick={() => { setDeleteOpen(false); setDeleteStep(1); }}
                    style={{ padding: "10px 18px", fontSize: 13, fontWeight: 700, borderRadius: 10, border: "1px solid rgba(22,38,31,.15)", background: "#fff", color: "#16261F", cursor: "pointer" }}
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeleteStep(2)}
                    style={{ padding: "10px 18px", fontSize: 13, fontWeight: 700, borderRadius: 10, border: "1px solid #c2410c", background: "#c2410c", color: "#fff", cursor: "pointer" }}
                  >
                    Continuar
                  </button>
                </div>
              </>
            ) : (
              <>
                <h2 style={{ fontFamily: "var(--font-anton, 'Anton', sans-serif)", fontWeight: 400, fontSize: 16, marginBottom: 8 }}>
                  ¿Confirmar la eliminación?
                </h2>
                <p style={{ fontSize: 13, color: "rgba(22,38,31,.55)", margin: "0 0 20px", lineHeight: 1.55 }}>
                  Esta acción notificará al titular ahora mismo. ¿Continuar?
                </p>
                <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
                  <button
                    type="button"
                    onClick={() => setDeleteStep(1)}
                    disabled={deleting}
                    style={{ padding: "10px 18px", fontSize: 13, fontWeight: 700, borderRadius: 10, border: "1px solid rgba(22,38,31,.15)", background: "#fff", color: "#16261F", cursor: "pointer", opacity: deleting ? 0.4 : 1 }}
                  >
                    Atrás
                  </button>
                  <button
                    type="button"
                    onClick={handleDelete}
                    disabled={deleting}
                    style={{ padding: "10px 18px", fontSize: 13, fontWeight: 700, borderRadius: 10, border: "1px solid #c2410c", background: "#c2410c", color: "#fff", cursor: "pointer", opacity: deleting ? 0.6 : 1 }}
                  >
                    {deleting ? "Eliminando…" : "Sí, eliminar mis datos"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

function Toggle({ label, value, onChange, bordered }: { label: string; value: boolean; onChange: (v: boolean) => void; bordered?: boolean }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "10px 0",
        borderBottom: bordered ? "1px solid rgba(22,38,31,.15)" : undefined,
      }}
    >
      <div style={{ fontWeight: 600, fontSize: 13.5 }}>{label}</div>
      <button
        type="button"
        role="switch"
        aria-checked={value}
        onClick={() => onChange(!value)}
        style={{
          width: 40,
          height: 23,
          borderRadius: 99,
          background: value ? "#16261F" : "rgba(22,38,31,.15)",
          position: "relative",
          flexShrink: 0,
          border: "none",
          cursor: "pointer",
          padding: 0,
        }}
      >
        <div
          style={{
            width: 17,
            height: 17,
            borderRadius: "50%",
            background: "#fff",
            position: "absolute",
            top: 3,
            left: value ? 20 : 3,
            transition: "left .15s ease",
          }}
        />
      </button>
    </div>
  );
}

const selectStyle: React.CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  padding: "14px 16px",
  borderRadius: 10,
  border: "1.5px solid #16261F",
  fontSize: 16,
  fontFamily: FONT_BODY,
  background: "#fff",
  color: "#16261F",
  outline: "none",
};
