export default function StepSending() {
  const FONT_DISPLAY = "var(--font-anton, 'Anton', sans-serif)";

  return (
    <div
      style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", padding: "40px 10px" }}
      aria-busy="true"
      aria-live="polite"
    >
      <div
        className="animate-pc-spin"
        style={{
          width: 44,
          height: 44,
          borderRadius: "50%",
          border: "4px solid rgba(22,38,31,0.15)",
          borderTopColor: "#16261F",
          marginBottom: 20,
        }}
        aria-hidden="true"
      />
      <div style={{ fontFamily: FONT_DISPLAY, fontSize: 22, marginBottom: 8, color: "#16261F" }}>
        Enviando tu firma…
      </div>
      <div style={{ fontSize: 14, color: "rgba(22,38,31,0.6)" }}>
        Un momento, estamos procesando tu solicitud.
      </div>
    </div>
  );
}
