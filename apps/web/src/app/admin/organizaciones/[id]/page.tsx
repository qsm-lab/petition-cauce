import { redirect } from "next/navigation";
import { apiServer } from "@/lib/api-server";
import type { User } from "@/lib/types";
import type { AdminOrg } from "@/lib/admin-orgs-api";
import OrgDetailClient from "./OrgDetailClient";
import Link from "next/link";

interface CampaignSummary {
  id: string;
  title: string;
  status: string;
  slug: string;
}

export default async function OrgDetailPage({ params }: { params: { id: string } }) {
  const user = await apiServer<User>("/v1/auth/me");
  if (!user || user.role !== "admin") redirect("/admin/campanas");

  const org = await apiServer<AdminOrg>(`/v1/admin/organizaciones/${params.id}`);
  if (!org) redirect("/admin/organizaciones");

  const campaigns = await apiServer<CampaignSummary[]>(
    `/v1/admin/organizaciones/${params.id}/campaigns`
  ) ?? [];

  return (
    <div>
      <header
        className="sticky top-0 z-10 px-6 py-4 flex items-center gap-3"
        style={{ backgroundColor: "var(--bsurf)", borderBottom: "1px solid var(--bbord)" }}
      >
        <Link
          href="/admin/organizaciones"
          className="flex items-center gap-1.5 text-[12.5px] font-medium"
          style={{ color: "var(--bmut)" }}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
            <path d="M8.5 2.5 4 7l4.5 4.5" />
          </svg>
          Organizaciones
        </Link>
        <span style={{ color: "var(--bbord)" }}>/</span>
        <div>
          <h1 className="font-display font-bold text-[18px]" style={{ color: "var(--bink)" }}>
            {org.name}
          </h1>
          <p className="text-[12px] mt-0.5" style={{ color: "var(--bmut)" }}>{org.slug}</p>
        </div>
      </header>

      <div className="p-6 animate-pc-rise">
        <OrgDetailClient initialOrg={org} initialCampaigns={campaigns} />
      </div>
    </div>
  );
}
