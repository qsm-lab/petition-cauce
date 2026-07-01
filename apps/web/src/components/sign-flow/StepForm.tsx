"use client";

import { useState } from "react";
import TurnstileWidget from "@/components/form-renderer/TurnstileWidget";

const PROVINCIAS = [
  "Azuay", "Bolívar", "Cañar", "Carchi", "Chimborazo", "Cotopaxi",
  "El Oro", "Esmeraldas", "Galápagos", "Guayas", "Imbabura", "Loja",
  "Los Ríos", "Manabí", "Morona Santiago", "Napo", "Orellana",
  "Pastaza", "Pichincha", "Santa Elena", "Santo Domingo", "Sucumbíos",
  "Tungurahua", "Zamora Chinchipe", "Otra",
];

const VIS_OPTIONS = [
  {
    value: "pub" as const,
    label: "Pública",
    desc: "Tu nombre y provincia aparecerán en la lista pública de firmas.",
  },
  {
    value: "anon" as const,
    label: "Anónima",
    desc: 'Aparecerás como "Anónimo". Tus datos van solo a la autoridad. (Recomendado)',
  },
  {
    value: "sec" as const,
    label: "Secreta",
    desc: "No apareces en ninguna lista. Solo la autoridad te cuenta para el total.",
  },
];

export interface FormValues {
  name: string;
  email: string;
  cedula: string;
  provincia: string;
  visibility: "pub" | "anon" | "sec";
  consent: boolean;
  cf_turnstile_token: string;
}

interface Props {
  initial: FormValues;
  campaignTitle: string;
  onSubmit: (values: FormValues) => void;
}

const inputClass = [
  "w-full min-h-[48px] px-4 rounded-[16px] text-[15px] outline-none",
  "transition-colors duration-150",
  "bg-[var(--bbg)] border-[1.5px] border-[var(--bbord)]",
  "placeholder:text-[var(--bmut)] text-[var(--bink)]",
  "focus:border-[var(--bp)] focus:ring-2 focus:ring-[color-mix(in_srgb,var(--bp)_40%,transparent)]",
].join(" ");

export default function StepForm({ initial, campaignTitle, onSubmit }: Props) {
  const [vals, setVals] = useState<FormValues>(initial);

  const set = (k: keyof FormValues, v: FormValues[keyof FormValues]) =>
    setVals((prev) => ({ ...prev, [k]: v }));

  const canSubmit = vals.consent && vals.cf_turnstile_token !== "";

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    onSubmit(vals);
  }

  const visDesc = VIS_OPTIONS.find((o) => o.value === vals.visibility)?.desc ?? "";

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 pb-4">
      {/* Nombre */}
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

      {/* Email */}
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

      {/* Cédula */}
      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="sig-cedula"
          className="text-[13px] font-semibold"
          style={{ color: "var(--bink)" }}
        >
          Cédula de identidad <span aria-hidden="true">*</span>
        </label>
        <input
          id="sig-cedula"
          type="text"
          inputMode="numeric"
          required
          pattern="[0-9]{10}"
          maxLength={10}
          value={vals.cedula}
          onChange={(e) => set("cedula", e.target.value.replace(/\D/g, ""))}
          className={inputClass}
          placeholder="0102030405"
        />
      </div>

      {/* Provincia */}
      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="sig-prov"
          className="text-[13px] font-semibold"
          style={{ color: "var(--bink)" }}
        >
          Provincia <span aria-hidden="true">*</span>
        </label>
        <select
          id="sig-prov"
          required
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

      {/* Visibilidad */}
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
          {VIS_OPTIONS.map((opt) => {
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
                    ? {
                        background: "var(--bp)",
                        color: "var(--bop)",
                        border: "1.5px solid var(--bp)",
                      }
                    : {
                        background: "var(--bbg)",
                        color: "var(--bink)",
                        border: "1.5px solid var(--bbord)",
                      }
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

      {/* Consentimiento */}
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
                boxShadow:
                  "0 6px 18px color-mix(in srgb,var(--bp) 32%,transparent)",
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
