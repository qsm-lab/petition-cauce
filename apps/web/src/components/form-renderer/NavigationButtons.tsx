"use client";

import { motion } from "framer-motion";

interface Props {
  onPrev?: () => void;
  onNext?: () => void;
  onSubmit?: () => void;
  submitting?: boolean;
  canProceed?: boolean;
  inline?: boolean;
}

function Buttons({ onPrev, onNext, onSubmit, submitting, canProceed = true }: Omit<Props, "inline">) {
  return (
    <>
      {onPrev && (
        <motion.button
          onClick={onPrev}
          whileTap={{ scale: 0.97 }}
          className="shrink-0 px-5 py-3.5 rounded-full border border-white/25 text-white/70 font-body text-sm hover:border-white/50 hover:text-white transition-colors whitespace-nowrap"
        >
          ← Anterior
        </motion.button>
      )}
      {onNext && (
        <motion.button
          onClick={onNext}
          whileTap={{ scale: 0.97 }}
          className={`flex-1 py-3.5 rounded-full font-heading font-bold text-base text-center transition-colors ${
            canProceed ? "bg-qsm-green text-white" : "bg-qsm-green/40 text-white/60"
          }`}
        >
          Siguiente →
        </motion.button>
      )}
      {onSubmit && (
        <motion.button
          onClick={onSubmit}
          disabled={submitting || !canProceed}
          whileTap={{ scale: submitting || !canProceed ? 1 : 0.97 }}
          className="flex-1 py-3.5 rounded-full bg-qsm-green text-white font-heading font-bold text-base text-center transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {submitting ? "Enviando…" : "Enviar respuesta ✓"}
        </motion.button>
      )}
    </>
  );
}

export default function NavigationButtons({ onPrev, onNext, onSubmit, submitting, canProceed = true, inline = false }: Props) {
  if (inline) {
    // Desktop: botones inline, ancho completo para que flex-1 funcione
    return (
      <div className="flex items-center gap-3 mt-8 mb-4 w-full">
        <Buttons onPrev={onPrev} onNext={onNext} onSubmit={onSubmit} submitting={submitting} canProceed={canProceed} />
      </div>
    );
  }

  // Mobile: fijo al fondo con fondo sólido (sin transparencia para que nada se vea detrás)
  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-[#01004d]">
      {/* gradiente que sube por encima del área de botones */}
      <div className="absolute bottom-full left-0 right-0 h-20 pointer-events-none"
        style={{ background: "linear-gradient(to top, #01004d 0%, transparent 100%)" }}
      />
      <div className="max-w-2xl mx-auto px-5 sm:px-8 pb-6 pt-3 flex items-center gap-3">
        <Buttons onPrev={onPrev} onNext={onNext} onSubmit={onSubmit} submitting={submitting} canProceed={canProceed} />
      </div>
    </div>
  );
}
