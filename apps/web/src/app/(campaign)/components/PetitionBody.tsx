interface Props {
  asks: string[];
  petitionBody: Record<string, unknown>;
}

export default function PetitionBody({ asks, petitionBody }: Props) {
  const paragraphs: string[] = Array.isArray(petitionBody?.paragraphs)
    ? (petitionBody.paragraphs as string[])
    : typeof petitionBody?.texto === "string"
    ? [petitionBody.texto as string]
    : [];

  return (
    <div
      className="rounded-petition p-5 flex flex-col gap-5"
      style={{ background: "var(--bsurf)", border: "1px solid var(--bbord)" }}
    >
      {/* Lo que pedimos */}
      {asks.length > 0 && (
        <div>
          <h2
            className="font-display font-bold mb-3"
            style={{ fontSize: 18, color: "var(--bink)", fontFamily: "var(--fd)" }}
          >
            Lo que pedimos
          </h2>
          <ul className="flex flex-col gap-[11px]">
            {asks.map((ask, i) => (
              <li key={i} className="flex gap-[11px]">
                <span
                  className="shrink-0 flex items-center justify-center rounded-full text-[12px]"
                  style={{
                    width: 22,
                    height: 22,
                    background: "color-mix(in srgb,var(--bp) 14%,transparent)",
                    color: "var(--bp)",
                  }}
                >
                  ✓
                </span>
                <span
                  className="leading-relaxed"
                  style={{ fontSize: 14.5, color: "var(--bink)" }}
                >
                  {ask}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Por qué importa */}
      {paragraphs.length > 0 && (
        <div>
          <h2
            className="font-display font-bold mb-3"
            style={{ fontSize: 18, color: "var(--bink)", fontFamily: "var(--fd)" }}
          >
            Por qué importa
          </h2>
          <div className="flex flex-col gap-3">
            {paragraphs.map((p, i) => (
              <p
                key={i}
                style={{
                  fontSize: 14.5,
                  lineHeight: 1.68,
                  color: "color-mix(in srgb,var(--bink) 86%,var(--bbg))",
                  maxWidth: "68ch",
                }}
              >
                {p}
              </p>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
