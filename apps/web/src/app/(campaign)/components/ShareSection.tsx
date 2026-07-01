"use client";

import { useState } from "react";

interface Props {
  title: string;
  url: string;
}

export default function ShareSection({ title, url }: Props) {
  const [copied, setCopied] = useState(false);

  const encoded = encodeURIComponent(url);
  const text = encodeURIComponent(`${title} — firma aquí: ${url}`);

  const shares = [
    {
      label: "WhatsApp",
      href: `https://wa.me/?text=${text}`,
      full: true,
      color: "var(--bp)",
      textColor: "var(--bop)",
    },
    {
      label: "Telegram",
      href: `https://t.me/share/url?url=${encoded}&text=${encodeURIComponent(title)}`,
      full: false,
    },
    {
      label: "Facebook",
      href: `https://www.facebook.com/sharer/sharer.php?u=${encoded}`,
      full: false,
    },
    {
      label: "X",
      href: `https://twitter.com/intent/tweet?text=${text}`,
      full: false,
    },
    {
      label: "Correo",
      href: `mailto:?subject=${encodeURIComponent(title)}&body=${text}`,
      full: false,
    },
  ];

  async function copyUrl() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // silent
    }
  }

  const pillBase =
    "inline-flex items-center justify-center min-h-[44px] rounded-full font-semibold text-[13px] transition-opacity hover:opacity-80 active:scale-95";

  return (
    <div
      className="rounded-petition p-5 flex flex-col gap-3"
      style={{ background: "var(--bsurf)", border: "1px solid var(--bbord)" }}
    >
      <h3
        className="font-display font-bold"
        style={{ fontSize: 15, color: "var(--bink)", fontFamily: "var(--fd)" }}
      >
        Comparte esta campaña
      </h3>

      {/* WhatsApp full-width */}
      <a
        href={shares[0].href}
        target="_blank"
        rel="noopener noreferrer"
        className={`${pillBase} w-full`}
        style={{ background: "var(--bp)", color: "var(--bop)", minHeight: 48 }}
      >
        WhatsApp
      </a>

      {/* Telegram full-width outlined */}
      <a
        href={shares[1].href}
        target="_blank"
        rel="noopener noreferrer"
        className={`${pillBase} w-full`}
        style={{
          border: "1.5px solid var(--bbord)",
          color: "var(--bink)",
          minHeight: 46,
        }}
      >
        Telegram
      </a>

      {/* Facebook, X, Correo — equal flex */}
      <div className="flex gap-2">
        {shares.slice(2).map((s) => (
          <a
            key={s.label}
            href={s.href}
            target="_blank"
            rel="noopener noreferrer"
            className={`${pillBase} flex-1`}
            style={{
              border: "1.5px solid var(--bbord)",
              color: "var(--bmut)",
              minHeight: 44,
              fontSize: 12,
            }}
          >
            {s.label}
          </a>
        ))}
      </div>

      {/* URL copiable */}
      <div
        className="flex rounded-[12px] overflow-hidden"
        style={{ border: "1.5px solid var(--bbord)" }}
      >
        <input
          readOnly
          value={url}
          className="flex-1 px-3 py-2 text-[12px] bg-transparent outline-none"
          style={{ color: "var(--bmut)", background: "var(--bbg)" }}
        />
        <button
          onClick={copyUrl}
          className="px-4 text-[12px] font-semibold transition-opacity hover:opacity-90"
          style={{ background: "var(--bp)", color: "var(--bop)" }}
        >
          {copied ? "✓" : "Copiar"}
        </button>
      </div>

      {/* QR placeholder */}
      <div
        className="mx-auto rounded-[12px] flex items-center justify-center"
        style={{
          width: 64,
          height: 56,
          background:
            "repeating-linear-gradient(45deg,var(--bbord) 0,var(--bbord) 1px,transparent 1px,transparent 8px)",
          border: "1px solid var(--bbord)",
        }}
        aria-label="Código QR (próximamente)"
      />
    </div>
  );
}
