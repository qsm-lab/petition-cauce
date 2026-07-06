interface Props {
  regions: { name: string; pct: number }[];
  categoryColor: string;
}

export default function RegionBars({ regions, categoryColor }: Props) {
  if (!regions || regions.length === 0) return null;

  const FONT_DISPLAY = "var(--font-anton, 'Anton', sans-serif)";

  return (
    <div>
      <h2
        style={{
          fontFamily: FONT_DISPLAY,
          fontWeight: 400,
          fontSize: 24,
          margin: "0 0 16px",
          color: "#16261F",
        }}
      >
        De dónde vienen las firmas
      </h2>

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {regions.map((r) => (
          <div key={r.name}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                fontSize: 14,
                fontWeight: 600,
                marginBottom: 6,
                color: "#16261F",
              }}
            >
              <span>{r.name}</span>
              <span>{r.pct}%</span>
            </div>
            <div style={{ height: 8, borderRadius: 5, background: "rgba(22,38,31,0.1)" }}>
              <div
                style={{
                  height: "100%",
                  borderRadius: 5,
                  background: categoryColor,
                  width: `${r.pct}%`,
                }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
