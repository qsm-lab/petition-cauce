"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import Image from "next/image";

interface Props {
  text: string;
  requiresConsent: boolean;
  consentText?: string | null;
  onAccept: () => void;
}

export default function PrivacyNotice({ text, requiresConsent, consentText, onAccept }: Props) {
  const [accepted, setAccepted] = useState(false);
  const canAccept = !requiresConsent || accepted;

  // Bloqueo de interacción en los primeros 500ms para evitar "ghost touches"
  // provenientes de la pantalla anterior.
  const [interactionReady, setInteractionReady] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setInteractionReady(true), 500);
    return () => clearTimeout(t);
  }, []);

  // Enter → continuar (solo cuando canAccept e interactionReady)
  useEffect(() => {
    if (!canAccept) return;
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === "Enter") {
        if (!interactionReady) return;
        onAccept();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [canAccept, interactionReady, onAccept]);

  return (
    <div className="relative min-h-screen flex flex-col items-center justify-center px-6 py-10 pb-28">
      {/* Fondo responsive */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        <Image src="/bear/back-phone.png" alt="" fill className="object-cover md:hidden" priority />
        <Image src="/bear/back-desktop.png" alt="" fill className="object-cover hidden md:block" priority />
      </div>

      {/* espacio seguro superior */}
      <div className="h-8 shrink-0 w-full relative z-10" />
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="relative z-10 w-full max-w-lg"
      >
        <div className="mb-8 flex justify-center">
          <Image
            src="/logos/logo-horizontal-white.png"
            alt="Quito Sin Minería"
            width={140}
            height={46}
            className="object-contain opacity-80"
          />
        </div>

        <div className="bg-qsm-navy rounded-card p-6 sm:p-8 shadow-navy-md">
          <h2 className="font-heading font-bold text-white text-xl mb-4">
            Aviso de privacidad
          </h2>

          {text && (
            <p className="text-white/70 font-body text-sm leading-relaxed mb-6 whitespace-pre-wrap">
              {text}
            </p>
          )}

          {requiresConsent && consentText && (
            <label className="flex items-start gap-3 cursor-pointer p-4 rounded-xl border border-white/10 bg-white/5">
              <input
                type="checkbox"
                checked={accepted}
                onChange={(e) => setAccepted(e.target.checked)}
                className="mt-0.5 w-4 h-4 accent-qsm-green shrink-0"
              />
              <span className="text-white/80 font-body text-sm leading-relaxed">{consentText}</span>
            </label>
          )}
        </div>
      </motion.div>

      {/* botón Aceptar — barra fija al fondo */}
      <div className="fixed bottom-0 left-0 right-0 z-50">
        <div className="absolute inset-0 bg-gradient-to-t from-[#050a18]/95 via-[#050a18]/70 to-transparent pointer-events-none" />
        <div className="relative max-w-2xl mx-auto px-5 sm:px-8 pb-6 pt-4">
          <motion.button
            onClick={() => { if (!interactionReady) return; onAccept(); }}
            disabled={!canAccept}
            whileHover={{ scale: canAccept ? 1.02 : 1 }}
            whileTap={{ scale: canAccept ? 0.98 : 1 }}
            className="w-full py-3.5 rounded-full font-heading font-bold text-white transition-all bg-qsm-green hover:bg-brand-light disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {requiresConsent ? "Acepto y continúo →" : "Entendido, continuar →"}
          </motion.button>

          <p className="text-white/30 text-xs font-body text-center mt-3">
            Colectivo ciudadano #QuitoSinMinería | 2026
          </p>
        </div>
      </div>
    </div>
  );
}
