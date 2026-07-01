"use client";

import { useState } from "react";
import TurnstileWidget from "@/components/form-renderer/TurnstileWidget";
import type { FormConfig } from "@/lib/campaign-api";

const PROVINCIAS = [
  "Azuay", "Bolívar", "Cañar", "Carchi", "Chimborazo", "Cotopaxi",
  "El Oro", "Esmeraldas", "Galápagos", "Guayas", "Imbabura", "Loja",
  "Los Ríos", "Manabí", "Morona Santiago", "Napo", "Orellana",
  "Pastaza", "Pichincha", "Santa Elena", "Santo Domingo", "Sucumbíos",
  "Tungurahua", "Zamora Chinchipe", "Otra",
];

const ALL_VIS_OPTIONS = [
  {
    value: "pub" as const,
    db: "publica" as const,
    label: "Pública",
    desc: "Tu nombre y provincia aparecerán en la lista pública de firmas.",
  },
  {
    value: "anon" as const,
    db: "anonima" as const,
    label: "Anónima",
    desc: 'Aparecerás como "Anónimo". Tus datos van solo a la autoridad. (Recomendado)',
  },
  {
    value: "sec" as const,
    db: "secreta" as const,
    label: "Secreta",
    desc: "No apareces en ninguna lista. Solo la autoridad te cuenta para el total.",
  },
];

export interface FormValues {
  signer_type: "natural" | "org";
  org_name: string;
  name: string;
  email: string;
  location_mode: "nacional" | "internacional";
  provincia: string;
  country: string;
  cedula: string;
  visibility: "pub" | "anon" | "sec";
  consent: boolean;
  cf_turnstile_token: string;
}

interface Props {
  initial: FormValues;
  campaignTitle: string;
  formConfig: FormConfig;
  onSubmit: (values: FormValues) => void;
}

const inputClass = [
  "w-full min-h-[48px] px-4 rounded-[16px] text-[15px] outline-none",
  "transition-colors duration-150",
  "bg-[var(--bbg)] border-[1.5px] border-[var(--bbord)]",
  "placeholder:text-[var(--bmut)] text-[var(--bink)]",
  "focus:border-[var(--bp)] focus:ring-2 focus:ring-[color-mix(in_srgb,var(--bp)_40%,transparent)]",
].join(" ");

