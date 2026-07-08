"use client";

import { useState } from "react";
import type { CampaignOrg } from "@/lib/campaign-api";

interface Props {
  org: CampaignOrg;
}

export default function OrgCard({ org }: Props) {
  const [open, setOpen] = useState(false);
  const hasDetails = Boolean(org.description || org.contact_email);

  return (
    <div
      style={{
        background: "#fff",
        border: "1.5px solid #16261F",
        borderRadius: 18,
        padding: 20,
      }}
    >
      <button
        type="button"
        onClick={hasDetails ? () => setOpen((o) => !o) : undefined}
        aria-expanded={open}
        aria-label={hasDetails ? (open ? "Ocultar detalles de la organización" : "Ver más de la organización") : undefined}
        className="flex items-center gap-3.5 w-full text-left"
        style={{
          background: "transparent",
          border: "none",
          padding: 0,
          cursor: hasDetails ? "pointer" : "default",
        }}
      >
        <div
          className="flex items-center justify-center"
          style={{
            width: 46,
            height: 46,
            borderRadius: "50%",
            background: "#16261F",
            color: "#FBF0E6",
            fontFamily: "var(--font-anton, 'Anton', sans-serif)",
            fontSize: 18,
            flexShrink: 0,
            overflow: "hidden",
          }}
        >
          {org.logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={org.logo_url} alt={org.name} className="w-full h-full object-cover" />
          ) : (
            org.initial
          )}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12, color: "rgba(22,38,31,0.5)" }}>Organización</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: "#16261F" }}>{org.name}</div>
        </div>

        {hasDetails && (
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#16261F"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            className={`flex-shrink-0 transition-transform duration-300 ease-in-out ${open ? "rotate-180" : ""}`}
            style={{ opacity: 0.6 }}
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        )}
      </button>

      {/* Detalle expandible: descripción + email de contacto de la org (perfil del admin) */}
      <div
        className={`overflow-hidden transition-all duration-300 ease-in-out ${
          open ? "max-h-[340px] opacity-100 mt-3.5" : "max-h-0 opacity-0 mt-0"
        }`}
      >
        {org.description && (
          <p style={{ fontSize: 13.5, lineHeight: 1.6, color: "rgba(22,38,31,0.75)", margin: 0 }}>
            {org.description}
          </p>
        )}
        {org.contact_email && (
          <a
            href={`mailto:${org.contact_email}`}
            style={{
              display: "inline-block",
              marginTop: org.description ? 10 : 0,
              fontSize: 13,
              fontWeight: 600,
              color: "#16261F",
              textDecoration: "underline",
              textUnderlineOffset: 3,
            }}
          >
            {org.contact_email}
          </a>
        )}
      </div>
    </div>
  );
}
