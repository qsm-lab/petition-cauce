export type QuestionType =
  | "text"
  | "long_text"
  | "single_choice"
  | "multiple_choice"
  | "likert_scale"
  | "nps"
  | "matrix"
  | "date"
  | "email"
  | "number";

export interface QuestionOption {
  id: string;
  label: string;
  value: string;
  order_index: number;
  meta: Record<string, unknown>;
}

export interface Question {
  id: string;
  form_id: string;
  code: string;
  type: QuestionType;
  label: string;
  description?: string;
  is_required: boolean;
  is_pii: boolean;
  order_index: number;
  validation: Record<string, unknown>;
  conditional_logic?: Record<string, unknown> | null;
  options: QuestionOption[];
}

export interface Form {
  id: string;
  title: string;
  description?: string;
  status: string;
  slug?: string | null;
  campaign_id?: string | null;
  privacy_notice_text?: string;
  requires_explicit_consent: boolean;
  consent_text?: string;
  consent_version?: string;
  description_font_size?: number;
  cover_image_url?: string;
  og_description?: string;
  og_image_alt?: string;
  meta?: Record<string, unknown>;
  questions: Question[];
}

export interface SocialLinks {
  instagram?: string;
  facebook?: string;
  tiktok?: string;
  whatsapp?: string;
  newsletter?: string;
  website?: string;
  share_text?: string;
}

export interface Campaign {
  id: string;
  form_id?: string | null;
  title: string;
  slug: string;
  status: string;
  access_mode: string;
  starts_at?: string;
  ends_at?: string;
  max_responses?: number;
  source_platform?: string;
  social_links?: SocialLinks;
  share_text?: string;
  thank_you_title?: string;
  thank_you_body?: string;
  welcome_logo_url?: string;
  welcome_title?: string;
  welcome_title_size?: string;
  welcome_description?: string;
  welcome_slogan?: string;
  welcome_slogan_size?: string;
  welcome_title_color?: string;
  welcome_slogan_color?: string;
  quota_config?: Record<string, unknown>;
  description?: string;
  data_protection_level?: string;
  created_at?: string;
  updated_at?: string;
}

export interface AnswerInput {
  question_id: string;
  question_code: string;
  question_type: QuestionType;
  value_text?: string;
  value_number?: number;
  value_choice?: string;
  value_choices?: string[];
  value_matrix?: Record<string, number>;
  value_other_text?: string;
  time_on_question_seconds?: number;
}

export interface FormVersion {
  id: string;
  form_id: string;
  version_number: number;
  label: string;
  snapshot: Record<string, unknown>;
  created_at: string;
}

export interface User {
  id: string;
  email: string;
  full_name?: string;
  role: "admin" | "gestor" | "editor";
  org_id: string;
}

export interface CampaignSummaryItem {
  id: string;
  title: string;
  slug: string;
  status: string;
  total_responses: number;
  created_at: string;
}

export interface CampaignStats {
  total_opened: number;
  total_completed: number;
  total_abandoned: number;
  completion_rate: number;
  avg_time_seconds: number;
  responses_by_platform: Record<string, number>;
  responses_over_time: Array<{ date: string; count: number }>;
  abandonment_by_question: Array<{ question_index: number; count: number }>;
}
