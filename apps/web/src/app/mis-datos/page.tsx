import RequestAccessForm from "./RequestAccessForm";

export const metadata = {
  title: "Accedé a tus datos — Cauce",
  robots: { index: false, follow: false },
};

export default async function MisDatosPage(
  props: {
    searchParams: Promise<{ campaign?: string }>;
  }
) {
  const searchParams = await props.searchParams;
  return <RequestAccessForm originCampaignId={searchParams.campaign || null} />;
}
