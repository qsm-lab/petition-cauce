import type { CampaignOrg } from "@/lib/campaign-api";

interface Props {
  org: CampaignOrg;
}

export default function OrgCard({ org }: Props) {
  return (
    <div
      className="rounded-petition p-5 flex items-center gap-4"
      style={{ background: "var(--bsurf)", border: "1px solid var(--bbord)" }}
    >
      {/* Avatar */}
      <div
        className="shrink-0 flex items-center justify-center font-black text-[20px]"
        style={{
          width: 52,
          height: 52,
          borderRadius: 15,
          background: "color-mix(in srgb,var(--bp) 14%,transparent)",
          color: "var(--bp)",
          fontFamily: "var(--fd)",
        }}
      >
        {org.initial}
      </div>

      <div className="flex-1 min-w-0">
        <p
          className="uppercase font-bold mb-0.5"
          style={{ fontSize: 11, color: "var(--bmut)", letterSpacing: "0.04em" }}
        >
          Organización
        </p>
        <p
          className="font-display font-bold truncate"
          style={{ fontSize: 15, color: "var(--bink)", fontFamily: "var(--fd)" }}
        >
          {org.name}
        </p>
      </div>

      <button
        disabled
        className="shrink-0 rounded-full font-semibold text-[12px] cursor-default opacity-60"
        style={{
          minHeight: 40,
          padding: "0 16px",
          border: "1.5px solid var(--bbord)",
          color: "var(--bp)",
        }}
        title="Próximamente"
      >
        Ver perfil
      </button>
    </div>
  );
}
