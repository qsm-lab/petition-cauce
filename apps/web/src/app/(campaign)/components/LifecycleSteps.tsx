const STAGES = ["Lanzada", "Recolección", "Entrega", "Diálogo", "Decisión"];

interface Props {
  currentStage: number;
}

export default function LifecycleSteps({ currentStage }: Props) {
  const progressPct = (currentStage / 4) * 84;

  return (
    <div
      className="rounded-petition p-4"
      style={{ background: "var(--bsurf)", border: "1px solid var(--bbord)" }}
    >
      <div className="relative flex justify-between">
        {/* Track line */}
        <div
          className="absolute top-[13px] left-[8%] right-[8%] h-[3px] rounded-full"
          style={{ background: "var(--bbord)" }}
        />
        {/* Progress fill */}
        <div
          className="absolute top-[13px] left-[8%] h-[3px] rounded-full transition-all duration-700"
          style={{ background: "var(--bp)", width: `${progressPct}%` }}
        />

        {STAGES.map((label, i) => {
          const done = i < currentStage;
          const current = i === currentStage;
          return (
            <div key={label} className="relative flex flex-col items-center" style={{ flex: 1 }}>
              <div
                className="flex items-center justify-center w-7 h-7 rounded-full text-[11px] font-bold z-10"
                style={
                  done || current
                    ? {
                        background: "var(--bp)",
                        color: "var(--bop)",
                        boxShadow: current
                          ? "0 0 0 4px color-mix(in srgb,var(--bp) 22%,transparent)"
                          : undefined,
                      }
                    : {
                        background: "var(--bsurf)",
                        color: "var(--bmut)",
                        border: "2px solid var(--bbord)",
                      }
                }
              >
                {done ? "✓" : i + 1}
              </div>
              <span
                className="mt-[7px] text-center leading-tight"
                style={{
                  fontSize: 10,
                  color: done || current ? "var(--bink)" : "var(--bmut)",
                  fontWeight: current ? 800 : done ? 600 : 400,
                }}
              >
                {label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
