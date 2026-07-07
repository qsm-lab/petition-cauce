"use client";

import { useState } from "react";
import type { CampaignAttachment } from "@/lib/campaign-api";

interface Props {
  title: string;
  url: string;
  status: string;
  attachments?: CampaignAttachment[];
  showQr?: boolean;
  qrCodeData?: string | null;
  shareText?: string | null;
  /** Documentos como tarjetas destacadas (usado en el bloque final móvil) */
  prominentDocs?: boolean;
}

const IcoDownload = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
    <polyline points="7 10 12 15 17 10"/>
    <line x1="12" y1="15" x2="12" y2="3"/>
  </svg>
);

export default function ShareSection({
  title,
  url,
  status,
  attachments = [],
  showQr = false,
  qrCodeData,
  shareText,
  prominentDocs = false,
}: Props) {
  const [copied, setCopied] = useState(false);
  const isClosed = status === "closed";

  const encoded = encodeURIComponent(url);
  const text = encodeURIComponent(shareText ?? `${title} — firma aquí: ${url}`);

  async function copyUrl() {
    if (isClosed) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch { /* silent */ }
  }

  const secondaryBtn: React.CSSProperties = {
    flex: 1,
    fontSize: 14,
    fontWeight: 600,
    color: "#16261F",
    background: "#fff",
    border: "1.5px solid #16261F",
    borderRadius: 24,
    padding: 12,
    cursor: "pointer",
  };

  const disabledStyle: React.CSSProperties = isClosed
    ? { opacity: 0.5, pointerEvents: "none", cursor: "not-allowed" }
    : {};

  return (
    <div
      style={{
        background: "#fff",
        border: "1.5px solid #16261F",
        borderRadius: 18,
        padding: 20,
        display: "flex",
        flexDirection: "column",
        gap: 14,
      }}
    >
      <div style={{ fontSize: 16, fontWeight: 700, color: "#16261F" }}>
        {isClosed ? "Campaña cerrada — comparte el resultado" : "Comparte esta campaña"}
      </div>

      {/* WhatsApp — dark ink blue, full width */}
      <a
        href={`https://wa.me/?text=${text}`}
        target="_blank"
        rel="noopener noreferrer"
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 10,
          fontSize: 15,
          fontWeight: 700,
          color: "#FBF0E6",
          background: "#12222E",
          border: "none",
          borderRadius: 24,
          padding: "14px 18px",
          textDecoration: "none",
          boxSizing: "border-box",
          ...disabledStyle,
        }}
      >
        {/* Logo de WhatsApp */}
        <svg width="19" height="19" viewBox="0 0 24 24" fill="#FBF0E6" aria-hidden="true" style={{ flexShrink: 0 }}>
          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z" />
        </svg>
        Compartir por WhatsApp
      </a>

      {/* Facebook / X / Email */}
      <div style={{ display: "flex", gap: 8 }}>
        <a
          href={`https://www.facebook.com/sharer/sharer.php?u=${encoded}`}
          target="_blank"
          rel="noopener noreferrer"
          style={{ ...secondaryBtn, textDecoration: "none", textAlign: "center" as const, ...disabledStyle }}
        >
          Facebook
        </a>
        <a
          href={`https://twitter.com/intent/tweet?text=${text}`}
          target="_blank"
          rel="noopener noreferrer"
          style={{ ...secondaryBtn, textDecoration: "none", textAlign: "center" as const, ...disabledStyle }}
        >
          X
        </a>
        <a
          href={`mailto:?subject=${encodeURIComponent(title)}&body=${text}`}
          style={{ ...secondaryBtn, textDecoration: "none", textAlign: "center" as const, ...disabledStyle }}
        >
          Email
        </a>
      </div>

      {/* URL copiable */}
      <div
        style={{
          display: "flex",
          gap: 8,
          alignItems: "center",
          background: "#FBF0E6",
          borderRadius: 12,
          padding: "8px 8px 8px 14px",
          opacity: isClosed ? 0.5 : 1,
        }}
      >
        <div
          style={{
            flex: 1,
            fontSize: 13,
            color: "rgba(22,38,31,0.6)",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {url}
        </div>
        <button
          onClick={copyUrl}
          disabled={isClosed}
          style={{
            fontSize: 12,
            fontWeight: 700,
            color: "#16261F",
            background: "#fff",
            border: "1.5px solid #16261F",
            borderRadius: 18,
            padding: "8px 14px",
            cursor: isClosed ? "not-allowed" : "pointer",
            whiteSpace: "nowrap",
          }}
        >
          {copied ? "¡Copiado!" : "Copiar enlace"}
        </button>
      </div>

      {/* QR */}
      {showQr && qrCodeData && (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, opacity: isClosed ? 0.6 : 1 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={qrCodeData} alt="Código QR de la campaña" style={{ width: 120, height: 120, borderRadius: 10 }} />
          <p style={{ fontSize: 11, color: "rgba(22,38,31,0.5)", margin: 0 }}>Escanea para abrir</p>
        </div>
      )}

      {/* Documentos */}
      {attachments.length > 0 && (
        <div
          style={{
            borderTop: "1px solid rgba(22,38,31,0.15)",
            paddingTop: prominentDocs ? 18 : 12,
            marginTop: prominentDocs ? 6 : 0,
          }}
        >
          <p
            style={{
              fontSize: prominentDocs ? 13 : 11.5,
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              color: prominentDocs ? "#16261F" : "rgba(22,38,31,0.5)",
              margin: prominentDocs ? "0 0 12px" : "0 0 8px",
            }}
          >
            Documentos adjuntos
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: prominentDocs ? 10 : 8 }}>
            {attachments.map((att, i) =>
              prominentDocs ? (
                <a
                  key={i}
                  href={att.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    fontSize: 14.5,
                    fontWeight: 700,
                    color: "#16261F",
                    textDecoration: "none",
                    background: "var(--bbg, #EDF4F1)",
                    border: "1.5px solid #16261F",
                    borderRadius: 14,
                    padding: "14px 16px",
                    ...disabledStyle,
                  }}
                >
                  <IcoDownload />
                  <span style={{ flex: 1 }}>{att.title}</span>
                  <span style={{ fontSize: 12, fontWeight: 600, color: "rgba(22,38,31,0.55)", flexShrink: 0 }}>
                    Descargar →
                  </span>
                </a>
              ) : (
                <a
                  key={i}
                  href={att.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    fontSize: 13,
                    fontWeight: 500,
                    color: "#16261F",
                    textDecoration: "none",
                    ...disabledStyle,
                  }}
                >
                  <IcoDownload />
                  {att.title}
                </a>
              )
            )}
          </div>
        </div>
      )}
    </div>
  );
}
