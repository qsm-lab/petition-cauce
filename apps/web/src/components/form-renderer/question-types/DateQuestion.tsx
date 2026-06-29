import type { Question } from "@/lib/types";

interface Props {
  question: Question;
  value?: string;
  onChange: (v: string) => void;
}

export default function DateQuestion({ question: _q, value, onChange }: Props) {
  return (
    <input
      type="date"
      value={value || ""}
      onChange={(e) => onChange(e.target.value)}
      className="border-b-2 border-white/20 focus:border-qsm-green outline-none py-3
        text-white font-body text-lg bg-transparent transition-colors
        [color-scheme:dark]"
    />
  );
}
