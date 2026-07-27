export interface AdminOrg {
  id: string;
  name: string;
  slug: string;
  domain: string | null;
  description: string | null;
  logo_url: string | null;
  contact_email: string | null;
  domains: string[];
  rep_name: string | null;
  status: "verificada" | "pendiente" | "archivada";
  archived_at: string | null;
  created_at: string;
  active_campaigns: number;
}

export interface OrgCreate {
  name: string;
  slug: string;
  domain?: string;
  description?: string;
  contact_email?: string;
  domains?: string[];
  rep_name?: string;
  status?: string;
}

export interface OrgUpdate {
  name?: string;
  slug?: string;
  domain?: string;
  description?: string;
  contact_email?: string;
  domains?: string[];
  rep_name?: string;
  status?: string;
  logo_url?: string | null;
}

// config-email-org
export interface OrgEmailConfig {
  org_id: string;
  provider: string;
  plan: string | null;
  daily_quota: number | null;
  monthly_quota: number | null;
  default_from: string | null;
  default_reply_to: string | null;
  default_display_name: string | null;
  allowed_domains: string[];
  status: "active" | "disabled";
  has_credentials: boolean;
  verified_at: string | null;
  daily_used: number;
  monthly_used: number;
  provider_snapshot: { daily_quota_used: number | null; monthly_quota_used: number | null; updated_at: string } | null;
}

export interface OrgEmailConfigUpdate {
  provider: string;
  api_key?: string;
  plan?: string;
  daily_quota?: number;
  monthly_quota?: number;
  default_from?: string;
  default_reply_to?: string;
  default_display_name?: string;
  allowed_domains?: string[];
  status?: string;
}
