interface AbandonItem {
  question_code: string;
  question_label: string;
  abandonment_count: number;
}

interface Props {
  data: AbandonItem[];
}

export default function AbandonmentBySection({ data }: Props) {
  if (!data.length) return <p className="text-gray-400 text-sm">Sin abandonos registrados.</p>;

  return (
    <div className="space-y-2">
      {data.map((item) => (
        <div key={item.question_code} className="flex items-center gap-3 text-sm">
          <span className="font-mono text-xs text-gray-400 w-10">{item.question_code}</span>
          <span className="flex-1 text-gray-700 truncate">{item.question_label}</span>
          <span className="font-semibold text-gray-900">{item.abandonment_count}</span>
        </div>
      ))}
    </div>
  );
}
