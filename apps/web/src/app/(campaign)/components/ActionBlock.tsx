"use client";

import { useEffect, useRef, useState } from "react";

interface Props {
  count: number;
  goal: number | null;
  authority: string | null;
  showAuthority?: boolean;
  showGoal?: boolean;
  status: string;
  onSign: () => void;
}

const SIGNABLE = new Set(["draft", "active", "online"]);

export default function ActionBlock({ count, goal, authority, showAuthority = true, showGoal = true, status, onSign }: Props) {
  const [barW, setBarW] = useState(0);
  const [showFloat, setShowFloat] = useState(false);
  const blockRef = useRef<HTMLDivElement>(null);

  const effectiveGoal = showGoal ? goal : null;
  const pct = effectiveGoal && effectiveGoal > 0 ? Math.min(100, Math.round((count / effectiveGoal) * 100)) : 0;
  const canSign = SIGNABLE.has(status);

  // Animate progress bar on mount
  useEffect(() => {
    const raf = requestAnimationFrame(() => {
      setTimeout(() => setBarW(pct), 60);
    });
    return () => cancelAnimationFrame(raf);
  }, [pct]);

  // Floating CTA on mobile
  useEffect(() => {
    if (!blockRef.current) return;
    const observer = new IntersectionObserver(
      ([entry]) => setShowFloat(!entry.isIntersecting),
      { threshold: 0 }
    );
    observer.observe(blockRef.current);
    return () => observer.disconnect();
  }, []);

  const CTAButton = ({ height = 54 }: { height?: number }) =>
    canSign ? (
      <button
        onClick={onSign}
        className="w-full font-display font-bold rounded-full transition-all hover:brightness-110 active:scale-[0.98]"
        style={{
          minHeight: height,
          background: "var(--bp)",
          color: "var(--bop)",
          fontSize: 17,
          fontFamily: "var(--fd)",
          boxShadow: "0 8px 22px color-mix(in srgb,var(--bp) 34%,transparent)",
        }}
      >
        {status === "draft" ? "Firmar (modo prueba)" : "Firmar esta petición"}
      </button>
    ) : (
      <div
        className="w-full font-display font-bold rounded-full flex items-center justify-center"
        style={{
          minHeight: height,
          background: "var(--bbord)",
          color: "var(--bmut)",
          fontSize: 15,
          fontFamily: "var(--fd)",
        }}
      >
        {status === "closed" ? "Campaña cerrada" : "Campaña no disponible"}
      </div>
    );

  return (
    <>
      {/* Main card */}
      <div
        ref={blockRef}
        className="rounded-petition p-5 flex flex-col gap-4"
        style={{
          background: "var(--bsurf)",
          border: "1px solid var(--bbord)",
          boxShadow: "0 10px 30px color-mix(in srgb,var(--bp) 9%,transparent)",
        }}
      >
        {/* Counter */}
        <div>
          <span
            className="font-display font-black block"
            style={{ fontSize: 34, color: "var(--bink)", fontFamily: "var(--fd)" }}
          >
            {count.toLocaleString("es-EC")}
          </span>
          {effectiveGoal && (
            <span
              className="font-semibold"
              style={{ fontSize: 14, color: "var(--bmut)" }}
            >
              de {effectiveGoal.toLocaleString("es-EC")} firmas
            </span>
          )}
        </div>

        {/* Progress bar */}
        {effectiveGoal && (
          <div
            role="progressbar"
            aria-valuenow={pct}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`${pct}% del objetivo alcanzado`}
            className="rounded-full overflow-hidden"
            style={{
              height: 12,
              background:
                "color-mix(in srgb,var(--bp) 12%,var(--bbg))",
            }}
          >
            <div
              className="h-full rounded-full"
              style={{
                width: `${barW}%`,
                background:
                  "linear-gradient(90deg, color-mix(in srgb,var(--bp) 82%,#fff), var(--bp))",
                transition: "width 1.1s cubic-bezier(.22,1,.36,1)",
              }}
            />
          </div>
        )}

        {/* Directed at chip */}
        {showAuthority && authority && (
          <div
            className="flex items-center gap-2 rounded-[14px] px-[14px] py-3 text-[13px]"
            style={{ background: "var(--bbg)", color: "var(--bink)" }}
          >
            <span aria-hidden="true">🏛️</span>
            <span className="font-medium truncate">
              Dirigida a: {authority}
            </span>
          </div>
        )}

        <CTAButton />

        <p
          className="text-center"
          style={{ fontSize: 11.5, color: "var(--bmut)" }}
        >
          🔒 Confirmación por correo · privacidad por defecto
        </p>
      </div>

      {/* Floating CTA — mobile only, solo si la campaña acepta firmas */}
      {showFloat && canSign && (
        <div
          className="fixed bottom-0 left-0 right-0 px-4 pb-7 z-50 md:hidden animate-pc-float-in"
          style={{
            background:
              "linear-gradient(to top, var(--bbg) 58%, transparent)",
          }}
        >
          <CTAButton height={50} />
        </div>
      )}
    </>
  );
}
