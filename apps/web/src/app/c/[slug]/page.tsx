import { notFound } from "next/navigation";
import type { Metadata } from "next";
import FormRenderer from "@/components/form-renderer/FormRenderer";

async function getCampaign(slug: string) {
  const apiUrl = process.env.API_INTERNAL_URL || process.env.NEXT_PUBLIC_API_URL;
  const res = await fetch(`${apiUrl}/v1/public/c/${slug}`, { cache: "no-store" });
  if (!res.ok) return null;
  return res.json();
}

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const data = await getCampaign(params.slug);
  if (!data) return {};

  const { campaign, form } = data;

  const title       = form?.title ?? campaign.welcome_title ?? campaign.title;
  const description = form?.og_description ?? campaign.welcome_slogan ?? campaign.description ?? undefined;
  const coverImage  = form?.cover_image_url ?? undefined;
  const imageAlt    = form?.og_image_alt ?? campaign.welcome_slogan ?? title;
  const pageUrl     = `https://forms.quitosinmineria.org/c/${campaign.slug}`;

  const ogImages = coverImage
    ? [{ url: coverImage, alt: imageAlt, width: 1200, height: 630 }]
    : [];

  return {
    title: `${title} — Quito Sin Minería`,
    description,
    openGraph: {
      type:        "website",
      url:         pageUrl,
      siteName:    "Quito Sin Minería",
      title,
      description,
      ...(ogImages.length ? { images: ogImages } : {}),
    },
    twitter: {
      card:        coverImage ? "summary_large_image" : "summary",
      title,
      description,
      ...(coverImage ? { images: [{ url: coverImage, alt: imageAlt }] } : {}),
    },
  };
}

export default async function PublicFormPage({ params }: { params: { slug: string } }) {
  const data = await getCampaign(params.slug);
  if (!data) notFound();

  return <FormRenderer campaign={data.campaign} form={data.form} />;
}
