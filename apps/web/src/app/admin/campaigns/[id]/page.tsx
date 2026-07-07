import { apiServer } from "@/lib/api-server";
import { Campaign, Form } from "@/lib/types";
import Link from "next/link";
import ExportButtons from "./ExportButtons";
import SocialLinksEditor from "./SocialLinksEditor";
import ThankYouEditor from "./ThankYouEditor";
import WelcomeConfigEditor from "./WelcomeConfigEditor";
import CampaignInfoEditor from "./CampaignInfoEditor";
import CampaignTitleEditor from "./CampaignTitleEditor";
import LinkedFormsSection from "./LinkedFormsSection";

interface Props {
  params: { id: string };
}

export default async function CampaignDetailPage({ params }: Props) {
  const campaign = await apiServer<Campaign>(`/v1/campaigns/${params.id}`);

  if (!campaign) {
    return (
      <div className="text-gray-500 text-sm">
        Campaña no encontrada.{" "}
        <Link href="/admin/campaigns" className="text-brand hover:underline">
          Volver
        </Link>
      </div>
    );
  }

  const form = campaign.form_id
    ? await apiServer<Form>(`/v1/forms/${campaign.form_id}`)
    : null;

  return (
    <div>
      <div className="flex items-center gap-2 text-sm text-gray-500 mb-6">
        <Link href="/admin/campaigns" className="hover:text-gray-900">Campañas</Link>
        <span>/</span>
        <span className="text-gray-900">{campaign.title}</span>
      </div>

      <div className="flex justify-between items-start mb-6">
        <div>
          <CampaignTitleEditor campaignId={campaign.id} initialTitle={campaign.title} />
          <p className="text-sm text-gray-500 mt-1 font-mono">/{campaign.slug}</p>
          {campaign.data_protection_level && (
            <span className="inline-flex items-center mt-1 px-2 py-0.5 rounded text-xs font-medium bg-blue-50 text-blue-700">
              {campaign.data_protection_level}
            </span>
          )}
        </div>
        <Link href={`/admin/campaigns/${campaign.id}/monitor`} className="text-sm text-brand hover:underline">
          Ver métricas →
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="font-semibold text-gray-900 mb-4">Información</h2>
          <dl className="space-y-3 text-sm">
            <InfoRow label="Estado" value={campaign.status} />
            <InfoRow label="Acceso" value={campaign.access_mode} />
            {campaign.source_platform && <InfoRow label="Plataforma" value={campaign.source_platform} />}
            {campaign.max_responses && (
              <InfoRow label="Cuota máxima" value={String(campaign.max_responses)} />
            )}
            {campaign.starts_at && (
              <InfoRow label="Inicio" value={new Date(campaign.starts_at).toLocaleDateString("es-EC", { timeZone: "America/Guayaquil" })} />
            )}
            {campaign.ends_at && (
              <InfoRow label="Cierre" value={new Date(campaign.ends_at).toLocaleDateString("es-EC", { timeZone: "America/Guayaquil" })} />
            )}
          </dl>
        </div>

        {/* Formulario vinculado */}
        <LinkedFormsSection campaignId={campaign.id} form={form} />

        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="font-semibold text-gray-900 mb-4">Exportar respuestas</h2>
          <ExportButtons campaignId={campaign.id} />
        </div>

        <CampaignInfoEditor
          campaignId={campaign.id}
          initialDescription={campaign.description}
          initialDataProtectionLevel={campaign.data_protection_level}
        />

        <div className="lg:col-span-2">
          <SocialLinksEditor
            campaignId={campaign.id}
            initial={campaign.social_links ?? {}}
            initialShareText={campaign.share_text ?? ""}
          />
        </div>

        <div className="lg:col-span-2">
          <ThankYouEditor
            campaignId={campaign.id}
            initialTitle={campaign.thank_you_title}
            initialBody={campaign.thank_you_body}
          />
        </div>

        <div className="lg:col-span-2">
          <WelcomeConfigEditor
            campaignId={campaign.id}
            initialLogoUrl={campaign.welcome_logo_url}
            initialTitle={campaign.welcome_title}
            initialTitleSize={campaign.welcome_title_size}
            initialDescription={campaign.welcome_description}
            initialSlogan={campaign.welcome_slogan}
            initialSloganSize={campaign.welcome_slogan_size}
            initialTitleColor={campaign.welcome_title_color}
            initialSloganColor={campaign.welcome_slogan_color}
            initialSlug={campaign.slug}
            initialStatus={campaign.status}
          />
        </div>
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <dt className="text-gray-500">{label}</dt>
      <dd className="text-gray-900">{value}</dd>
    </div>
  );
}
