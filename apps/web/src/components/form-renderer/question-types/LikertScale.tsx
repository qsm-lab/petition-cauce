"use client";

import { motion } from "framer-motion";
import type { Question } from "@/lib/types";

interface Props {
  question: Question;
  value?: number;
  onChange: (v: number) => void;
}

export default function LikertScale({ question, value, onChange }: Props) {
  const min = (question.validation.min as number) || 1;
  const max = (question.validation.max as number) || 5;
  const labels = (question.validation.labels as Record<string, string>) || {};
  const options = Array.from({ length: max - min + 1 }, (_, i) => min + i);

  const hasLabels = !!(labels[String(min)] || labels[String(max)]);

  return (
    <div className="flex flex-col items-center gap-3 pt-5 pb-2">
      {/* Etiquetas ARRIBA — solo desktop, texto legible */}
      {hasLabels && (
        <div className="hidden sm:flex w-full justify-between font-body text-sm text-white/65 px-1">
          <span>{labels[String(min)]}</span>
          <span>{labels[String(max)]}</span>
        </div>
      )}

      <div className="flex justify-center gap-2 sm:gap-3">
        {options.map((n, i) => (
          <motion.button
            key={n}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            onClick={() => onChange(n)}
            className={`w-13 h-13 sm:w-14 sm:h-14 rounded-xl border-2 font-heading font-bold text-base transition-all ${
              value === n
                ? "border-qsm-green bg-qsm-green text-white shadow-lg scale-105"
                : "border-white/20 bg-white/5 text-white/70 hover:border-qsm-green/60 hover:scale-105"
            }`}
            style={{ width: "3.25rem", height: "3.25rem" }}
          >
            {n}
          </motion.button>
        ))}
      </div>

      {/* Etiquetas ABAJO — solo mobile */}
      {hasLabels && (
        <div className="sm:hidden w-full flex justify-between font-body text-xs text-white/50 px-1">
          <span>{labels[String(min)]}</span>
          <span>{labels[String(max)]}</span>
        </div>
      )}
    </div>
  );
}
