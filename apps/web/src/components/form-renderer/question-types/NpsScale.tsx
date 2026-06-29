"use client";

import { motion } from "framer-motion";
import type { Question } from "@/lib/types";

interface Props {
  question: Question;
  value?: number;
  onChange: (v: number) => void;
}

export default function NpsScale({ question, value, onChange }: Props) {
  const min = (question.validation.min as number) ?? 0;
  const max = (question.validation.max as number) ?? 10;
  const detractorMax = (question.validation.detractor_max as number) ?? 6;
  const promoterMin = (question.validation.promoter_min as number) ?? 9;
  const labelMin = (question.validation.label_min as string) || "No lo recomendaría";
  const labelMid = (question.validation.label_mid as string) || "Neutro";
  const labelMax = (question.validation.label_max as string) || "Lo recomendaría totalmente";
  const options = Array.from({ length: max - min + 1 }, (_, i) => min + i);

  function getColor(n: number, selected: boolean) {
    if (n <= detractorMax)
      return selected
        ? "border-qsm-orange bg-qsm-orange text-white"
        : "border-white/20 bg-white/5 text-white/70 hover:border-qsm-orange/60";
    if (n < promoterMin)
      return selected
        ? "border-qsm-blue bg-qsm-blue text-white"
        : "border-white/20 bg-white/5 text-white/70 hover:border-qsm-blue/60";
    return selected
      ? "border-qsm-green bg-qsm-green text-white"
      : "border-white/20 bg-white/5 text-white/70 hover:border-qsm-green/60";
  }

  return (
    <div>
      <div className="flex flex-wrap justify-center gap-2">
        {options.map((n, i) => (
          <motion.button
            key={n}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.03 }}
            onClick={() => onChange(n)}
            className={`w-12 h-12 rounded-xl border-2 font-heading font-bold text-sm transition-all hover:scale-105 ${getColor(n, value === n)}`}
          >
            {n}
          </motion.button>
        ))}
      </div>

      {/* etiquetas extremos */}
      <div className="flex justify-between text-white/50 font-body text-xs mt-3 px-0.5">
        <span>{labelMin}</span>
        <span>{labelMax}</span>
      </div>

      {/* rangos coloreados */}
      <div className="mt-4 flex gap-2">
        <div className="flex-1 bg-qsm-orange/10 border border-qsm-orange/20 rounded-lg px-3 py-3 sm:py-4 text-center">
          <div className="text-qsm-orange font-body text-xs font-semibold">Detractores</div>
          <div className="text-white/50 font-body text-xs mt-1">{min}–{detractorMax}</div>
        </div>
        <div className="flex-1 bg-qsm-blue/10 border border-qsm-blue/20 rounded-lg px-3 py-3 sm:py-4 text-center">
          <div className="text-qsm-blue font-body text-xs font-semibold">{labelMid}</div>
          <div className="text-white/50 font-body text-xs mt-1">{detractorMax + 1}–{promoterMin - 1}</div>
        </div>
        <div className="flex-1 bg-qsm-green/10 border border-qsm-green/20 rounded-lg px-3 py-3 sm:py-4 text-center">
          <div className="text-qsm-green font-body text-xs font-semibold">Promotores</div>
          <div className="text-white/50 font-body text-xs mt-1">{promoterMin}–{max}</div>
        </div>
      </div>
    </div>
  );
}
