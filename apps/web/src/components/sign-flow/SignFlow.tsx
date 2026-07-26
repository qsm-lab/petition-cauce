"use client";

import { useEffect, useRef, useState } from "react";
import StepForm, { type FormValues } from "./StepForm";
import StepSending from "./StepSending";
import StepSuccess from "./StepSuccess";
import StepError from "./StepError";
import StepThanks from "./StepThanks";
import {
  submitSignature,
  getCampaignCount,
  resendConfirmation,
  setNewsletterConsent,
  type SignatureError,
} from "@/lib/signatures-api";
import type { FormConfig } from "@/lib/campaign-api";

type Step = 0 | 1 | 2 | 3 | 4;

interface Props {
  campaignId: string;
  campaignTitle: string;
  campaignUrl: string;
  formConfig: FormConfig;
  categoryColor: string;
  shareText?: string | null;
  heroImageUrl?: string | null;
  welcomeTitle?: string | null;
  welcomeSlogan?: string | null;
  onClose: () => void;
}

function buildInitForm(formConfig: FormConfig): FormValues {
  // Por defecto la firma es pública (regla de plataforma); fallback al orden configurado
  const defaultVis = formConfig.visibility_options.includes("publica")
    ? "pub"
    : formConfig.visibility_options.includes("anonima")
    ? "anon"
    : "sec";
  return {
    signer_type: "natural",
    org_name: "",
    name: "",
    email: "",
    cedula: "",
    celular: "",
    location_mode: "nacional",
    provincia: "",
    country: "",
    visibility: defaultVis,
    consent: false,
    cf_turnstile_token: "",
  };
}

function errorMessage(err: SignatureError): string {
  switch (err.type) {
    case "ya_firmaste":    return "Ya registramos una firma suya en esta campaña.";
    case "cedula_invalida": return "La cédula ingresada no es válida. Revísela e inténtelo de nuevo.";
    case "cedula_requerida": return "La cédula es obligatoria para esta campaña.";
    case "turnstile_failed": return "La verificación anti-bot no pasó. Actualice la página e intente de nuevo.";
    case "rate_limit":    return "Demasiados intentos. Espere unos minutos e inténtelo de nuevo.";
    case "network":       return "No pudimos conectar. Revise su conexión e inténtelo de nuevo.";
    default:              return "Algo salió mal. Inténtelo de nuevo.";
  }
}

export default function SignFlow({
  campaignId,
  campaignTitle,
  campaignUrl,
  formConfig,
  categoryColor,
  shareText,
  heroImageUrl,
  welcomeTitle,
  welcomeSlogan,
  onClose,
}: Props) {
  const [step, setStep]           = useState<Step>(0);
  const [form, setForm]           = useState<FormValues>(() => buildInitForm(formConfig));
  const [errorMsg, setErrorMsg]   = useState("");
  const [confirmData, setConfirmData] = useState<{ count: number; goal: number | null } | null>(null);
  const [resendState, setResendState] = useState<"idle" | "sending" | "sent">("idle");
  // Token del consentimiento de Anuncios post-firma (embudo-post-firma).
  const [newsletterToken, setNewsletterToken] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  // Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  // Focus trap
  useEffect(() => {
    const el = dialogRef.current;
    if (!el) return;
    const focusable = el.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    const first = focusable[0];
    const last  = focusable[focusable.length - 1];
    first?.focus();
    const trap = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;
      if (e.shiftKey) {
        if (document.activeElement === first) { e.preventDefault(); last?.focus(); }
      } else {
        if (document.activeElement === last)  { e.preventDefault(); first?.focus(); }
      }
    };
    el.addEventListener("keydown", trap);
    return () => el.removeEventListener("keydown", trap);
  }, [step]);

  async function handleSubmit(values: FormValues) {
    setForm(values);
    setStep(1);
    const result = await submitSignature(campaignId, {
      signer_type: values.signer_type,
      org_name: values.signer_type === "org" ? values.org_name : undefined,
      name: values.name,
      email: values.email,
      cedula: values.cedula || undefined,
      celular: values.celular || undefined,
      location_mode: values.location_mode,
      provincia: values.location_mode === "nacional" ? values.provincia : undefined,
      country: values.location_mode === "internacional" ? values.country : undefined,
      visibility: values.visibility,
      consent: values.consent,
      subscribe_newsletter: false,
      cf_turnstile_token: values.cf_turnstile_token,
    });
    if (result.ok) { setNewsletterToken(result.data.newsletter_token ?? null); setStep(2); }
    else { setErrorMsg(errorMessage(result.error)); setStep(3); }
  }

  async function handleContinue() {
    const data = await getCampaignCount(campaignId);
    if (data) setConfirmData(data);
    setStep(4);
  }

  const FONT_BODY = "var(--font-work-sans, 'Work Sans', sans-serif)";

  return (
    /* Backdrop */
    <div
      className="fixed inset-0 z-[100] flex items-end md:items-center md:justify-center"
      style={{ background: "rgba(18,34,46,.55)", backdropFilter: "blur(3px)" }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
      role="dialog"
      aria-modal="true"
      aria-label={step === 4 ? "Tu apoyo quedó registrado" : "Firmar esta petición"}
    >
      {/* Panel */}
      <div
        ref={dialogRef}
        onClick={(e) => e.stopPropagation()}
        className="w-full md:max-w-[520px] rounded-t-[24px] md:rounded-[20px] max-h-[88vh] md:max-h-[90vh] overflow-y-auto"
        style={{
          background: "#fff",
          padding: 28,
          position: "relative",
          boxShadow: "0 20px 60px rgba(22,38,31,.3)",
          boxSizing: "border-box",
          fontFamily: FONT_BODY,
        }}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          aria-label="Cerrar"
          style={{
            position: "absolute",
            top: 16,
            right: 16,
            width: 34,
            height: 34,
            borderRadius: "50%",
            background: "#FBF0E6",
            border: "none",
            fontSize: 16,
            cursor: "pointer",
            color: "#16261F",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          ✕
        </button>

        {step === 0 && (
          <StepForm
            initial={form}
            campaignId={campaignId}
            campaignTitle={campaignTitle}
            formConfig={formConfig}
            categoryColor={categoryColor}
            onSubmit={handleSubmit}
          />
        )}
        {step === 1 && <StepSending />}
        {step === 2 && (
          <StepSuccess
            name={form.name}
            email={form.email}
            resendState={resendState}
            onContinue={handleContinue}
            onResend={async () => {
              setResendState("sending");
              await resendConfirmation(campaignId, form.email);
              setResendState("sent");
            }}
          />
        )}
        {step === 3 && (
          <StepError
            message={errorMsg}
            onRetry={() => handleSubmit(form)}
            onBack={() => setStep(0)}
          />
        )}
        {step === 4 && (
          <StepThanks
            name={form.name}
            count={confirmData?.count ?? 0}
            goal={confirmData?.goal ?? null}
            campaignUrl={campaignUrl}
            campaignTitle={campaignTitle}
            categoryColor={categoryColor}
            shareText={shareText}
            heroImageUrl={heroImageUrl}
            welcomeTitle={welcomeTitle}
            welcomeSlogan={welcomeSlogan}
            onSubscribe={async (val: boolean) => {
              if (!newsletterToken) return { ok: false, expired: true };
              return setNewsletterConsent(newsletterToken, val);
            }}
          />
        )}
      </div>
    </div>
  );
}
