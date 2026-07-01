export default function StepSending() {
  return (
    <div
      className="flex flex-col items-center justify-center gap-4 py-12"
      aria-busy="true"
      aria-live="polite"
    >
      <div
        className="rounded-full animate-pc-spin"
        style={{
          width: 52,
          height: 52,
          border: "5px solid var(--bbord)",
          borderTopColor: "var(--bp)",
        }}
        aria-hidden="true"
      />
      <p
        className="font-display font-semibold text-center"
        style={{ fontSize: 16, color: "var(--bink)", fontFamily: "var(--fd)" }}
      >
        Registrando tu firma…
      </p>
      <p
        className="text-center"
        style={{ fontSize: 13, color: "var(--bmut)" }}
      >
        Un momento, no cierres esta ventana.
      </p>
    </div>
  );
}
