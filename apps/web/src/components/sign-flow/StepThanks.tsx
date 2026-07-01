interface Props {
  name: string;
  count: number;
  goal: number | null;
  campaignUrl: string;
  campaignTitle: string;
  onSubscribe: (val: boolean) => void;
}

export default function StepThanks({
  name,
  count,
  goal,
  campaignUrl,
  campaignTitle,
  onSubscribe,
}: Props) {
  const firstName = name.split(" ")[0] || name;
  const text = encodeURIComponent(
    `Firmé: ${campaignTitle} — únete aquí: ${campaignUrl}`
  );

  return (
    <div
      className="flex flex-col items-center gap-5 py-6 px-2"
      aria-live="polite"
    >
      {/* Icon */}
      <div
        className="flex items-center justify-center rounded-full font-bold text-[28px] animate-pc-pop"
        style={{
          width: 60,
          height: 60,
          background: "color-mix(in srgb,var(--bsec) 16%,transparent)",
          color: "var(--bsec)",
        }}
        aria-hidden="true"
      >
        ✓
      </div>

      <div className="text-center">
        <h2
          className="font-display font-black mb-1"
          style={{ fontSize: 20, color: "var(--bink)", fontFamily: "var(--fd)" }}
        >
          ¡Gracias, {firstName}!
        </h2>
        <p style={{ fontSize: 13, color: "var(--bmut)" }}>
          Tu apoyo quedó registrado
        </p>
      </div>

      {/* Counter chip */}
      <div
        className="rounded-full px-5 py-2 text-center"
        style={{ background: "color-mix(in srgb,var(--bp) 10%,var(--bbg))" }}
      >
        <span
          className="font-display font-bold"
          style={{ fontSize: 24, color: "var(--bp)", fontFamily: "var(--fd)" }}
        >
          {count.toLocaleString("es-EC")}
          {goal ? ` de ${goal.toLocaleString("es-EC")}` : ""}
        </span>
        <p style={{ fontSize: 11.5, color: "var(--bmut)" }}>
          ¡Acabas de mover el contador!
        </p>
      </div>

      {/* Share */}
      <div className="flex gap-2 w-full">
        <a
          href={`https://wa.me/?text=${text}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex-1 flex items-center justify-center rounded-full font-semibold text-[13px] min-h-[44px] hover:opacity-80"
          style={{ background: "var(--bp)", color: "var(--bop)" }}
        >
          WhatsApp
        </a>
        <a
          href={`https://t.me/share/url?url=${encodeURIComponent(campaignUrl)}&text=${encodeURIComponent(campaignTitle)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex-1 flex items-center justify-center rounded-full font-semibold text-[13px] min-h-[44px] hover:opacity-80"
          style={{ border: "1.5px solid var(--bbord)", color: "var(--bink)" }}
        >
          Telegram
        </a>
      </div>

      {/* Newsletter opt-in (consent separado) */}
      <label
        className="flex items-start gap-3 cursor-pointer w-full rounded-[16px] p-4"
        style={{ border: "1.5px solid var(--bbord)" }}
      >
        <input
          type="checkbox"
          defaultChecked={false}
          onChange={(e) => onSubscribe(e.target.checked)}
          className="mt-0.5 w-[22px] h-[22px] shrink-0 accent-brand-primary"
          aria-label="Suscribirme a novedades de esta causa"
        />
        <span style={{ fontSize: 13, color: "var(--bink)", lineHeight: 1.5 }}>
          Quiero recibir novedades de esta causa por correo.
          <br />
          <span style={{ fontSize: 11.5, color: "var(--bmut)" }}>
            Consentimiento separado · puedo retirarme cuando quiera.
          </span>
        </span>
      </label>
    </div>
  );
}
