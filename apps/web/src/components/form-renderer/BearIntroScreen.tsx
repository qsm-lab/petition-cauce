"use client";

import { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import type { Campaign, Form } from "@/lib/types";
import BearCharacter, { type BearPhase } from "./BearCharacter";
import SpeechBubble from "./SpeechBubble";

interface Props {
  campaign: Campaign;
  form: Form;
  questionCount: number;
  onStart: () => void;
}

const AUTO_ADVANCE_MS = 10000;
const BUBBLE_DELAY_MS  = 600; // retardo antes de mostrar el globo tras entrar el oso

const STATUS_CONFIGS: Record<string, { label: string; className: string }> = {
  draft:     { label: "EN EDICIÓN",       className: "bg-white/8 border border-white/25 text-white/55" },
  active:    { label: "ACTIVO · PRUEBAS", className: "bg-yellow-400/15 border border-yellow-400/50 text-yellow-300" },
  online:    { label: "ENCUESTA ABIERTA", className: "bg-qsm-green/20 border border-qsm-green/70 text-qsm-green" },
  completed: { label: "CONCLUIDA",        className: "bg-red-500/15 border border-red-400/50 text-red-300" },
  archived:  { label: "ARCHIVADA",        className: "bg-white/5 border border-white/15 text-white/30" },
};

const BG_FALLBACK = "#050a18";

const TITLE_SIZE_MAP: Record<string, string> = {
  xl:    "text-xl",
  "2xl": "text-2xl",
  "3xl": "text-3xl sm:text-4xl",
  "4xl": "text-4xl sm:text-5xl",
  "5xl": "text-5xl sm:text-6xl",
};

const SLOGAN_SIZE_MAP: Record<string, string> = {
  xl:    "text-xl",
  "2xl": "text-2xl sm:text-3xl",
  "3xl": "text-3xl sm:text-4xl",
  "4xl": "text-4xl sm:text-5xl",
  "5xl": "text-5xl sm:text-6xl",
};

const DEFAULT_DESCRIPTION =
  "¡Claro, sabía que ibas a estar aquí dándonos una mano! Queremos escucharte. Esta encuesta nos ayuda a entender cómo se siente la comunidad de QSM, qué piensas del trabajo que hacemos y cómo ves el futuro del Ecuador frente al extractivismo.";

export default function BearIntroScreen({ campaign, form, questionCount, onStart }: Props) {
  const storageKey  = `qsm-intro-${campaign.slug}`;
  const dialogText  = campaign.welcome_description ?? DEFAULT_DESCRIPTION;

  const prefersReducedMotion = useReducedMotion() ?? false;

  // null = aún no hidratado (evita mismatch SSR/cliente)
  const [phase,          setPhase]          = useState<BearPhase | null>(null);
  const [awaitingAdvance, setAwaitingAdvance] = useState(false);
  // showBubble: false hasta que pase BUBBLE_DELAY_MS desde que el oso termina de entrar
  const [showBubble, setShowBubble] = useState(false);

  // Fase inicial: se determina en el cliente tras hidratación
  useEffect(() => {
    if (window.location.search.includes("reset-intro")) {
      localStorage.removeItem(storageKey);
    }
    const seen = !!localStorage.getItem(storageKey);
    setPhase(seen ? "cta" : "entering");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Delay del globo: aparece 1.5s después de que el oso llega
  useEffect(() => {
    if (phase !== "dialog-1") {
      setShowBubble(false);
      return;
    }
    const t = setTimeout(() => setShowBubble(true), BUBBLE_DELAY_MS);
    return () => clearTimeout(t);
  }, [phase]);

  // Escribir localStorage al llegar a CTA
  useEffect(() => {
    if (phase === "cta") {
      try { localStorage.setItem(storageKey, "1"); } catch { /* storage bloqueado */ }
    }
  }, [phase, storageKey]);

  // Avance desde dialog-1: tecla / tap / auto 6s
  const advanceToCta = useCallback(() => {
    setAwaitingAdvance(false);
    setPhase("cta");
  }, []);

  useEffect(() => {
    if (!awaitingAdvance) return;

    const timer    = setTimeout(advanceToCta, AUTO_ADVANCE_MS);
    const onKey   = () => { clearTimeout(timer); advanceToCta(); };
    const onTouch = () => { clearTimeout(timer); advanceToCta(); };

    window.addEventListener("keydown", onKey, { once: true });
    // Retraso antes de registrar touchstart para evitar que el gesto que
    // disparó el fin del typewriter avance inmediatamente a CTA.
    const touchTimer = setTimeout(() => {
      document.addEventListener("touchstart", onTouch, { once: true });
    }, 400);

    return () => {
      clearTimeout(timer);
      clearTimeout(touchTimer);
      window.removeEventListener("keydown",     onKey);
      document.removeEventListener("touchstart", onTouch);
    };
  }, [awaitingAdvance, advanceToCta]);

  // canStart necesita estar antes del useEffect que lo usa (y antes del early return)
  const canStart = campaign.status === "active" || campaign.status === "online";

  function handleBearEntered() { setPhase("dialog-1"); }
  function handleTypingDone()  { setAwaitingAdvance(true); }
  function handleBearExited()  { onStart(); }
  function handleBeginClick()  { if (phase === "cta") setPhase("exiting"); }

  // Fallback para iOS con "Reduce Motion" activo: framer-motion no dispara
  // onAnimationComplete cuando initial === animate (nada que animar).
  // Este efecto fuerza el avance de fase a los 50ms si no ocurrió de forma natural.
  useEffect(() => {
    if (!prefersReducedMotion) return;
    if (phase !== "entering" && phase !== "exiting") return;
    const t = setTimeout(() => {
      if (phase === "entering") handleBearEntered();
      else if (phase === "exiting") handleBearExited();
    }, 50);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, prefersReducedMotion]);

  // Enter → "Comenzar encuesta" cuando el CTA está visible (desktop)
  useEffect(() => {
    if (phase !== "cta" || !canStart) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Enter") handleBeginClick();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, canStart]);

  // Solo fondo durante la hidratación
  if (phase === null) {
    return (
      <div className="fixed inset-0 z-0">
        <Image src="/bear/back-phone.png" alt="" fill className="object-cover md:hidden" priority />
        <Image src="/bear/back-desktop.png" alt="" fill className="object-cover hidden md:block" priority />
      </div>
    );
  }
  const mins        = Math.max(1, Math.round(questionCount * 20 / 60));
  const isAnonymous = !form.questions.some((q) => q.is_pii);
  const statusCfg   = STATUS_CONFIGS[campaign.status] ?? STATUS_CONFIGS.draft;
  const titleSize   = TITLE_SIZE_MAP[campaign.welcome_title_size  ?? "3xl"] ?? "text-3xl sm:text-4xl";
  const sloganSize  = SLOGAN_SIZE_MAP[campaign.welcome_slogan_size ?? "2xl"] ?? "text-2xl sm:text-3xl";
  const titleColor  = campaign.welcome_title_color  ?? "#FFFFFF";
  const sloganColor = campaign.welcome_slogan_color ?? "#FFFFFF";

  const showCta  = phase === "cta" || phase === "exiting";
  const isExiting = phase === "exiting";

  // Logo: 70% durante diálogo, 90% en CTA
  const logoOpacity = showCta ? 0.9 : 0.7;

  return (
    <div className="relative min-h-[100dvh] flex flex-col items-center overflow-hidden">
      {/* Fondo fijo: z-0 para quedar sobre html/body pero bajo el contenido */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        <Image src="/bear/back-phone.png" alt="" fill className="object-cover md:hidden" priority />
        <Image src="/bear/back-desktop.png" alt="" fill className="object-cover hidden md:block" priority />
      </div>

      {/* Zona superior: logo + contenido CTA */}
      <div className="relative z-10 w-full flex flex-col items-center px-6 pt-10 sm:pt-8 flex-1">

        {/* Logo — opacidad variable según fase */}
        <motion.div
          initial={{ opacity: phase === "cta" ? 0.9 : 0 }}
          animate={{ opacity: logoOpacity }}
          transition={{ duration: 0.4 }}
          className="mb-6 flex justify-center"
        >
          {campaign.welcome_logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={campaign.welcome_logo_url}
              alt="Logo"
              width={200}
              height={70}
              className="object-contain"
            />
          ) : (
            <Image
              src="/logos/logo-qsm-v2-white.png"
              alt="Quito Sin Minería"
              width={130}
              height={46}
              className="object-contain"
              priority
            />
          )}
        </motion.div>

        {/* Badge de estado + título + slogan + pills — centrado verticalmente en espacio disponible */}
        <div className="flex-1 flex flex-col items-center justify-center w-full pb-32 sm:pb-44">
        <AnimatePresence>
          {showCta && (
            <motion.div
              key="cta-content"
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.5, delay: 0.15 }}
              className="flex flex-col items-center gap-4 text-center w-full max-w-sm"
            >
              <span className={`inline-block text-xs font-body font-semibold tracking-widest uppercase px-5 py-1.5 rounded-full ${statusCfg.className}`}>
                {statusCfg.label}
              </span>

              <h1
                className={`font-brush ${titleSize} leading-tight uppercase w-full text-center`}
                style={{ color: titleColor }}
              >
                {campaign.welcome_title ?? "Ahora es tu turno"}
              </h1>

              <p
                className={`font-brush ${sloganSize} uppercase tracking-wide w-full text-center`}
                style={{ color: sloganColor }}
              >
                {campaign.welcome_slogan ?? "Cada respuesta cuenta"}
              </p>

              {/* Pills debajo del texto */}
              <div className="flex items-center gap-4 mt-1">
                <div className="flex items-center gap-2 bg-[#0A1128] rounded-full px-4 py-2">
                  <Image src="/icons/timer.svg" alt="" width={20} height={20} />
                  <span className="text-qsm-blue font-body text-sm">~{mins} min</span>
                </div>
                {isAnonymous && (
                  <div className="flex items-center gap-2 bg-[#0A1128] rounded-full px-4 py-2">
                    <Image src="/icons/shield-lock.svg" alt="" width={20} height={20} />
                    <span className="text-qsm-blue font-body text-sm">anónimo</span>
                  </div>
                )}
              </div>

              {/* Mensaje cuando la campaña no está activa */}
              {!canStart && (
                <div className="mt-2 px-6 py-3 rounded-2xl border border-white/20 bg-white/5 text-white/50 font-body text-sm text-center">
                  {campaign.status === "completed"
                    ? "Esta encuesta ya ha concluido. Gracias por tu interés."
                    : "Este formulario está en edición y no está disponible aún."}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
        </div>
      </div>

      {/* Botón "Comenzar encuesta" — z-30 (sobre el oso), sube desde área del oso */}
      <AnimatePresence>
        {showCta && canStart && (
          <motion.div
            className="absolute left-0 right-0 bottom-48 sm:bottom-40 z-30 flex justify-center px-6"
            initial={{ y: 120, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{
              y:       { type: "spring", stiffness: 180, damping: 20, delay: 0.3 },
              opacity: { duration: 0.5, delay: 0.2 },
            }}
          >
            <motion.button
              onClick={handleBeginClick}
              disabled={isExiting}
              whileHover={isExiting ? {} : { scale: 1.03 }}
              whileTap={isExiting ? {} : { scale: 0.97 }}
              className="w-full max-w-xs py-4 bg-qsm-orange text-white font-heading font-bold text-lg rounded-full shadow-lg hover:bg-orange-500 transition-colors disabled:opacity-70 disabled:cursor-not-allowed"
            >
              Comenzar encuesta ›
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Zona inferior: oso + globo a altura de orejas — z-20 */}
      <div className="absolute bottom-0 left-0 right-0 z-20">
        {/* Globo posicionado a altura de orejas del oso */}
        <div className="absolute bottom-[250px] left-0 right-0 flex justify-center px-4">
          <SpeechBubble
            text={dialogText}
            visible={showBubble}
            awaitingAdvance={awaitingAdvance}
            onDone={handleTypingDone}
          />
        </div>

        <BearCharacter
          phase={phase}
          onEntered={handleBearEntered}
          onExited={handleBearExited}
        />
      </div>

      {/* Créditos del artista — solo desktop, fase CTA */}
      <AnimatePresence>
        {showCta && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5, delay: 0.4 }}
            className="hidden md:flex absolute bottom-5 right-6 z-30 flex-col items-end gap-1.5 pointer-events-auto"
          >
            <Image
              src="/bear/firma-art.png"
              alt="Ani Jervis"
              width={90}
              height={56}
              className="object-contain opacity-80"
            />
            <p className="text-white/45 text-xs font-body text-right max-w-[210px] leading-relaxed">
              El Osito Serafín del libro &ldquo;Hay Miel Para Todos&rdquo;, ilustración de{" "}
              <a
                href="https://linktr.ee/anijervis"
                target="_blank"
                rel="noopener noreferrer"
                className="text-white/65 underline hover:text-white transition-colors"
              >
                Ani Jervis
              </a>
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
