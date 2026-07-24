import RequestAccessForm from "./RequestAccessForm";

export const metadata = {
  title: "Accedé a tus datos — Cauce",
  robots: { index: false, follow: false },
};

export default function MisDatosPage({
  searchParams,
}: {
  searchParams: { campaign?: string };
}) {
  return <RequestAccessForm originCampaignId={searchParams.campaign || null} />;
}
