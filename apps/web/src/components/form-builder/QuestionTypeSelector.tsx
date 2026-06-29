import type { QuestionType } from "@/lib/types";

const TYPES: { value: QuestionType; label: string }[] = [
  { value: "text", label: "Texto corto" },
  { value: "long_text", label: "Texto largo" },
  { value: "single_choice", label: "Selección única" },
  { value: "multiple_choice", label: "Selección múltiple" },
  { value: "likert_scale", label: "Escala Likert" },
  { value: "nps", label: "NPS (0-10)" },
  { value: "matrix", label: "Matriz" },
  { value: "date", label: "Fecha" },
  { value: "email", label: "Correo electrónico" },
  { value: "number", label: "Número" },
];

interface Props {
  value: QuestionType;
  onChange: (v: QuestionType) => void;
}

export default function QuestionTypeSelector({ value, onChange }: Props) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as QuestionType)}
      className="border rounded px-3 py-1.5 text-sm w-full"
    >
      {TYPES.map((t) => (
        <option key={t.value} value={t.value}>{t.label}</option>
      ))}
    </select>
  );
}
