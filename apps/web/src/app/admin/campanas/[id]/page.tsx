import Link from "next/link";
import { getAdminCampaign } from "@/lib/admin-campaigns-api";
import CampanaEditorClient from "./CampanaEditorClient";
import { apiServer } from "@/lib/api-server";
import type { Category } from "@/lib/admin-categories-api";
import type { PrivacyPolicy } from "@/lib/admin-privacy-api";
import type { AdminOrg } from "@/lib/admin-orgs-api";

interface PageProps {
  params: { id: string };
}

export default async function CampanaDetailPage({ params }: PageProps) {
  const [campaign, categories, policies, orgs] = await Promise.all([
    getAdminCampaign(params.id),
    apiServer<Category[]>("/v1/admin/categories").then((r) => r ?? []),
    apiServer<PrivacyPolicy[]>("/v1/admin/privacy-policies").then((r) => r ?? []),
    apiServer<AdminOrg[]>("/v1/admin/organizaciones").then((r) => r ?? []),
  ]);

  if (!campaign) {
    return (
      <div className="p-6">
        <div
          className="rounded-[14px] p-10 text-center"
          style={{ backgroundColor: "var(--bsurf)", border: "1px solid var(--bbord)" }}
        >
          <p className="font-semibold text-[15px] mb-1" style={{ color: "var(--bink)" }}>
            Campaña no encontrada
          </p>
          <p className="text-[13px] mb-4" style={{ color: "var(--bmut)" }}>
            Puede que no exista o no tengas acceso.
          </p>
          <Link
            href="/admin/campanas"
            className="text-[13px] font-semibold"
            style={{ color: "var(--bp)" }}
          >
            ← Volver a campañas
          </Link>
        </div>
      </div>
    );
  }

  return <CampanaEditorClient campaign={campaign} categories={categories} policies={policies} orgs={orgs} />;
}
