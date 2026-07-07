import type { Metadata } from "next";

import type { PublicCampaign } from "@/lib/campaign-api";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3002";
const SITE_NAME = "Cauce Petition";

/** Metadata OG/Twitter de una campaña. Compartido por `/` (dominio propio) y `/c/[slug]`. */
export function campaignMetadata(
  campaign: PublicCampaign,
  pageUrl: string
): Metadata {
  const meta = campaign.meta as Record<string, unknown>;

  const ogTitle = campaign.petition_title || campaign.title;
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
    title: `${ogTitle} — ${SITE_NAME}`,
    description: ogDesc,
    metadataBase: new URL(APP_URL),
    openGraph: {
      type: "website",
      url: pageUrl,
      siteName: SITE_NAME,
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
