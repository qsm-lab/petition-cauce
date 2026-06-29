import { apiServer } from "@/lib/api-server";
import FormBuilder from "./FormBuilder";
import { Campaign } from "@/lib/types";

interface Props {
  params: { id: string };
}

export default async function BuilderPage({ params }: Props) {
  const form = await apiServer<any>(`/v1/forms/${params.id}`);

  if (!form) {
    return <div className="text-gray-500 text-sm">Formulario no encontrado.</div>;
  }

  const campaign = await apiServer<Campaign>(`/v1/campaigns/by-form/${params.id}`);

  return <FormBuilder form={form} campaignId={campaign?.id} />;
}
