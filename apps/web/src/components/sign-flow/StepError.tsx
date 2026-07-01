interface Props {
  onRetry: () => void;
  onBack: () => void;
  message?: string;
}

export default function StepError({ onRetry, onBack, message }: Props) {
  return (
    <div
      className="flex flex-col items-center gap-5 py-8 px-2"
      aria-live="assertive"
    >
      {/* Icon */}
      <div
        className="flex items-center justify-center rounded-full text-[28px] animate-pc-pop"
        style={{
          width: 64,
          height: 64,
          background: "color-mix(in srgb,#d9483b 12%,transparent)",
          color: "#d9483b",
        }}
        aria-hidden="true"
      >
        ⚠
      </div>

      <div className="text-center">
        <h2
          className="font-display font-bold mb-2"
          style={{ fontSize: 18, color: "var(--bink)", fontFamily: "var(--fd)" }}
        >
          No pudimos registrar tu firma
        </h2>
        <p style={{ fontSize: 14, color: "var(--bmut)", lineHeight: 1.6 }}>
          {message ||
            "Tus datos no se perdieron. Solo vuelve a intentarlo."}
        </p>
      </div>

      <button
        onClick={onRetry}
        className="w-full font-display font-bold rounded-full transition-all hover:brightness-110"
        style={{
          minHeight: 52,
          background: "var(--bp)",
          color: "var(--bop)",
          fontSize: 16,
          fontFamily: "var(--fd)",
        }}
      >
        Reintentar
      </button>

      <button
        onClick={onBack}
        className="w-full rounded-full font-semibold text-[14px] transition-opacity hover:opacity-75"
        style={{
          minHeight: 46,
          border: "1.5px solid var(--bbord)",
          color: "var(--bink)",
        }}
      >
        Volver al formulario
      </button>
    </div>
  );
}
