"use client";

import { motion } from "framer-motion";

interface Props {
  current: number;
  total: number;
}

export default function ProgressBar({ current, total }: Props) {
  const pct = total > 0 ? Math.round((current / total) * 100) : 0;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-[60] h-1 bg-white/10">
      <motion.div
        className="h-full bg-qsm-green"
        initial={false}
        animate={{ width: `${pct}%` }}
        transition={{ duration: 0.4, ease: "easeOut" }}
      />
    </div>
  );
}
