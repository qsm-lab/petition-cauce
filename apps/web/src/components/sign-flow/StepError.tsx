interface Props {
  message?: string;
  onRetry: () => void;
  onBack: () => void;
}

export default function StepError({ message, onRetry, onBack }: Props) {
  const FONT_DISPLAY = "var(--font-anton, 'Anton', sans-serif)";
  const FONT_BODY    = "var(--font-work-sans, 'Work Sans', sans-serif)";

  return (
    <div
      style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", padding: "20px 10px 10px" }}
      aria-live="assertive"
    >
      {/* Alert icon */}
      <div
        style={{
          width: 56,
          height: 56,
          borderRadius: "50%",
          background: "#FBEAE4",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 24,
          marginBottom: 20,
          color: "#FF5A2B",
          fontWeight: 700,
        }}
        aria-hidden="true"
      >
        !
      </div>

      <div style={{ fontFamily: FONT_DISPLAY, fontSize: 26, marginBottom: 10, color: "#16261F" }}>
        No pudimos registrar tu firma
      </div>

      <div style={{ fontSize: 15, color: "rgba(22,38,31,0.7)", lineHeight: 1.5, marginBottom: 24 }}>
        {message ?? "Tus datos no se perdieron. Solo vuelve a intentarlo."}
      </div>

      <button
        onClick={onRetry}
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
        Reintentar
      </button>

      <button
        onClick={onBack}
        style={{
          width: "100%",
          fontSize: 14,
          fontWeight: 600,
          color: "#16261F",
          background: "#fff",
          border: "1.5px solid #16261F",
          borderRadius: 30,
          padding: 14,
          cursor: "pointer",
          fontFamily: FONT_BODY,
        }}
      >
        Editar mis datos
      </button>
    </div>
  );
}
