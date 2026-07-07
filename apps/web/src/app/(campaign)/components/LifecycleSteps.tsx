const STAGES = ["Lanzada", "Recolección", "Entrega", "Diálogo", "Decisión"];

export interface LifecycleConfig {
  dialogo?: boolean;
  decision?: boolean;
}

interface Props {
  currentStage: number;
  categoryColor: string;
  lifecycleConfig?: LifecycleConfig;
}

/** Índices de etapas visibles según la configuración de la campaña (3=Diálogo, 4=Decisión opcionales). */
export function visibleStageIndices(config?: LifecycleConfig): number[] {
  const indices = [0, 1, 2];
  if (config?.dialogo !== false) indices.push(3);
  if (config?.decision !== false) indices.push(4);
  return indices;
}

export default function LifecycleSteps({ currentStage, categoryColor, lifecycleConfig }: Props) {
  const visible = visibleStageIndices(lifecycleConfig);

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

      {/* Con etapas deshabilitadas el riel se acorta y se centra en su bloque */}
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          maxWidth: visible.length < 5 ? visible.length * 150 : undefined,
          marginLeft: "auto",
          marginRight: "auto",
        }}
      >
        {visible.map((stageIndex, pos) => {
          const label   = STAGES[stageIndex];
          const done    = stageIndex < currentStage;
          const current = stageIndex === currentStage;
          const isLast  = pos === visible.length - 1;

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
                  {done ? "✓" : pos + 1}
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
