"use client";

import { useState } from "react";
import TurnstileWidget from "@/components/form-renderer/TurnstileWidget";
import SignHandIcon from "@/components/ui/SignHandIcon";
import type { FormConfig } from "@/lib/campaign-api";
import { PROVINCIAS } from "@/lib/provincias";

/** Azul de la paleta — selección activa después de que el usuario interactúa con un grupo */
const ACTIVE_BLUE = "#2B4EEA";

const ALL_VIS_OPTIONS = [
  { value: "pub"  as const, db: "publica"  as const, label: "Pública" },
  { value: "anon" as const, db: "anonima"  as const, label: "Anónima" },
  { value: "sec"  as const, db: "secreta"  as const, label: "Secreta" },
];

/** Qué implica cada visibilidad — se muestra bajo los botones según la selección */
const VIS_HINTS: Record<"pub" | "anon" | "sec", string> = {
  pub:  "Su nombre aparecerá en el listado público de apoyos y en el documento de entrega de la campaña.",
  anon: "Su firma se suma al conteo y al documento de entrega, pero su nombre no se muestra públicamente.",
  sec:  "Su firma solo se suma al conteo. No se muestra ni se incluirá en el documento de entrega oficial a autoridades.",
};

export interface FormValues {
  signer_type: "natural" | "org";
  org_name: string;
  name: string;
  email: string;
  cedula: string;
  location_mode: "nacional" | "internacional";
  provincia: string;
  country: string;
  visibility: "pub" | "anon" | "sec";
  consent: boolean;
  cf_turnstile_token: string;
}

interface Props {
  initial: FormValues;
  campaignId: string;
  campaignTitle: string;
  formConfig: FormConfig;
  categoryColor: string;
  onSubmit: (values: FormValues) => void;
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  padding: "14px 16px",
  borderRadius: 10,
  border: "1.5px solid #16261F",
  fontSize: 16,
  fontFamily: "var(--font-work-sans, 'Work Sans', sans-serif)",
  background: "#fff",
  color: "#16261F",
  outline: "none",
};

const labelStyle: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 700,
  display: "block",
  marginBottom: 6,
  color: "#16261F",
};

