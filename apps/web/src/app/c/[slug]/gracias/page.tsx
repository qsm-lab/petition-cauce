interface SocialLinks {
  instagram?: string;
  facebook?: string;
  tiktok?: string;
  whatsapp?: string;
  newsletter?: string;
  website?: string;
}

interface CampaignPublic {
  slug: string;
  thank_you_title: string | null;
  thank_you_body: string | null;
  social_links: SocialLinks;
  share_text: string | null;
}

async function getCampaignPublic(slug: string): Promise<CampaignPublic | null> {
  const apiUrl = process.env.API_INTERNAL_URL || process.env.NEXT_PUBLIC_API_URL;
  try {
    const res = await fetch(`${apiUrl}/v1/public/c/${slug}`, { cache: "no-store" });
    if (!res.ok) return null;
    const data = await res.json();
    return data.campaign ?? null;
  } catch {
    return null;
  }
}

const PROFILE_CONFIG: { key: keyof SocialLinks; label: string }[] = [
  { key: "instagram", label: "Instagram" },
  { key: "facebook", label: "Facebook" },
  { key: "tiktok", label: "TikTok" },
  { key: "whatsapp", label: "WhatsApp" },
  { key: "newsletter", label: "Newsletter" },
  { key: "website", label: "Sitio web" },
];

export default async function GraciasPage({ params }: { params: { slug: string } }) {
  const campaign = await getCampaignPublic(params.slug);

  const title = campaign?.thank_you_title ?? "¡Gracias por tu respuesta!";
  const body = campaign?.thank_you_body ?? "Tu participación es muy importante para la comunidad.";
  const socialLinks = campaign?.social_links ?? {};
  const shareText = campaign?.share_text;

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://forms.quitosinmineria.org";
  const campaignUrl = `${appUrl}/c/${params.slug}`;

  const whatsappShareUrl = shareText
    ? `https://wa.me/?text=${encodeURIComponent(`${shareText} ${campaignUrl}`)}`
    : null;

  const profileLinks = PROFILE_CONFIG.filter(({ key }) => key !== "whatsapp" && socialLinks[key]);
  const whatsappProfileLink = !shareText && socialLinks.whatsapp ? socialLinks.whatsapp : null;

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center max-w-md px-4">
        <div className="text-5xl mb-4">✓</div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">{title}</h1>
        <p className="text-gray-500">{body}</p>

        {/* Botón principal de compartir por WhatsApp */}
        {whatsappShareUrl && (
          <div className="mt-6">
            <a
              href={whatsappShareUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-white bg-green-500 rounded-full hover:bg-green-600 transition-colors"
            >
              Compartir por WhatsApp
            </a>
          </div>
        )}

        {/* Links de redes sociales (perfil / grupos) */}
        {(profileLinks.length > 0 || whatsappProfileLink) && (
          <div className="mt-4 flex flex-wrap justify-center gap-3">
            {profileLinks.map(({ key, label }) => (
              <a
                key={key}
                href={socialLinks[key]}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-full hover:bg-gray-100 transition-colors"
              >
                {label}
              </a>
            ))}
            {whatsappProfileLink && (
              <a
                href={whatsappProfileLink}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-full hover:bg-gray-100 transition-colors"
              >
                WhatsApp
              </a>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
