"use client";

import { useEffect, useRef, useState } from "react";
import StepForm, { type FormValues } from "./StepForm";
import StepSending from "./StepSending";
import StepSuccess from "./StepSuccess";
import StepError from "./StepError";
import StepThanks from "./StepThanks";
import { submitSignature, type SignatureError } from "@/lib/signatures-api";

type Step = 0 | 1 | 2 | 3 | 4;

interface Props {
  campaignId: string;
  campaignTitle: string;
  campaignUrl: string;
  onClose: () => void;
}

const INIT_FORM: FormValues = {
  name: "",
  email: "",
  cedula: "",
  provincia: "",
  visibility: "anon",
  consent: false,
  cf_turnstile_token: "",
};

function errorMessage(err: SignatureError): string {
  switch (err.type) {
    case "ya_firmaste":
      return "Ya firmaste esta campaña con este correo. Si crees que es un error, contacta al administrador.";
    case "cedula_invalida":
      return "La cédula ingresada no es válida. Por favor verifica el número.";
    case "turnstile_failed":
      return "La verificación anti-bot no pasó. Actualiza la página e intenta de nuevo.";
    case "rate_limit":
      return "Demasiados intentos. Espera un minuto e intenta de nuevo.";
    case "network":
      return "Sin conexión. Verifica tu internet e intenta de nuevo.";
    default:
      return "Hubo un problema de conexión. Tus datos no se perdieron: solo vuelve a intentar.";
  }
}

export default function SignFlow({
  campaignId,
  campaignTitle,
  campaignUrl,
  onClose,
}: Props) {
  const [step, setStep] = useState<Step>(0);
  const [form, setForm] = useState<FormValues>(INIT_FORM);
  const [errorMsg, setErrorMsg] = useState("");
  const [confirmData, setConfirmData] = useState<{
    count: number;
    goal: number | null;
  } | null>(null);

  const dialogRef = useRef<HTMLDivElement>(null);

  // Close on Esc
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
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
    const last = focusable[focusable.length - 1];
    first?.focus();

    const trap = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;
      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };
    el.addEventListener("keydown", trap);
    return () => el.removeEventListener("keydown", trap);
  }, [step]);

  async function handleSubmit(values: FormValues) {
    setForm(values);
    setStep(1);

    const result = await submitSignature(campaignId, {
      name: values.name,
      email: values.email,
      cedula: values.cedula,
      provincia: values.provincia,
      visibility: values.visibility,
      consent: values.consent,
      subscribe_newsletter: false,
      cf_turnstile_token: values.cf_turnstile_token,
    });

    if (result.ok) {
      setStep(2);
    } else {
      setErrorMsg(errorMessage(result.error));
      setStep(3);
    }
  }

  function handleContinue() {
    // Ideally: poll for confirmation. For now, proceed to thanks with last known count.
    setStep(4);
  }

  const stepTitle =
    step === 4 ? "Tu apoyo quedó registrado" : "Firmar esta petición";

  return (
    /* Backdrop */
    <div
      className="fixed inset-0 z-50 flex items-end md:items-center md:justify-center"
      style={{ background: "rgba(15,20,16,.5)", backdropFilter: "blur(2px)" }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
      aria-hidden="false"
    >
      {/* Sheet / Modal */}
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={stepTitle}
        className="
          w-full md:max-w-[420px]
          rounded-t-[28px] md:rounded-[28px]
          flex flex-col
          animate-pc-rise
          overflow-hidden
        "
        style={{
          background: "var(--bsurf)",
          maxHeight: "92dvh",
        }}
      >
        {/* Header */}
        <div
          className="shrink-0 px-5 pt-4 pb-3 flex items-start"
          style={{ borderBottom: "1px solid var(--bbord)" }}
        >
          {/* Drag handle (mobile) */}
          <div className="md:hidden w-full flex justify-center mb-3 absolute left-0 top-3 pointer-events-none">
            <div
              className="rounded-full"
              style={{ width: 38, height: 5, background: "var(--bbord)" }}
            />
          </div>

          <div className="flex-1 mt-6 md:mt-0">
            <p
              className="font-display font-bold"
              style={{
                fontSize: 17,
                color: "var(--bink)",
                fontFamily: "var(--fd)",
              }}
            >
              {stepTitle}
            </p>
            {step === 0 && (
              <p style={{ fontSize: 12.5, color: "var(--bmut)" }}>
                {campaignTitle} · 4 datos obligatorios
              </p>
            )}
          </div>

          <button
            onClick={onClose}
            className="ml-2 mt-4 md:mt-0 shrink-0 rounded-full flex items-center justify-center transition-colors hover:bg-[var(--bbg)]"
            style={{ width: 44, height: 44, color: "var(--bmut)", fontSize: 22 }}
            aria-label="Cerrar"
          >
            ✕
          </button>
        </div>

        {/* Body (scrollable) */}
        <div className="flex-1 overflow-y-auto px-5 pt-4">
          {step === 0 && (
            <StepForm
              initial={form}
              campaignTitle={campaignTitle}
              onSubmit={handleSubmit}
            />
          )}
          {step === 1 && <StepSending />}
          {step === 2 && (
            <StepSuccess
              email={form.email}
              onContinue={handleContinue}
              onResend={() => {
                /* TODO: call resend endpoint */
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
              onSubscribe={() => {
                /* TODO: update newsletter consent */
              }}
            />
          )}
        </div>
      </div>
    </div>
  );
}
