"use client";

import { useEffect, useState } from "react";

interface Props {
  name: string;
  count: number;
  goal: number | null;
  campaignUrl: string;
  campaignTitle: string;
  categoryColor: string;
  shareText?: string | null;
  heroImageUrl?: string | null;
  welcomeTitle?: string | null;
  welcomeSlogan?: string | null;
  onSubscribe: (val: boolean) => void;
}

const WA_ICON = (
  <svg width="20" height="20" viewBox="0 0 32 32" fill="currentColor" style={{ flexShrink: 0 }}>
    <path d="M16 3C8.82 3 3 8.82 3 16c0 2.3.62 4.47 1.7 6.34L3 29l6.85-1.65A13 13 0 0016 29c7.18 0 13-5.82 13-13S23.18 3 16 3zm0 2c6.07 0 11 4.93 11 11s-4.93 11-11 11c-2.02 0-3.9-.55-5.52-1.5l-.39-.23-4.06.98.99-3.96-.26-.42A10.96 10.96 0 015 16C5 9.93 9.93 5 16 5zm-3.4 5.5c-.2 0-.52.08-.8.38-.27.3-1.04 1.02-1.04 2.48s1.07 2.88 1.22 3.08c.14.2 2.07 3.24 5.08 4.42.71.31 1.26.49 1.69.62.71.22 1.36.19 1.87.12.57-.08 1.75-.72 2-1.41.25-.7.25-1.3.18-1.42-.08-.12-.27-.2-.57-.34-.3-.15-1.75-.86-2.02-.96-.27-.1-.47-.15-.67.15-.2.3-.77.96-.94 1.16-.17.2-.34.22-.64.08-.3-.15-1.27-.47-2.42-1.49-.9-.8-1.5-1.78-1.68-2.08-.17-.3-.02-.46.13-.61.13-.13.3-.34.44-.51.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.08-.14-.67-1.62-.92-2.22-.24-.58-.49-.5-.67-.51l-.57-.01z"/>
  </svg>
);

const IG_ICON = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
    <rect x="2" y="2" width="20" height="20" rx="5" ry="5"/>
    <circle cx="12" cy="12" r="4"/>
    <circle cx="17.5" cy="6.5" r="0.5" fill="currentColor" stroke="none"/>
  </svg>
);

