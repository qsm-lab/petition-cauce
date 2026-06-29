import { apiServer } from "@/lib/api-server";
import Link from "next/link";
import FormsActions from "./FormsActions";

interface FormItem {
  id: string;
  title: string;
  status: string;
  campaign_id: string | null;
  created_at: string;
  questions: { id: string }[];
}

interface CampaignItem {
  id: string;
  title: string;
  slug: string;
}

const STATUS_LABELS: Record<string, string> = {
  draft: "Borrador",
  active: "Activo",
  online: "En línea",
  completed: "Concluido",
  archived: "Archivado",
};

export default async function FormsPage() {
  const [forms, campaigns] = await Promise.all([
    apiServer<FormItem[]>("/v1/forms") ?? [],
    apiServer<CampaignItem[]>("/v1/campaigns") ?? [],
  ]);

  const campaignMap = Object.fromEntries((campaigns ?? []).map((c) => [c.id, c]));

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Formularios</h1>
        <div className="flex items-center gap-3">
          <Link href="/admin/forms/archived" className="text-gray-500 text-sm hover:text-gray-700">
            Papelera
          </Link>
          <Link
            href="/admin/forms/new"
            className="bg-brand text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-brand-light"
          >
            Nuevo formulario
          </Link>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200">
        {(forms ?? []).length === 0 ? (
          <p className="text-gray-500 text-sm p-5">No hay formularios todavía.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-gray-500 border-b border-gray-100">
                <th className="text-left px-5 py-3 font-medium">Título</th>
                <th className="text-left px-5 py-3 font-medium">Campaña</th>
                <th className="text-left px-5 py-3 font-medium">Estado</th>
                <th className="text-right px-5 py-3 font-medium">Preguntas</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody>
              {(forms ?? []).map((f) => {
                const campaign = f.campaign_id ? campaignMap[f.campaign_id] : null;
                return (
                  <tr key={f.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50">
                    <td className="px-5 py-3 font-medium text-gray-900">{f.title}</td>
                    <td className="px-5 py-3 text-gray-400 text-xs">
                      {campaign ? (
                        <Link href={`/admin/campaigns/${campaign.id}`} className="hover:text-brand hover:underline">
                          {campaign.title}
                        </Link>
                      ) : (
                        <span className="text-gray-300">Sin campaña</span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-gray-500">
                      {STATUS_LABELS[f.status] ?? f.status}
                    </td>
                    <td className="px-5 py-3 text-right text-gray-700">{f.questions.length}</td>
                    <td className="px-5 py-3 text-right">
                      <div className="flex justify-end items-center gap-3">
                        <Link href={`/admin/forms/${f.id}/builder`} className="text-brand text-xs hover:underline">
                          Editar
                        </Link>
                        <FormsActions formId={f.id} />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
