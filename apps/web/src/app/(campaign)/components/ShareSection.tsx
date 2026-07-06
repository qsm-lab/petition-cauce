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
        {/* Chat bubble icon (no marca registrada) */}
        <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 18, height: 18, position: "relative", flexShrink: 0 }}>
          <span style={{ width: 17, height: 13, borderRadius: 7, background: "#FBF0E6", display: "block" }} />
          <span style={{ position: "absolute", bottom: -3, left: 3, width: 0, height: 0, borderLeft: "3px solid transparent", borderRight: "3px solid transparent", borderTop: "5px solid #FBF0E6" }} />
        </span>
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
        <div style={{ borderTop: "1px solid rgba(22,38,31,0.15)", paddingTop: 12 }}>
          <p
            style={{
              fontSize: 11.5,
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              color: "rgba(22,38,31,0.5)",
              margin: "0 0 8px",
            }}
          >
            Documentos adjuntos
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {attachments.map((att, i) => (
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
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
