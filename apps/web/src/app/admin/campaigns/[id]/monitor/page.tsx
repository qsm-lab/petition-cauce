import { apiServer } from "@/lib/api-server";
import { Campaign, CampaignStats } from "@/lib/types";
import Link from "next/link";

interface Props {
  params: { id: string };
}

function formatSeconds(secs: number): string {
  if (secs < 60) return `${secs}s`;
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return s > 0 ? `${m}m ${s}s` : `${m}m`;
}

export default async function MonitorPage({ params }: Props) {
  const [campaign, stats] = await Promise.all([
    apiServer<Campaign>(`/v1/campaigns/${params.id}`),
    apiServer<CampaignStats>(`/v1/dashboard/campaigns/${params.id}/stats`),
  ]);

  if (!campaign || !stats) {
    return (
      <div className="text-gray-500 text-sm">
        No se pudieron cargar las métricas.{" "}
        <Link href="/admin/campaigns" className="text-brand hover:underline">
          Volver
        </Link>
      </div>
    );
  }

  const maxOvertime = Math.max(...stats.responses_over_time.map((r) => r.count), 1);
  const maxAbandonment = Math.max(...stats.abandonment_by_question.map((r) => r.count), 1);

  return (
    <div>
      <div className="flex items-center gap-2 text-sm text-gray-500 mb-6">
        <Link href="/admin/campaigns" className="hover:text-gray-900">Campañas</Link>
        <span>/</span>
        <Link href={`/admin/campaigns/${campaign.id}`} className="hover:text-gray-900">{campaign.title}</Link>
        <span>/</span>
        <span className="text-gray-900">Métricas</span>
      </div>

      <h1 className="text-2xl font-bold text-gray-900 mb-6">Métricas — {campaign.title}</h1>

      <div className="grid grid-cols-4 gap-4 mb-8">
        <StatCard label="Total abiertos" value={stats.total_opened} />
        <StatCard label="Completados" value={stats.total_completed} />
        <StatCard label="Abandonados" value={stats.total_abandoned} />
        <StatCard label="Tasa de compl." value={`${stats.completion_rate}%`} />
      </div>

      <div className="grid grid-cols-2 gap-6 mb-6">
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="font-semibold text-gray-900 mb-4">Respuestas por día</h2>
          {stats.responses_over_time.length === 0 ? (
            <p className="text-sm text-gray-400">Sin datos todavía.</p>
          ) : (
            <div className="space-y-2">
              {stats.responses_over_time.map((row) => (
                <div key={row.date} className="flex items-center gap-3 text-sm">
                  <span className="text-gray-500 w-24 shrink-0 text-xs">{row.date}</span>
                  <div className="flex-1 bg-gray-100 rounded-full h-2">
                    <div
                      className="bg-brand h-2 rounded-full"
                      style={{ width: `${(row.count / maxOvertime) * 100}%` }}
                    />
                  </div>
                  <span className="text-gray-700 w-6 text-right text-xs">{row.count}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="font-semibold text-gray-900 mb-4">Plataforma de origen</h2>
          {Object.keys(stats.responses_by_platform).length === 0 ? (
            <p className="text-sm text-gray-400">Sin datos todavía.</p>
          ) : (
            <table className="w-full text-sm">
              <tbody>
                {Object.entries(stats.responses_by_platform).map(([platform, count]) => (
                  <tr key={platform} className="border-b border-gray-50 last:border-0">
                    <td className="py-2 text-gray-600 capitalize">{platform}</td>
                    <td className="py-2 text-right text-gray-900 font-medium">{count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-5 mb-6">
        <h2 className="font-semibold text-gray-900 mb-1">Abandono por pregunta</h2>
        <p className="text-xs text-gray-400 mb-4">Número de usuarios que dejaron el formulario en cada pregunta.</p>
        {stats.abandonment_by_question.length === 0 ? (
          <p className="text-sm text-gray-400">Sin abandonos registrados.</p>
        ) : (
          <div className="flex gap-2 items-end h-24">
            {stats.abandonment_by_question.map((row) => (
              <div key={row.question_index} className="flex flex-col items-center gap-1 flex-1 min-w-0">
                <span className="text-xs text-gray-500">{row.count}</span>
                <div
                  className="w-full bg-red-200 rounded-sm"
                  style={{ height: `${(row.count / maxAbandonment) * 80}%`, minHeight: 4 }}
                />
                <span className="text-xs text-gray-400">P{row.question_index + 1}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h2 className="font-semibold text-gray-900 mb-1">Tiempo promedio</h2>
        <p className="text-3xl font-bold text-gray-900 mt-2">
          {stats.avg_time_seconds > 0 ? formatSeconds(stats.avg_time_seconds) : "—"}
        </p>
        <p className="text-sm text-gray-500 mt-1">Por respuesta completada</p>
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <p className="text-sm text-gray-500">{label}</p>
      <p className="text-3xl font-bold text-gray-900 mt-1">{value}</p>
    </div>
  );
}
