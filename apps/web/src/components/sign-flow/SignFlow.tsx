"use client";

import { useEffect, useRef, useState } from "react";
import StepForm, { type FormValues } from "./StepForm";
import StepSending from "./StepSending";
import StepReview from "./StepReview";
import StepSuccess, { type ResendUi } from "./StepSuccess";
import StepError from "./StepError";
import StepThanks from "./StepThanks";
import {
  submitSignature,
  resendConfirmation,
  setNewsletterConsent,
  type SignatureError,
} from "@/lib/signatures-api";
import type { FormConfig } from "@/lib/campaign-api";
import { toSignaturePayload } from "@/lib/sign-payload";
import { buildReviewRows } from "@/lib/review-rows";
import { displayFirstName } from "@/lib/names";

type Step = "form" | "review" | "sending" | "success" | "error" | "thanks";

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
    first_name: "",
    last_name: "",
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
  const [step, setStep]           = useState<Step>("form");
  const [form, setForm]           = useState<FormValues>(() => buildInitForm(formConfig));
  const [errorMsg, setErrorMsg]   = useState("");
  const [resend, setResend] = useState<ResendUi>("idle");
  const [signing, setSigning] = useState(false);
  const signingRef = useRef(false); // guardia síncrona: el estado llega tarde para un doble clic
  // Último valor del formulario (incluido el token anti-bot, que se renueva solo aunque el formulario esté oculto).
  const formRef = useRef(form);
  formRef.current = form;
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

  /** Formulario válido → revisión. Todavía no se envía nada. */
  function handleReview(values: FormValues) {
    setForm(values);
    setStep("review");
  }

  async function handleSign() {
    if (signingRef.current) return;
    signingRef.current = true;
    setSigning(true);
    // Turnstile es invisible y se resolvió con el formulario; si venció o aún no llega, se espera hasta 5 s.
    for (let i = 0; i < 50 && !formRef.current.cf_turnstile_token; i++) await new Promise((r) => setTimeout(r, 100));
    await submit(formRef.current);
    signingRef.current = false;
    setSigning(false);
  }

  async function submit(values: FormValues) {
    setStep("sending");
    const result = await submitSignature(campaignId, toSignaturePayload(values));
    if (result.ok) { setNewsletterToken(result.data.newsletter_token ?? null); setResend("idle"); setStep("success"); }
    else { setErrorMsg(errorMessage(result.error)); setStep("error"); }
  }

  async function handleResend() {
    setResend("sending");
    const r = await resendConfirmation(campaignId, form.email);
    setResend(r);
    if (r === "rate_limited") setTimeout(() => setResend("idle"), 60_000);
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
      aria-label={step === "thanks" ? "Tu apoyo quedó registrado" : "Firmar esta petición"}
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

        {/* El formulario se mantiene montado (oculto) durante la revisión: conserva lo escrito y el token de Turnstile. */}
        <div hidden={step !== "form"}>
          <StepForm
            initial={form}
            campaignId={campaignId}
            campaignTitle={campaignTitle}
            formConfig={formConfig}
            categoryColor={categoryColor}
            onSubmit={handleReview}
            onValuesChange={setForm}
          />
        </div>
        {step === "review" && (
          <StepReview
            firstName={displayFirstName(form.first_name)}
            rows={buildReviewRows(form, formConfig)}
            busy={signing}
            onSign={handleSign}
            onEdit={() => setStep("form")}
          />
        )}
        {step === "sending" && <StepSending />}
        {step === "success" && (
          <StepSuccess
            name={displayFirstName(form.first_name)}
            email={form.email}
            resend={resend}
            onResend={handleResend}
            onDone={() => setStep("thanks")}
          />
        )}
        {step === "error" && (
          <StepError
            message={errorMsg}
            onRetry={() => submit(form)}
            onBack={() => setStep("form")}
          />
        )}
        {step === "thanks" && (
          <StepThanks
            name={displayFirstName(form.first_name)}
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
