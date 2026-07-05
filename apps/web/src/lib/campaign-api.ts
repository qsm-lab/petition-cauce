const INTERNAL_API =
  process.env.API_INTERNAL_URL ?? "http://petition-api-dev:8000";

export interface CampaignOrg {
  id: string;
  name: string;
  initial: string;
  logo_url: string | null;
}

export interface CampaignAttachment {
  title: string;
  url: string;
}

export interface FormConfig {
  signer_types: ("natural" | "org")[];
  location_modes: ("nacional" | "internacional")[];
  required_fields: string[];
  visibility_options: ("publica" | "anonima" | "secreta")[];
}

export const DEFAULT_FORM_CONFIG: FormConfig = {
  signer_types: ["natural"],
  location_modes: ["nacional"],
  required_fields: ["nombre", "email", "cedula", "location"],
  visibility_options: ["publica", "anonima"],
};

export interface PublicCampaign {
  id: string;
  slug: string;
  title: string;
  petition_title: string;
  status: string;
  is_draft: boolean;
  category: string | null;
  authority: string | null;
  show_authority: boolean;
  show_goal: boolean;
  asks: string[];
  petition_body: Record<string, unknown>;
  hero_image_url: string | null;
  hero_image_mobile_url: string | null;
  attachments: CampaignAttachment[];
  show_qr: boolean;
  qr_code_data: string | null;
  lifecycle_stage: number;
  goal_count: number | null;
  signature_count: number;
  signer_type: string;
  form_config: FormConfig;
  share_text: string | null;
  meta: Record<string, unknown>;
  org: CampaignOrg;
}

export interface RecentSignature {
  name_display: string;
  provincia: string;
  time_ago: string;
  is_anon: boolean;
}

export interface PrivacyInfo {
  aviso_privacidad: string;
  version: number;
  base_legal: string;
  data_contact_email: string | null;
}

export async function getCampaignBySlug(
  slug: string
): Promise<PublicCampaign | null> {
  try {
    const res = await fetch(
      `${INTERNAL_API}/v1/public-campaign/by-slug/${slug}`,
      { cache: "no-store" }
    );
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export async function getCampaignById(
  id: string
): Promise<PublicCampaign | null> {
  try {
    const res = await fetch(`${INTERNAL_API}/v1/public-campaign/${id}`, {
      cache: "no-store",
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export async function resolveDomain(host: string): Promise<string | null> {
  try {
    const res = await fetch(
      `${INTERNAL_API}/v1/domains/resolve-domain?host=${encodeURIComponent(host)}`,
      { next: { revalidate: 300 } }
    );
    if (!res.ok) return null;
    const data = await res.json();
    return data.campaign_id ?? null;
  } catch {
    return null;
  }
}

export async function getRecentSignatures(
  campaignId: string,
  limit = 10
): Promise<RecentSignature[]> {
  try {
    const res = await fetch(
      `${INTERNAL_API}/v1/public-campaign/${campaignId}/signatures/recent?limit=${limit}`,
      { next: { revalidate: 30 } }
    );
    if (!res.ok) return [];
    return res.json();
  } catch {
    return [];
  }
}
