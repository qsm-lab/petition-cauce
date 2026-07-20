import { api } from "@/lib/api";
import type { LifecycleEventOut } from "@/lib/admin-campaigns-api";

export async function advanceLifecycleStage(
  campaignId: string,
  stage: number,
  notes: string | null,
  notifyOrg: boolean,
): Promise<{ lifecycle_stage: number; event: LifecycleEventOut; notifications_sent: string[] }> {
  return api.patch(`/v1/campaigns/${campaignId}/lifecycle`, {
    stage,
    notes: notes || null,
    notify_org: notifyOrg,
  });
}

export async function notifySigners(
  campaignId: string,
  message: string,
): Promise<{ sent_count: number }> {
  return api.post(`/v1/campaigns/${campaignId}/lifecycle/notify-signers`, { message });
}

export interface EventInvitationData {
  event_title?: string | null;
  event_subtitle?: string | null;
  event_datetime: string;
  event_location: string;
  event_map_url?: string | null;
  event_image_url?: string | null;
  message?: string | null;
  subject?: string | null;
}

export async function previewEventInvitation(
  campaignId: string,
  data: EventInvitationData,
): Promise<{ html: string; recipient_count: number }> {
  return api.post(`/v1/campaigns/${campaignId}/lifecycle/event-invitation/preview`, data);
}

export async function sendEventInvitation(
  campaignId: string,
  data: EventInvitationData,
  testEmails?: string[],
): Promise<{ sent_count: number; mode: "test" | "real" }> {
  return api.post(`/v1/campaigns/${campaignId}/lifecycle/event-invitation`, {
    ...data,
    test_emails: testEmails && testEmails.length > 0 ? testEmails : undefined,
  });
}

export interface ClosingNotificationData {
  subtitle?: string | null;
  image_url?: string | null;
  message?: string | null;
  subject?: string | null;
}

export async function previewClosingNotification(
  campaignId: string,
  data: ClosingNotificationData,
): Promise<{ html: string; final_count: number; recipient_count: number }> {
  return api.post(`/v1/campaigns/${campaignId}/lifecycle/closing-notification/preview`, data);
}

export async function sendClosingNotification(
  campaignId: string,
  data: ClosingNotificationData,
  testEmails?: string[],
): Promise<{ sent_count: number; final_count: number; mode: "test" | "real" }> {
  return api.post(`/v1/campaigns/${campaignId}/lifecycle/closing-notification`, {
    ...data,
    test_emails: testEmails && testEmails.length > 0 ? testEmails : undefined,
  });
}
