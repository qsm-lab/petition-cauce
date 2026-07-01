import type { PublicCampaign } from "@/lib/campaign-api";

interface Props {
  campaign: PublicCampaign;
}

export default function Hero({ campaign }: Props) {
  return (
    <div
      className="relative overflow-hidden"
      style={{ height: "196px" }}
      aria-hidden="true"
    >
      {campaign.hero_image_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={campaign.hero_image_url}
          alt=""
          className="w-full h-full object-cover"
        />
      ) : (
        <div
          className="w-full h-full"
          style={{
            background:
              "repeating-linear-gradient(135deg, color-mix(in srgb,var(--bp) 16%,var(--bbg)) 0px, color-mix(in srgb,var(--bp) 16%,var(--bbg)) 1px, var(--bbg) 1px, var(--bbg) 28px)",
          }}
        />
      )}

      {/* Overlay */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(180deg, transparent 38%, rgba(21,36,27,0.78))",
        }}
      />

      {/* Category badge — top right */}
      {campaign.category && (
        <span
          className="absolute top-3 right-3 text-[11.5px] font-bold px-3 py-1 rounded-full"
          style={{ background: "var(--bp)", color: "var(--bop)" }}
        >
          {campaign.category}
        </span>
      )}

      {/* Org avatar — bottom left */}
      <div
        className="absolute bottom-3 left-3 flex items-center justify-center text-[16px] font-black"
        style={{
          width: 38,
          height: 38,
          borderRadius: 11,
          background: "var(--bsurf)",
          color: "var(--bp)",
          fontFamily: "var(--fd)",
        }}
      >
        {campaign.org.initial}
      </div>
    </div>
  );
}
