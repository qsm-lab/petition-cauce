"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { type PublicCampaign, type RecentSignature } from "@/lib/campaign-api";
import { getCategoryColor } from "@/lib/category-color";
import Hero from "./components/Hero";
import ActionBlock from "./components/ActionBlock";
import LifecycleSteps, { type LifecycleConfig } from "./components/LifecycleSteps";
import PetitionBody from "./components/PetitionBody";
import RecentSignatures from "./components/RecentSignatures";
import ShareSection from "./components/ShareSection";
import RegionBars from "./components/RegionBars";
import OrgCard from "./components/OrgCard";
import SignFlow from "@/components/sign-flow/SignFlow";

interface Props {
  campaign: PublicCampaign;
  recentSignatures: RecentSignature[];
  campaignUrl: string;
}

export default function CampaignPage({ campaign, recentSignatures, campaignUrl }: Props) {
  const [signOpen, setSignOpen] = useState(false);

  // Desktop: posición de la tarjeta de firma en el sidebar (0=arriba expandida,
  // 1=debajo de organización, 2=debajo de compartir). Al hacer scroll down la
  // tarjeta INTERCAMBIA lugar con la tarjeta siguiente (nunca se sobrepone);
  // al volver a su primer lugar con scroll up, se expande.
  const [ctaPos, setCtaPos] = useState<0 | 1 | 2>(0);
  const posRef = useRef<0 | 1 | 2>(0);
  posRef.current = ctaPos;
  const ctaWrapRef = useRef<HTMLDivElement>(null);
  const orgWrapRef = useRef<HTMLDivElement>(null);
  const shareWrapRef = useRef<HTMLDivElement>(null);
  const prevTops = useRef<{ cta: number; org: number; share: number } | null>(null);

  useEffect(() => {
    const md = window.matchMedia("(min-width: 768px)");
    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        ticking = false;
        const cta = ctaWrapRef.current;
        const org = orgWrapRef.current;
        const share = shareWrapRef.current;
        if (!cta || !org || !share) return;
        if (!md.matches) {
          if (posRef.current !== 0) setCtaPos(0);
          return;
        }
        const pos = posRef.current;
        const ctaR = cta.getBoundingClientRect();
        const orgR = org.getBoundingClientRect();
        const shareR = share.getBoundingClientRect();
        // Posiciones previas al posible cambio de orden — insumo del FLIP
        prevTops.current = { cta: ctaR.top, org: orgR.top, share: shareR.top };
        if (ctaR.top <= 8 && pos < 2) {
          // La tarjeta tocó el borde superior: cede el lugar a la siguiente
          setCtaPos((pos + 1) as 1 | 2);
        } else if (pos === 2 && shareR.top > ctaR.height + 56) {
          // Scroll up: hay espacio encima de "compartir" para volver a subir
          setCtaPos(1);
        } else if (pos === 1 && orgR.top > ctaR.height + 56) {
          setCtaPos(0);
        }
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // FLIP: anima el empuje/intercambio — cada tarjeta parte de su posición
  // anterior y desliza a la nueva
  useLayoutEffect(() => {
    const prev = prevTops.current;
    if (!prev) return;
    const els = {
      cta: ctaWrapRef.current,
      org: orgWrapRef.current,
      share: shareWrapRef.current,
    } as const;
    (Object.keys(els) as (keyof typeof els)[]).forEach((k) => {
      const el = els[k];
      if (!el) return;
      const delta = prev[k] - el.getBoundingClientRect().top;
      if (Math.abs(delta) < 2) return;
      el.style.transition = "none";
      el.style.transform = `translateY(${delta}px)`;
      requestAnimationFrame(() => {
        // La tarjeta de firma viaja un poco más lenta que las desplazadas:
        // desacelera suave (easeOutCubic largo) y el conjunto se siente fluido
        el.style.transition =
          k === "cta"
            ? "transform 700ms cubic-bezier(0.22, 0.61, 0.36, 1)"
            : "transform 600ms cubic-bezier(0.22, 0.61, 0.36, 1)";
        el.style.transform = "";
      });
    });
  }, [ctaPos]);

  const categoryColor = getCategoryColor(campaign.category, campaign.meta);
  const regions = (campaign.meta?.regions as { name: string; pct: number }[]) ?? [];

  const FONT_DISPLAY = "var(--font-anton, 'Anton', sans-serif)";
  const FONT_BODY    = "var(--font-work-sans, 'Work Sans', sans-serif)";

  return (
    <div
      style={{
        fontFamily: FONT_BODY,
        background: "#EDF4F1",
        color: "#16261F",
        minHeight: "100vh",
        position: "relative",
      }}
    >
      {/* Draft banner */}
      {campaign.is_draft && (
        <div
          style={{
            position: "sticky",
            top: 0,
            zIndex: 40,
            background: "#F2C230",
            color: "#16261F",
            textAlign: "center",
            padding: "10px 16px",
            fontSize: 14,
            fontWeight: 700,
          }}
        >
          Campaña en revisión · las firmas realizadas aquí son de prueba y no se contabilizarán
        </div>
      )}

      {/* Nav — en móvil más compacto y con marca atenuada */}
      <div
        className="flex items-center justify-between px-6 py-2 md:py-5"
        style={{ maxWidth: 1180, margin: "0 auto" }}
      >
        <div
          className="text-[12px] text-[#16261F]/40 md:text-[19px] md:text-[#16261F]/55"
          style={{ letterSpacing: "0.01em" }}
        >
          {/* "+" en Poppins semibold un 20% más grande; el resto en Anton */}
          <span style={{ fontFamily: "var(--font-poppins, 'Poppins', sans-serif)", fontWeight: 600, fontSize: "1.2em" }}>+</span>
          <span style={{ fontFamily: FONT_DISPLAY }}>Cauces.org</span>
        </div>
        <div style={{ fontSize: 13, color: "rgba(22,38,31,0.55)" }}>
          Plataforma de firmas ciudadanas
        </div>
      </div>

      {/* Hero */}
      <div style={{ margin: "0 16px", maxWidth: 1148, marginLeft: "auto", marginRight: "auto" }}>
        <Hero campaign={campaign} categoryColor={categoryColor} />
      </div>

      {/* Title — solo móvil; en desktop va dentro de la columna principal para que
          el sidebar suba a su altura. "Impulsada por" móvil vive bajo el bloque de firma;
          en desktop está sobre el hero (esquina inferior derecha). */}
      <div className="md:hidden" style={{ maxWidth: 1148, margin: "0 auto", padding: "28px 24px 0" }}>
        <h1
          style={{
            fontFamily: FONT_DISPLAY,
            fontWeight: 400,
            fontSize: "clamp(32px, 4.6vw, 52px)",
            lineHeight: 1.14,
            margin: 0,
            color: categoryColor,
          }}
        >
          {campaign.petition_title}
        </h1>
      </div>

      {/* Main grid — sidebar first in DOM so it appears top on mobile */}
      <div
        className="grid grid-cols-1 md:grid-cols-[minmax(0,1.6fr)_minmax(300px,1fr)]"
        style={{
          maxWidth: 1148,
          margin: "0 auto",
          padding: "24px 24px 64px",
          gap: 52,
          alignItems: "start",
        }}
      >
        {/* Sidebar — order-1 mobile (solo firma), order-2 desktop (columna derecha completa).
            En desktop se estira a la altura de la fila para que el ActionBlock (sticky
            individual) siga visible hasta el final del scroll. */}
        <div
          className="order-1 md:order-2 md:self-stretch"
          style={{ display: "flex", flexDirection: "column", gap: 20 }}
        >
          {/* Tarjeta de firma — viaja por el sidebar intercambiando lugar (ctaPos).
              En pos 2 (última) queda sticky: nada debajo, nada que tapar. */}
          <div
            ref={ctaWrapRef}
            className={
              ctaPos === 0
                ? "md:order-1"
                : ctaPos === 1
                ? "md:order-2"
                : "md:order-3 md:sticky"
            }
            style={{ top: 8 }}
          >
            <ActionBlock
              count={campaign.signature_count}
              goal={campaign.goal_count}
              authority={campaign.authority}
              showAuthority={campaign.show_authority}
              showGoal={campaign.show_goal}
              status={campaign.status}
              categoryColor={categoryColor}
              onSign={() => setSignOpen(true)}
              compressed={ctaPos > 0}
            />
          </div>
          {/* Solo móvil: "Impulsada por" debajo y fuera del bloque de firma */}
          <div
            className="md:hidden text-center"
            style={{ fontSize: 14, color: "rgba(22,38,31,0.6)" }}
          >
            Impulsada por{" "}
            <strong style={{ color: "#16261F" }}>{campaign.org.name}</strong>
          </div>
          {/* En móvil org + compartir van al final de la página (bloque order-3) */}
          <div
            ref={orgWrapRef}
            className={`hidden md:block ${ctaPos >= 1 ? "md:order-1" : "md:order-2"}`}
          >
            <OrgCard org={campaign.org} />
          </div>
          <div
            ref={shareWrapRef}
            className={`hidden md:block ${ctaPos === 2 ? "md:order-2" : "md:order-3"}`}
          >
            <ShareSection
              title={campaign.petition_title}
              url={campaignUrl}
              status={campaign.status}
              attachments={campaign.attachments}
              showQr={campaign.show_qr}
              qrCodeData={campaign.qr_code_data}
              shareText={campaign.share_text}
              prominentDocs
            />
          </div>
        </div>

        {/* Main column — order-2 mobile (second), order-1 desktop (left column) */}
        <div
          className="order-2 md:order-1"
          style={{ display: "flex", flexDirection: "column", gap: 36, minWidth: 0 }}
        >
          {/* Título — solo desktop, limitado al ancho de esta columna (order 0: primero) */}
          <h1
            className="hidden md:block"
            style={{
              fontFamily: FONT_DISPLAY,
              fontWeight: 400,
              fontSize: "clamp(32px, 4.6vw, 52px)",
              lineHeight: 1.14,
              margin: 0,
              color: categoryColor,
            }}
          >
            {campaign.petition_title}
          </h1>

          {/* En móvil el estado de la campaña va después de "Por qué importa" */}
          <div className="order-2 md:order-1">
            <LifecycleSteps
              currentStage={campaign.lifecycle_stage}
              categoryColor={categoryColor}
              lifecycleConfig={(campaign.meta?.lifecycle_config as LifecycleConfig) ?? undefined}
            />
          </div>

          {(campaign.asks.length > 0 || Object.keys(campaign.petition_body).length > 0) && (
            <div className="order-1 md:order-2">
              <PetitionBody
                asks={campaign.asks}
                petitionBody={campaign.petition_body}
                categoryColor={categoryColor}
              />
            </div>
          )}

          {/* Documentos adjuntos en columna principal (mobile y desktop) — ya están en ShareSection en sidebar */}

          <div className="order-3">
            <RecentSignatures
              campaignId={campaign.id}
              initial={recentSignatures}
              categoryColor={categoryColor}
            />
          </div>

          {regions.length > 0 && (
            <div className="order-4">
              <RegionBars regions={regions} categoryColor={categoryColor} />
            </div>
          )}
        </div>

        {/* Móvil: organización y compartir al final de la página.
            El display va solo en clases: un display inline anularía el md:hidden.
            paddingBottom deja aire para que el CTA flotante no tape los documentos */}
        <div className="order-3 md:hidden flex flex-col" style={{ gap: 20, paddingBottom: 96 }}>
          <OrgCard org={campaign.org} />
          <ShareSection
            title={campaign.petition_title}
            url={campaignUrl}
            status={campaign.status}
            attachments={campaign.attachments}
            showQr={campaign.show_qr}
            qrCodeData={campaign.qr_code_data}
            shareText={campaign.share_text}
            prominentDocs
          />
        </div>
      </div>

      {/* Footer */}
      <footer
        className="text-center"
        style={{
          background: "#16261F",
          color: "rgba(251,240,230,0.7)",
          fontSize: 12,
          padding: "16px 24px",
          lineHeight: 1.6,
        }}
      >
        Plataforma sin fines de lucro hecha en Ecuador ·{" "}
        <span style={{ color: "#FBF0E6", whiteSpace: "nowrap" }}>
          <span style={{ fontFamily: "var(--font-poppins, 'Poppins', sans-serif)", fontWeight: 600, fontSize: "1.2em" }}>+</span>
          <span style={{ fontFamily: FONT_DISPLAY }}>Cauces.org</span>
        </span>{" "}
        · Todos los derechos reservados 2026
      </footer>

      {/* SignFlow modal */}
      {signOpen && (
        <SignFlow
          campaignId={campaign.id}
          campaignTitle={campaign.petition_title}
          campaignUrl={campaignUrl}
          formConfig={campaign.form_config}
          categoryColor={categoryColor}
          shareText={campaign.share_text}
          heroImageUrl={campaign.hero_image_url}
          welcomeTitle={(campaign.meta?.welcome_title as string) ?? null}
          welcomeSlogan={(campaign.meta?.welcome_slogan as string) ?? null}
          onClose={() => setSignOpen(false)}
        />
      )}
    </div>
  );
}
