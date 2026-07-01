interface RegionStat {
  name: string;
  pct: number;
}

interface Props {
  regions: RegionStat[];
}

export default function RegionBars({ regions }: Props) {
  if (!regions || regions.length === 0) return null;

  return (
    <div
      className="rounded-petition p-5"
      style={{ background: "var(--bsurf)", border: "1px solid var(--bbord)" }}
    >
      <h3
        className="font-display font-bold mb-4"
        style={{ fontSize: 15, color: "var(--bink)", fontFamily: "var(--fd)" }}
      >
        Apoyo por provincia
      </h3>
      <div className="flex flex-col gap-3">
        {regions.slice(0, 7).map((r) => (
          <div key={r.name}>
            <div className="flex justify-between mb-1">
              <span style={{ fontSize: 12.5, color: "var(--bink)" }}>{r.name}</span>
              <span style={{ fontSize: 12, color: "var(--bmut)" }}>{r.pct}%</span>
            </div>
            <div
              className="rounded-full h-[7px]"
              style={{ background: "color-mix(in srgb,var(--bp) 12%,var(--bbg))" }}
            >
              <div
                className="h-full rounded-full"
                style={{ width: `${r.pct}%`, background: "var(--bp)" }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
