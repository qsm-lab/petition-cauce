interface DataPoint {
  date: string;
  count: number;
}

interface Props {
  data: DataPoint[];
}

export default function CompletionChart({ data }: Props) {
  if (!data.length) return <p className="text-gray-400 text-sm">Sin datos todavía.</p>;

  const max = Math.max(...data.map((d) => d.count), 1);

  return (
    <div className="flex items-end gap-1 h-32">
      {data.map((d) => (
        <div key={d.date} className="flex-1 flex flex-col items-center gap-1">
          <div
            className="w-full bg-brand rounded-t"
            style={{ height: `${(d.count / max) * 100}%` }}
            title={`${d.date}: ${d.count}`}
          />
          <span className="text-xs text-gray-400 rotate-45 origin-left">{d.date.slice(5)}</span>
        </div>
      ))}
    </div>
  );
}