export default function StepThanks({
  name,
  count,
  goal,
  campaignUrl,
  campaignTitle,
  categoryColor,
  shareText,
  heroImageUrl,
  welcomeTitle,
  welcomeSlogan,
  onSubscribe,
}: Props) {
  const firstName = name.trim().split(" ")[0] || name.trim();
  const [copied, setCopied] = useState(false);

  // Emojis compatibles con WhatsApp (Unicode 6.0, ampliamente soportados)
  // 🌿 (U+1F33F, Unicode 7.0) falla en algunos dispositivos → usar ✊ (U+270A, Unicode 6.0)
  function buildCopy(): string {
    if (shareText?.trim()) {
      const header = welcomeTitle && !shareText.includes(welcomeTitle)
        ? `*${welcomeTitle}*\n`
        : "";
      return `${header}${shareText.trim()}`;
    }
    const parts: string[] = [];
    if (welcomeTitle)  parts.push(`*${welcomeTitle}*`);
    if (welcomeSlogan) parts.push(welcomeSlogan);
    if (parts.length === 0) {
      parts.push(`Acabo de firmar: "${campaignTitle}". Suma tu voz.`);
    } else {
      parts.push(`Acabo de firmar esta peticion. Suma tu voz tambien.`);
    }
    return parts.join("\n");
  }

  const copyBase    = buildCopy();
  const cta         = `\n\nFirma aqui -> ${campaignUrl}`;
  const copyWithUrl = `${copyBase}${cta}`;

  const text    = encodeURIComponent(copyWithUrl);
  const encoded = encodeURIComponent(campaignUrl);

  const emailSubject = encodeURIComponent(`Firma esta peticion: ${welcomeTitle || campaignTitle}`);
  const emailBody    = encodeURIComponent(
    `${copyBase}\n\nFirma aqui: ${campaignUrl}` +
    (heroImageUrl ? `\n\n${heroImageUrl}` : "")
  );
  const goalPct = goal && goal > 0 ? Math.min(100, Math.round((count / goal) * 100)) : 0;

  async function handleNativeShare() {
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title: welcomeTitle || campaignTitle, text: copyBase, url: campaignUrl });
      } catch { /* usuario canceló */ }
    }
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(copyWithUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* clipboard no disponible */ }
  }

  const canNativeShare = typeof navigator !== "undefined" && !!navigator.share;

  const FONT_DISPLAY = "var(--font-anton, 'Anton', sans-serif)";
  const FONT_BODY    = "var(--font-work-sans, 'Work Sans', sans-serif)";

  // Animación del corazón: late 2 veces al montar
  const [heartBeat, setHeartBeat] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setHeartBeat(true), 120);
    const t2 = setTimeout(() => setHeartBeat(false), 900);
    return () => { clearTimeout(t); clearTimeout(t2); };
  }, []);

  const secondaryBtn: React.CSSProperties = {
    flex: 1,
    fontSize: 13,
    fontWeight: 600,
    color: "#16261F",
    background: "#fff",
    border: "1.5px solid #16261F",
    borderRadius: 24,
    padding: "11px 8px",
    cursor: "pointer",
    textDecoration: "none",
    textAlign: "center",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    fontFamily: FONT_BODY,
  };

  return (
    <>
      <style>{`
        @keyframes heartbeat {
          0%   { transform: scale(1); }
          25%  { transform: scale(1.28); }
          50%  { transform: scale(1); }
          70%  { transform: scale(1.18); }
          100% { transform: scale(1); }
        }
        .heart-anim { animation: heartbeat 0.7s ease; }
      `}</style>

      <div style={{ textAlign: "center", padding: "10px 0 0" }} aria-live="polite">

        {/* Corazón animado */}
        <div
          className={heartBeat ? "heart-anim" : ""}
          style={{
            width: 56, height: 56, borderRadius: "50%",
            background: categoryColor,
            display: "flex", alignItems: "center", justifyContent: "center",
            margin: "0 auto 18px",
            transformOrigin: "center",
          }}
          aria-hidden="true"
        >
          <svg width="26" height="26" viewBox="0 0 24 24" fill="#16261F" stroke="none">
            <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
          </svg>
        </div>

        <div style={{ fontFamily: FONT_DISPLAY, fontSize: 30, marginBottom: 8, color: "#16261F" }}>
          ¡Gracias, {firstName}!
        </div>
        <div style={{ fontSize: 15, color: "rgba(22,38,31,0.7)", lineHeight: 1.5, marginBottom: 20, fontFamily: FONT_BODY }}>
          Tu firma quedó registrada. Acabás de mover el contador.
        </div>

        {/* Contador */}
        <div style={{ background: "#FBF0E6", borderRadius: 14, padding: 20, marginBottom: 24 }}>
          <div style={{ fontFamily: FONT_DISPLAY, fontSize: 34, color: "#16261F" }}>
            {count.toLocaleString("es-EC")}
          </div>
          <div style={{ fontSize: 13, color: "rgba(22,38,31,0.6)", marginBottom: goal ? 10 : 0, fontFamily: FONT_BODY }}>
            firmas{goal ? ` de ${goal.toLocaleString("es-EC")}` : ""}
          </div>
          {goal && (
            <div style={{ height: 8, borderRadius: 5, background: "rgba(22,38,31,0.12)" }}>
              <div style={{ height: "100%", borderRadius: 5, background: categoryColor, width: `${goalPct}%` }} />
            </div>
          )}
        </div>

        {/* Compartir */}
        <div style={{ fontSize: 14, fontWeight: 700, textAlign: "left", marginBottom: 10, color: "#16261F", fontFamily: FONT_BODY }}>
          Ayudá a que llegue a más personas
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {/* Botón nativo (abre share sheet del SO en móvil con texto pre-relleno) */}
          {canNativeShare && (
            <button
              type="button"
              onClick={handleNativeShare}
              style={{
                width: "100%", display: "flex", alignItems: "center", justifyContent: "center",
                gap: 8, fontSize: 15, fontWeight: 700,
                color: "#16261F", background: categoryColor,
                borderRadius: 24, padding: "14px 18px",
                border: "none", cursor: "pointer", boxSizing: "border-box", fontFamily: FONT_BODY,
              }}
            >
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                <path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/>
              </svg>
              Compartir
            </button>
          )}

          {/* WhatsApp — siempre visible */}
          <a
            href={`https://wa.me/?text=${text}`}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              width: "100%", display: "flex", alignItems: "center", justifyContent: "center",
              gap: 10, fontSize: 15, fontWeight: 700,
              color: "#FBF0E6", background: "#12222E",
              borderRadius: 24, padding: "14px 18px",
              textDecoration: "none", boxSizing: "border-box", fontFamily: FONT_BODY,
            }}
          >
            {WA_ICON}
            Compartir por WhatsApp
          </a>

          {/* Copiar texto */}
          <button
            type="button"
            onClick={handleCopy}
            style={{
              width: "100%", display: "flex", alignItems: "center", justifyContent: "center",
              gap: 8, fontSize: 14, fontWeight: 600,
              color: "#16261F", background: copied ? "rgba(22,38,31,0.08)" : "#fff",
              border: "1.5px solid #16261F", borderRadius: 24, padding: "13px 18px",
              cursor: "pointer", boxSizing: "border-box", fontFamily: FONT_BODY,
              transition: "background 0.15s",
            }}
          >
            {copied ? (
              <>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#16261F" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                Texto copiado
              </>
            ) : (
              <>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#16261F" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>
                Copiar texto
              </>
            )}
          </button>

          {/* X / Email */}
          <div style={{ display: "flex", gap: 8 }}>
            <a href={`https://twitter.com/intent/tweet?text=${text}`} target="_blank" rel="noopener noreferrer" style={secondaryBtn}>
              X
            </a>
            <a href={`mailto:?subject=${emailSubject}&body=${emailBody}`} style={secondaryBtn}>
              Email
            </a>
          </div>
        </div>

        {/* Newsletter — separado, más visible */}
        <div style={{ marginTop: 20, paddingTop: 16, borderTop: "1px solid rgba(22,38,31,0.12)" }}>
          <label style={{ display: "flex", gap: 10, alignItems: "flex-start", textAlign: "left", cursor: "pointer" }}>
            <input
              type="checkbox"
              defaultChecked={false}
              onChange={(e) => onSubscribe(e.target.checked)}
              style={{ marginTop: 3, width: 18, height: 18, flexShrink: 0, accentColor: categoryColor }}
              aria-label="Suscribirme a novedades de esta causa"
            />
            <span style={{ fontFamily: FONT_BODY }}>
              <span style={{ fontSize: 14, fontWeight: 700, color: "#16261F", display: "block", marginBottom: 3 }}>
                Quiero recibir noticias de esta campaña
              </span>
              <span style={{ fontSize: 12, color: "rgba(22,38,31,0.55)", lineHeight: 1.4, display: "block" }}>
                Consentimiento independiente de tu firma · puedo retirarme cuando quiera.
              </span>
            </span>
          </label>
        </div>

      </div>
    </>
  );
}
