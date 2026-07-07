import { headers } from "next/headers";
import {
  getCampaignBySlug,
  getCampaignById,
  resolveDomain,
} from "@/lib/campaign-api";

const DEV_SLUG = process.env.DEV_CAMPAIGN_SLUG ?? "campana-dev-001";
const INTERNAL_API =
  process.env.API_INTERNAL_URL ?? "http://petition-api-dev:8000";

async function getPrivacy(campaignId: string) {
  try {
    const res = await fetch(
      `${INTERNAL_API}/v1/public-campaign/${campaignId}/privacy`,
      { cache: "no-store" }
    );
    if (!res.ok) return null;
    return res.json() as Promise<{
      aviso_privacidad: string;
      version: number;
      base_legal: string;
      data_contact_email: string | null;
    }>;
  } catch {
    return null;
  }
}

export default async function AvisoPrivacidad({
  searchParams,
}: {
  searchParams: { slug?: string };
}) {
  const headersList = headers();
  const host = headersList.get("x-original-host") || headersList.get("host") || "";
  const isLocal =
    host.includes("localhost") || host.includes("127.0.0.1") || !host.includes(".");

  let campaign;
  if (isLocal) {
    campaign = await getCampaignBySlug(searchParams.slug ?? DEV_SLUG);
  } else {
    const id = await resolveDomain(host);
    campaign = id ? await getCampaignById(id) : null;
  }

  const privacy = campaign ? await getPrivacy(campaign.id) : null;

  return (
    <div
      className="min-h-screen py-12 px-4"
      style={{ background: "var(--bbg)" }}
    >
      <div
        className="max-w-2xl mx-auto rounded-petition p-8"
        style={{
          background: "var(--bsurf)",
          border: "1px solid var(--bbord)",
        }}
      >
        {privacy ? (
          <pre
            className="whitespace-pre-wrap text-[13px] leading-relaxed font-body"
            style={{ color: "var(--bink)", fontFamily: "var(--fb)", overflowWrap: "break-word", wordBreak: "break-word", overflowX: "hidden" }}
          >
            {privacy.aviso_privacidad}
          </pre>
        ) : (
          <p style={{ color: "var(--bmut)" }}>
            Aviso de privacidad no disponible para esta campaña.
          </p>
        )}
      </div>
    </div>
  );
}
