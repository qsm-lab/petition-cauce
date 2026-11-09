import PortalClient from "./PortalClient";

export const metadata = {
  title: "Tus datos en Cauce",
  robots: { index: false, follow: false },
};

export default async function PortalPage(
  props: {
    searchParams: Promise<{ token?: string; campaign?: string }>;
  }
) {
  const searchParams = await props.searchParams;
  return <PortalClient token={searchParams.token || null} originCampaignId={searchParams.campaign || null} />;
}
