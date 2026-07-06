const STAGES = ["Lanzada", "Recolección", "Entrega", "Diálogo", "Decisión"];

interface Props {
  currentStage: number;
  categoryColor: string;
}

export default function LifecycleSteps({ currentStage, categoryColor }: Props) {
  return (
    <div>
      <div
        style={{
          fontSize: 12,
          fontWeight: 700,
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          color: "rgba(22,38,31,0.5)",
          marginBottom: 14,
        }}
      >
        Estado de la campaña
      </div>

      <div style={{ display: "flex", alignItems: "flex-start" }}>
        {STAGES.map((label, i) => {
          const done    = i < currentStage;
          const current = i === currentStage;
          const isLast  = i === STAGES.length - 1;

          const dotBg     = done ? "#16261F" : current ? categoryColor : "#ffffff";
          const dotColor  = done || current ? "#FBF0E6" : "#16261F";
          const dotBorder = done || current ? "none" : "2px solid #16261F";

          return (
            <div
              key={label}
              style={{ display: "flex", alignItems: "center", flex: 1, minWidth: 0 }}
            >
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 8,
                  flexShrink: 0,
                }}
              >
                <div
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: "50%",
                    background: dotBg,
                    border: dotBorder,
                    color: dotColor,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 13,
                    fontWeight: 700,
                  }}
                >
                  {done ? "✓" : i + 1}
                </div>
                <div
                  style={{
                    fontSize: 12,
                    fontWeight: current ? 700 : 500,
                    opacity: current ? 1 : 0.55,
                    textAlign: "center",
                    whiteSpace: "nowrap",
                    color: "#16261F",
                  }}
                >
                  {label}
                </div>
              </div>

              {!isLast && (
                <div
                  style={{
                    height: 2,
                    flex: 1,
                    background: done ? "#16261F" : "rgba(22,38,31,0.2)",
                    margin: "0 6px",
                    marginBottom: 20,
                  }}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
