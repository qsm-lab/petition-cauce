import type { Question } from "@/lib/types";

interface Props {
  questions: Question[];
  onSelect: (q: Question) => void;
  selectedId?: string;
}

export default function QuestionList({ questions, onSelect, selectedId }: Props) {
  return (
    <div className="space-y-1">
      {questions.map((q) => (
        <button
          key={q.id}
          onClick={() => onSelect(q)}
          className={`w-full text-left px-3 py-2 rounded text-sm transition ${
            selectedId === q.id ? "bg-brand/10 text-brand font-medium" : "hover:bg-gray-100"
          }`}
        >
          <span className="text-xs text-gray-400 mr-2">{q.code}</span>
          {q.label.length > 50 ? q.label.slice(0, 50) + "..." : q.label}
        </button>
      ))}
    </div>
  );
}
