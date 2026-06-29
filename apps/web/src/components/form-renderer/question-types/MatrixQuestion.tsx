"use client";

import { motion } from "framer-motion";
import type { Question } from "@/lib/types";

interface Props {
  question: Question;
  value?: Record<string, number>;
  onChange: (v: Record<string, number>) => void;
  showIncompleteWarning?: boolean;
}

export default function MatrixQuestion({ question, value = {}, onChange, showIncompleteWarning }: Props) {
  const items = (question.validation.items as string[]) || [];
  const scaleMin = (question.validation.scale_min as number) || 1;
  const scaleMax = (question.validation.scale_max as number) || 5;
  const scaleLabels = (question.validation.scale_labels as Record<string, string>) || {};
  const scale = Array.from({ length: scaleMax - scaleMin + 1 }, (_, i) => scaleMin + i);
  const answered = items.filter((item) => value[item] !== undefined).length;

  // Armar leyenda de etiquetas como texto libre (ej: "1 = Nunca · 5 = Siempre")
  const labelParts = Object.entries(scaleLabels)
    .sort(([a], [b]) => Number(a) - Number(b))
    .map(([n, label]) => `${n} = ${label}`);

  function handleChange(item: string, score: number) {
    onChange({ ...value, [item]: score });
  }

  return (
    <div className="w-full">
      {/* Leyenda de escala — visible en mobile y desktop como descripción */}
      {labelParts.length > 0 && (
        <p className="text-white/55 font-body text-xs mb-4 leading-relaxed">
          {labelParts.join(" · ")}
        </p>
      )}

      <div className="space-y-2">
        {items.map((item, rowIdx) => {
          const rowAnswered = value[item] !== undefined;
          return (
            <motion.div
              key={item}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: rowIdx * 0.04 }}
              className={`rounded-xl border px-4 py-3 transition-colors ${
                rowAnswered
                  ? "bg-qsm-green/8 border-qsm-green/30"
                  : "bg-white/5 border-white/10"
              }`}
            >
              {/* desktop — número dentro de cada círculo */}
              <div
                className="hidden sm:grid items-center gap-2"
                style={{ gridTemplateColumns: `1fr repeat(${scale.length}, 2.5rem)` }}
              >
                <span className={`font-body text-sm ${rowAnswered ? "text-white" : "text-white/70"}`}>{item}</span>
                {scale.map((n) => (
                  <button
                    key={n}
                    onClick={() => handleChange(item, n)}
                    className="mx-auto"
                    aria-label={`${item}: ${scaleLabels[String(n)] || String(n)}`}
                  >
                    <span className={`w-8 h-8 rounded-full border-2 flex items-center justify-center text-xs font-heading font-bold transition-all ${
                      value[item] === n
                        ? "border-qsm-green bg-qsm-green text-white"
                        : "border-white/30 text-white/40 hover:border-qsm-green/60 hover:text-white/70"
                    }`}>
                      {n}
                    </span>
                  </button>
                ))}
              </div>

              {/* móvil — número dentro de cada círculo */}
              <div className="sm:hidden">
                <p className={`font-body text-sm mb-3 ${rowAnswered ? "text-white" : "text-white/70"}`}>{item}</p>
                <div className="flex justify-between items-center">
                  {scale.map((n) => (
                    <button
                      key={n}
                      onClick={() => handleChange(item, n)}
                      aria-label={`${item}: ${scaleLabels[String(n)] || String(n)}`}
                    >
                      <span className={`w-9 h-9 rounded-full border-2 flex items-center justify-center text-xs font-heading font-bold transition-all ${
                        value[item] === n
                          ? "border-qsm-green bg-qsm-green text-white"
                          : "border-white/30 text-white/40"
                      }`}>
                        {n}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* contador de completitud */}
      <div className="flex items-center justify-between mt-3 px-1">
        <div className="flex items-center gap-2">
          <div className="h-1.5 w-32 bg-white/10 rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-qsm-green rounded-full"
              animate={{ width: `${(answered / items.length) * 100}%` }}
              transition={{ duration: 0.3 }}
            />
          </div>
          <span className="text-white/40 font-body text-xs">
            {answered}/{items.length}
          </span>
        </div>
      </div>

      {showIncompleteWarning && answered < items.length && (
        <motion.p
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-qsm-orange/80 font-body text-xs mt-2"
        >
          Por favor califica todos los ítems antes de continuar.
        </motion.p>
      )}
    </div>
  );
}
