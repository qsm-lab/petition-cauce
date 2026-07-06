interface Props {
  email: string;
  resendState: "idle" | "sending" | "sent";
  onContinue: () => void;
  onResend: () => void;
}

export default function StepSuccess({ email, resendState, onContinue, onResend }: Props) {
  const FONT_DISPLAY = "var(--font-anton, 'Anton', sans-serif)";
  const FONT_BODY    = "var(--font-work-sans, 'Work Sans', sans-serif)";

  const resendLabel =
    resendState === "sending" ? "Enviando…"
    : resendState === "sent"  ? "Correo reenviado ✓"
    : "Reenviar correo de confirmación";

  return (
    <div
      style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", padding: "20px 10px 10px" }}
      aria-live="polite"
    >
      {/* Envelope icon */}
      <div
        style={{
          width: 56,
          height: 56,
          borderRadius: "50%",
          background: "#DCE9E6",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 24,
          marginBottom: 20,
        }}
        aria-hidden="true"
      >
        ✉
      </div>

      <div style={{ fontFamily: FONT_DISPLAY, fontSize: 26, marginBottom: 10, color: "#16261F" }}>
        Confirmá tu correo
      </div>

      <div style={{ fontSize: 15, color: "rgba(22,38,31,0.7)", lineHeight: 1.5, marginBottom: 6 }}>
        Enviamos un enlace de confirmación a:
      </div>
      <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 24, wordBreak: "break-all", color: "#16261F" }}>
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
        }}
      >
        {resendLabel}
      </button>

      <div style={{ fontSize: 12, color: "rgba(22,38,31,0.45)", marginTop: 16, lineHeight: 1.5 }}>
        Si no lo ves, revisá spam. El enlace vence en 30 minutos.
      </div>
    </div>
  );
}
