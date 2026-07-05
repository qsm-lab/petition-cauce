interface Props {
  name: string;
  count: number;
  goal: number | null;
  campaignUrl: string;
  campaignTitle: string;
  onSubscribe: (val: boolean) => void;
}

const IcoCheck = () => (
  <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M22 5.18L10.59 16.6l-4.24-4.24 1.41-1.41 2.83 2.83 10-10L22 5.18zm-2.21 5.04c.13.57.21 1.17.21 1.78 0 4.42-3.58 8-8 8s-8-3.58-8-8 3.58-8 8-8c1.58 0 3.04.46 4.28 1.25l1.44-1.44C16.1 2.67 14.13 2 12 2 6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10c0-1.19-.22-2.33-.6-3.39l-1.61 1.61z"/>
  </svg>
);

const IcoWA = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
    <path d="M12 0C5.373 0 0 5.373 0 12c0 2.117.554 4.103 1.523 5.832L0 24l6.335-1.498A11.955 11.955 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.818a9.793 9.793 0 01-5.034-1.396l-.361-.214-3.742.985.998-3.648-.235-.374A9.771 9.771 0 012.182 12C2.182 6.57 6.57 2.182 12 2.182c5.432 0 9.818 4.388 9.818 9.818 0 5.432-4.386 9.818-9.818 9.818z"/>
  </svg>
);

const IcoFB = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M24 12.073C24 5.406 18.627 0 12 0S0 5.406 0 12.073C0 18.1 4.388 23.094 10.125 24v-8.437H7.078v-3.49h3.047V9.41c0-3.025 1.792-4.697 4.533-4.697 1.313 0 2.686.236 2.686.236v2.97h-1.513c-1.491 0-1.956.931-1.956 1.887v2.256h3.328l-.532 3.49h-2.796V24C19.612 23.094 24 18.1 24 12.073z"/>
  </svg>
);

const IcoX = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.747l7.73-8.835L1.254 2.25H8.08l4.253 5.622zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
  </svg>
);

const IcoEmail = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="2" y="4" width="20" height="16" rx="2"/>
    <path d="M2 7l10 7 10-7"/>
  </svg>
);

export default function StepThanks({ name, count, goal, campaignUrl, campaignTitle, onSubscribe }: Props) {
  const firstName = name.split(" ")[0] || name;
  const text = encodeURIComponent(`Firmé: ${campaignTitle} — únete: ${campaignUrl}`);
  const encoded = encodeURIComponent(campaignUrl);

  const pillBase = "flex-1 flex items-center justify-center gap-1.5 rounded-full font-semibold text-[13px] min-h-[44px] hover:opacity-80 transition-opacity";

  return (
    <div className="flex flex-col items-center gap-5 py-6 px-2" aria-live="polite">
      {/* Icono */}
      <div
        className="flex items-center justify-center rounded-full animate-pc-pop"
        style={{ width: 60, height: 60, background: "color-mix(in srgb,var(--bsec) 16%,transparent)", color: "var(--bsec)" }}
        aria-hidden="true"
      >
        <IcoCheck />
      </div>

      <div className="text-center">
        <h2 className="font-display font-black mb-1" style={{ fontSize: 20, color: "var(--bink)", fontFamily: "var(--fd)" }}>
          ¡Gracias, {firstName}!
        </h2>
        <p style={{ fontSize: 13, color: "var(--bmut)" }}>Tu apoyo quedó registrado</p>
      </div>

      {/* Contador */}
      <div className="rounded-full px-5 py-2 text-center" style={{ background: "color-mix(in srgb,var(--bp) 10%,var(--bbg))" }}>
        <span className="font-display font-bold" style={{ fontSize: 24, color: "var(--bp)", fontFamily: "var(--fd)" }}>
          {count.toLocaleString("es-EC")}
          {goal ? ` de ${goal.toLocaleString("es-EC")}` : ""}
        </span>
        <p style={{ fontSize: 11.5, color: "var(--bmut)" }}>¡Acabas de mover el contador!</p>
      </div>

      {/* Compartir */}
      <div className="w-full">
        <p className="text-[11.5px] font-bold uppercase tracking-wide text-center mb-2" style={{ color: "var(--bmut)" }}>
          Invita a tus contactos
        </p>
        <div className="flex gap-2 mb-2">
          <a
            href={`https://wa.me/?text=${text}`}
            target="_blank" rel="noopener noreferrer"
            className={pillBase}
            style={{ background: "var(--bp)", color: "var(--bop)" }}
          >
            <IcoWA /> WhatsApp
          </a>
          <a
            href={`https://www.facebook.com/sharer/sharer.php?u=${encoded}`}
            target="_blank" rel="noopener noreferrer"
            className={pillBase}
            style={{ border: "1.5px solid var(--bbord)", color: "var(--bink)" }}
          >
            <IcoFB /> Facebook
          </a>
        </div>
        <div className="flex gap-2">
          <a
            href={`https://twitter.com/intent/tweet?text=${text}`}
            target="_blank" rel="noopener noreferrer"
            className={pillBase}
            style={{ border: "1.5px solid var(--bbord)", color: "var(--bink)" }}
          >
            <IcoX /> X
          </a>
          <a
            href={`mailto:?subject=${encodeURIComponent(campaignTitle)}&body=${text}`}
            className={pillBase}
            style={{ border: "1.5px solid var(--bbord)", color: "var(--bink)" }}
          >
            <IcoEmail /> Email
          </a>
        </div>
      </div>

      {/* Newsletter opt-in */}
      <label className="flex items-start gap-3 cursor-pointer w-full rounded-[16px] p-4" style={{ border: "1.5px solid var(--bbord)" }}>
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
          <span style={{ fontSize: 11.5, color: "var(--bmut)" }}>Consentimiento separado · puedo retirarme cuando quiera.</span>
        </span>
      </label>
    </div>
  );
}
