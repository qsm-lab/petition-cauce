import type { CampaignOrg } from "@/lib/campaign-api";

interface Props {
  org: CampaignOrg;
}

export default function OrgCard({ org }: Props) {
  return (
    <div
      style={{
        background: "#fff",
        border: "1.5px solid #16261F",
        borderRadius: 18,
        padding: 20,
        display: "flex",
        alignItems: "center",
        gap: 14,
      }}
    >
      <div
        style={{
          width: 46,
          height: 46,
          borderRadius: "50%",
          background: "#16261F",
          color: "#FBF0E6",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "var(--font-anton, 'Anton', sans-serif)",
          fontSize: 18,
          flexShrink: 0,
          overflow: "hidden",
        }}
      >
        {org.logo_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={org.logo_url} alt={org.name} className="w-full h-full object-cover" />
        ) : (
          org.initial
        )}
      </div>

      <div>
        <div style={{ fontSize: 12, color: "rgba(22,38,31,0.5)" }}>Organización</div>
        <div style={{ fontSize: 16, fontWeight: 700, color: "#16261F" }}>{org.name}</div>
      </div>
    </div>
  );
}
