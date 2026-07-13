import { apiServer } from "@/lib/api-server";

export interface AdminSignatureItem {
  id: string;
  name: string | null;
  org_name: string | null;
  signer_type: "natural" | "org";
  provincia: string | null;
  country: string | null;
  visibility: "publica" | "anonima" | "secreta";
  pending_visibility: "publica" | "anonima" | "secreta" | null;
  status: "confirmed" | "pending_confirmation" | "anulada";
  confirmed_at: string | null;
  created_at: string;
}

export interface AdminSignaturesResponse {
  campaign_title: string;
  campaign_slug: string;
  items: AdminSignatureItem[];
  total: number;
  confirmed_count: number;
  pending_count: number;
  anulada_count: number;
  page: number;
  per_page: number;
  pages: number;
}

export interface SignaturesFilterParams {
  page?: number;
  provincia?: string;
  visibility?: string;
  status?: string;
}

export async function getAdminSignatures(
  campaignId: string,
  params: SignaturesFilterParams = {},
): Promise<AdminSignaturesResponse | null> {
  const qs = new URLSearchParams();
  if (params.page && params.page > 1) qs.set("page", String(params.page));
  if (params.provincia) qs.set("provincia", params.provincia);
  if (params.visibility) qs.set("visibility", params.visibility);
  if (params.status) qs.set("status", params.status);
  const query = qs.toString();
  return apiServer<AdminSignaturesResponse>(
    `/v1/admin/campaigns/${campaignId}/signatures${query ? `?${query}` : ""}`,
  );
}
