import { apiServer } from "@/lib/api-server";
import { CampaignSummaryItem } from "@/lib/types";
import Link from "next/link";

export default async function CampaignsPage() {
  const data = await apiServer<{ campaigns: CampaignSummaryItem[] }>("/v1/dashboard/summary");
  const campaigns = data?.campaigns ?? [];

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Campañas</h1>
        <Link
          href="/admin/campaigns/new"
          className="px-4 py-2 text-sm bg-brand text-white rounded-lg hover:opacity-90 transition-opacity"
        >
          + Nueva campaña
        </Link>
      </div>

      <div className="bg-white rounded-xl border border-gray-200">
        {campaigns.length === 0 ? (
          <p className="text-gray-500 text-sm p-5">No hay campañas todavía.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-gray-500 border-b border-gray-100">
                <th className="text-left px-5 py-3 font-medium">Título</th>
                <th className="text-left px-5 py-3 font-medium">Slug</th>
                <th className="text-left px-5 py-3 font-medium">Estado</th>
                <th className="text-right px-5 py-3 font-medium">Respuestas</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody>
              {campaigns.map((c) => (
                <tr key={c.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50">
                  <td className="px-5 py-3 font-medium text-gray-900">{c.title}</td>
                  <td className="px-5 py-3 text-gray-500 font-mono text-xs">{c.slug}</td>
                  <td className="px-5 py-3">
                    <StatusBadge status={c.status} />
                  </td>
                  <td className="px-5 py-3 text-right">{c.total_responses}</td>
                  <td className="px-5 py-3 text-right space-x-4">
                    <Link href={`/admin/campaigns/${c.id}/monitor`} className="text-gray-400 text-xs hover:text-gray-700">
                      Métricas
                    </Link>
                    <Link href={`/admin/campaigns/${c.id}`} className="text-brand text-xs hover:underline">
                      Detalle
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { bg: string; label: string }> = {
    active:  { bg: "bg-green-100 text-green-700",   label: "Activa"   },
    testing: { bg: "bg-yellow-100 text-yellow-700", label: "Pruebas"  },
    draft:   { bg: "bg-gray-100 text-gray-500",      label: "Borrador" },
    closed:  { bg: "bg-red-100 text-red-700",        label: "Cerrada"  },
  };
  const { bg, label } = map[status] ?? { bg: "bg-gray-100 text-gray-500", label: status };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${bg}`}>
      {label}
    </span>
  );
}
