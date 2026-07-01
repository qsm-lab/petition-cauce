"use client";

import { useEffect, useState } from "react";
import type { RecentSignature } from "@/lib/campaign-api";

interface Props {
  campaignId: string;
  initial: RecentSignature[];
}

export default function RecentSignatures({ campaignId, initial }: Props) {
  const [sigs, setSigs] = useState<RecentSignature[]>(initial);

  useEffect(() => {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "";
    const poll = async () => {
      try {
        const res = await fetch(
          `${apiUrl}/v1/public-campaign/${campaignId}/signatures/recent?limit=10`
        );
        if (res.ok) setSigs(await res.json());
      } catch {
        // silent — no mostrar error en poll
      }
    };

    const id = setInterval(poll, 30_000);
    return () => clearInterval(id);
  }, [campaignId]);

  return (
    <div
      className="rounded-petition p-5"
      style={{ background: "var(--bsurf)", border: "1px solid var(--bbord)" }}
    >
      {/* Live indicator */}
      <div className="flex items-center gap-2 mb-4">
        <span
          className="inline-block rounded-full animate-pc-pulse"
          style={{ width: 8, height: 8, background: "var(--bsec)" }}
          aria-hidden="true"
        />
        <span
          className="uppercase font-bold tracking-[0.06em]"
          style={{ fontSize: 11, color: "var(--bmut)" }}
        >
          Firmas recientes
        </span>
      </div>

      {sigs.length === 0 ? (
        <p style={{ fontSize: 13, color: "var(--bmut)" }}>
          Sé el primero en firmar esta campaña.
        </p>
      ) : (
        <ul>
          {sigs.map((sig, i) => (
            <li
              key={i}
              className="flex items-center gap-[11px] py-2"
              style={{
                borderBottom:
                  i < sigs.length - 1
                    ? "1px solid color-mix(in srgb,var(--bbord) 60%,transparent)"
                    : "none",
              }}
            >
              {/* Avatar */}
              <div
                className="shrink-0 flex items-center justify-center rounded-full text-[13px] font-semibold"
                style={
                  sig.is_anon
                    ? {
                        width: 34,
                        height: 34,
                        background: "var(--bbg)",
                        color: "var(--bmut)",
                        border: "1px solid var(--bbord)",
                      }
                    : {
                        width: 34,
                        height: 34,
                        background:
                          "color-mix(in srgb,var(--bp) 15%,transparent)",
                        color: "var(--bp)",
                      }
                }
              >
                {sig.is_anon ? "🔒" : sig.name_display[0]}
              </div>

              <div className="min-w-0 flex-1">
                <p
                  className="font-semibold truncate"
                  style={{ fontSize: 13.5, color: "var(--bink)" }}
                >
                  {sig.name_display}
                </p>
                <p style={{ fontSize: 11.5, color: "var(--bmut)" }}>
                  {sig.provincia}
                  {sig.provincia && sig.time_ago ? " · " : ""}
                  {sig.time_ago}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}

      <p className="mt-3" style={{ fontSize: 11.5, color: "var(--bmut)" }}>
        Quienes eligen firma anónima o secreta aparecen como &ldquo;Anónimo&rdquo;.
      </p>
    </div>
  );
}
