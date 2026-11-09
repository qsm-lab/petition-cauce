const PUBLIC_API =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8011";

export interface SignaturePayload {
  signer_type: "natural" | "org";
  org_name?: string;
  name: string;
  email: string;
  cedula?: string;
  celular?: string;
  location_mode: "nacional" | "internacional";
  provincia?: string;
  country?: string;
  visibility: "pub" | "anon" | "sec";
  consent: boolean;
  subscribe_newsletter: boolean;
  cf_turnstile_token: string;
}

export interface SignatureResult {
  id: string;
  status: string;
  // Token efímero para setear el consentimiento de Anuncios desde StepThanks
  // (embudo-post-firma). Puede faltar si el backend aún no lo emite.
  newsletter_token?: string | null;
}

export interface ConfirmResult {
  count: number;
  goal: number | null;
}

export type SignatureError =
  | { type: "turnstile_failed" }
  | { type: "ya_firmaste" }
  | { type: "cedula_invalida" }
  | { type: "cedula_requerida" }
  | { type: "rate_limit" }
  | { type: "network" }
  | { type: "unknown"; status: number };

export async function submitSignature(
  campaignId: string,
  payload: SignaturePayload
): Promise<{ ok: true; data: SignatureResult } | { ok: false; error: SignatureError }> {
  try {
    const res = await fetch(
      `${PUBLIC_API}/v1/public-campaign/${campaignId}/signatures`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }
    );

    if (res.ok) {
      return { ok: true, data: await res.json() };
    }

    if (res.status === 429) return { ok: false, error: { type: "rate_limit" } };

    const body = await res.json().catch(() => ({}));
    const detail = body?.detail ?? {};
    const errCode = typeof detail === "object" ? detail?.error : detail;

    if (errCode === "turnstile_failed")
      return { ok: false, error: { type: "turnstile_failed" } };
    if (errCode === "ya_firmaste")
      return { ok: false, error: { type: "ya_firmaste" } };
    if (errCode === "cedula_invalida")
      return { ok: false, error: { type: "cedula_invalida" } };
    if (errCode === "cedula_requerida")
      return { ok: false, error: { type: "cedula_requerida" } };

    return { ok: false, error: { type: "unknown", status: res.status } };
  } catch {
    return { ok: false, error: { type: "network" } };
  }
}

export async function resendConfirmation(
  campaignId: string,
  email: string,
): Promise<boolean> {
  try {
    const res = await fetch(
      `${PUBLIC_API}/v1/public-campaign/${campaignId}/signatures/resend-confirmation`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      }
    );
    return res.status === 204;
  } catch {
    return false;
  }
}

/**
 * Setea el consentimiento de Anuncios de la firma recién creada, autorizado por
 * el `newsletter_token` devuelto al firmar (embudo-post-firma).
 * `expired: true` cuando el token venció (404) → la UI degrada al portal por
 * correo; cualquier otro fallo es de red → la UI revierte el checkbox.
 */
export async function setNewsletterConsent(
  token: string,
  notifyUpdates: boolean
): Promise<{ ok: boolean; expired: boolean }> {
  try {
    const res = await fetch(
      `${PUBLIC_API}/v1/public-campaign/signatures/newsletter-consent`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, notify_updates: notifyUpdates }),
      }
    );
    if (res.status === 204) return { ok: true, expired: false };
    if (res.status === 404) return { ok: false, expired: true };
    return { ok: false, expired: false };
  } catch {
    return { ok: false, expired: false };
  }
}

export async function getCampaignCount(
  campaignId: string
): Promise<ConfirmResult | null> {
  try {
    const res = await fetch(`${PUBLIC_API}/v1/public-campaign/${campaignId}`);
    if (!res.ok) return null;
    const data = await res.json();
    return { count: data.total_count ?? data.signature_count ?? 0, goal: data.goal_count ?? null };
  } catch {
    return null;
  }
}

/** Respuesta de `POST /confirm/<token>` (verificacion-confirmacion-privacidad). `name` solo llega si la firma es pública. */
export type ConfirmOutcome =
  | { kind: "confirmed"; slug: string; name?: string }
  | { kind: "expired"; slug: string }
  | { kind: "invalid" }
  | { kind: "error"; rateLimited: boolean };

/** Confirma la firma del enlace del correo. El token nunca se registra ni se devuelve. */
export async function confirmSignature(token: string): Promise<ConfirmOutcome> {
  try {
    const res = await fetch(`${PUBLIC_API}/v1/public-campaign/confirm/${encodeURIComponent(token)}`, {
      method: "POST",
      cache: "no-store",
    });
    if (res.status === 429) return { kind: "error", rateLimited: true };
    if (!res.ok) return { kind: "error", rateLimited: false };
    const body = await res.json();
    if (body?.status === "confirmed" && typeof body.slug === "string" && body.slug) {
      return { kind: "confirmed", slug: body.slug, name: typeof body.name === "string" ? body.name : undefined };
    }
    if (body?.status === "expired" && typeof body.slug === "string" && body.slug) {
      return { kind: "expired", slug: body.slug };
    }
    return { kind: "invalid" };
  } catch {
    return { kind: "error", rateLimited: false };
  }
}
