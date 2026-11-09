"use client";

import { useEffect, useRef, useState } from "react";

import { confirmSignature } from "@/lib/signatures-api";

/** Diseño aprobado: specs/verificacion-confirmacion-privacidad/design-export.html (marcos 0–7). */

type View =
  | { kind: "antes" }
  | { kind: "enviando" }
  | { kind: "error"; cooldown: boolean }
  | { kind: "exito"; dest: string; name?: string }
  | { kind: "vencido"; dest: string }
  | { kind: "invalido" };

const REDIRECT_MS = 1500;
const COOLDOWN_MS = 5000; // tras un 429: el servidor admite 20 por minuto por IP

const campaignUrl = (slug: string, query: string) => `/c/${encodeURIComponent(slug)}?${query}`;

const BTN_BASE =
  "flex w-full min-h-[56px] items-center justify-center gap-2.5 rounded-[30px] border-[1.5px] px-6 py-[18px] " +
  "text-[18px] font-bold leading-[1.2] no-underline transition-[transform,box-shadow] duration-150 " +
  "focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-[3px] focus-visible:outline-[#12222E]";
const BTN_PRIMARY =
  "border-[var(--bink)] bg-brand-primary text-brand-on-primary hover:scale-[1.03] " +
  "hover:shadow-[0_6px_18px_rgba(22,38,31,0.18)] active:scale-[0.99]";
const BTN_SECONDARY =
  "border-[var(--bink)] bg-white text-brand-on-primary hover:scale-[1.03] " +
  "hover:shadow-[0_6px_18px_rgba(22,38,31,0.18)] active:scale-[0.99]";
const BTN_INACTIVE =
  "cursor-progress border-[rgba(22,38,31,0.25)] bg-[rgba(22,38,31,0.1)] text-[rgba(22,38,31,0.6)]";

const MUTED = "text-[rgba(22,38,31,0.72)]"; // --bmut-txt del diseño: --bmut (.55) no llega a 4,5:1 en texto pequeño

const ICON_BASE = "mx-auto mb-[18px] grid h-14 w-14 place-items-center rounded-full";
const SVG_PROPS = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  className: "h-[26px] w-[26px]",
};

function Icon({ tone, children }: { tone: "neutral" | "ok" | "amber" | "danger"; children: React.ReactNode }) {
  const toneClass = {
    neutral: "bg-brand-secondary text-brand-ink",
    ok: "animate-pc-pop border-[1.5px] border-[var(--bink)] bg-brand-primary text-brand-on-primary",
    amber: "bg-[color-mix(in_srgb,#b45309_12%,transparent)] text-[#b45309]",
    danger: "bg-[color-mix(in_srgb,#c2410c_9%,transparent)] text-[#c2410c]",
  }[tone];
  return (
    <div className={`${ICON_BASE} ${toneClass}`} aria-hidden="true">
      {children}
    </div>
  );
}

const Title = ({ id, titleRef, children }: { id: string; titleRef?: React.Ref<HTMLHeadingElement>; children: React.ReactNode }) => (
  <h1
    id={id}
    ref={titleRef}
    tabIndex={titleRef ? -1 : undefined}
    className="mb-3 font-display text-[36px] font-normal uppercase leading-[1.05] tracking-[0.01em] [text-wrap:balance] focus:outline-none sm:text-[44px]"
  >
    {children}
  </h1>
);

const Lead = ({ children }: { children: React.ReactNode }) => (
  <p className="mx-auto mb-6 max-w-[34ch] text-[17px] leading-normal [text-wrap:pretty]">{children}</p>
);

