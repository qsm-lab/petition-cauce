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
}
