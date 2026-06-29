"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import type { Question, QuestionOption, AnswerInput } from "@/lib/types";

interface Props {
  question: Question;
  values: string[];
  otherText?: string;
  onChange: (v: Partial<AnswerInput>) => void;
}

const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

function isOtherOption(opt: QuestionOption): boolean {
  if (opt.meta?.is_other === true) return true;
  const l = opt.label.trim().toLowerCase();
  return l === "otros" || l === "otra" || l === "other";
}

function shuffleArray<T>(arr: T[]): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export default function MultipleChoice({ question, values, otherText, onChange }: Props) {
  const maxChoices = (question.validation.max_choices as number) || 999;
  const otherOpt = question.options.find((o) => isOtherOption(o));

  const [displayOptions] = useState<QuestionOption[]>(() => {
    const regular = question.options.filter((o) => !isOtherOption(o));
    const others = question.options.filter((o) => isOtherOption(o));
    return [...shuffleArray(regular), ...others];
  });

  function toggle(value: string) {
    const newValues = values.includes(value)
      ? values.filter((v) => v !== value)
      : values.length < maxChoices
      ? [...values, value]
      : values;
    onChange({ value_choices: newValues, value_other_text: otherText });
  }

  function handleOtherText(text: string) {
    onChange({ value_choices: values, value_other_text: text.slice(0, 50) });
  }

  return (
    <div className="space-y-3">
      {maxChoices < 999 && (
        <p className="text-white/50 font-body text-xs mb-1">
          Selecciona hasta {maxChoices} opciones · {values.length}/{maxChoices}
        </p>
      )}
      {displayOptions.map((opt, i) => {
        const selected = values.includes(opt.value);
        const isOther = isOtherOption(opt);
        const blocked = !selected && values.length >= maxChoices;

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
                <button
                  onClick={() => toggle(opt.value)}
                  className="w-7 h-7 rounded-md shrink-0 flex items-center justify-center text-xs font-heading font-bold bg-qsm-green text-white hover:bg-qsm-green/75 transition-colors"
                  title="Deseleccionar"
                >
                  {LETTERS[i]}
                </button>
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
            onClick={() => toggle(opt.value)}
            disabled={blocked}
            className={`w-full text-left px-4 py-3.5 rounded-xl border-2 transition-all font-body text-base sm:text-lg ${
              selected
                ? "border-qsm-green bg-qsm-green/15 text-white"
                : blocked
                ? "border-white/8 bg-white/3 text-white/30 cursor-not-allowed"
                : "border-white/15 bg-white/5 text-white/80 hover:border-qsm-green/50 hover:bg-white/8"
            }`}
          >
            <span className="flex items-center gap-3">
              <span className={`w-7 h-7 rounded-md shrink-0 flex items-center justify-center text-xs font-heading font-bold transition-colors ${
                selected ? "bg-qsm-green text-white" : blocked ? "bg-white/5 text-white/20" : "bg-white/10 text-white/50"
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
