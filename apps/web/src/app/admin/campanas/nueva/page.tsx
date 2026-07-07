import CampanaEditorClient from "../[id]/CampanaEditorClient";
import { apiServer } from "@/lib/api-server";
import type { Category } from "@/lib/admin-categories-api";
import type { PrivacyPolicy } from "@/lib/admin-privacy-api";
import type { AdminOrg } from "@/lib/admin-orgs-api";

export default async function NuevaCampanaPage() {
  const [categories, policies, orgs] = await Promise.all([
    apiServer<Category[]>("/v1/admin/categories").then((r) => r ?? []),
    apiServer<PrivacyPolicy[]>("/v1/admin/privacy-policies").then((r) => r ?? []),
    apiServer<AdminOrg[]>("/v1/admin/organizaciones").then((r) => r ?? []),
  ]);

  return (
    <CampanaEditorClient
      categories={categories}
      policies={policies}
      orgs={orgs}
    />
  );
}
