interface Props {
  email: string;
  onContinue: () => void;
  onResend: () => void;
}

export default function StepSuccess({ email, onContinue, onResend }: Props) {
  return (
    <div
      className="flex flex-col items-center gap-5 py-8 px-2"
      aria-live="polite"
    >
      {/* Icon */}
      <div
        className="flex items-center justify-center rounded-full text-[28px] animate-pc-pop"
        style={{
          width: 64,
          height: 64,
          background: "color-mix(in srgb,var(--bsec) 16%,transparent)",
          color: "var(--bsec)",
        }}
        aria-hidden="true"
      >
        ✉️
      </div>

      <div className="text-center">
        <h2
          className="font-display font-bold mb-2"
          style={{ fontSize: 19, color: "var(--bink)", fontFamily: "var(--fd)" }}
        >
          Casi listo: revisa tu correo
        </h2>
        <p style={{ fontSize: 14, color: "var(--bmut)", lineHeight: 1.6 }}>
          Enviamos un enlace de confirmación a{" "}
          <strong style={{ color: "var(--bink)" }}>{email}</strong>. Haz clic
          en ese enlace para que tu firma quede registrada.
        </p>
      </div>

      <button
        onClick={onContinue}
        className="w-full font-display font-bold rounded-full transition-all hover:brightness-110"
        style={{
          minHeight: 52,
          background: "var(--bp)",
          color: "var(--bop)",
          fontSize: 16,
          fontFamily: "var(--fd)",
        }}
      >
        Ya confirmé — continuar →
      </button>

      <button
        onClick={onResend}
        className="w-full rounded-full font-semibold text-[14px] transition-opacity hover:opacity-75"
        style={{
          minHeight: 46,
          border: "1.5px solid var(--bbord)",
          color: "var(--bink)",
        }}
      >
        Reenviar correo de confirmación
      </button>

      <p style={{ fontSize: 12, color: "var(--bmut)" }}>
        ¿No llega? Revisa spam o vuelve a intentarlo en 1 minuto.
      </p>
    </div>
  );
}