export default function StepForm({ initial, campaignId, campaignTitle, formConfig, categoryColor, onSubmit }: Props) {
  const [vals, setVals] = useState<FormValues>(initial);
  const set = <K extends keyof FormValues>(k: K, v: FormValues[K]) =>
    setVals((prev) => ({ ...prev, [k]: v }));

  const [showPrivacy, setShowPrivacy] = useState(false);
  const [privacyText, setPrivacyText] = useState<string | null>(null);
  const [privacyLoading, setPrivacyLoading] = useState(false);

  async function openPrivacy() {
    setShowPrivacy(true);
    if (privacyText !== null) return;
    setPrivacyLoading(true);
    try {
      const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8011";
      const res = await fetch(`${API}/v1/public-campaign/${campaignId}/privacy`);
      if (res.ok) {
        const data = await res.json();
        setPrivacyText(data.aviso_privacidad ?? "Aviso de privacidad no disponible.");
      } else {
        setPrivacyText("Aviso de privacidad no disponible para esta campaña.");
      }
    } catch {
      setPrivacyText("No se pudo cargar el aviso de privacidad.");
    } finally {
      setPrivacyLoading(false);
    }
  }

  const showSignerType   = formConfig.signer_types.length > 1;
  const showLocationToggle = formConfig.location_modes.length > 1;
  const required          = new Set(formConfig.required_fields);
  const visOptions        = ALL_VIS_OPTIONS.filter((o) => formConfig.visibility_options.includes(o.db));
  const showVisGroup      = visOptions.length > 1;
  const isIntl            = vals.location_mode === "internacional";
  const cedulaRequired    = !isIntl && required.has("cedula");
  const canSubmit         = !!(vals.name.trim() && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(vals.email) && vals.consent);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    onSubmit(vals);
  }

  const FONT_DISPLAY = "var(--font-anton, 'Anton', sans-serif)";
  const FONT_BODY    = "var(--font-work-sans, 'Work Sans', sans-serif)";

  // Un grupo pasa a "interactuado" cuando el usuario toca cualquiera de sus pills:
  // la selección por defecto va en negro; tras interactuar, la activa va en azul.
  const [interacted, setInteracted] = useState<{ signer: boolean; loc: boolean; vis: boolean }>({
    signer: false,
    loc: false,
    vis: false,
  });
  const markInteracted = (group: "signer" | "loc" | "vis") =>
    setInteracted((prev) => (prev[group] ? prev : { ...prev, [group]: true }));

  // Pill button factory
  function pill(
    label: string,
    active: boolean,
    onClick: () => void,
    groupInteracted = false
  ) {
    const bg    = active ? (groupInteracted ? ACTIVE_BLUE : "#16261F") : "#fff";
    const color = active ? "#fff" : "#16261F";
    return (
      <button
        key={label}
        type="button"
        onClick={onClick}
        style={{
          flex: 1,
          padding: "12px 6px",
          borderRadius: 24,
          fontSize: 14,
          fontWeight: 600,
          cursor: "pointer",
          background: bg,
          color,
          border: "1.5px solid #16261F",
          fontFamily: FONT_BODY,
          transition: "background 0.25s ease, color 0.25s ease",
        }}
      >
        {label}
      </button>
    );
  }

  return (
    <>
    <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 0 }}>
      {/* Eyebrow */}
      <div
        style={{
          fontSize: 12,
          fontWeight: 700,
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          color: "rgba(22,38,31,0.5)",
          marginBottom: 8,
          paddingRight: 40,
        }}
      >
        {campaignTitle}
      </div>

      <h2
        style={{
          fontFamily: FONT_DISPLAY,
          fontWeight: 400,
          fontSize: 28,
          margin: "0 0 20px",
          color: categoryColor,
        }}
      >
        Firmar esta petición
      </h2>

      {/* Tipo de firmante */}
      {showSignerType && (
        <div style={{ marginBottom: 18 }}>
          <div style={{ ...labelStyle, marginBottom: 8 }}>Tipo de firmante</div>
          <div style={{ display: "flex", gap: 8 }}>
            {pill("Persona natural", vals.signer_type === "natural", () => { markInteracted("signer"); set("signer_type", "natural"); }, interacted.signer)}
            {pill("Organización", vals.signer_type === "org", () => { markInteracted("signer"); set("signer_type", "org"); }, interacted.signer)}
          </div>
        </div>
      )}

      {/* Nombre de la org (condicional) */}
      {vals.signer_type === "org" && (
        <div style={{ marginBottom: 16 }}>
          <label style={labelStyle}>Nombre de la organización</label>
          <input
            type="text"
            value={vals.org_name}
            onChange={(e) => set("org_name", e.target.value)}
            style={inputStyle}
            placeholder="Nombre de tu organización"
          />
        </div>
      )}

      {/* Nombre completo */}
      <div style={{ marginBottom: 16 }}>
        <label style={labelStyle}>Nombre completo *</label>
        <input
          type="text"
          required
          autoComplete="name"
          value={vals.name}
          onChange={(e) => set("name", e.target.value)}
          style={inputStyle}
          placeholder="Nombre Apellido"
        />
      </div>

      {/* Correo */}
      <div style={{ marginBottom: 16 }}>
        <label style={labelStyle}>Correo electrónico *</label>
        <input
          type="email"
          required
          autoComplete="email"
          value={vals.email}
          onChange={(e) => set("email", e.target.value)}
          style={inputStyle}
          placeholder="tu@correo.com"
        />
      </div>

      {/* Ubicación toggle */}
      {showLocationToggle && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ ...labelStyle, marginBottom: 8 }}>Ubicación</div>
          <div style={{ display: "flex", gap: 8 }}>
            {pill("Ecuador", vals.location_mode === "nacional", () => {
              markInteracted("loc");
              set("location_mode", "nacional");
              set("country", "");
            }, interacted.loc)}
            {pill("Internacional", vals.location_mode === "internacional", () => {
              markInteracted("loc");
              set("location_mode", "internacional");
              set("provincia", "");
            }, interacted.loc)}
          </div>
        </div>
      )}

      {/* Provincia */}
      {vals.location_mode === "nacional" && (
        <div style={{ marginBottom: 16 }}>
          <label style={labelStyle}>
            Provincia {required.has("location") && <span aria-hidden="true">*</span>}
          </label>
          <select
            value={vals.provincia}
            onChange={(e) => set("provincia", e.target.value)}
            required={required.has("location")}
            style={{ ...inputStyle, appearance: "none" as const }}
          >
            <option value="">Selecciona...</option>
            {PROVINCIAS.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
      )}

      {/* País (internacional) */}
      {isIntl && (
        <div style={{ marginBottom: 16 }}>
          <label style={labelStyle}>
            País {required.has("location") && <span aria-hidden="true">*</span>}
          </label>
          <input
            type="text"
            required={required.has("location")}
            autoComplete="country-name"
            value={vals.country}
            onChange={(e) => set("country", e.target.value)}
            style={inputStyle}
            placeholder="Ej. Colombia, España, EE.UU."
          />
        </div>
      )}

      {/* Cédula */}
      <div style={{ marginBottom: 16 }}>
        <label style={labelStyle}>
          {isIntl ? "Número de identificación" : "Cédula de identidad"}{" "}
          {cedulaRequired
            ? <span aria-hidden="true">*</span>
            : <span style={{ fontWeight: 400, color: "rgba(22,38,31,0.5)" }}>(opcional)</span>
          }
        </label>
        <input
          type="text"
          inputMode={isIntl ? "text" : "numeric"}
          required={cedulaRequired}
          pattern={cedulaRequired ? "[0-9]{10}" : undefined}
          maxLength={isIntl ? undefined : 10}
          value={vals.cedula}
          onChange={(e) => set("cedula", isIntl ? e.target.value : e.target.value.replace(/\D/g, ""))}
          style={inputStyle}
          placeholder={isIntl ? "Tu número de identificación" : "0102030405"}
        />
      </div>

      {/* Visibilidad */}
      {showVisGroup && (
        <div style={{ marginBottom: 22 }}>
          <div style={{ ...labelStyle, marginBottom: 8 }}>Visibilidad de su firma</div>
          <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
            {visOptions.map((opt) =>
              pill(
                opt.label,
                vals.visibility === opt.value,
                () => { markInteracted("vis"); set("visibility", opt.value); },
                interacted.vis
              )
            )}
          </div>
          {/* Qué implica la opción elegida — cambia con la selección */}
          <div
            aria-live="polite"
            style={{
              fontSize: 12.5,
              lineHeight: 1.55,
              color: "rgba(22,38,31,0.65)",
              background: "rgba(22,38,31,0.05)",
              borderRadius: 10,
              padding: "10px 14px",
              minHeight: 40,
              boxSizing: "border-box",
            }}
          >
            {VIS_HINTS[vals.visibility]}
          </div>
        </div>
      )}

      {/* Consentimiento LOPDP */}
      <label
        style={{
          display: "flex",
          gap: 10,
          alignItems: "flex-start",
          cursor: "pointer",
          marginBottom: 8,
        }}
      >
        <input
          type="checkbox"
          required
          checked={vals.consent}
          onChange={(e) => set("consent", e.target.checked)}
          style={{ marginTop: 3, width: 18, height: 18, flexShrink: 0 }}
          aria-label="Acepto el aviso de privacidad"
        />
        <span style={{ fontSize: 13, lineHeight: 1.5, color: "#16261F" }}>
          Acepto el tratamiento de mis datos según el{" "}
          <button
            type="button"
            onClick={openPrivacy}
            style={{ color: "#16261F", textDecoration: "underline", background: "none", border: "none", padding: 0, cursor: "pointer", fontSize: "inherit", fontFamily: "inherit" }}
          >
            aviso de privacidad
          </button>.
        </span>
      </label>

      {/* Nota anti-bot — solo texto, sin espacio reservado visible */}
      <div style={{ fontSize: 12, color: "rgba(22,38,31,0.45)", marginBottom: 20 }}>
        Protegido con verificación de seguridad automática.
      </div>

      {/* Turnstile invisible */}
      <TurnstileWidget
        onVerify={(token) => set("cf_turnstile_token", token)}
        onExpire={() => set("cf_turnstile_token", "")}
        onError={() => set("cf_turnstile_token", "")}
      />

      {/* Submit */}
      <button
        type="submit"
        disabled={!canSubmit}
        className="group"
        style={{
          width: "100%",
          fontSize: 17,
          fontWeight: 700,
          color: canSubmit ? "var(--bop, #16261F)" : "rgba(22,38,31,0.4)",
          background: canSubmit ? "var(--bp, #D7F24C)" : "rgba(22,38,31,0.1)",
          border: "1.5px solid #16261F",
          borderRadius: 30,
          padding: 18,
          cursor: canSubmit ? "pointer" : "not-allowed",
          fontFamily: FONT_BODY,
          marginBottom: 16,
        }}
      >
        <span className="inline-flex items-center justify-center">
          {canSubmit && <SignHandIcon />}
          Firmar esta petición
        </span>
      </button>
    </form>

    {/* Modal aviso de privacidad */}
    {showPrivacy && (
      <div
        onClick={() => setShowPrivacy(false)}
        style={{
          position: "fixed", inset: 0, zIndex: 9999,
          background: "rgba(0,0,0,0.55)",
          display: "flex", alignItems: "center", justifyContent: "center",
          padding: "16px",
        }}
      >
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            position: "relative",
            background: "var(--bsurf, #fff)",
            borderRadius: 16,
            width: "100%", maxWidth: 640, maxHeight: "85vh",
            display: "flex", flexDirection: "column",
            boxShadow: "0 20px 60px rgba(0,0,0,0.25)",
            border: "1px solid var(--bbord, #e5e7eb)",
          }}
        >
          {/* Header */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px", borderBottom: "1px solid var(--bbord, #e5e7eb)", flexShrink: 0 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: "var(--bink, #16261F)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
              Aviso de privacidad
            </span>
            <button
              type="button"
              onClick={() => setShowPrivacy(false)}
              style={{
                width: 28, height: 28, borderRadius: "50%",
                border: "none", cursor: "pointer",
                background: "var(--bbg, #f3f4f6)",
                color: "var(--bink, #16261F)",
                fontSize: 14, fontWeight: 700,
                display: "flex", alignItems: "center", justifyContent: "center",
                flexShrink: 0,
              }}
              aria-label="Cerrar"
            >
              ✕
            </button>
          </div>

          {/* Contenido */}
          <div style={{ overflowY: "auto", padding: "20px 24px", flex: 1 }}>
            {privacyLoading ? (
              <p style={{ color: "var(--bmut, #6b7280)", fontSize: 13 }}>Cargando…</p>
            ) : (
              <pre style={{
                whiteSpace: "pre-wrap",
                overflowWrap: "break-word",
                wordBreak: "break-word",
                fontSize: 12.5,
                lineHeight: 1.7,
                color: "var(--bink, #16261F)",
                fontFamily: "inherit",
                margin: 0,
              }}>
                {privacyText}
              </pre>
            )}
          </div>
        </div>
      </div>
    )}
    </>
  );
}
