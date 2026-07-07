"use client";

import { useState } from "react";
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

      {/* Nav */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "20px 24px",
          maxWidth: 1180,
          margin: "0 auto",
        }}
      >
        <div style={{ fontFamily: FONT_DISPLAY, fontSize: 22, letterSpacing: "0.01em" }}>
          Cauce
        </div>
        <div style={{ fontSize: 13, color: "rgba(22,38,31,0.55)" }}>
          Plataforma de firmas ciudadanas
        </div>
      </div>

      {/* Hero */}
      <div style={{ margin: "0 16px", maxWidth: 1148, marginLeft: "auto", marginRight: "auto" }}>
        <Hero campaign={campaign} categoryColor={categoryColor} />
      </div>

      {/* Title + org line */}
      <div style={{ maxWidth: 1148, margin: "0 auto", padding: "28px 24px 0" }}>
        <h1
          style={{
            fontFamily: FONT_DISPLAY,
            fontWeight: 400,
            fontSize: "clamp(32px, 4.6vw, 52px)",
            lineHeight: 1.03,
            margin: "0 0 14px",
            maxWidth: 820,
            color: categoryColor,
          }}
        >
          {campaign.petition_title}
        </h1>
        <div style={{ fontSize: 14, color: "rgba(22,38,31,0.6)" }}>
          Impulsada por{" "}
          <strong style={{ color: "#16261F" }}>{campaign.org.name}</strong>
        </div>
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
        {/* Sidebar — order-1 mobile (solo firma), order-2 desktop (columna derecha completa) */}
        <div
          className="order-1 md:order-2 md:sticky"
          style={{ display: "flex", flexDirection: "column", gap: 20, top: 20 }}
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
          />
          {/* En móvil org + compartir van al final de la página (bloque order-3) */}
          <div className="hidden md:flex" style={{ flexDirection: "column", gap: 20 }}>
            <OrgCard org={campaign.org} />
            <ShareSection
              title={campaign.petition_title}
              url={campaignUrl}
              status={campaign.status}
              attachments={campaign.attachments}
              showQr={campaign.show_qr}
              qrCodeData={campaign.qr_code_data}
              shareText={campaign.share_text}
            />
          </div>
        </div>

        {/* Main column — order-2 mobile (second), order-1 desktop (left column) */}
        <div
          className="order-2 md:order-1"
          style={{ display: "flex", flexDirection: "column", gap: 36, minWidth: 0 }}
        >
          <LifecycleSteps
            currentStage={campaign.lifecycle_stage}
            categoryColor={categoryColor}
            lifecycleConfig={(campaign.meta?.lifecycle_config as LifecycleConfig) ?? undefined}
          />

          {(campaign.asks.length > 0 || Object.keys(campaign.petition_body).length > 0) && (
            <PetitionBody
              asks={campaign.asks}
              petitionBody={campaign.petition_body}
              categoryColor={categoryColor}
            />
          )}

          {/* Documentos adjuntos en columna principal (mobile y desktop) — ya están en ShareSection en sidebar */}

          <RecentSignatures
            campaignId={campaign.id}
            initial={recentSignatures}
            categoryColor={categoryColor}
          />

          {regions.length > 0 && (
            <RegionBars regions={regions} categoryColor={categoryColor} />
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
