interface Props {
  asks: string[];
  petitionBody: Record<string, unknown>;
  categoryColor: string;
}

export default function PetitionBody({ asks, petitionBody, categoryColor }: Props) {
  const richHtml = typeof petitionBody?.html === "string" ? petitionBody.html : null;
  const paragraphs: string[] = Array.isArray(petitionBody?.paragraphs)
    ? (petitionBody.paragraphs as string[])
    : typeof petitionBody?.texto === "string"
    ? [petitionBody.texto as string]
    : [];

  const FONT_DISPLAY = "var(--font-anton, 'Anton', sans-serif)";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 36 }}>
      {asks.length > 0 && (
        <div>
          <h2
            style={{
              fontFamily: FONT_DISPLAY,
              fontWeight: 400,
              fontSize: 26,
              margin: "0 0 16px",
              color: "#16261F",
            }}
          >
            Lo que pedimos
          </h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {asks.map((ask, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  gap: 12,
                  alignItems: "flex-start",
                  background: "#fff",
                  border: "1.5px solid #16261F",
                  borderRadius: 14,
                  padding: "16px 18px",
                }}
              >
                <div
                  style={{
                    width: 26,
                    height: 26,
                    borderRadius: "50%",
                    background: categoryColor,
                    color: "#fff",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 11,
                    fontWeight: 700,
                    flexShrink: 0,
                  }}
                >
                  {String.fromCharCode(65 + i)}
                </div>
                <div style={{ fontSize: 16, lineHeight: 1.5, paddingTop: 2, color: "#16261F" }}>
                  {ask}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {(richHtml || paragraphs.length > 0) && (
        <div
          style={{
            background: "#16261F",
            borderRadius: 20,
            padding: "28px 28px 32px",
          }}
        >
          <h2
            style={{
              fontFamily: FONT_DISPLAY,
              fontWeight: 400,
              fontSize: 26,
              margin: "0 0 18px",
              color: "#D7F24C",
            }}
          >
            Por qué importa
          </h2>
          {richHtml ? (
            <div
              className="petition-body-html petition-body-html--dark"
              style={{ fontSize: 17, lineHeight: 1.7, color: "rgba(237,244,241,0.88)" }}
              dangerouslySetInnerHTML={{ __html: richHtml }}
            />
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {paragraphs.map((p, i) => (
                <p key={i} style={{ fontSize: 17, lineHeight: 1.7, color: "rgba(237,244,241,0.88)", margin: 0 }}>
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