function TogglePills<T extends string>({
  options,
  value,
  onChange,
  labelId,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  labelId: string;
}) {
  return (
    <div role="radiogroup" aria-labelledby={labelId} className="flex gap-2">
      {options.map((opt) => {
        const active = value === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(opt.value)}
            className="flex-1 min-h-[44px] rounded-[14px] text-[13px] font-semibold transition-all"
            style={
              active
                ? { background: "var(--bp)", color: "var(--bop)", border: "1.5px solid var(--bp)" }
                : { background: "var(--bbg)", color: "var(--bink)", border: "1.5px solid var(--bbord)" }
            }
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

export default function StepForm({ initial, formConfig, onSubmit }: Props) {
  const [vals, setVals] = useState<FormValues>(initial);

  const set = <K extends keyof FormValues>(k: K, v: FormValues[K]) =>
    setVals((prev) => ({ ...prev, [k]: v }));

  const showSignerType = formConfig.signer_types.length > 1;
  const showLocationToggle = formConfig.location_modes.length > 1;
  const required = new Set(formConfig.required_fields);

  const visOptions = ALL_VIS_OPTIONS.filter((o) =>
    formConfig.visibility_options.includes(o.db)
  );
  const showVisGroup = visOptions.length > 1;

  const isInternacional = vals.location_mode === "internacional";
  const locationRequired = required.has("location");
  const orgNameRequired = required.has("org_name");

  // Cédula: solo obligatoria con algoritmo cuando es Ecuador
  const cedulaRequired = !isInternacional && required.has("cedula");

  const canSubmit = vals.consent && vals.cf_turnstile_token !== "";

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    onSubmit(vals);
  }

  const visDesc = visOptions.find((o) => o.value === vals.visibility)?.desc ?? "";

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 pb-4">

      {/* ── Tipo de firmante ── */}
      {showSignerType && (
        <div className="flex flex-col gap-2">
          <p
            id="signer-type-label"
            className="text-[13px] font-semibold"
            style={{ color: "var(--bink)" }}
          >
            Firmas como
          </p>
          <TogglePills
            options={[
              { value: "natural", label: "Persona natural" },
              { value: "org", label: "Organización" },
            ]}
            value={vals.signer_type}
            onChange={(v) => set("signer_type", v)}
            labelId="signer-type-label"
          />
        </div>
      )}

      {/* Nombre de la organización (condicional) */}
      {vals.signer_type === "org" && (
        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="sig-org-name"
            className="text-[13px] font-semibold"
            style={{ color: "var(--bink)" }}
          >
            Nombre de la organización{" "}
            {orgNameRequired && <span aria-hidden="true">*</span>}
          </label>
          <input
            id="sig-org-name"
            type="text"
            required={orgNameRequired}
            value={vals.org_name}
            onChange={(e) => set("org_name", e.target.value)}
            className={inputClass}
            placeholder="Nombre de tu organización"
          />
        </div>
      )}

      {/* ── Nombre ── */}
      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="sig-name"
          className="text-[13px] font-semibold"
          style={{ color: "var(--bink)" }}
        >
          Nombre completo <span aria-hidden="true">*</span>
        </label>
        <input
          id="sig-name"
          type="text"
          required
          autoComplete="name"
          value={vals.name}
          onChange={(e) => set("name", e.target.value)}
          className={inputClass}
          placeholder="Nombre Apellido"
        />
      </div>

      {/* ── Email ── */}
      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="sig-email"
          className="text-[13px] font-semibold"
          style={{ color: "var(--bink)" }}
        >
          Correo electrónico <span aria-hidden="true">*</span>
        </label>
        <input
          id="sig-email"
          type="email"
          required
          autoComplete="email"
          value={vals.email}
          onChange={(e) => set("email", e.target.value)}
          className={inputClass}
          placeholder="tu@correo.com"
        />
        <p style={{ fontSize: 12, color: "var(--bmut)" }}>
          Lo usamos solo para confirmar tu firma. No lo publicamos.
        </p>
      </div>

      {/* ── Toggle Nacional / Internacional ── */}
      {showLocationToggle && (
        <div className="flex flex-col gap-2">
          <p
            id="location-mode-label"
            className="text-[13px] font-semibold"
            style={{ color: "var(--bink)" }}
          >
            ¿Firmas desde?
          </p>
          <TogglePills
            options={[
              { value: "nacional", label: "Ecuador" },
              { value: "internacional", label: "Internacional" },
            ]}
            value={vals.location_mode}
            onChange={(v) => {
              set("location_mode", v);
              if (v === "nacional") set("country", "");
              else set("provincia", "");
            }}
            labelId="location-mode-label"
          />
        </div>
      )}

      {/* Provincia (Ecuador) */}
      {vals.location_mode === "nacional" && (
        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="sig-prov"
            className="text-[13px] font-semibold"
            style={{ color: "var(--bink)" }}
          >
            Provincia{" "}
            {locationRequired && <span aria-hidden="true">*</span>}
          </label>
          <select
            id="sig-prov"
            required={locationRequired}
            value={vals.provincia}
            onChange={(e) => set("provincia", e.target.value)}
            className={inputClass + " appearance-none"}
            style={{ background: "var(--bbg)" }}
          >
            <option value="">Selecciona tu provincia</option>
            {PROVINCIAS.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* País (Internacional) */}
      {isInternacional && (
        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="sig-country"
            className="text-[13px] font-semibold"
            style={{ color: "var(--bink)" }}
          >
            País{" "}
            {locationRequired && <span aria-hidden="true">*</span>}
          </label>
          <input
            id="sig-country"
            type="text"
            required={locationRequired}
            autoComplete="country-name"
            value={vals.country}
            onChange={(e) => set("country", e.target.value)}
            className={inputClass}
            placeholder="Ej. Colombia, España, EE.UU."
          />
        </div>
      )}

      {/* ── Identificación ── */}
      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="sig-cedula"
          className="text-[13px] font-semibold"
          style={{ color: "var(--bink)" }}
        >
          {isInternacional
            ? "Número de identificación"
            : "Cédula de identidad"}
          {" "}
          {cedulaRequired
            ? <span aria-hidden="true">*</span>
            : <span style={{ fontWeight: 400, color: "var(--bmut)" }}>(opcional)</span>
          }
        </label>
        <input
          id="sig-cedula"
          type="text"
          inputMode={isInternacional ? "text" : "numeric"}
          required={cedulaRequired}
          pattern={cedulaRequired ? "[0-9]{10}" : undefined}
          maxLength={isInternacional ? undefined : 10}
          value={vals.cedula}
          onChange={(e) =>
            set(
              "cedula",
              isInternacional ? e.target.value : e.target.value.replace(/\D/g, "")
            )
          }
          className={inputClass}
          placeholder={isInternacional ? "Tu número de identificación" : "0102030405"}
        />
        {isInternacional && (
          <p style={{ fontSize: 12, color: "var(--bmut)" }}>
            Pasaporte, DNI u otro documento según tu país.
          </p>
        )}
      </div>

      {/* ── Visibilidad ── */}
      {showVisGroup && (
        <div>
          <p
            className="text-[13px] font-semibold mb-2"
            style={{ color: "var(--bink)" }}
            id="vis-group-label"
          >
            ¿Cómo quieres aparecer?
          </p>
          <div
            role="radiogroup"
            aria-labelledby="vis-group-label"
            className="flex gap-2"
          >
            {visOptions.map((opt) => {
              const active = vals.visibility === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => set("visibility", opt.value)}
                  className="flex-1 min-h-[48px] rounded-[14px] text-[13px] font-semibold transition-all"
                  style={
                    active
                      ? { background: "var(--bp)", color: "var(--bop)", border: "1.5px solid var(--bp)" }
                      : { background: "var(--bbg)", color: "var(--bink)", border: "1.5px solid var(--bbord)" }
                  }
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
          {visDesc && (
            <p
              className="mt-2 text-[12px] leading-relaxed"
              style={{ color: "var(--bmut)" }}
            >
              {visDesc}
            </p>
          )}
        </div>
      )}

      {/* ── Consentimiento ── */}
      <label
        className="flex items-start gap-3 cursor-pointer rounded-[16px] p-3 transition-colors"
        style={{
          border: `1.5px solid ${vals.consent ? "var(--bp)" : "var(--bbord)"}`,
        }}
      >
        <input
          type="checkbox"
          required
          checked={vals.consent}
          onChange={(e) => set("consent", e.target.checked)}
          className="mt-0.5 w-[22px] h-[22px] shrink-0 accent-brand-primary"
          aria-label="Acepto el aviso de privacidad"
        />
        <span style={{ fontSize: 13, color: "var(--bink)", lineHeight: 1.5 }}>
          He leído y acepto el{" "}
          <a
            href="/aviso-de-privacidad"
            target="_blank"
            className="underline"
            style={{ color: "var(--bp)" }}
          >
            aviso de privacidad
          </a>
          . Mis datos se entregan a la autoridad como respaldo del trámite.
          Puedo revocar mi consentimiento cuando quiera.
        </span>
      </label>

      {/* Turnstile */}
      <TurnstileWidget
        onVerify={(token) => set("cf_turnstile_token", token)}
        onExpire={() => set("cf_turnstile_token", "")}
        onError={() => set("cf_turnstile_token", "")}
      />

      {/* Submit */}
      <button
        type="submit"
        disabled={!canSubmit}
        className="w-full font-display font-bold rounded-full text-[16px] transition-all"
        style={
          canSubmit
            ? {
                minHeight: 52,
                background: "var(--bp)",
                color: "var(--bop)",
                fontFamily: "var(--fd)",
                boxShadow: "0 6px 18px color-mix(in srgb,var(--bp) 32%,transparent)",
              }
            : {
                minHeight: 52,
                background: "var(--bbord)",
                color: "var(--bmut)",
                cursor: "not-allowed",
                fontFamily: "var(--fd)",
              }
        }
      >
        Firmar la petición
      </button>

      <p
        className="text-center"
        style={{ fontSize: 12, color: "var(--bmut)" }}
      >
        Verificación anti-bot invisible · doble confirmación por correo
      </p>
    </form>
  );
}
