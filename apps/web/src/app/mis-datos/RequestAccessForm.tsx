"use client";

import { useState } from "react";
import TurnstileWidget from "@/components/form-renderer/TurnstileWidget";
import { arcoApi } from "@/lib/arco-api";

const FONT_DISPLAY = "var(--font-anton, 'Anton', sans-serif)";
const FONT_BODY = "var(--font-work-sans, 'Work Sans', sans-serif)";

interface Props {
  originCampaignId: string | null;
}

type Stage = "form" | "sent";

export default function RequestAccessForm({ originCampaignId }: Props) {
  const [stage, setStage] = useState<Stage>("form");
  const [email, setEmail] = useState("");
  const [cedula, setCedula] = useState("");
  const [turnstileToken, setTurnstileToken] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = email.trim() !== "" && cedula.trim() !== "" && turnstileToken !== "" && !sending;

  async function handleSubmit() {
    if (!canSubmit) return;
    setSending(true);
    setError(null);
    try {
      await arcoApi.requestAccess(email.trim(), cedula.trim(), turnstileToken, originCampaignId);
      setStage("sent");
    } catch {
      // Anti-enumeración: incluso ante error de validación mostramos el mismo mensaje genérico (R2)
      setStage("sent");
    } finally {
      setSending(false);
    }
  }

  return (
    <div style={{ minHeight: "100dvh", background: "#dfe6e2", fontFamily: FONT_BODY, padding: "48px 20px" }}>
      <div style={{ maxWidth: 480, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <div style={{ fontFamily: FONT_DISPLAY, fontSize: 22, color: "#16261F" }}>Cauce</div>
          <div
            style={{
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              color: "rgba(22,38,31,.55)",
              marginTop: 2,
            }}
          >
            Portal de derechos ARCO
          </div>
        </div>

        <div
          style={{
            background: "#fff",
            border: "1.5px solid #16261F",
            borderRadius: 18,
            padding: "36px 32px",
          }}
        >
          {stage === "form" ? (
            <>
              <h1 style={{ fontFamily: FONT_DISPLAY, fontWeight: 400, fontSize: "clamp(26px,4vw,32px)", color: "#2B4EEA", marginBottom: 14 }}>
                Accedé a tus datos
              </h1>
              <p style={{ fontSize: 15, lineHeight: 1.6, color: "rgba(22,38,31,.82)", margin: "0 0 22px" }}>
                Si firmaste alguna petición en <strong>cualquier campaña de Cauce</strong>, podés
                ejercer tus derechos LOPDP desde un solo lugar: ver tus datos, corregirlos,
                oponerte a comunicaciones, descargar una copia o eliminar tu información — campaña
                por campaña. Ingresá el correo y la cédula con los que firmaste — te enviaremos un
                enlace de verificación.
              </p>

              <div style={{ marginBottom: 16 }}>
                <label style={{ fontSize: 13, fontWeight: 700, display: "block", marginBottom: 6 }}>
                  Correo electrónico *
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="tu@correo.com"
                  style={inputStyle}
                />
              </div>
              <div style={{ marginBottom: 20 }}>
                <label style={{ fontSize: 13, fontWeight: 700, display: "block", marginBottom: 6 }}>
                  Cédula de identidad *
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={10}
                  value={cedula}
                  onChange={(e) => setCedula(e.target.value.replace(/\D/g, ""))}
                  placeholder="0102030405"
                  style={inputStyle}
                />
              </div>

              <div style={{ marginBottom: 20 }}>
                <TurnstileWidget
                  onVerify={setTurnstileToken}
                  onExpire={() => setTurnstileToken("")}
                  onError={() => setTurnstileToken("")}
                />
              </div>

              {error && (
                <p style={{ fontSize: 12.5, color: "#c2410c", marginBottom: 14 }}>{error}</p>
              )}

              <button
                type="button"
                onClick={handleSubmit}
                disabled={!canSubmit}
                style={{
                  width: "100%",
                  fontSize: 17,
                  fontWeight: 700,
                  padding: 18,
                  borderRadius: 30,
                  border: "1.5px solid #16261F",
                  background: canSubmit ? "#D7F24C" : "rgba(22,38,31,.1)",
                  color: canSubmit ? "#16261F" : "rgba(22,38,31,.4)",
                  cursor: canSubmit ? "pointer" : "not-allowed",
                  fontFamily: FONT_BODY,
                }}
              >
                {sending ? "Enviando…" : "Enviar enlace de acceso"}
              </button>

              <p style={{ fontSize: 12, color: "rgba(22,38,31,.45)", margin: "18px 0 0", lineHeight: 1.5, textAlign: "center" }}>
                Por privacidad, siempre mostramos este mismo mensaje al enviar la solicitud, exista
                o no una firma asociada a esos datos.
              </p>
            </>
          ) : (
            <div style={{ textAlign: "center", padding: "4px 0" }}>
              <div
                style={{
                  width: 64,
                  height: 64,
                  borderRadius: "50%",
                  background: "#DCE9E6",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  margin: "0 auto 20px",
                  fontSize: 26,
                }}
              >
                ✉️
              </div>
              <h1 style={{ fontSize: 24, marginBottom: 10, color: "#16261F", fontFamily: FONT_DISPLAY, fontWeight: 400 }}>
                Revisá tu correo
              </h1>
              <p style={{ fontSize: 14.5, lineHeight: 1.6, color: "rgba(22,38,31,.75)", margin: "0 0 4px" }}>
                Si existen datos asociados a ese correo y cédula, te enviamos un enlace de
                verificación. El enlace es válido por <strong>1 hora</strong> y de un solo uso.
              </p>
              <p style={{ fontSize: 13, color: "rgba(22,38,31,.55)", margin: "16px 0 0" }}>
                ¿No te llegó nada? Revisá spam o intentá de nuevo en unos minutos.
              </p>
            </div>
          )}
        </div>

        <p style={{ textAlign: "center", fontSize: 12.5, marginTop: 18 }}>
          <a href="/" style={{ color: "#16261F", fontWeight: 600 }}>
            ← Volver a la campaña
          </a>
        </p>
      </div>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
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
