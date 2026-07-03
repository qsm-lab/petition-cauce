import type { PublicCampaign } from "@/lib/campaign-api";

interface Props {
  campaign: PublicCampaign;
}

export default function Hero({ campaign }: Props) {
  const desktopSrc = campaign.hero_image_url;
  const mobileSrc = campaign.hero_image_mobile_url ?? campaign.hero_image_url;

  return (
    <div
      className="relative overflow-hidden rounded-[14px]"
      style={{ height: "196px" }}
      aria-hidden="true"
    >
      {desktopSrc ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={mobileSrc ?? desktopSrc} alt="" className="w-full h-full object-cover md:hidden" />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={desktopSrc} alt="" className="hidden md:block w-full h-full object-cover" />
        </>
      ) : (
        <div
          className="w-full h-full"
          style={{
            background:
              "repeating-linear-gradient(135deg, color-mix(in srgb,var(--bp) 16%,var(--bbg)) 0px, color-mix(in srgb,var(--bp) 16%,var(--bbg)) 1px, var(--bbg) 1px, var(--bbg) 28px)",
          }}
        />
      )}

      <div
        className="absolute inset-0"
        style={{ background: "linear-gradient(180deg, transparent 38%, rgba(21,36,27,0.78))" }}
      />

      {campaign.category && (
        <span
          className="absolute top-3 right-3 text-[11.5px] font-bold px-3 py-1 rounded-full"
          style={{ background: "var(--bp)", color: "var(--bop)" }}
        >
          {campaign.category}
        </span>
      )}

      <div
        className="absolute bottom-3 left-3 flex items-center justify-center overflow-hidden"
        style={{
          width: 38, height: 38, borderRadius: 11,
          background: "var(--bsurf)",
          border: "2px solid rgba(255,255,255,0.2)",
        }}
      >
        {campaign.org.logo_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={campaign.org.logo_url} alt={campaign.org.name} className="w-full h-full object-cover" />
        ) : (
          <span className="font-display font-black text-[16px]" style={{ color: "var(--bp)", fontFamily: "var(--fd)" }}>
            {campaign.org.initial}
          </span>
        )}
      </div>
    </div>
  );
}
