interface Stats {
  total_opened: number;
  total_completed: number;
  total_abandoned: number;
  completion_rate: number;
  avg_time_seconds: number;
}

interface Props {
  stats: Stats;
}

export default function CampaignStats({ stats }: Props) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      <StatCard label="Abiertos" value={stats.total_opened} />
      <StatCard label="Completados" value={stats.total_completed} />
      <StatCard label="Abandonados" value={stats.total_abandoned} />
      <StatCard label="Tasa completación" value={`${stats.completion_rate}%`} />
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-white border rounded-xl p-4">
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
    </div>
  );
}
