import type { Question } from "@/lib/types";

interface Props {
  question: Question;
  onChange: (q: Partial<Question>) => void;
}

export default function QuestionEditor({ question, onChange }: Props) {
  return (
    <div className="space-y-4">
      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1">Código</label>
        <input
          value={question.code}
          onChange={(e) => onChange({ code: e.target.value })}
          className="w-full border rounded px-3 py-1.5 text-sm"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1">Pregunta</label>
        <textarea
          value={question.label}
          onChange={(e) => onChange({ label: e.target.value })}
          rows={3}
          className="w-full border rounded px-3 py-1.5 text-sm resize-none"
        />
      </div>
      <div className="flex gap-4">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={question.is_required}
            onChange={(e) => onChange({ is_required: e.target.checked })}
          />
          Obligatoria
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={question.is_pii}
            onChange={(e) => onChange({ is_pii: e.target.checked })}
          />
          Datos personales (PII)
        </label>
      </div>
    </div>
  );
}
