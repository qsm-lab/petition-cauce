interface Props {
  name: string;
  email: string;
  resendState: "idle" | "sending" | "sent";
  onContinue: () => void;
  onResend: () => void;
}

export default function StepSuccess({ name, email, resendState, onContinue, onResend }: Props) {
  const FONT_DISPLAY = "var(--font-anton, 'Anton', sans-serif)";
  const FONT_BODY    = "var(--font-work-sans, 'Work Sans', sans-serif)";

  const firstName = name.trim().split(" ")[0] || name.trim();

  const resendLabel =
    resendState === "sending" ? "Enviando…"
    : resendState === "sent"  ? "Correo reenviado ✓"
    : "Reenviar correo de confirmación";

  return (
    <div
      style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", padding: "20px 10px 10px" }}
      aria-live="polite"
    >
      {/* Ícono correo — SVG claro */}
      <div
        style={{
          width: 56,
          height: 56,
          borderRadius: "50%",
          background: "#DCE9E6",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          marginBottom: 20,
          flexShrink: 0,
        }}
        aria-hidden="true"
      >
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#16261F" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <rect x="2" y="4" width="20" height="16" rx="2" />
          <polyline points="2,4 12,13 22,4" />
        </svg>
      </div>

      {/* Título personalizado */}
      <div style={{ fontFamily: FONT_DISPLAY, fontSize: 26, marginBottom: 10, color: "#16261F", lineHeight: 1.2 }}>
        {firstName}, por favor,{"\n"}confirmá tu correo
      </div>

      <div style={{ fontSize: 15, color: "rgba(22,38,31,0.7)", lineHeight: 1.5, marginBottom: 6, fontFamily: FONT_BODY }}>
        Enviamos un enlace de confirmación a:
      </div>
      <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 24, wordBreak: "break-all", color: "#16261F", fontFamily: FONT_BODY }}>
        {email}
      </div>

      <button
        onClick={onContinue}
        style={{
          width: "100%",
          fontSize: 16,
          fontWeight: 700,
          color: "#16261F",
          background: "#D7F24C",
          border: "none",
          borderRadius: 30,
          padding: 16,
          cursor: "pointer",
          marginBottom: 12,
          fontFamily: FONT_BODY,
        }}
      >
        Ya confirmé — continuar
      </button>

      <button
        onClick={onResend}
        disabled={resendState !== "idle"}
        style={{
          width: "100%",
          fontSize: 14,
          fontWeight: 600,
          color: "#16261F",
          background: "#fff",
          border: "1.5px solid #16261F",
          borderRadius: 30,
          padding: 14,
          cursor: resendState !== "idle" ? "default" : "pointer",
          opacity: resendState === "sending" ? 0.6 : 1,
          fontFamily: FONT_BODY,
          marginBottom: 16,
        }}
      >
        {resendLabel}
      </button>

      {/* Aviso spam — visible pero sin competir */}
      <div style={{
        display: "flex",
        alignItems: "flex-start",
        gap: 7,
        background: "rgba(22,38,31,0.06)",
        borderRadius: 10,
        padding: "10px 14px",
        textAlign: "left",
        width: "100%",
        boxSizing: "border-box",
      }}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="rgba(22,38,31,0.55)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 1 }}>
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
        <span style={{ fontSize: 12.5, color: "rgba(22,38,31,0.65)", lineHeight: 1.5, fontFamily: FONT_BODY }}>
          Si no lo ves, revisá la carpeta de spam. El enlace vence en 30 minutos.
        </span>
      </div>
    </div>
  );
}
