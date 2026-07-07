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
