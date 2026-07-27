import { api, API_URL } from "@/lib/api";

export type CommsType = "general" | "invitation" | "closing";

export interface CtaButtonIn {
  text: string;
  url: string;
  enabled: boolean;
}

export interface AudienceIn {
  include_confirmed: boolean;
  include_pending: boolean;
  signer_types: string[];
  locations: string[];
  visibilities: string[];
}

export interface CommsQuota {
  provider: string;
  plan: string;
  daily_used: number;
  daily_quota: number | null;
  monthly_used: number;
  monthly_quota: number | null;
  updated_at: string | null;
  sender: string;
  org_name: string;
}

export async function getCommsQuota(campaignId: string): Promise<CommsQuota> {
  return api.get(`/v1/campaigns/${campaignId}/comms/quota`);
}

export async function countCommsRecipients(
  campaignId: string,
  type: CommsType,
  audience: AudienceIn,
): Promise<{ count: number }> {
  return api.post(`/v1/campaigns/${campaignId}/comms/recipients/count`, { type, audience });
}

interface CommsContentPayload {
  type: CommsType;
  subject: string;
  body_html: string;
  ctas: CtaButtonIn[];
  include_social: boolean;
}

export async function previewComms(
  campaignId: string,
  data: CommsContentPayload,
): Promise<{ html: string }> {
  return api.post(`/v1/campaigns/${campaignId}/comms/preview`, data);
}

export async function sendComms(
  campaignId: string,
  data: CommsContentPayload & { audience: AudienceIn; test_emails?: string[] },
): Promise<{ sent_count: number; recipient_count: number; mode: "test" | "real" }> {
  return api.post(`/v1/campaigns/${campaignId}/comms/send`, data);
}

export async function uploadCommsImage(campaignId: string, file: File): Promise<{ id: string; url: string }> {
  const form = new FormData();
  form.append("file", file);
  // multipart: no fijar Content-Type a mano (el navegador arma el boundary) —
  // por eso no se reutiliza el helper `api` (siempre serializa a JSON).
  const res = await fetch(`${API_URL}/v1/campaigns/${campaignId}/comms/uploads`, {
    method: "POST",
    credentials: "include",
    body: form,
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({ detail: "Error al subir la imagen" }));
    throw new Error(error.detail || `HTTP ${res.status}`);
  }
  return res.json();
}
