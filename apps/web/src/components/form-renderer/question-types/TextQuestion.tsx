import type { Question } from "@/lib/types";

interface Props {
  question: Question;
  value?: string;
  onChange: (v: string) => void;
}

export default function TextQuestion({ question, value, onChange }: Props) {
  return (
    <input
      type={question.type === "email" ? "email" : "text"}
      value={value || ""}
      onChange={(e) => onChange(e.target.value)}
      placeholder="Tu respuesta…"
      className="w-full border-b-2 border-white/20 focus:border-qsm-green outline-none py-3
        text-white text-lg font-body bg-transparent placeholder-white/30 transition-colors"
    />
  );
}
