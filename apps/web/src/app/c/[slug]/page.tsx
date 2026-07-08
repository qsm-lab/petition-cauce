import { headers } from "next/headers";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { getCampaignBySlug, getRecentSignatures } from "@/lib/campaign-api";
import { campaignMetadata } from "@/lib/campaign-og";
import { campaignStyleTag } from "@/lib/design-tokens";
import CampaignPage from "../../(campaign)/CampaignPage";
import ConfirmationBanner from "../../(campaign)/components/ConfirmationBanner";
import ConfirmedSharePopup from "../../(campaign)/components/ConfirmedSharePopup";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3002";

// Sin esto, un slug inexistente responde 200: notFound() se lanza antes de
// tocar una API dinámica (headers) y el status ya salió en el stream.
export const dynamic = "force-dynamic";

// Landing de campaña por path (patrón heredado de forms-qsm: /c/<slug>).
// El dominio compartido sirve N campañas sin filas en `domains`; las campañas
// con dominio propio siguen resolviéndose por Host en `/` (multidominio).
function buildCampaignUrl(slug: string, host: string): string {
  if (host && !host.includes("localhost") && !host.includes("127.0.0.1")) {
    return `https://${host}/c/${slug}`;
  }
  return `${APP_URL}/c/${slug}`;
}

export async function generateMetadata({
  params,
}: {
  params: { slug: string };
}): Promise<Metadata> {
  const headersList = headers();
  const host = headersList.get("x-original-host") || headersList.get("host") || "";

  const campaign = await getCampaignBySlug(params.slug);
  if (!campaign) return { title: "Cauce Petition" };

  return campaignMetadata(campaign, buildCampaignUrl(campaign.slug, host));
}

export default async function CampaignBySlugPage({
  params,
  searchParams,
}: {
  params: { slug: string };
  searchParams: { confirmada?: string; nombre?: string };
}) {
  const headersList = headers();
  const host = headersList.get("x-original-host") || headersList.get("host") || "";

  const campaign = await getCampaignBySlug(params.slug);
  if (!campaign) return notFound();

  const recentSignatures = await getRecentSignatures(campaign.id, 10);

  const campaignUrl = buildCampaignUrl(campaign.slug, host);

  // Inject per-campaign theme tokens (overrides globals.css defaults)
  const branding = (campaign.meta?.branding ?? {}) as Record<string, string>;
  const styleTag = campaignStyleTag(branding);

  return (
    <>
      {styleTag && <style dangerouslySetInnerHTML={{ __html: styleTag }} />}
      {/* Firma recién confirmada → popup de compartir; otros estados → banner */}
      {searchParams.confirmada === "1" ? (
        <ConfirmedSharePopup
          name={searchParams.nombre}
          title={campaign.petition_title}
          url={campaignUrl}
          status={campaign.status}
          showQr={campaign.show_qr}
          qrCodeData={campaign.qr_code_data}
          shareText={campaign.share_text}
        />
      ) : searchParams.confirmada ? (
        <ConfirmationBanner estado={searchParams.confirmada} />
      ) : null}
      <CampaignPage
        campaign={campaign}
        recentSignatures={recentSignatures}
        campaignUrl={campaignUrl}
      />
    </>
  );
}
