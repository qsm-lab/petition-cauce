"use client";

import { useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useTypewriter } from "@/hooks/useTypewriter";

interface Props {
  text: string;
  visible: boolean;
  speed?: number;
  awaitingAdvance?: boolean;
  onDone?: () => void;
}

function BubbleContent({
  text,
  speed,
  awaitingAdvance,
  onDone,
}: {
  text: string;
  speed: number;
  awaitingAdvance: boolean;
  onDone?: () => void;
}) {
  const { displayed, done } = useTypewriter(text, speed);

  useEffect(() => {
    if (done && onDone) onDone();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [done]);

  return (
    <p className="font-body font-bold text-[#222F5B] text-base sm:text-lg leading-relaxed text-center">
      {displayed}
      {/* Cursor parpadeante mientras escribe */}
      {!done && (
        <motion.span
          animate={{ opacity: [1, 0] }}
          transition={{ duration: 0.5, repeat: Infinity, repeatType: "reverse" }}
          className="inline-block ml-0.5 align-middle"
        >
          ▌
        </motion.span>
      )}
      {/* Flecha ▼ cuando el typewriter terminó y esperamos interacción */}
      {done && awaitingAdvance && (
        <motion.span
          animate={{ opacity: [1, 0.2] }}
          transition={{ duration: 0.7, repeat: Infinity, repeatType: "reverse" }}
          className="inline-block ml-1.5 align-middle text-[#FF5511]"
        >
          ▼
        </motion.span>
      )}
    </p>
  );
}

export default function SpeechBubble({
  text,
  visible,
  speed = 30,
  awaitingAdvance = false,
  onDone,
}: Props) {
  return (
    <AnimatePresence mode="wait">
      {visible && (
        <motion.div
          key={text}
          initial={{ opacity: 0, y: 12, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -8, scale: 0.97 }}
          transition={{ duration: 0.3, ease: "easeOut" }}
          className="relative mx-4 max-w-xs sm:max-w-sm w-full"
        >
          <div className="bg-[#F4F7F6]/90 border-[3px] border-[#FF5511] rounded-3xl px-5 py-4 shadow-lg">
            <BubbleContent
              text={text}
              speed={speed}
              awaitingAdvance={awaitingAdvance}
              onDone={onDone}
            />
          </div>

          {/* Flecha triangular hacia el oso — borde */}
          <div
            className="absolute left-1/2 -translate-x-1/2 -bottom-3 w-0 h-0"
            style={{
              borderLeft: "14px solid transparent",
              borderRight: "14px solid transparent",
              borderTop: "16px solid #FF5511",
            }}
          />
          {/* Flecha triangular — relleno */}
          <div
            className="absolute left-1/2 -translate-x-1/2 -bottom-[10px] w-0 h-0"
            style={{
              borderLeft: "11px solid transparent",
              borderRight: "11px solid transparent",
              borderTop: "13px solid #F4F7F6",
            }}
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
