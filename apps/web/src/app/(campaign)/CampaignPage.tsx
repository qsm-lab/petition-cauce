"use client";

import { useState } from "react";
import { DEFAULT_FORM_CONFIG, type PublicCampaign, type RecentSignature } from "@/lib/campaign-api";
import Hero from "./components/Hero";
import ActionBlock from "./components/ActionBlock";
import LifecycleSteps from "./components/LifecycleSteps";
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

export default function CampaignPage({
  campaign,
  recentSignatures,
  campaignUrl,
}: Props) {
  const [signOpen, setSignOpen] = useState(false);

  const regions: { name: string; pct: number }[] =
    (campaign.meta?.regions as { name: string; pct: number }[]) ?? [];

  return (
    <>
      {/* Campaign layout */}
      <div
        className="min-h-screen"
        style={{ background: "var(--bbg)" }}
      >
        {/* Banner borrador */}
        {campaign.is_draft && (
          <div
            className="w-full text-center py-2 text-[12px] font-semibold"
            style={{
              background: "color-mix(in srgb,#ca8a04 14%,transparent)",
              color: "#92400e",
              borderBottom: "1px solid color-mix(in srgb,#ca8a04 30%,transparent)",
            }}
          >
            Campaña en revisión · Las firmas realizadas aquí son de prueba y no se contabilizarán
          </div>
        )}

        {/* Mobile: single column */}
        <div className="md:hidden flex flex-col gap-[18px] pb-16">
          <Hero campaign={campaign} />

          {/* Title */}
          <div className="px-4">
            <h1
              className="font-display font-black leading-[1.12]"
              style={{
                fontSize: 24,
                color: "var(--bink)",
                letterSpacing: "-0.01em",
                maxWidth: "18ch",
                fontFamily: "var(--fd)",
              }}
            >
              {campaign.petition_title}
            </h1>
          </div>

          <div className="px-4">
            <ActionBlock
              count={campaign.signature_count}
              goal={campaign.goal_count}
              authority={campaign.authority}
              showAuthority={campaign.show_authority}
              showGoal={campaign.show_goal}
              status={campaign.status}
              onSign={() => setSignOpen(true)}
            />
          </div>

          <div className="px-4">
            <LifecycleSteps currentStage={campaign.lifecycle_stage} />
          </div>

          {(campaign.asks.length > 0 ||
            Object.keys(campaign.petition_body).length > 0) && (
            <div className="px-4">
              <PetitionBody
                asks={campaign.asks}
                petitionBody={campaign.petition_body}
              />
            </div>
          )}

          <div className="px-4">
            <RecentSignatures
              campaignId={campaign.id}
              initial={recentSignatures}
            />
          </div>

          <div className="px-4">
            <ShareSection
              title={campaign.petition_title}
              url={campaignUrl}
              status={campaign.status}
              attachments={campaign.attachments}
              showQr={campaign.show_qr}
              qrCodeData={campaign.qr_code_data}
            />
          </div>

          {regions.length > 0 && (
            <div className="px-4">
              <RegionBars regions={regions} />
            </div>
          )}

          <div className="px-4">
            <OrgCard org={campaign.org} />
          </div>
        </div>

        {/* Desktop: two-column grid */}
        <div
          className="hidden md:grid mx-auto px-7"
          style={{
            gridTemplateColumns: "1fr 360px",
            gap: 26,
            maxWidth: 1180,
            paddingTop: 28,
            paddingBottom: 48,
          }}
        >
          {/* Main column */}
          <div className="flex flex-col gap-6">
            <Hero campaign={campaign} />

            <h1
              className="font-display font-black leading-[1.12]"
              style={{
                fontSize: 34,
                color: "var(--bink)",
                letterSpacing: "-0.01em",
                maxWidth: "18ch",
                fontFamily: "var(--fd)",
              }}
            >
              {campaign.petition_title}
            </h1>

            <LifecycleSteps currentStage={campaign.lifecycle_stage} />

            {(campaign.asks.length > 0 ||
              Object.keys(campaign.petition_body).length > 0) && (
              <PetitionBody
                asks={campaign.asks}
                petitionBody={campaign.petition_body}
              />
            )}

            <RecentSignatures
              campaignId={campaign.id}
              initial={recentSignatures}
            />

            {regions.length > 0 && <RegionBars regions={regions} />}

            <OrgCard org={campaign.org} />
          </div>

          {/* Aside (sticky) */}
          <aside style={{ position: "sticky", top: 18, alignSelf: "start" }}>
            <div className="flex flex-col gap-5">
              <ActionBlock
                count={campaign.signature_count}
                goal={campaign.goal_count}
                authority={campaign.authority}
                showAuthority={campaign.show_authority}
                showGoal={campaign.show_goal}
                status={campaign.status}
                onSign={() => setSignOpen(true)}
              />
              <ShareSection
              title={campaign.petition_title}
              url={campaignUrl}
              status={campaign.status}
              attachments={campaign.attachments}
              showQr={campaign.show_qr}
              qrCodeData={campaign.qr_code_data}
            />
            </div>
          </aside>
        </div>
      </div>

      {/* Sign Flow modal */}
      {signOpen && (
        <SignFlow
          campaignId={campaign.id}
          campaignTitle={campaign.title}
          campaignUrl={campaignUrl}
          formConfig={campaign.form_config ?? DEFAULT_FORM_CONFIG}
          onClose={() => setSignOpen(false)}
        />
      )}
    </>
  );
}
