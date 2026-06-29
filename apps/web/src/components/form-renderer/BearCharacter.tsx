"use client";

import { useRef } from "react";
import Image from "next/image";
import { motion, useReducedMotion } from "framer-motion";

export type BearPhase = "entering" | "dialog-1" | "cta" | "exiting";

interface Props {
  phase: BearPhase;
  onEntered: () => void;
  onExited: () => void;
}

export default function BearCharacter({ phase, onEntered, onExited }: Props) {
  const shouldReduce = useReducedMotion() ?? false;

  const initialPhase = useRef(phase).current;
  const startOffScreen = initialPhase === "entering" && !shouldReduce;

  // En CTA y exiting el oso baja hasta nivel de nariz
  const isLowered = (phase === "cta" || phase === "exiting") && !shouldReduce;
  const isExiting  = phase === "exiting";

  function handleAnimationComplete() {
    if (phase === "entering") onEntered();
    if (phase === "exiting")  onExited();
  }

  const animate = isExiting
    ? { y: shouldReduce ? 0 : 280, opacity: 0, scale: 1 }
    : isLowered
      ? { y: 120, opacity: 1, scale: 1 }
      : { y: 0,   opacity: 1, scale: 1 };

  const transition = isExiting
    ? { duration: 0.6, ease: "easeIn" }
    : isLowered
      ? { type: "spring" as const, stiffness: 100, damping: 15 }
      : { type: "spring" as const, stiffness: 200, damping: 12 };

  return (
    <motion.div
      initial={{
        y:       startOffScreen ? 420 : 0,
        opacity: startOffScreen ? 0   : 1,
        scale:   startOffScreen ? 0.85 : 1,
      }}
      animate={animate}
      transition={transition}
      onAnimationComplete={handleAnimationComplete}
      className="w-full"
    >
      {/* translate-y desplaza la imagen hacia abajo → torso oculto bajo el viewport */}
      <Image
        src="/bear/oso-qsm.png"
        alt=""
        width={781}
        height={753}
        priority
        className="w-full md:max-w-sm md:mx-auto block translate-y-[35%] md:translate-y-[40%] select-none pointer-events-none"
      />
    </motion.div>
  );
}
