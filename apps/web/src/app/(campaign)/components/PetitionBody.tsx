interface Props {
  asks: string[];
  petitionBody: Record<string, unknown>;
}

const IcoChecklist = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M22 7h-9v2h9V7zm0 8h-9v2h9v-2zM5.54 11L2 7.46l1.41-1.41 2.13 2.13 4.24-4.24 1.42 1.41zm0 8L2 15.46l1.41-1.41 2.13 2.13 4.24-4.24 1.42 1.41z"/>
  </svg>
);

const IcoArticle = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-5 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z"/>
  </svg>
);

function SectionHeading({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <span
        className="flex items-center justify-center"
        style={{
          width: 28, height: 28, borderRadius: 8,
          background: "color-mix(in srgb,var(--bp) 14%,transparent)",
          color: "var(--bp)",
          flexShrink: 0,
        }}
        aria-hidden="true"
      >
        {icon}
      </span>
      <h2
        className="font-display font-extrabold"
        style={{ fontSize: 18, color: "var(--bink)", fontFamily: "var(--fd)", letterSpacing: "-0.01em" }}
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
          <SectionHeading icon={<IcoChecklist />} label="Lo que pedimos" />
          <ul className="flex flex-col gap-[12px]">
            {asks.map((ask, i) => (
              <li key={i} className="flex gap-[12px] items-start">
                <span
                  className="shrink-0 flex items-center justify-center rounded-full font-bold mt-0.5"
                  style={{
                    width: 24, height: 24, minWidth: 24,
                    background: "color-mix(in srgb,var(--bp) 14%,transparent)",
                    color: "var(--bp)",
                    fontSize: 11,
                  }}
                >
                  {i + 1}
                </span>
                <span
                  className="font-semibold leading-snug"
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
      {(richHtml || paragraphs.length > 0) && (
        <div>
          <SectionHeading icon={<IcoArticle />} label="Por qué importa" />
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
