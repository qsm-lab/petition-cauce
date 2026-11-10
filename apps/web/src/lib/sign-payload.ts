// Objeto que se envía al firmar. La revisión («Verifica que tu información sea correcta») se construye a partir de los MISMOS valores
// (ver review-rows.ts y su test): un campo nuevo que viaje al servidor sin aparecer en la revisión hace fallar el test.
import type { FormValues } from "@/components/sign-flow/StepForm";
import type { SignaturePayload } from "@/lib/signatures-api";

export function toSignaturePayload(values: FormValues): SignaturePayload {
  return {
    signer_type: values.signer_type,
    org_name: values.signer_type === "org" ? values.org_name : undefined,
    first_name: values.first_name.trim(),
    last_name: values.last_name.trim(),
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
  };
}
