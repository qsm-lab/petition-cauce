import PortalClient from "./PortalClient";

export const metadata = {
  title: "Tus datos en Cauce",
  robots: { index: false, follow: false },
};

export default function PortalPage({
  searchParams,
}: {
  searchParams: { token?: string; campaign?: string };
}) {
  return <PortalClient token={searchParams.token || null} originCampaignId={searchParams.campaign || null} />;
}
