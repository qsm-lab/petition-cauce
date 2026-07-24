"use client";

import { useEffect, useState } from "react";
import { arcoApi, ArcoApiError, type ArcoDataResponse, type ArcoPersonalDataConflict } from "@/lib/arco-api";
import CampaignCard from "./CampaignCard";

const FONT_DISPLAY = "var(--font-anton, 'Anton', sans-serif)";
const FONT_BODY = "var(--font-work-sans, 'Work Sans', sans-serif)";

interface Props {
  token: string | null;
  originCampaignId: string | null;
}

type Stage = "verifying" | "invalid" | "loaded";

export default function PortalClient({ token, originCampaignId }: Props) {
  const [stage, setStage] = useState<Stage>("verifying");
  const [portalToken, setPortalToken] = useState<string | null>(null);
  const [data, setData] = useState<ArcoDataResponse | null>(null);
  const [activeCampaignId, setActiveCampaignId] = useState<string | null>(null);

  async function loadData(pt: string) {
    const d = await arcoApi.getData(pt);
    setData(d);
    setActiveCampaignId((current) => {
      if (current && d.campaigns.some((c) => c.signature_id === current)) return current;
      const origin = d.campaigns.find((c) => c.is_origin);
      return (origin || d.campaigns[0])?.signature_id ?? null;
    });
  }

  useEffect(() => {
    if (!token) {
      setStage("invalid");
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const session = await arcoApi.verify(token, originCampaignId);
        if (cancelled) return;
        setPortalToken(session.portal_token);
        await loadData(session.portal_token);
        if (cancelled) return;
        setStage("loaded");
      } catch {
        if (!cancelled) setStage("invalid");
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  async function refetch() {
    if (!portalToken) return;
    try {
      await loadData(portalToken);
    } catch {
      setStage("invalid");
    }
  }

  if (stage === "verifying") {
    return (
      <div style={{ minHeight: "100dvh", background: "#dfe6e2", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", fontFamily: FONT_BODY }}>
        <div
          style={{
            width: 44, height: 44, borderRadius: "50%",
            border: "4px solid rgba(22,38,31,.15)", borderTopColor: "#16261F",
            marginBottom: 20, animation: "arco-spin 0.9s linear infinite",
          }}
        />
        <style>{"@keyframes arco-spin{to{transform:rotate(360deg)}}"}</style>
        <div style={{ fontFamily: FONT_DISPLAY, fontSize: 22, marginBottom: 8 }}>Verificando tu acceso…</div>
        <div style={{ fontSize: 14, color: "rgba(22,38,31,.55)" }}>Un momento, estamos confirmando tu identidad.</div>
      </div>
    );
  }

  if (stage === "invalid" || !data || !portalToken) {
    return (
      <div style={{ minHeight: "100dvh", background: "#dfe6e2", padding: "48px 20px", fontFamily: FONT_BODY }}>
        <div style={{ maxWidth: 480, margin: "0 auto" }}>
          <div style={{ background: "#fff", border: "1.5px solid #16261F", borderRadius: 18, padding: "40px 32px", textAlign: "center" }}>
            <div style={{ width: 56, height: 56, borderRadius: "50%", background: "#FBEAE4", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, fontWeight: 700, color: "#c2410c", margin: "0 auto 20px" }}>
              !
            </div>
            <h1 style={{ fontSize: 24, marginBottom: 10, fontFamily: FONT_DISPLAY, fontWeight: 400 }}>Este enlace ya no es válido</h1>
            <p style={{ fontSize: 14.5, lineHeight: 1.6, color: "rgba(22,38,31,.75)", margin: "0 0 24px" }}>
              El enlace expiró o ya fue usado — cada enlace de verificación es de un solo uso y dura 1 hora.
            </p>
            <a
              href="/mis-datos"
              style={{
                display: "block", width: "100%", boxSizing: "border-box", textAlign: "center",
                fontSize: 15, fontWeight: 700, padding: 16, borderRadius: 30,
                border: "1.5px solid #16261F", background: "#D7F24C", color: "#16261F", textDecoration: "none",
              }}
            >
              Solicitar un nuevo enlace
            </a>
          </div>
        </div>
      </div>
    );
  }

  const activeCampaign = data.campaigns.find((c) => c.signature_id === activeCampaignId) || null;

  return (
    <div style={{ minHeight: "100dvh", background: "#dfe6e2", padding: "48px 20px", fontFamily: FONT_BODY }}>
      <div style={{ maxWidth: 640, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 6 }}>
          <div style={{ fontFamily: FONT_DISPLAY, fontSize: 20 }}>Cauce</div>
        </div>
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <h1 style={{ fontFamily: FONT_DISPLAY, fontWeight: 400, fontSize: "clamp(24px,3.6vw,30px)", color: "#2B4EEA" }}>
            Tus datos en Cauce
          </h1>
          <p style={{ fontSize: 13.5, color: "rgba(22,38,31,.55)", marginTop: 4 }}>
            Sesión activa por <strong style={{ color: "#16261F" }}>30 minutos</strong> · encontramos{" "}
            <strong style={{ color: "#16261F" }}>
              {data.campaigns.length} {data.campaigns.length === 1 ? "campaña" : "campañas"}
            </strong>{" "}
            con datos tuyos.
          </p>
        </div>

        {data.campaigns.length === 0 ? (
          <div style={{ background: "#fff", border: "1.5px solid #16261F", borderRadius: 18, padding: 24, textAlign: "center" }}>
            <p style={{ fontSize: 14.5, color: "rgba(22,38,31,.75)", margin: 0 }}>
              Ya no encontramos datos asociados a esta sesión.
            </p>
          </div>
        ) : (
          <>
            <PersonalDataSection data={data} portalToken={portalToken} campaignCount={data.campaigns.length} onChanged={refetch} />

            <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "rgba(22,38,31,.55)", marginBottom: 8 }}>
              Preferencias por campaña
            </div>
            <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 4, marginBottom: 4 }}>
              {data.campaigns.map((c) => (
                <button
                  key={c.signature_id}
                  type="button"
                  onClick={() => setActiveCampaignId(c.signature_id)}
                  style={{
                    padding: "9px 16px", fontSize: 12.5, borderRadius: 30, fontWeight: 700,
                    fontFamily: FONT_BODY, whiteSpace: "nowrap", cursor: "pointer",
                    border: "1.5px solid #16261F",
                    background: c.signature_id === activeCampaignId ? "#16261F" : "#fff",
                    color: c.signature_id === activeCampaignId ? "#fff" : "#16261F",
                  }}
                >
                  {c.campaign_title}{" "}
                  <span style={{ opacity: 0.7 }}>· {c.status === "confirmed" ? "Confirmada" : "Pendiente"}</span>
                </button>
              ))}
            </div>
            {activeCampaign?.is_origin && (
              <p style={{ fontSize: 12, color: "rgba(22,38,31,.55)", margin: "0 0 16px" }}>
                Llegaste desde <strong style={{ color: "#16261F" }}>{activeCampaign.campaign_title}</strong> — por eso se muestra primero. Elegí otra pestaña arriba para gestionar sus preferencias.
              </p>
            )}

            {activeCampaign && (
              <CampaignCard key={activeCampaign.signature_id} campaign={activeCampaign} portalToken={portalToken} onChanged={refetch} />
            )}
          </>
        )}
      </div>
    </div>
  );
}

function PersonalDataSection({
  data,
  portalToken,
  campaignCount,
  onChanged,
}: {
  data: ArcoDataResponse;
  portalToken: string;
  campaignCount: number;
  onChanged: () => void;
}) {
  const [name, setName] = useState(data.name || "");
  const [email, setEmail] = useState("");
  const [cedula, setCedula] = useState("");
  const [celular, setCelular] = useState("");
  const [saving, setSaving] = useState(false);
  const [conflicts, setConflicts] = useState<ArcoPersonalDataConflict[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function handleSave() {
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const payload: Record<string, string> = { name };
      if (email.trim()) payload.email = email.trim();
      if (cedula.trim()) payload.cedula = cedula.trim();
      if (celular.trim()) payload.celular = celular.trim();
      const res = await arcoApi.updatePersonalData(portalToken, payload);
      setConflicts(res.conflicts);
      setMessage(res.message);
      onChanged();
    } catch (e: unknown) {
      setError(e instanceof ArcoApiError ? e.message : "No se pudieron guardar tus datos personales");
    } finally {
      setSaving(false);
    }
  }

  async function handleDownload(format: "json" | "csv") {
    try {
      const res = await fetch(arcoApi.exportUrl(format), {
        headers: { Authorization: `Bearer ${portalToken}` },
      });
      if (!res.ok) throw new Error();
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `mis-datos-cauce.${format}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      setError("No se pudo generar la descarga");
    }
  }

  return (
    <>
      <section style={{ background: "#fff", border: "1.5px solid #16261F", borderRadius: 18, padding: 24, marginBottom: 14 }}>
        <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "rgba(22,38,31,.55)", marginBottom: 4 }}>
          Tus datos personales
        </div>
        <h2 style={{ fontSize: 18, marginBottom: 4 }}>
          Se aplican a tus {campaignCount} {campaignCount === 1 ? "campaña" : "campañas"}
        </h2>
        <p style={{ fontSize: 12.5, color: "rgba(22,38,31,.55)", margin: "0 0 16px", lineHeight: 1.5 }}>
          Nombre, correo y cédula se actualizan en todas tus campañas a la vez — salvo las que ya{" "}
          <strong>cerraron</strong>: esos datos quedan fijos ahí porque pudieron usarse en la
          entrega formal de firmas. Provincia/país y tipo de firmante se gestionan por campaña más
          abajo — cada una puede ser distinta. El correo/cédula también son únicos por campaña: si
          el valor nuevo ya está en uso en alguna, esa campaña no se actualiza y te lo avisamos.
        </p>

        <div style={{ marginBottom: 12 }}>
          <label style={{ fontSize: 13, fontWeight: 700, display: "block", marginBottom: 6 }}>Nombre</label>
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} style={inputStyle} />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
          <div>
            <label style={{ fontSize: 13, fontWeight: 700, display: "block", marginBottom: 6 }}>Correo electrónico</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder={data.email_masked} style={inputStyle} />
          </div>
          <div>
            <label style={{ fontSize: 13, fontWeight: 700, display: "block", marginBottom: 6 }}>Cédula</label>
            <input type="text" value={cedula} onChange={(e) => setCedula(e.target.value.replace(/\D/g, ""))} placeholder={data.cedula_masked || ""} maxLength={10} style={inputStyle} />
          </div>
        </div>
        <div style={{ marginBottom: 8 }}>
          <label style={{ fontSize: 13, fontWeight: 700, display: "block", marginBottom: 6 }}>
            Celular <span style={{ fontWeight: 400, color: "rgba(22,38,31,.55)" }}>(opcional)</span>
          </label>
          <input type="tel" value={celular} onChange={(e) => setCelular(e.target.value)} placeholder={data.celular_masked || "099 123 4567"} style={inputStyle} />
        </div>

        {conflicts.map((c, i) => (
          <div
            key={i}
            style={{
              padding: "10px 14px",
              background: c.reason === "campana_cerrada" ? "#EDF4F1" : "color-mix(in srgb,#b45309 12%,transparent)",
              borderRadius: 10,
              fontSize: 12,
              color: c.reason === "campana_cerrada" ? "rgba(22,38,31,.7)" : "#b45309",
              marginBottom: 10,
              lineHeight: 1.5,
            }}
          >
            {c.reason === "campana_cerrada" ? "🔒" : "⚠"} Tu {c.field} en <strong>{c.campaign_title}</strong>{" "}
            {c.reason === "campana_cerrada" ? "quedó fijo — esa campaña ya cerró." : "no se pudo actualizar — ya hay una firma con ese valor ahí."}
          </div>
        ))}

        {error && <p style={{ fontSize: 12.5, color: "#c2410c", marginBottom: 10 }}>{error}</p>}
        {message && !error && <p style={{ fontSize: 12.5, color: "#16261F", marginBottom: 10 }}>{message}</p>}

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            style={{
              padding: "11px 20px", fontSize: 13, borderRadius: 30, fontWeight: 700,
              fontFamily: FONT_BODY, border: "1.5px solid #16261F", background: "#D7F24C",
              color: "#16261F", cursor: saving ? "default" : "pointer", opacity: saving ? 0.6 : 1,
            }}
          >
            {saving ? "Guardando…" : "Guardar datos personales"}
          </button>
          <span style={{ fontSize: 11, color: "rgba(22,38,31,.55)" }}>
            Cédula: {data.cedula_masked} · Celular: {data.celular_masked || "—"}
          </span>
        </div>
        <p style={{ fontSize: 11, color: "rgba(22,38,31,.55)", margin: "12px 0 0", lineHeight: 1.5 }}>
          Por trazabilidad, registramos que cambiaste estos datos y cuándo — no guardamos el valor
          anterior. Si cambiás el correo de una firma que todavía no confirmaste, te reenviamos la
          confirmación a la dirección nueva. Por seguridad, avisamos cualquier cambio al correo{" "}
          <strong>anterior</strong>.
        </p>
      </section>

      <section style={{ background: "#fff", border: "1.5px solid #16261F", borderRadius: 18, padding: 24, marginBottom: 24 }}>
        <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "rgba(22,38,31,.55)", marginBottom: 4 }}>
          Portabilidad
        </div>
        <h2 style={{ fontSize: 18, marginBottom: 10 }}>Descargá una copia de todo</h2>
        <p style={{ fontSize: 12.5, color: "rgba(22,38,31,.55)", margin: "0 0 14px" }}>
          Un solo archivo con tus {campaignCount} {campaignCount === 1 ? "campaña" : "campañas"}. Generado al momento — no lo guardamos.
        </p>
        <div style={{ display: "flex", gap: 10 }}>
          <button type="button" onClick={() => handleDownload("json")} style={portabilityBtnStyle}>⬇ Descargar JSON</button>
          <button type="button" onClick={() => handleDownload("csv")} style={portabilityBtnStyle}>⬇ Descargar CSV</button>
        </div>
      </section>
    </>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%", boxSizing: "border-box", padding: "14px 16px", borderRadius: 10,
  border: "1.5px solid #16261F", fontSize: 16, fontFamily: FONT_BODY,
  background: "#fff", color: "#16261F", outline: "none",
};

const portabilityBtnStyle: React.CSSProperties = {
  flex: 1, padding: 11, fontSize: 13, borderRadius: 30, fontWeight: 700,
  fontFamily: FONT_BODY, border: "1.5px solid #16261F", background: "#fff",
  color: "#16261F", cursor: "pointer",
};
