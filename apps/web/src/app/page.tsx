import { headers } from "next/headers";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

import {
  getCampaignBySlug,
  getCampaignById,
  resolveDomain,
  getRecentSignatures,
} from "@/lib/campaign-api";
import { campaignStyleTag, BOSQUE_LIGHT } from "@/lib/design-tokens";
import CampaignPage from "./(campaign)/CampaignPage";

const DEV_SLUG = process.env.DEV_CAMPAIGN_SLUG ?? "campana-dev-001";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3002";

function buildCampaignUrl(slug: string, host: string): string {
  if (host && !host.includes("localhost") && !host.includes("127.0.0.1")) {
    return `https://${host}`;
  }
  return `${APP_URL}/?slug=${slug}`;
}

export async function generateMetadata({
  searchParams,
}: {
  searchParams: { slug?: string };
}): Promise<Metadata> {
  const headersList = headers();
  const host = headersList.get("x-original-host") || headersList.get("host") || "";
  const isLocal =
    host.includes("localhost") || host.includes("127.0.0.1") || !host.includes(".");

  const campaign = isLocal
    ? await getCampaignBySlug(searchParams.slug ?? DEV_SLUG)
    : await (async () => {
        const id = await resolveDomain(host);
        return id ? getCampaignById(id) : null;
      })();

  if (!campaign) return { title: "Cauce Petition" };

  const meta = campaign.meta as Record<string, unknown>;
  const pageUrl = buildCampaignUrl(campaign.slug, host);
  const siteName = "Cauce Petition";

  const ogTitle = (campaign.petition_title || campaign.title);
  const welcomeDesc = meta?.welcome_description as string | undefined;
  const shareText = campaign.share_text ?? undefined;
  const ogDesc =
    welcomeDesc ||
    shareText ||
    (campaign.authority
      ? `Firma y apoya esta petición dirigida a ${campaign.authority}.`
      : "Campaña de activismo ambiental en Ecuador. Suma tu voz.");

  const heroImage = campaign.hero_image_url;
  const imageAlt = ogTitle;

  const fbAppId = process.env.NEXT_PUBLIC_FB_APP_ID ?? "";

  return {
    title: `${ogTitle} — ${siteName}`,
    description: ogDesc,
    metadataBase: new URL(APP_URL),
    openGraph: {
      type: "website",
      url: pageUrl,
      siteName,
      title: ogTitle,
      description: ogDesc,
      ...(heroImage
        ? { images: [{ url: heroImage, width: 1200, height: 630, alt: imageAlt }] }
        : {}),
    },
    twitter: {
      card: heroImage ? "summary_large_image" : "summary",
      title: ogTitle,
      description: ogDesc,
      ...(heroImage ? { images: [{ url: heroImage, alt: imageAlt }] } : {}),
    },
    ...(fbAppId ? { other: { "fb:app_id": fbAppId } } : {}),
  };
}

export default async function Home({
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
    const slug = searchParams.slug ?? DEV_SLUG;
    campaign = await getCampaignBySlug(slug);
  } else {
    const campaignId = await resolveDomain(host);
    campaign = campaignId ? await getCampaignById(campaignId) : null;
  }

  if (!campaign) return notFound();

  const [recentSignatures] = await Promise.all([
    getRecentSignatures(campaign.id, 10),
  ]);

  const campaignUrl = buildCampaignUrl(campaign.slug, host);

  // Inject per-campaign theme tokens (overrides globals.css defaults)
  const branding = (campaign.meta?.branding ?? {}) as Record<string, string>;
  const styleTag = campaignStyleTag(branding);

  return (
    <>
      {styleTag && (
        <style dangerouslySetInnerHTML={{ __html: styleTag }} />
      )}
      <CampaignPage
        campaign={campaign}
        recentSignatures={recentSignatures}
        campaignUrl={campaignUrl}
      />
    </>
  );
}
