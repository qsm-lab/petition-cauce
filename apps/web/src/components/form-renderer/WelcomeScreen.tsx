"use client";

import { motion } from "framer-motion";
import Image from "next/image";
import type { Campaign, Form } from "@/lib/types";

interface Props {
  campaign: Campaign;
  form: Form;
  questionCount: number;
  onStart: () => void;
}

const TITLE_SIZE_MAP: Record<string, string> = {
  xl:  "text-xl",
  "2xl": "text-2xl",
  "3xl": "text-3xl sm:text-4xl",
  "4xl": "text-4xl sm:text-5xl",
  "5xl": "text-5xl sm:text-6xl",
};

const SLOGAN_SIZE_MAP: Record<string, string> = {
  xl:  "text-xl",
  "2xl": "text-2xl sm:text-3xl",
  "3xl": "text-3xl sm:text-4xl",
  "4xl": "text-4xl sm:text-5xl",
  "5xl": "text-5xl sm:text-6xl",
};

function StatusBadge({ status }: { status: string }) {
  const configs: Record<string, { label: string; className: string }> = {
    draft:     { label: "EN EDICIÓN",      className: "bg-white/8 border border-white/25 text-white/55" },
    active:    { label: "ACTIVO · PRUEBAS", className: "bg-yellow-400/15 border border-yellow-400/50 text-yellow-300" },
    online:    { label: "EN LÍNEA",         className: "bg-qsm-green/20 border border-qsm-green/70 text-qsm-green" },
    completed: { label: "CONCLUIDA",        className: "bg-red-500/15 border border-red-400/50 text-red-300" },
    archived:  { label: "ARCHIVADA",        className: "bg-white/5 border border-white/15 text-white/30" },
  };
  const cfg = configs[status] ?? configs.draft;
  return (
    <span className={`inline-block text-xs font-body font-semibold tracking-widest uppercase px-5 py-1.5 rounded-full ${cfg.className}`}>
      {cfg.label}
    </span>
  );
}

export default function WelcomeScreen({ campaign, form, questionCount, onStart }: Props) {
  const titleSize = TITLE_SIZE_MAP[campaign.welcome_title_size ?? "3xl"] ?? "text-3xl sm:text-4xl";
  const sloganSize = SLOGAN_SIZE_MAP[campaign.welcome_slogan_size ?? "2xl"] ?? "text-2xl sm:text-3xl";
  const mins = Math.max(1, Math.round(questionCount * 20 / 60));
  const isAnonymous = !form.questions.some((q) => q.is_pii);
  const canStart = campaign.status === "active" || campaign.status === "online";

  const defaultDescription = `En Quito Sin Minería queremos escucharte. Esta encuesta nos ayuda a entender cómo se siente nuestra comunidad, qué percepción tienes del trabajo que hacemos y cómo ves el futuro del Ecuador frente al extractivismo.\n\nEs anónima, confidencial y está diseñada con cariño. La información que compartas será la base de nuestras próximas iniciativas y tú eres la parte más importante.`;

  const footerText = (
    <p className="text-white/40 text-sm sm:text-base font-body text-center">
      Colectivo ciudadano #QuitoSinMinería | 2026
    </p>
  );

  return (
    <div
      className="min-h-[100dvh] overscroll-none flex flex-col items-center px-6 pb-28 overflow-hidden"
      style={{ background: "radial-gradient(ellipse at 50% 0%, #4b355d 0%, #1a1040 50%, #01004d 100%)" }}
    >
      {/* espacio seguro superior (notch / Dynamic Island) */}
      <div className="h-12 sm:h-8 shrink-0 w-full" />

      {/* logo + badge */}
      <motion.div
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="flex flex-col items-center gap-3 pt-2 mb-6"
      >
        {campaign.welcome_logo_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={campaign.welcome_logo_url}
            alt="Logo"
            width={160}
            height={106}
            className="object-contain"
          />
        ) : (
          <Image
            src="/logos/logo-qsm-blanco.png"
            alt="Quito Sin Minería"
            width={160}
            height={106}
            className="object-contain"
            priority
          />
        )}
        <StatusBadge status={campaign.status} />
      </motion.div>

      {/* contenido central */}
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.15 }}
        className="relative z-10 text-center w-full max-w-sm md:max-w-xl mx-auto flex flex-col items-center gap-5 flex-1"
      >
        <h1 className={`font-brush text-qsm-green ${titleSize} leading-tight uppercase`}>
          {campaign.welcome_title ?? "Comunidades,\nTerritorios\ny Ciudadanos Unidos"}
        </h1>

        <div className="bg-qsm-navy rounded-3xl px-6 py-5 text-center">
          <p className="text-white font-body text-sm sm:text-base leading-relaxed whitespace-pre-line">
            {campaign.welcome_description ?? defaultDescription}
          </p>
        </div>

        <p className={`font-brush text-qsm-orange ${sloganSize} uppercase tracking-wide`}>
          {campaign.welcome_slogan ?? "Cada respuesta cuenta"}
        </p>

        <div className="flex items-center gap-4">
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

        {/* Mensaje de bloqueo cuando no es posible iniciar */}
        {!canStart && campaign.status === "completed" && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mt-2 px-6 py-3 rounded-2xl border border-red-400/30 bg-red-500/10 text-red-300 font-body text-sm text-center"
          >
            Esta encuesta ya ha concluido. Gracias por tu interés.
          </motion.div>
        )}
        {!canStart && campaign.status === "draft" && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mt-2 px-6 py-3 rounded-2xl border border-white/20 bg-white/5 text-white/50 font-body text-sm text-center"
          >
            Este formulario está en edición y no está disponible aún.
          </motion.div>
        )}

        {/* Desktop: botón inline + footer */}
        {canStart && (
          <div className="hidden md:flex flex-col items-center gap-3 mt-2">
            <motion.button
              onClick={onStart}
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              className="px-14 py-4 bg-qsm-orange text-white font-heading font-bold text-lg rounded-full shadow-lg hover:bg-orange-500 transition-colors"
            >
              Comenzar encuesta ›
            </motion.button>
            {footerText}
          </div>
        )}
        {!canStart && <div className="hidden md:block">{footerText}</div>}
      </motion.div>

      {/* Mobile: botón fijo al fondo + footer dentro del área fija */}
      {canStart && (
        <div className="fixed bottom-0 left-0 right-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-gradient-to-t from-[#01004d]/95 via-[#2a1a4a]/80 to-transparent pointer-events-none" />
          <div className="relative px-5 pb-5 pt-4 flex flex-col items-center gap-2">
            <motion.button
              onClick={onStart}
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              className="w-full py-4 bg-qsm-orange text-white font-heading font-bold text-lg rounded-full shadow-lg hover:bg-orange-500 transition-colors"
            >
              Comenzar encuesta ›
            </motion.button>
            {footerText}
          </div>
        </div>
      )}
      {/* Mobile sin botón: footer flotante */}
      {!canStart && (
        <div className="mt-6 md:hidden">{footerText}</div>
      )}
    </div>
  );
}
