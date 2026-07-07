import type { PublicCampaign } from "@/lib/campaign-api";

interface Props {
  campaign: PublicCampaign;
  categoryColor: string;
}

export default function Hero({ campaign, categoryColor }: Props) {
  const desktopSrc = campaign.hero_image_url;
  const mobileSrc  = campaign.hero_image_mobile_url ?? campaign.hero_image_url;

  return (
    <div
      style={{
        position: "relative",
        borderRadius: 20,
        overflow: "hidden",
        height: "clamp(260px, 42vw, 420px)",
      }}
    >
      {desktopSrc ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={mobileSrc ?? desktopSrc} alt="" className="block md:hidden w-full h-full object-cover" />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={desktopSrc} alt="" className="hidden md:block w-full h-full object-cover" />
        </>
      ) : (
        <div
          className="w-full h-full"
          style={{
            background:
              "repeating-linear-gradient(135deg,#cfd9d4,#cfd9d4 14px,#bfcac4 14px,#bfcac4 28px)",
          }}
        />
      )}

      {/* Gradient overlay */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: "linear-gradient(to top, rgba(22,38,31,.88), rgba(22,38,31,0) 58%)",
        }}
      />

      {/* Category badge — top left */}
      {campaign.category && (
        <span
          style={{
            position: "absolute",
            top: 18,
            left: 18,
            background: "#fff",
            borderRadius: 20,
            padding: "8px 16px",
            fontSize: 13,
            fontWeight: 700,
            color: "#16261F",
          }}
        >
          {campaign.category}
        </span>
      )}

      {/* Org avatar — top right */}
      <div
        style={{
          position: "absolute",
          top: 18,
          right: 18,
          width: 44,
          height: 44,
          borderRadius: "50%",
          background: "#16261F",
          color: "#FBF0E6",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          overflow: "hidden",
        }}
      >
        {campaign.org.logo_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={campaign.org.logo_url} alt={campaign.org.name} className="w-full h-full object-cover" />
        ) : (
          <span style={{ fontFamily: "var(--font-anton, 'Anton', sans-serif)", fontSize: 18 }}>
            {campaign.org.initial}
          </span>
        )}
      </div>
    </div>
  );
}
