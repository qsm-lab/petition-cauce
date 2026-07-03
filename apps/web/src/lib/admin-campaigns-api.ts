import { apiServer } from "@/lib/api-server";

export interface AdminCampaign {
  id: string;
  title: string;
  petition_title: string | null;
  slug: string;
  status: string;
  category: string | null;
  goal_count: number | null;
  authority: string | null;
  petition_body: Record<string, unknown>;
  asks: string[];
  hero_image_url: string | null;
  ends_at: string | null;
  created_at: string;
  updated_at: string;
  meta: Record<string, unknown>;
  // campos de edición avanzada
  access_mode: string;
  description: string | null;
  welcome_title: string | null;
  welcome_title_color: string;
  welcome_slogan: string | null;
  welcome_slogan_color: string;
  welcome_description: string | null;
  welcome_logo_url: string | null;
  thank_you_title: string | null;
  thank_you_body: string | null;
  social_links: Record<string, string>;
  share_text: string | null;
}

export interface AdminCampaignListItem {
  id: string;
  title: string;
  slug: string;
  status: string;
  confirmed_signatures: number;
  goal_count: number | null;
  ends_at: string | null;
  created_at: string;
}

export interface DashboardSummary {
  total_confirmed_signatures: number;
  active_campaigns: number;
  draft_campaigns: number;
  total_goal: number | null;
  recent_campaigns: {
    id: string;
    title: string;
    slug: string;
    status: string;
    confirmed_signatures: number;
    goal_count: number | null;
    ends_at: string | null;
  }[];
}

export async function getAdminCampaigns(): Promise<AdminCampaignListItem[]> {
  const data = await apiServer<AdminCampaignListItem[]>("/v1/admin/campaigns");
  return data ?? [];
}

export async function getAdminCampaign(id: string): Promise<AdminCampaign | null> {
  return apiServer<AdminCampaign>(`/v1/campaigns/${id}`);
}

export async function getDashboardSummary(): Promise<DashboardSummary | null> {
  return apiServer<DashboardSummary>("/v1/dashboard/summary");
}
