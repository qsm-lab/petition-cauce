const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8011";

export class ArcoApiError extends Error {
  constructor(public code: string, message?: string) {
    super(message || code);
  }
}

async function arcoFetch<T>(path: string, options: RequestInit & { token?: string } = {}): Promise<T> {
  const { token, headers, ...rest } = options;
  const res = await fetch(`${API_URL}/v1/arco${path}`, {
    ...rest,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const code = typeof body?.detail === "object" ? body.detail.error : body?.detail;
    throw new ArcoApiError(code || `http_${res.status}`, body?.message);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

export interface ArcoConsentSummary {
  text_snapshot: string;
  version: string;
  legal_basis: string;
  consented_at: string | null;
  notify_updates: boolean;
  subscribe_newsletter: boolean;
}

export interface ArcoCampaignSummary {
  signature_id: string;
  campaign_id: string;
  campaign_title: string;
  visibility: "publica" | "anonima" | "secreta";
  status: string;
  signable: boolean;
  is_origin: boolean;
  confirmed_at: string | null;
  created_at: string;
  just_auto_confirmed: boolean;
  consent: ArcoConsentSummary | null;
  signer_type: "natural" | "org";
  org_name: string | null;
  location_mode: "nacional" | "internacional";
  provincia: string | null;
  country: string | null;
  profile_editable: boolean;
}

export interface ArcoDataResponse {
  name: string | null;
  email_masked: string;
  cedula_masked: string | null;
  celular_masked: string | null;
  campaigns: ArcoCampaignSummary[];
}

export interface ArcoPersonalDataConflict {
  campaign_id: string;
  campaign_title: string;
  field: string;
  reason: string;
}

export const arcoApi = {
  requestAccess: (email: string, cedula: string, cf_turnstile_token: string, origin_campaign_id: string | null) =>
    arcoFetch<{ ok: boolean; message: string }>("/request-access", {
      method: "POST",
      body: JSON.stringify({ email, cedula, cf_turnstile_token, origin_campaign_id }),
    }),

  verify: (token: string, origin_campaign_id: string | null) =>
    arcoFetch<{ portal_token: string; expires_at: string }>("/verify", {
      method: "POST",
      body: JSON.stringify({ token, origin_campaign_id }),
    }),

  getData: (portalToken: string) =>
    arcoFetch<ArcoDataResponse>("/data", { token: portalToken }),

  updatePersonalData: (
    portalToken: string,
    data: { name?: string; email?: string; cedula?: string; celular?: string }
  ) =>
    arcoFetch<{ ok: boolean; message: string; conflicts: ArcoPersonalDataConflict[] }>("/personal-data", {
      method: "PATCH",
      token: portalToken,
      body: JSON.stringify(data),
    }),

  setVisibility: (portalToken: string, signature_id: string, visibility: string) =>
    arcoFetch<{ ok: boolean; message: string }>("/visibility", {
      method: "PATCH",
      token: portalToken,
      body: JSON.stringify({ signature_id, visibility }),
    }),

  updateCampaignProfile: (
    portalToken: string,
    data: {
      signature_id: string;
      signer_type?: string;
      org_name?: string;
      location_mode?: string;
      provincia?: string;
      country?: string;
    }
  ) =>
    arcoFetch<{ ok: boolean; message: string }>("/campaign-profile", {
      method: "PATCH",
      token: portalToken,
      body: JSON.stringify(data),
    }),

  oppose: (
    portalToken: string,
    signature_id: string,
    data: { notify_updates?: boolean; subscribe_newsletter?: boolean }
  ) =>
    arcoFetch<{ ok: boolean; message: string }>("/oppose", {
      method: "PATCH",
      token: portalToken,
      body: JSON.stringify({ signature_id, ...data }),
    }),

  confirm: (portalToken: string, signature_id: string) =>
    arcoFetch<{ ok: boolean; message: string }>("/confirm", {
      method: "POST",
      token: portalToken,
      body: JSON.stringify({ signature_id }),
    }),

  deleteSubject: (portalToken: string, signature_id: string) =>
    arcoFetch<{ ok: boolean; message: string }>("/subject", {
      method: "DELETE",
      token: portalToken,
      body: JSON.stringify({ signature_id }),
    }),

  exportUrl: (format: "json" | "csv") => `${API_URL}/v1/arco/export?format=${format}`,
};
