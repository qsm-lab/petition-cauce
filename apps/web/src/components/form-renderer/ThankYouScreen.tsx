"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import Image from "next/image";
import type { SocialLinks } from "@/lib/types";

interface Props {
  socialLinks?: SocialLinks;
  shareUrl?: string;
  shareText?: string;
  thankYouTitle?: string;
  thankYouBody?: string;
}

const SOCIAL_CONFIG = [
  { key: "instagram" as const, label: "Instagram",  color: "hover:border-pink-400" },
  { key: "facebook"  as const, label: "Facebook",   color: "hover:border-blue-400" },
  { key: "tiktok"    as const, label: "TikTok",     color: "hover:border-white" },
  { key: "whatsapp"  as const, label: "WhatsApp",   color: "hover:border-green-400" },
  { key: "newsletter"as const, label: "Newsletter", color: "hover:border-qsm-blue" },
  { key: "website"   as const, label: "Sitio web",  color: "hover:border-qsm-blue" },
];

const DEFAULT_TITLE = "¡Gracias por tu voz!";
const DEFAULT_BODY = "Tu participación es fundamental para la comunidad QSM. Con tus respuestas seguimos construyendo un Ecuador libre de minería irresponsable.";

const DEFAULT_SHARE_TEXT = "Participé en la encuesta de Quito Sin Minería 🌿 ¡Tú también puedes hacerlo!";

export default function ThankYouScreen({ socialLinks, shareUrl, shareText, thankYouTitle, thankYouBody }: Props) {
  const [copied, setCopied] = useState(false);
  const activeLinks = SOCIAL_CONFIG.filter(({ key }) => socialLinks?.[key]);
  const url = shareUrl || (typeof window !== "undefined" ? window.location.href : "");
  const encodedUrl = encodeURIComponent(url);
  const encodedShareText = encodeURIComponent((shareText || DEFAULT_SHARE_TEXT) + " ");

  async function handleCopy() {
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  }

  return (
    <div className="relative min-h-screen overflow-hidden">
      {/* Fondo responsive: z-0 para quedar sobre html/body pero bajo el contenido */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        <Image src="/bear/back-phone.png" alt="" fill className="object-cover md:hidden" priority />
        <Image src="/bear/back-desktop.png" alt="" fill className="object-cover hidden md:block" priority />
      </div>

      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.6 }}
        className="relative z-10 min-h-screen flex flex-col items-center justify-center px-6 py-10 pb-52 sm:pb-36 text-center max-w-sm mx-auto gap-6"
      >
        {/* logo — agrupado con el contenido */}
        <Image
          src="/logos/logo-qsm-blanco.png"
          alt="Quito Sin Minería"
          width={120}
          height={80}
          className="object-contain"
        />

        {/* check animado */}
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", stiffness: 200, delay: 0.2 }}
          className="w-20 h-20 rounded-full bg-qsm-green/20 border border-qsm-green/40 flex items-center justify-center"
        >
          <svg className="w-10 h-10 text-qsm-green" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
          </svg>
        </motion.div>

        <div className="space-y-3">
          <h1 className="font-heading font-extrabold text-white text-3xl sm:text-4xl">
            {thankYouTitle || DEFAULT_TITLE}
          </h1>
          <p className="text-white/70 font-body text-base leading-relaxed">
            {thankYouBody || DEFAULT_BODY}
          </p>
        </div>

        {/* compartir — siempre visible */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
          className="w-full"
        >
          <p className="text-white/50 font-body text-sm mb-3 uppercase tracking-wide text-xs">
            Comparte la encuesta
          </p>
          <div className="flex gap-3 justify-center">
            {/* WhatsApp */}
            <a
              href={`https://wa.me/?text=${encodedShareText}${encodedUrl}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-4 py-2.5 rounded-full bg-[#25D366]/15 border border-[#25D366]/40 text-white/80 font-body text-sm hover:bg-[#25D366]/25 transition-all"
            >
              <svg viewBox="0 0 24 24" className="w-4 h-4 fill-[#25D366]">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
                <path d="M12 0C5.373 0 0 5.373 0 12c0 2.126.553 4.124 1.522 5.855L.08 23.508a.5.5 0 00.611.611l5.653-1.442A11.945 11.945 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-1.9 0-3.68-.51-5.21-1.396l-.374-.22-3.878.99.99-3.878-.22-.374A9.956 9.956 0 012 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z"/>
              </svg>
              WhatsApp
            </a>

            {/* X / Twitter */}
            <a
              href={`https://twitter.com/intent/tweet?text=${encodedShareText}&url=${encodedUrl}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-4 py-2.5 rounded-full bg-black/30 border border-white/20 text-white/80 font-body text-sm hover:bg-white/10 transition-all"
            >
              <svg viewBox="0 0 24 24" className="w-4 h-4 fill-white">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.748l7.732-8.836L2.188 2.25h6.986l4.26 5.636L18.244 2.25zm-1.161 17.52h1.833L7.084 4.126H5.117L17.083 19.77z"/>
              </svg>
              X
            </a>

            {/* Copiar enlace */}
            <button
              onClick={handleCopy}
              className="flex items-center gap-2 px-4 py-2.5 rounded-full bg-white/8 border border-white/20 text-white/80 font-body text-sm hover:bg-white/15 transition-all"
            >
              {copied ? (
                <>
                  <svg className="w-4 h-4 text-qsm-green" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="text-qsm-green">Copiado</span>
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                  </svg>
                  Copiar
                </>
              )}
            </button>
          </div>
        </motion.div>

        {/* redes sociales de la org (opcional) */}
        {activeLinks.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="w-full"
          >
            <p className="text-white/40 font-body text-xs mb-3 uppercase tracking-wide">
              Síguenos
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              {activeLinks.map(({ key, label, color }) => (
                <a
                  key={key}
                  href={socialLinks![key]!}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`px-4 py-2 rounded-full border border-white/15 bg-white/5 text-white/70 font-body text-xs transition-all hover:bg-white/10 ${color}`}
                >
                  {label}
                </a>
              ))}
            </div>
          </motion.div>
        )}
        <p className="text-white/20 text-xs font-body text-center">
          Colectivo ciudadano #QuitoSinMinería | 2026
        </p>
      </motion.div>

      {/* Oso de espaldas — bottom left */}
      <motion.div
        initial={{ opacity: 0, y: 60 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, ease: "easeOut", delay: 0.5 }}
        className="absolute bottom-0 left-0 z-0 w-2/5 sm:w-1/3 md:w-72 pointer-events-none select-none"
      >
        <Image
          src="/bear/osoback_v2.png"
          alt=""
          width={300}
          height={400}
          className="w-full object-contain object-bottom"
        />
      </motion.div>

      {/* Firma + créditos — bottom right */}
      <div className="absolute bottom-4 right-4 z-10 flex flex-col items-end gap-1.5">
        <Image
          src="/bear/firma-art.png"
          alt="Ani Jervis"
          width={80}
          height={50}
          className="object-contain opacity-75"
        />
        <p className="text-white/45 text-xs font-body text-right max-w-[180px] leading-relaxed">
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
      </div>
    </div>
  );
}
