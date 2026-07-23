"use client";

import { useEffect, useState } from "react";
import type { RecentSignature } from "@/lib/campaign-api";

interface Props {
  campaignId: string;
  initial: RecentSignature[];
  categoryColor: string;
}

export default function RecentSignatures({ campaignId, initial, categoryColor }: Props) {
  const [sigs, setSigs] = useState<RecentSignature[]>(initial);

  useEffect(() => {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "";
    const poll = async () => {
      try {
        const res = await fetch(
          `${apiUrl}/v1/public-campaign/${campaignId}/signatures/recent?limit=10`
        );
        if (res.ok) setSigs(await res.json());
      } catch { /* silent */ }
    };
    const id = setInterval(poll, 30_000);
    return () => clearInterval(id);
  }, [campaignId]);

  const FONT_DISPLAY = "var(--font-anton, 'Anton', sans-serif)";

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
        <span
          className="animate-cauce-live-dot"
          style={{
            width: 9,
            height: 9,
            borderRadius: "50%",
            background: categoryColor,
            flexShrink: 0,
            display: "inline-block",
            // CSS custom property para el color del halo de pulso
            ["--cauce-dot-color" as string]: categoryColor + "72",
          }}
          aria-hidden="true"
        />
        <h2
          style={{
            fontFamily: FONT_DISPLAY,
            fontWeight: 400,
            fontSize: 24,
            margin: 0,
            color: "#16261F",
          }}
        >
          Firmas recientes
        </h2>
      </div>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          border: "1.5px solid #16261F",
          borderRadius: 14,
          overflow: "hidden",
          background: "#fff",
        }}
      >
        {sigs.length === 0 ? (
          <p style={{ fontSize: 14, color: "rgba(22,38,31,0.6)", padding: "18px 18px", margin: 0 }}>
            Sé el primero en firmar esta campaña.
          </p>
        ) : (
          sigs.map((sig, i) => (
            <div
              key={i}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "14px 18px",
                borderBottom:
                  i < sigs.length - 1 ? "1px solid rgba(22,38,31,0.1)" : "none",
              }}
            >
              {sig.is_anon ? (
                /* Anon / secret avatar — lock icon */
                <div
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: "50%",
                    background: "rgba(22,38,31,0.08)",
                    flexShrink: 0,
                    position: "relative",
                  }}
                >
                  <div
                    style={{
                      width: 12,
                      height: 9,
                      border: "2px solid #16261F",
                      borderBottom: "none",
                      borderRadius: "6px 6px 0 0",
                      position: "absolute",
                      top: 6,
                      left: "50%",
                      transform: "translateX(-50%)",
                    }}
                  />
                  <div
                    style={{
                      width: 16,
                      height: 11,
                      background: "#16261F",
                      borderRadius: 3,
                      position: "absolute",
                      bottom: 6,
                      left: "50%",
                      transform: "translateX(-50%)",
                    }}
                  />
                </div>
              ) : (
                /* Public avatar — colored initial */
                <div
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: "50%",
                    background: categoryColor,
                    color: "#fff",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontWeight: 700,
                    fontSize: 14,
                    flexShrink: 0,
                  }}
                >
                  {(sig.name_display || "?").charAt(0)}
                </div>
              )}

              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 15, fontWeight: 600, color: "#16261F" }}>
                  {sig.name_display}
                </div>
                <div style={{ fontSize: 13, fontWeight: 500, color: "rgba(22,38,31,0.68)" }}>
                  {sig.provincia}
                  {sig.provincia && sig.time_ago ? " · " : ""}
                  {sig.time_ago}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      <p style={{ fontSize: 12, fontWeight: 500, color: "rgba(22,38,31,0.65)", marginTop: 10, lineHeight: 1.5 }}>
        Las firmas se muestran según la visibilidad elegida por cada firmante: pública, anónima o secreta.
      </p>

      {/* Acceso self-service a derechos ARCO (ver/corregir/eliminar datos ya firmados) */}
      <a
        href={`/mis-datos?campaign=${campaignId}`}
        style={{ fontSize: 12, fontWeight: 700, color: "#16261F", marginTop: 6, display: "inline-block", textDecoration: "underline" }}
      >
        ¿Ya firmaste? Accedé a tus datos
      </a>
    </div>
  );
}
