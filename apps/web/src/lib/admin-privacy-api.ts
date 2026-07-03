export interface PrivacyPolicy {
  id: string;
  org_id: string;
  title: string;
  aviso_firmante: string;
  aviso_organizacion: string;
  version: number;
  base_legal: string;
  data_contact_email: string | null;
  archived_at: string | null;
  created_at: string;
}

export interface PrivacyPolicyCreate {
  title: string;
  aviso_firmante?: string;
  aviso_organizacion?: string;
  base_legal?: string;
  data_contact_email?: string;
}

export interface PrivacyPolicyUpdate {
  title?: string;
  aviso_firmante?: string;
  aviso_organizacion?: string;
  base_legal?: string;
  data_contact_email?: string;
}