export default function ConfirmarFirma({ token }: { token: string }) {
  const [view, setView] = useState<View>({ kind: "antes" });
  const [ready, setReady] = useState(false); // sin hidratar (o sin JavaScript) el botón no actúa
  const inflight = useRef(false);
  const titleRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => setReady(true), []);

  // Éxito: redirección a la landing, donde el popup de compartir ya existe. El botón visible cubre el fallo.
  useEffect(() => {
    if (view.kind !== "exito") return;
    const t = setTimeout(() => window.location.assign(view.dest), REDIRECT_MS);
    return () => clearTimeout(t);
  }, [view]);

  // Éxito, vencido y no válido: el foco pasa al título. En «enviando» y «error» se queda en el botón.
  useEffect(() => {
    if (view.kind === "exito" || view.kind === "vencido" || view.kind === "invalido") {
      titleRef.current?.focus({ preventScroll: true });
    }
  }, [view.kind]);

  // Tras un 429 el botón vuelve a estar activo a los 5 s.
  useEffect(() => {
    if (view.kind !== "error" || !view.cooldown) return;
    const t = setTimeout(() => setView({ kind: "error", cooldown: false }), COOLDOWN_MS);
    return () => clearTimeout(t);
  }, [view]);

  async function confirmar() {
    if (inflight.current || !ready) return; // evita el doble envío
    if (view.kind === "error" && view.cooldown) return;
    inflight.current = true;
    setView({ kind: "enviando" });
    const result = await confirmSignature(token);
    inflight.current = false;

    if (result.kind === "confirmed") {
      const first = (result.name ?? "").trim().split(/\s+/)[0];
      const query = "confirmada=1" + (first ? `&nombre=${encodeURIComponent(first)}` : "");
      setView({ kind: "exito", dest: campaignUrl(result.slug, query), name: first || undefined });
    } else if (result.kind === "expired") {
      setView({ kind: "vencido", dest: campaignUrl(result.slug, "confirmada=expirada") });
    } else if (result.kind === "invalid") {
      setView({ kind: "invalido" });
    } else {
      setView({ kind: "error", cooldown: result.rateLimited });
    }
  }

  const inForm = view.kind === "antes" || view.kind === "enviando" || view.kind === "error";
  const sending = view.kind === "enviando";
  const inactive = !ready || sending || (view.kind === "error" && view.cooldown);

  const status =
    view.kind === "enviando"
      ? "Confirmando tu firma…"
      : view.kind === "error"
      ? "No pudimos confirmar tu firma. Inténtalo de nuevo."
      : view.kind === "exito"
      ? view.name
        ? `Gracias, ${view.name}. Tu firma quedó confirmada. Te llevamos a la campaña.`
        : "Firma confirmada. Te llevamos a la campaña."
      : view.kind === "vencido"
      ? "Este enlace venció."
      : view.kind === "invalido"
      ? "Este enlace no es válido."
      : "";

  return (
    <div className="flex min-h-dvh flex-col bg-brand-bg font-body text-brand-ink">
      <header className="flex h-14 items-center justify-center sm:h-[72px]">
        <span className="font-display text-xl uppercase leading-none tracking-[0.06em]">Cauce</span>
      </header>

      <main className="flex flex-1 flex-col items-center px-3 pb-6 pt-2 sm:px-6 sm:pb-12 sm:pt-14">
        <section
          className="w-full max-w-[440px] animate-pc-float-in rounded-card border border-brand-border bg-brand-surface px-[22px] pb-6 pt-8 text-center shadow-petition sm:px-10 sm:pb-8 sm:pt-11"
          aria-labelledby="confirmar-titulo"
          aria-busy={sending}
        >
          {/* Cada pantalla distinta re-monta su contenido (animación); antes/enviando/error comparten árbol: el botón conserva el foco. */}
          <div key={inForm ? "form" : view.kind} className="animate-pc-rise">
            {inForm && (
              <>
                {view.kind === "error" ? (
                  <Icon tone="danger">
                    <svg {...SVG_PROPS}>
                      <circle cx="12" cy="12" r="9" />
                      <path d="M12 7.5v5" />
                      <path d="M12 16.3v.01" />
                    </svg>
                  </Icon>
                ) : (
                  <Icon tone="neutral">
                    <svg {...SVG_PROPS}>
                      <path d="M12 20h9" />
                      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
                    </svg>
                  </Icon>
                )}
                <Title id="confirmar-titulo">{view.kind === "error" ? "No pudimos confirmar ahora" : "Confirma tu firma"}</Title>
                <Lead>
                  {view.kind === "error"
                    ? "Revisa tu conexión e inténtalo de nuevo."
                    : "Un toque más y tu firma queda registrada en la campaña."}
                </Lead>
                {!ready && (
                  <noscript>
                    <div role="alert" className="mb-4 rounded-[14px] bg-[color-mix(in_srgb,#b45309_12%,transparent)] px-3.5 py-3 text-sm font-semibold leading-[1.45] text-[#7a3a06]">
                      Activa JavaScript para confirmar tu firma.
                    </div>
                  </noscript>
                )}
                <button
                  type="button"
                  onClick={confirmar}
                  aria-disabled={inactive}
                  aria-busy={sending}
                  className={`${BTN_BASE} ${inactive ? BTN_INACTIVE : BTN_PRIMARY}`}
                >
                  {sending ? (
                    <>
                      <span
                        aria-hidden="true"
                        className="h-[18px] w-[18px] shrink-0 animate-pc-spin rounded-full border-[2.5px] border-[rgba(22,38,31,0.2)] border-t-[var(--bink)] motion-reduce:animate-none"
                      />
                      Confirmando…
                    </>
                  ) : view.kind === "error" ? (
                    "Reintentar"
                  ) : (
                    "Confirmar mi firma"
                  )}
                </button>
                <p className={`mx-auto mt-4 max-w-[32ch] text-sm leading-normal [text-wrap:pretty] ${MUTED}`}>
                  {view.kind === "error"
                    ? "Tu enlace sigue siendo válido."
                    : "Pedimos este paso para que ningún programa automático de tu correo confirme por ti."}
                </p>
              </>
            )}

            {view.kind === "exito" && (
              <>
                <Icon tone="ok">
                  <svg {...SVG_PROPS} strokeWidth={2.5}>
                    <path d="M5 12.5l4.5 4.5L19 7.5" />
                  </svg>
                </Icon>
                <Title id="confirmar-titulo" titleRef={titleRef}>
                  {view.name ? `¡Gracias, ${view.name}!` : "¡Firma confirmada!"}
                </Title>
                <Lead>
                  {view.name
                    ? "Tu firma quedó confirmada. Te llevamos a la campaña…"
                    : "Gracias por sumar tu voz. Te llevamos a la campaña…"}
                </Lead>
                <a href={view.dest} className={`${BTN_BASE} ${BTN_PRIMARY}`}>
                  Ir a la campaña
                </a>
                <div aria-hidden="true" className="mx-auto mt-2.5 h-[3px] max-w-[160px] overflow-hidden rounded-[3px] bg-brand-secondary">
                  <i className="block h-full origin-left animate-pc-bar bg-[#3d6b35] motion-reduce:animate-none" />
                </div>
              </>
            )}

            {view.kind === "vencido" && (
              <>
                <Icon tone="amber">
                  <svg {...SVG_PROPS}>
                    <circle cx="12" cy="12" r="9" />
                    <path d="M12 7v5l3 2" />
                  </svg>
                </Icon>
                <Title id="confirmar-titulo" titleRef={titleRef}>Este enlace venció</Title>
                <Lead>Los enlaces de confirmación duran 24 horas. Vuelve a la campaña y firma de nuevo para recibir uno nuevo.</Lead>
                <a href={view.dest} className={`${BTN_BASE} ${BTN_PRIMARY}`}>
                  Volver a la campaña
                </a>
              </>
            )}

            {view.kind === "invalido" && (
              <>
                <Icon tone="neutral">
                  <svg {...SVG_PROPS}>
                    <path d="M9 17H7a5 5 0 0 1 0-10h2" />
                    <path d="M15 7h2a5 5 0 0 1 3.9 8.1" />
                    <path d="M8 12h3" />
                    <path d="M3 3l18 18" />
                  </svg>
                </Icon>
                <Title id="confirmar-titulo" titleRef={titleRef}>Este enlace no es válido</Title>
                <Lead>Puede que esté incompleto o que ya lo hayas usado. Si aún no confirmaste, firma de nuevo desde la campaña.</Lead>
                <a href="/" className={`${BTN_BASE} ${BTN_SECONDARY}`}>
                  Ir al inicio
                </a>
              </>
            )}
          </div>
          <div role="status" aria-live="polite" className="sr-only">
            {status}
          </div>
        </section>

        {inForm && (
          <footer className={`mx-auto mt-5 max-w-[440px] px-2.5 text-center text-[13px] leading-[1.55] [text-wrap:pretty] ${MUTED}`}>
            Si no fuiste tú, cierra esta página: tu firma no quedará registrada.{" "}
            <a
              href="/aviso-de-privacidad"
              className="font-semibold text-brand-ink underline underline-offset-2 hover:text-[#3d6b35] focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-[3px] focus-visible:outline-[#12222E]"
            >
              Aviso de privacidad
            </a>
          </footer>
        )}
      </main>
    </div>
  );
}
