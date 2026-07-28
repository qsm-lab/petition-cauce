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
  heading: string;
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

// ── Fase 3: borradores, programación, cola, historial ──────────────────────

export type ScheduledSendStatus = "draft" | "pending" | "sending" | "sent" | "cancelled" | "failed";

export interface ScheduledSendOut {
  id: string;
  type: CommsType;
  comms_class: "anuncios" | "servicio";
  subject: string;
  heading: string;
  status: ScheduledSendStatus;
  scheduled_at: string | null;
  recipient_count: number;
  sent_count: number;
  failed_count: number;
  created_at: string;
  updated_at: string;
}

export interface DraftOut extends ScheduledSendOut {
  body_html: string;
  ctas: CtaButtonIn[];
  include_social: boolean;
  audience: AudienceIn;
}

export interface SendLogOut {
  id: string;
  type: CommsType;
  comms_class: "anuncios" | "servicio";
  subject: string;
  recipient_count: number;
  sent_count: number;
  failed_count: number;
  mode: "real" | "test";
  trigger: "manual" | "scheduled";
  created_at: string;
}

interface DraftSavePayload extends CommsContentPayload {
  audience: AudienceIn;
  draft_id?: string | null;
}

export async function saveCommsDraft(campaignId: string, data: DraftSavePayload): Promise<DraftOut> {
  return api.post(`/v1/campaigns/${campaignId}/comms/drafts`, data);
}

export async function listCommsDrafts(campaignId: string): Promise<DraftOut[]> {
  return api.get(`/v1/campaigns/${campaignId}/comms/drafts`);
}

export async function getCommsDraft(campaignId: string, draftId: string): Promise<DraftOut> {
  return api.get(`/v1/campaigns/${campaignId}/comms/drafts/${draftId}`);
}

export async function deleteCommsDraft(campaignId: string, draftId: string): Promise<{ ok: boolean }> {
  return api.delete(`/v1/campaigns/${campaignId}/comms/drafts/${draftId}`);
}

export async function scheduleComms(
  campaignId: string,
  data: DraftSavePayload & { scheduled_at: string },
): Promise<ScheduledSendOut> {
  return api.post(`/v1/campaigns/${campaignId}/comms/schedule`, data);
}

export async function getCommsQueue(campaignId: string): Promise<ScheduledSendOut[]> {
  return api.get(`/v1/campaigns/${campaignId}/comms/queue`);
}

export async function cancelCommsQueueItem(campaignId: string, sendId: string): Promise<ScheduledSendOut> {
  return api.post(`/v1/campaigns/${campaignId}/comms/queue/${sendId}/cancel`, {});
}

export async function getCommsHistory(campaignId: string): Promise<SendLogOut[]> {
  return api.get(`/v1/campaigns/${campaignId}/comms/history`);
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
  if (res.status === 401) {
    // Mismo manejo que apiFetch (api.ts): sin esto, una sesión vencida
    // dejaba "No autenticado" atascado en el modal en vez de mandar a
    // relogueáse como hace el resto de la app.
    if (typeof window !== "undefined") {
      window.location.href = "/login";
    }
    throw new Error("Sesión expirada");
  }
  if (!res.ok) {
    const error = await res.json().catch(() => ({ detail: "Error al subir la imagen" }));
    throw new Error(error.detail || `HTTP ${res.status}`);
  }
  return res.json();
}
