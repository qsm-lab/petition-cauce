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
}

const IcoWA = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
    <path d="M12 0C5.373 0 0 5.373 0 12c0 2.117.554 4.103 1.523 5.832L0 24l6.335-1.498A11.955 11.955 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.818a9.793 9.793 0 01-5.034-1.396l-.361-.214-3.742.985.998-3.648-.235-.374A9.771 9.771 0 012.182 12C2.182 6.57 6.57 2.182 12 2.182c5.432 0 9.818 4.388 9.818 9.818 0 5.432-4.386 9.818-9.818 9.818z"/>
  </svg>
);

const IcoFB = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M24 12.073C24 5.406 18.627 0 12 0S0 5.406 0 12.073C0 18.1 4.388 23.094 10.125 24v-8.437H7.078v-3.49h3.047V9.41c0-3.025 1.792-4.697 4.533-4.697 1.313 0 2.686.236 2.686.236v2.97h-1.513c-1.491 0-1.956.931-1.956 1.887v2.256h3.328l-.532 3.49h-2.796V24C19.612 23.094 24 18.1 24 12.073z"/>
  </svg>
);

const IcoX = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.747l7.73-8.835L1.254 2.25H8.08l4.253 5.622zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
  </svg>
);

const IcoEmail = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="2" y="4" width="20" height="16" rx="2"/>
    <path d="M2 7l10 7 10-7"/>
  </svg>
);

const IcoLink = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
    <path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/>
    <path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/>
  </svg>
);

const IcoDownload = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
    <polyline points="7 10 12 15 17 10"/>
    <line x1="12" y1="15" x2="12" y2="3"/>
  </svg>
);

export default function ShareSection({ title, url, status, attachments = [], showQr = false, qrCodeData }: Props) {
  const [copied, setCopied] = useState(false);
  const isClosed = status === "closed";

  const encoded = encodeURIComponent(url);
  const text = encodeURIComponent(`${title} — firma aquí: ${url}`);

  async function copyUrl() {
    if (isClosed) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* silent */ }
  }

  const pillBase = "inline-flex items-center justify-center gap-2 min-h-[44px] rounded-full font-semibold text-[13px] transition-opacity";
  const disabledStyle = isClosed ? { opacity: 0.35, pointerEvents: "none" as const, cursor: "not-allowed" as const } : {};

  return (
    <div
      className="rounded-petition p-5 flex flex-col gap-3"
      style={{ background: "var(--bsurf)", border: "1px solid var(--bbord)" }}
    >
      <h3
        className="font-display font-bold"
        style={{ fontSize: 15, color: isClosed ? "var(--bmut)" : "var(--bink)", fontFamily: "var(--fd)" }}
      >
        {isClosed ? "Campaña cerrada — comparte el resultado" : "Comparte esta campaña"}
      </h3>

      {/* WhatsApp */}
      <a
        href={`https://wa.me/?text=${text}`}
        target="_blank" rel="noopener noreferrer"
        className={`${pillBase} w-full hover:opacity-80`}
        style={{ background: "var(--bp)", color: "var(--bop)", minHeight: 48, ...disabledStyle }}
      >
        <IcoWA /> WhatsApp
      </a>

      {/* Facebook + X + Email */}
      <div className="flex gap-2">
        <a
          href={`https://www.facebook.com/sharer/sharer.php?u=${encoded}`}
          target="_blank" rel="noopener noreferrer"
          className={`${pillBase} flex-1 hover:opacity-80`}
          style={{ border: "1.5px solid var(--bbord)", color: "var(--bmut)", fontSize: 12, ...disabledStyle }}
        >
          <IcoFB /> Facebook
        </a>
        <a
          href={`https://twitter.com/intent/tweet?text=${text}`}
          target="_blank" rel="noopener noreferrer"
          className={`${pillBase} flex-1 hover:opacity-80`}
          style={{ border: "1.5px solid var(--bbord)", color: "var(--bmut)", fontSize: 12, ...disabledStyle }}
        >
          <IcoX /> X
        </a>
        <a
          href={`mailto:?subject=${encodeURIComponent(title)}&body=${text}`}
          className={`${pillBase} flex-1 hover:opacity-80`}
          style={{ border: "1.5px solid var(--bbord)", color: "var(--bmut)", fontSize: 12, ...disabledStyle }}
        >
          <IcoEmail /> Email
        </a>
      </div>

      {/* URL copiable */}
      <div
        className="flex rounded-[12px] overflow-hidden"
        style={{ border: "1.5px solid var(--bbord)", opacity: isClosed ? 0.5 : 1 }}
      >
        <div className="flex items-center px-2.5 shrink-0" aria-hidden="true">
          <IcoLink />
        </div>
        <input
          readOnly
          value={url}
          className="flex-1 py-2 text-[12px] bg-transparent outline-none pr-2"
          style={{ color: "var(--bmut)", background: "var(--bbg)" }}
        />
        <button
          onClick={copyUrl}
          disabled={isClosed}
          className="px-4 text-[12px] font-semibold transition-opacity hover:opacity-90 shrink-0"
          style={{ background: "var(--bp)", color: "var(--bop)" }}
        >
          {copied ? "✓" : "Copiar"}
        </button>
      </div>

      {/* QR */}
      {showQr && qrCodeData && (
        <div className="flex flex-col items-center gap-1.5" style={{ opacity: isClosed ? 0.6 : 1 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={qrCodeData} alt="Código QR de la campaña" className="rounded-[10px]" style={{ width: 120, height: 120 }} />
          <p className="text-[11px] text-center" style={{ color: "var(--bmut)" }}>Escanea para abrir</p>
        </div>
      )}

      {/* Archivos descargables */}
      {attachments.length > 0 && (
        <div style={{ borderTop: "1px solid var(--bbord)", paddingTop: 10 }}>
          <p className="text-[11.5px] font-bold uppercase tracking-[.05em] mb-2" style={{ color: "var(--bmut)" }}>
            Documentos
          </p>
          <div className="flex flex-col gap-1.5">
            {attachments.map((att, i) => (
              <a
                key={i}
                href={att.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-[12.5px] font-medium hover:underline"
                style={{ color: isClosed ? "var(--bmut)" : "var(--bp)", ...disabledStyle }}
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
