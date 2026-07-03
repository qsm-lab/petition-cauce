interface Props {
  asks: string[];
  petitionBody: Record<string, unknown>;
}

function SectionHeading({ icon, label }: { icon: string; label: string }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <span
        className="flex items-center justify-center text-[13px]"
        style={{
          width: 26, height: 26, borderRadius: 8,
          background: "color-mix(in srgb,var(--bp) 14%,transparent)",
          color: "var(--bp)",
        }}
        aria-hidden="true"
      >
        {icon}
      </span>
      <h2
        className="font-display font-bold"
        style={{ fontSize: 17, color: "var(--bink)", fontFamily: "var(--fd)" }}
      >
        {label}
      </h2>
    </div>
  );
}

export default function PetitionBody({ asks, petitionBody }: Props) {
  const richHtml = typeof petitionBody?.html === "string" ? petitionBody.html : null;
  const paragraphs: string[] = Array.isArray(petitionBody?.paragraphs)
    ? (petitionBody.paragraphs as string[])
    : typeof petitionBody?.texto === "string"
    ? [petitionBody.texto as string]
    : [];

  return (
    <div
      className="rounded-petition p-5 flex flex-col gap-6"
      style={{ background: "var(--bsurf)", border: "1px solid var(--bbord)" }}
    >
      {/* Lo que pedimos */}
      {asks.length > 0 && (
        <div>
          <SectionHeading icon="✓" label="Lo que pedimos" />
          <ul className="flex flex-col gap-[10px]">
            {asks.map((ask, i) => (
              <li key={i} className="flex gap-[11px] items-start">
                <span
                  className="shrink-0 flex items-center justify-center rounded-full text-[11px] font-bold mt-0.5"
                  style={{
                    width: 22, height: 22,
                    background: "color-mix(in srgb,var(--bp) 14%,transparent)",
                    color: "var(--bp)",
                  }}
                >
                  ✓
                </span>
                <span
                  className="font-bold leading-snug"
                  style={{ fontSize: 15, color: "var(--bink)" }}
                >
                  {ask}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Por qué importa */}
      {(richHtml || paragraphs.length > 0) && (
        <div>
          <SectionHeading icon="📄" label="Por qué importa" />
          {richHtml ? (
            <div
              className="petition-body-html"
              style={{
                fontSize: 14.5, lineHeight: 1.68,
                color: "color-mix(in srgb,var(--bink) 86%,var(--bbg))",
                maxWidth: "68ch",
              }}
              dangerouslySetInnerHTML={{ __html: richHtml }}
            />
          ) : (
            <div className="flex flex-col gap-3">
              {paragraphs.map((p, i) => (
                <p key={i} style={{ fontSize: 14.5, lineHeight: 1.68, color: "color-mix(in srgb,var(--bink) 86%,var(--bbg))", maxWidth: "68ch" }}>
                  {p}
                </p>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
