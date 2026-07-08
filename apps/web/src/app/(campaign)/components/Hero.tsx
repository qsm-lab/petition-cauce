"use client";

import { useEffect, useState } from "react";
import type { PublicCampaign } from "@/lib/campaign-api";

interface Props {
  campaign: PublicCampaign;
  categoryColor: string;
}

/** Luminancia media de la imagen → true si el fondo es oscuro (texto claro encima). */
function useImageIsDark(src: string | null): boolean {
  // Por defecto oscuro: el overlay degradado oscurece la base del hero
  const [dark, setDark] = useState(true);

  useEffect(() => {
    if (!src) {
      setDark(false); // patrón de respaldo claro
      return;
    }
    const img = new window.Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = 32;
        canvas.height = 32;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        ctx.drawImage(img, 0, 0, 32, 32);
        const data = ctx.getImageData(0, 0, 32, 32).data;
        let sum = 0;
        for (let i = 0; i < data.length; i += 4) {
          sum += 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
        }
        setDark(sum / (data.length / 4) < 140);
      } catch {
        /* CORS sin permiso: conservar el default oscuro */
      }
    };
    img.src = src;
  }, [src]);

  return dark;
}

export default function Hero({ campaign, categoryColor }: Props) {
  const desktopSrc = campaign.hero_image_url;
  const mobileSrc  = campaign.hero_image_mobile_url ?? campaign.hero_image_url;

  const isDark = useImageIsDark(desktopSrc);
  // Hasta 3 eslóganes (meta.welcome_slogan, _2, _3) rotando en secuencia:
  // el texto cambia al cierre de cada ciclo de animación, mientras está oculto
  const slogans = [
    campaign.meta?.welcome_slogan,
    campaign.meta?.welcome_slogan_2,
    campaign.meta?.welcome_slogan_3,
  ].filter((s): s is string => typeof s === "string" && s.trim().length > 0);
  const [sloganIdx, setSloganIdx] = useState(0);
  const slogan = slogans.length > 0 ? slogans[sloganIdx % slogans.length] : null;

  const FONT_DISPLAY = "var(--font-anton, 'Anton', sans-serif)";

  return (
    <div
      className="relative overflow-hidden rounded-none md:rounded-[20px]"
      style={{ height: "clamp(260px, 42vw, 420px)" }}
    >
      {desktopSrc ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={mobileSrc ?? desktopSrc} alt="" className="block md:hidden w-full h-full object-cover" />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={desktopSrc} alt="" className="hidden md:block w-full h-full object-cover" />
        </>
      ) : (
        <div
          className="w-full h-full"
          style={{
            background:
              "repeating-linear-gradient(135deg,#cfd9d4,#cfd9d4 14px,#bfcac4 14px,#bfcac4 28px)",
          }}
        />
      )}

      {/* Gradient overlay */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: "linear-gradient(to top, rgba(22,38,31,.88), rgba(22,38,31,0) 58%)",
        }}
      />

      {/* Eslogan — entra/sale en loop (3s visible, 5.5s oculto); escala móvil→desktop */}
      {slogan && (
        <div className="flex absolute inset-0 items-center justify-center pointer-events-none">
          <div
            className="cauce-slogan-loop px-6 md:px-14"
            onAnimationIteration={() => {
              if (slogans.length > 1) setSloganIdx((i) => (i + 1) % slogans.length);
            }}
            style={{
              fontFamily: FONT_DISPLAY,
              fontSize: "clamp(24px, 4.6vw, 56px)",
              lineHeight: 1.1,
              textAlign: "center",
              color: isDark ? "#FBF0E6" : "#16261F",
              textShadow: isDark
                ? "0 2px 20px rgba(0,0,0,0.4)"
                : "0 2px 20px rgba(255,255,255,0.5)",
            }}
          >
            {slogan}
          </div>
        </div>
      )}

      {/* Category badge — esquina superior derecha en ambos; en desktop 20% más pequeño.
          Móvil: esquema invertido (fondo ink como el chip "Dirigida a", texto en el
          color editable de la campaña); desktop conserva blanco/ink. */}
      {campaign.category && (
        <span
          className="absolute rounded-[20px] font-bold right-[18px] px-3 py-1.5 text-[11px] bg-[#16261F] text-[color:var(--tag-c)] md:bg-white md:text-[#16261F] md:px-[13px] md:py-[6px] md:text-[10.5px]"
          style={{ top: 18, "--tag-c": categoryColor } as React.CSSProperties}
        >
          {campaign.category}
        </span>
      )}

      {/* Solo desktop: "Impulsada por" + logo de la org en la esquina inferior derecha.
          El overlay degradado oscurece la base del hero, por eso el texto va claro. */}
      <div
        className="hidden md:flex items-center gap-3"
        style={{ position: "absolute", bottom: 18, right: 18 }}
      >
        <div style={{ fontSize: 14, color: "rgba(251,240,230,0.8)" }}>
          Impulsada por{" "}
          <strong style={{ color: "#FBF0E6" }}>{campaign.org.name}</strong>
        </div>
        <div
          className="flex items-center justify-center"
          style={{
            width: 44,
            height: 44,
            borderRadius: "50%",
            background: "#16261F",
            color: "#FBF0E6",
            overflow: "hidden",
            flexShrink: 0,
          }}
        >
          {campaign.org.logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={campaign.org.logo_url} alt={campaign.org.name} className="w-full h-full object-cover" />
          ) : (
            <span style={{ fontFamily: FONT_DISPLAY, fontSize: 18 }}>
              {campaign.org.initial}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
