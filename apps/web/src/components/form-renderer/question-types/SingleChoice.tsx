"use client";

import { motion } from "framer-motion";
import type { Question, AnswerInput } from "@/lib/types";

interface Props {
  question: Question;
  value?: string;
  otherText?: string;
  onChange: (v: Partial<AnswerInput>) => void;
}

const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

export default function SingleChoice({ question, value, otherText, onChange }: Props) {
  const otherOpt = question.options.find((o) => o.meta?.is_other === true);

  function handleSelect(optValue: string) {
    onChange({ value_choice: optValue });
  }

  function handleOtherText(text: string) {
    onChange({ value_choice: value, value_other_text: text.slice(0, 50) });
  }

  return (
    <div className="space-y-3">
      {question.options.map((opt, i) => {
        const selected = value === opt.value;
        const isOther = opt.meta?.is_other === true;

        if (isOther && selected) {
          return (
            <motion.div
              key={opt.id}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.04, duration: 0.25 }}
              className="w-full px-4 py-3.5 rounded-xl border-2 border-qsm-green bg-qsm-green/15"
            >
              <span className="flex items-center gap-3">
                <span className="w-7 h-7 rounded-md shrink-0 flex items-center justify-center text-xs font-heading font-bold bg-qsm-green text-white">
                  {LETTERS[i]}
                </span>
                <input
                  type="text"
                  maxLength={50}
                  value={otherText || ""}
                  onChange={(e) => handleOtherText(e.target.value)}
                  placeholder="Especifica tu respuesta…"
                  autoFocus
                  className="flex-1 bg-transparent text-white font-body text-base sm:text-lg placeholder-white/40 outline-none"
                />
                {(otherText || "").length > 0 && (
                  <span className="text-white/35 font-body text-xs shrink-0">
                    {(otherText || "").length}/50
                  </span>
                )}
              </span>
            </motion.div>
          );
        }

        return (
          <motion.button
            key={opt.id}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.04, duration: 0.25 }}
            onClick={() => handleSelect(opt.value)}
            className={`w-full text-left px-4 py-3.5 rounded-xl border-2 transition-all font-body text-base sm:text-lg ${
              selected
                ? "border-qsm-green bg-qsm-green/15 text-white"
                : "border-white/15 bg-white/5 text-white/80 hover:border-qsm-green/50 hover:bg-white/8"
            }`}
          >
            <span className="flex items-center gap-3">
              <span className={`w-7 h-7 rounded-md shrink-0 flex items-center justify-center text-xs font-heading font-bold transition-colors ${
                selected ? "bg-qsm-green text-white" : "bg-white/10 text-white/50"
              }`}>
                {LETTERS[i]}
              </span>
              <span className="flex-1">{opt.label}</span>
              {selected && (
                <motion.span
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="shrink-0 w-5 h-5 rounded-full bg-qsm-green flex items-center justify-center"
                >
                  <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                </motion.span>
              )}
            </span>
          </motion.button>
        );
      })}
    </div>
  );
}
