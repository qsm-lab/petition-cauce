"use client";

import { motion } from "framer-motion";
import type { Question } from "@/lib/types";

interface Props {
  question: Question;
  value?: string;
  onChange: (v: string) => void;
  showMinAlert?: boolean;
}

export default function LongTextQuestion({ question, value, onChange, showMinAlert }: Props) {
  const minLength = (question.validation?.min_length as number) || 0;
  const len = (value || "").length;
  const remaining = minLength > 0 ? minLength - len : 0;
  const reachedMin = minLength === 0 || remaining <= 0;

  return (
    <div>
      <textarea
        value={value || ""}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Escribe tu respuesta aquí…"
        rows={5}
        className={`w-full border-2 rounded-xl outline-none px-4 py-3 text-white font-body text-base bg-white/5 placeholder-white/30 transition-colors resize-none ${
          showMinAlert && !reachedMin
            ? "border-qsm-orange/60 focus:border-qsm-orange"
            : "border-white/20 focus:border-qsm-green"
        }`}
      />

      <div className="flex items-center justify-between mt-1.5">
        {minLength > 0 ? (
          <p className={`text-xs font-body transition-colors ${reachedMin ? "text-qsm-green" : "text-white/40"}`}>
            {reachedMin
              ? `✓ Mínimo alcanzado`
              : `${remaining} caracteres mínimos restantes`}
          </p>
        ) : (
          <span />
        )}
        <p className="text-white/30 font-body text-xs">{len} caracteres</p>
      </div>

      {showMinAlert && !reachedMin && minLength > 0 && (
        <motion.p
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-qsm-orange/80 font-body text-xs mt-1"
        >
          Necesitas al menos {minLength} caracteres para continuar.
        </motion.p>
      )}
    </div>
  );
}
