interface Props {
  name: string;
  count: number;
  goal: number | null;
  campaignUrl: string;
  campaignTitle: string;
  categoryColor: string;
  onSubscribe: (val: boolean) => void;
}

export default function StepThanks({
  name,
  count,
  goal,
  campaignUrl,
  campaignTitle,
  categoryColor,
  onSubscribe,
}: Props) {
  const firstName = name.split(" ")[0] || name;
  const text      = encodeURIComponent(`Firmé: ${campaignTitle} — únete: ${campaignUrl}`);
  const encoded   = encodeURIComponent(campaignUrl);
  const goalPct   = goal && goal > 0 ? Math.min(100, Math.round((count / goal) * 100)) : 0;

  const FONT_DISPLAY = "var(--font-anton, 'Anton', sans-serif)";
  const FONT_BODY    = "var(--font-work-sans, 'Work Sans', sans-serif)";

  const secondaryBtn: React.CSSProperties = {
    flex: 1,
    fontSize: 14,
    fontWeight: 600,
    color: "#16261F",
    background: "#fff",
    border: "1.5px solid #16261F",
    borderRadius: 24,
    padding: 12,
    cursor: "pointer",
    textDecoration: "none",
    textAlign: "center",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontFamily: FONT_BODY,
  };

  return (
    <div
      style={{ textAlign: "center", padding: "10px 0 0" }}
      aria-live="polite"
    >
      {/* Check icon */}
      <div
        style={{
          width: 56,
          height: 56,
          borderRadius: "50%",
          background: categoryColor,
          color: "#fff",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 26,
          margin: "0 auto 18px",
        }}
        aria-hidden="true"
      >
        ✓
      </div>

      <div style={{ fontFamily: FONT_DISPLAY, fontSize: 30, marginBottom: 8, color: "#16261F" }}>
        ¡Gracias, {firstName}!
      </div>
      <div style={{ fontSize: 15, color: "rgba(22,38,31,0.7)", lineHeight: 1.5, marginBottom: 20 }}>
        Tu firma quedó registrada. Acabás de mover el contador.
      </div>

      {/* Counter box */}
      <div
        style={{
          background: "#FBF0E6",
          borderRadius: 14,
          padding: 20,
          marginBottom: 24,
        }}
      >
        <div style={{ fontFamily: FONT_DISPLAY, fontSize: 34, color: "#16261F" }}>
          {count.toLocaleString("es-EC")}
        </div>
        <div style={{ fontSize: 13, color: "rgba(22,38,31,0.6)", marginBottom: goal ? 10 : 0 }}>
          firmas{goal ? ` de ${goal.toLocaleString("es-EC")}` : ""}
        </div>
        {goal && (
          <div style={{ height: 8, borderRadius: 5, background: "rgba(22,38,31,0.12)" }}>
            <div
              style={{
                height: "100%",
                borderRadius: 5,
                background: categoryColor,
                width: `${goalPct}%`,
              }}
            />
          </div>
        )}
      </div>

      {/* Share section */}
      <div style={{ fontSize: 14, fontWeight: 700, textAlign: "left", marginBottom: 10, color: "#16261F" }}>
        Ayudá a que llegue a más personas
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 18 }}>
        {/* WhatsApp */}
        <a
          href={`https://wa.me/?text=${text}`}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            width: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 10,
            fontSize: 15,
            fontWeight: 700,
            color: "#FBF0E6",
            background: "#12222E",
            border: "none",
            borderRadius: 24,
            padding: "14px 18px",
            textDecoration: "none",
            boxSizing: "border-box",
            fontFamily: FONT_BODY,
          }}
        >
          <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 18, height: 18, position: "relative", flexShrink: 0 }}>
            <span style={{ width: 17, height: 13, borderRadius: 7, background: "#FBF0E6", display: "block" }} />
            <span style={{ position: "absolute", bottom: -3, left: 3, width: 0, height: 0, borderLeft: "3px solid transparent", borderRight: "3px solid transparent", borderTop: "5px solid #FBF0E6" }} />
          </span>
          Compartir por WhatsApp
        </a>

        {/* FB / X / Email */}
        <div style={{ display: "flex", gap: 8 }}>
          <a href={`https://www.facebook.com/sharer/sharer.php?u=${encoded}`} target="_blank" rel="noopener noreferrer" style={secondaryBtn}>
            Facebook
          </a>
          <a href={`https://twitter.com/intent/tweet?text=${text}`} target="_blank" rel="noopener noreferrer" style={secondaryBtn}>
            X
          </a>
          <a href={`mailto:?subject=${encodeURIComponent(campaignTitle)}&body=${text}`} style={secondaryBtn}>
            Email
          </a>
        </div>
      </div>

      {/* Newsletter opt-in separado */}
      <label style={{ display: "flex", gap: 10, alignItems: "flex-start", textAlign: "left", cursor: "pointer" }}>
        <input
          type="checkbox"
          defaultChecked={false}
          onChange={(e) => onSubscribe(e.target.checked)}
          style={{ marginTop: 3, width: 18, height: 18, flexShrink: 0 }}
          aria-label="Suscribirme a novedades de esta causa"
        />
        <span style={{ fontSize: 13, lineHeight: 1.5, color: "rgba(22,38,31,0.7)" }}>
          Quiero recibir noticias de esta campaña por correo.{" "}
          <span style={{ fontSize: 12, color: "rgba(22,38,31,0.5)" }}>
            (Consentimiento independiente de tu firma · puedo retirarme cuando quiera.)
          </span>
        </span>
      </label>
    </div>
  );
}
