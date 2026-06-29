"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";
import type { Campaign, Form, Question, AnswerInput } from "@/lib/types";
import { generateSessionToken } from "@/lib/utils";
import BearIntroScreen from "./BearIntroScreen";
import PrivacyNotice from "./PrivacyNotice";
import ThankYouScreen from "./ThankYouScreen";
import ProgressBar from "./ProgressBar";
import NavigationButtons from "./NavigationButtons";
import TurnstileWidget from "./TurnstileWidget";
import { renderQuestion } from "./question-types";
import MarkdownText from "@/components/ui/MarkdownText";

interface Props {
  campaign: Campaign;
  form: Form;
}

type Screen = "welcome" | "privacy" | "questions" | "thankyou";


// Tipos que avanzan sólo cuando están completamente respondidos
const AUTO_ADVANCE_DELAY: Partial<Record<string, number>> = {
  single_choice: 350,
  likert_scale:  450,
  nps:           450,
  matrix:        700,
};

// Tiempo mínimo (ms) que el usuario debe permanecer en una pregunta antes de
// que pueda dispararse el auto-avance, para evitar avances accidentales en mobile.
const MIN_DWELL_MS = 1200;

function evaluateCondition(
  logic: Record<string, unknown> | null | undefined,
  answers: Record<string, AnswerInput>
): boolean {
  if (!logic) return true;
  const cond = logic.if as { question_code: string; operator: string; value: string } | undefined;
  if (!cond) return true;
  const match = Object.values(answers).find((a) => a.question_code === cond.question_code);
  const val = match?.value_choice ?? match?.value_text;
  switch (cond.operator) {
    case "!=": return val !== cond.value;
    case "==": return val === cond.value;
    case ">=": return Number(val) >= Number(cond.value);
    case "<=": return Number(val) <= Number(cond.value);
    default:   return true;
  }
}

function hasOtherSelected(q: Question, answer: AnswerInput): boolean {
  const otherOpt = q.options.find(
    (o) => o.meta?.is_other === true || ["otros", "otra", "other"].includes(o.label.trim().toLowerCase())
  );
  if (!otherOpt) return false;
  if (q.type === "single_choice") return answer.value_choice === otherOpt.value;
  if (q.type === "multiple_choice") return answer.value_choices?.includes(otherOpt.value) ?? false;
  return false;
}

function isAnswered(q: Question, answer?: AnswerInput): boolean {
  if (!answer) return false;
  switch (q.type) {
    case "single_choice": {
      if (!answer.value_choice) return false;
      const otherOpt = q.options.find((o) => o.meta?.is_other === true);
      if (otherOpt && answer.value_choice === otherOpt.value) {
        return (answer.value_other_text?.trim().length ?? 0) > 0;
      }
      return true;
    }
    case "multiple_choice": {
      if ((answer.value_choices?.length ?? 0) === 0) return false;
      const otherOpt = q.options.find((o) => o.meta?.is_other === true);
      if (otherOpt && answer.value_choices?.includes(otherOpt.value)) {
        return (answer.value_other_text?.trim().length ?? 0) > 0;
      }
      return true;
    }
    case "matrix": {
      const items = (q.validation?.items as string[]) || [];
      return items.length > 0 && items.every((item) => (answer.value_matrix ?? {})[item] !== undefined);
    }
    case "nps": return answer.value_number !== undefined && answer.value_number !== null;
    case "likert_scale": return answer.value_number !== undefined && answer.value_number !== null;
    case "text":
    case "email": return (answer.value_text?.trim().length ?? 0) > 0;
    case "long_text": {
      const minLen = (q.validation?.min_length as number) || 0;
      const len = answer.value_text?.length ?? 0;
      return len > 0 && (minLen === 0 || len >= minLen);
    }
    default: return true;
  }
}

// Transición: enter desde abajo (sugiere scroll), exit hacia arriba
const fadeVariants = {
  enter: (dir: number) => ({ opacity: 0, y: dir >= 0 ? 44 : -20 }),
  center:               { opacity: 1, y: 0 },
  exit:  (dir: number) => ({ opacity: 0, y: dir >= 0 ? -14 : 14 }),
};

export default function FormRenderer({ campaign, form }: Props) {
  const [screen, setScreen] = useState<Screen>("welcome");
  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState(1);
  const [answers, setAnswers] = useState<Record<string, AnswerInput>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState("");
  const [turnstileError, setTurnstileError] = useState(false);
  const [triedToAdvance, setTriedToAdvance] = useState(false);
  const sessionToken = useRef(generateSessionToken());
  const questionStartTime = useRef(Date.now());
  const scrollRef = useRef<HTMLDivElement>(null);
  const turnstileContainerRef = useRef<HTMLDivElement>(null);
  // Timestamp hasta el cual se bloquean avances por teclado y botón "Siguiente"
  // para evitar ghost-touches y Enter repetido durante transiciones de pantalla.
  const blockUntil = useRef(0);

  const handleTurnstileVerify = useCallback((token: string) => {
    setTurnstileToken(token);
    setTurnstileError(false);
  }, []);
  const handleTurnstileExpire = useCallback(() => setTurnstileToken(""), []);
  const handleTurnstileError = useCallback(() => {
    setTurnstileToken("");
    setTurnstileError(true);
  }, []);

  // Volver al top del área scrollable en cada cambio de pregunta
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0, behavior: "instant" });
  }, [step]);

  // En la última pregunta, hacer scroll al widget Turnstile tras la animación de entrada
  useEffect(() => {
    if (!isLast) return;
    const t = setTimeout(() => {
      turnstileContainerRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }, 450);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  // Animación peek (de abajo a arriba) para preguntas con muchas opciones en mobile
  useEffect(() => {
    const container = scrollRef.current;
    const qType = visibleQuestions[step]?.type;
    if (!container || !["matrix", "multiple_choice"].includes(qType ?? "")) return;

    // Esperar a que la animación de entrada (300ms) termine antes de hacer el peek
    const t1 = setTimeout(() => {
      const isScrollable = container.scrollHeight > container.clientHeight + 40;
      if (!isScrollable) return;
      container.scrollTo({ top: 110, behavior: "smooth" });
      const t2 = setTimeout(() => {
        container.scrollTo({ top: 0, behavior: "smooth" });
      }, 700);
      return () => clearTimeout(t2);
    }, 380);

    return () => clearTimeout(t1);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  const hasPrivacy = !!(form.privacy_notice_text || form.requires_explicit_consent);

  const visibleQuestions = useMemo(
    () =>
      [...form.questions]
        .sort((a, b) => a.order_index - b.order_index)
        .filter((q) => evaluateCondition(q.conditional_logic, answers)),
    [form.questions, answers]
  );

  const currentQuestion: Question | undefined = visibleQuestions[step];
  const isLast = step === visibleQuestions.length - 1;
  const currentAnswer = currentQuestion ? answers[currentQuestion.id] : undefined;

  // Resetear el token de Turnstile si el usuario sale de la última pregunta
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!isLast) {
      setTurnstileToken("");
      setTurnstileError(false);
    }
  }, [isLast]);

  // Al cambiar de pantalla, bloquear avances por 600ms para evitar
  // ghost-touches y Enter acumulado desde la pantalla anterior.
  useEffect(() => {
    blockUntil.current = Date.now() + 600;
  }, [screen]);
  const canProceed =
    !currentQuestion?.is_required || isAnswered(currentQuestion, currentAnswer);

  // Avanzar directamente al step siguiente (sin depender de canProceed del render actual)
  function advanceStep() {
    setDirection(1);
    setStep((s) => s + 1);
    setTriedToAdvance(false);
    questionStartTime.current = Date.now();
  }

  // atajos de teclado: Enter avanza, Backspace retrocede, A-Z selecciona opción
  useEffect(() => {
    if (screen !== "questions" || !currentQuestion) return;
    const q = currentQuestion; // narrowed

    function onKey(e: KeyboardEvent) {
      // No interferir con campos de texto
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      // Enter → avanzar si puede (bloqueado durante transiciones)
      if (e.key === "Enter") {
        if (Date.now() < blockUntil.current) return;
        if (!isLast && canProceed) {
          blockUntil.current = Date.now() + 500;
          advanceStep();
        }
        return;
      }

      // Backspace / ArrowLeft → retroceder
      if ((e.key === "Backspace" || e.key === "ArrowLeft") && step > 0) {
        e.preventDefault();
        setDirection(-1);
        setStep((s) => s - 1);
        setTriedToAdvance(false);
        questionStartTime.current = Date.now();
        return;
      }

      // Teclado numérico para likert
      if (q.type === "likert_scale") {
        const num = parseInt(e.key);
        if (!isNaN(num)) {
          const min = (q.validation.min as number) || 1;
          const max = (q.validation.max as number) || 5;
          if (num >= min && num <= max) {
            e.preventDefault();
            const updated: AnswerInput = {
              ...(answers[q.id] ?? {}),
              value_number: num,
              question_id: q.id,
              question_code: q.code,
              question_type: q.type,
              time_on_question_seconds: Math.round((Date.now() - questionStartTime.current) / 1000),
            } as AnswerInput;
            setAnswers((a) => ({ ...a, [q.id]: updated }));
            setTriedToAdvance(false);
            if (!isLast && isAnswered(q, updated)) setTimeout(advanceStep, AUTO_ADVANCE_DELAY.likert_scale ?? 450);
          }
        }
      }

      // Letras A-Z → seleccionar opción en single/multiple choice
      if (["single_choice", "multiple_choice"].includes(q.type)) {
        const key = e.key.toUpperCase();
        if (key.length !== 1 || key < "A" || key > "Z") return;
        e.preventDefault();
        const opts = [...q.options].sort((a, b) => a.order_index - b.order_index);
        const idx = key.charCodeAt(0) - 65;
        if (idx < 0 || idx >= opts.length) return;
        const opt = opts[idx];

        if (q.type === "single_choice") {
          const updated: AnswerInput = {
            ...(answers[q.id] ?? {}),
            value_choice: opt.value,
            question_id: q.id,
            question_code: q.code,
            question_type: q.type,
            time_on_question_seconds: Math.round((Date.now() - questionStartTime.current) / 1000),
          } as AnswerInput;
          setAnswers((a) => ({ ...a, [q.id]: updated }));
          setTriedToAdvance(false);
          if (!isLast && !hasOtherSelected(q, updated)) setTimeout(advanceStep, AUTO_ADVANCE_DELAY.single_choice);
        } else {
          const prevVals = answers[q.id]?.value_choices ?? [];
          const maxChoices = (q.validation.max_choices as number) || 999;
          let newVals: string[];
          if (prevVals.includes(opt.value)) {
            newVals = prevVals.filter((v) => v !== opt.value);
          } else if (prevVals.length < maxChoices) {
            newVals = [...prevVals, opt.value];
          } else {
            return;
          }
          const updated: AnswerInput = {
            ...(answers[q.id] ?? {}),
            value_choices: newVals,
            question_id: q.id,
            question_code: q.code,
            question_type: q.type,
            time_on_question_seconds: Math.round((Date.now() - questionStartTime.current) / 1000),
          } as AnswerInput;
          setAnswers((a) => ({ ...a, [q.id]: updated }));
          setTriedToAdvance(false);
        }
      }
    }

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [screen, step, isLast, canProceed, currentQuestion, answers]);

  function handleAnswer(value: Partial<AnswerInput>) {
    if (!currentQuestion) return;
    const prev = answers[currentQuestion.id];
    const updated: AnswerInput = {
      ...prev,
      ...value,
      question_id: currentQuestion.id,
      question_code: currentQuestion.code,
      question_type: currentQuestion.type,
      time_on_question_seconds: Math.round((Date.now() - questionStartTime.current) / 1000),
    } as AnswerInput;
    setAnswers((a) => ({ ...a, [currentQuestion.id]: updated }));
    setTriedToAdvance(false);

    // Auto-avance cuando la pregunta queda completa — desactivado si "otros" está seleccionado.
    // El delay efectivo respeta MIN_DWELL_MS desde que se mostró la pregunta para evitar
    // avances accidentales por ghost-touches en mobile.
    const delay = AUTO_ADVANCE_DELAY[currentQuestion.type];
    if (delay !== undefined && !isLast && isAnswered(currentQuestion, updated) && !hasOtherSelected(currentQuestion, updated)) {
      const elapsed = Date.now() - questionStartTime.current;
      setTimeout(advanceStep, Math.max(delay, MIN_DWELL_MS - elapsed));
    }

    // Auto-avance para multiple_choice cuando se alcanza el máximo — desactivado si "otros" está entre las elegidas
    if (currentQuestion.type === "multiple_choice" && !isLast) {
      const maxC = (currentQuestion.validation.max_choices as number) || 999;
      if (maxC < 999 && (updated.value_choices?.length ?? 0) >= maxC && !hasOtherSelected(currentQuestion, updated)) {
        const elapsed = Date.now() - questionStartTime.current;
        setTimeout(advanceStep, Math.max(500, MIN_DWELL_MS - elapsed));
      }
    }
  }

  function goNext() {
    if (Date.now() < blockUntil.current) return;
    if (!canProceed) {
      setTriedToAdvance(true);
      return;
    }
    if (!isLast) {
      blockUntil.current = Date.now() + 500;
      advanceStep();
    }
  }

  function goPrev() {
    if (step > 0) {
      setTriedToAdvance(false);
      setDirection(-1);
      setStep((s) => s - 1);
      questionStartTime.current = Date.now();
    }
  }

  function startFlow() {
    if (hasPrivacy) {
      setScreen("privacy");
    } else {
      setScreen("questions");
    }
  }

  async function handleSubmit() {
    setSubmitting(true);
    setSubmitError(false);
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/v1/public/c/${campaign.slug}/respond`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            session_token: sessionToken.current,
            turnstile_token: turnstileToken,
            answers: Object.values(answers),
            status: "completed",
          }),
        }
      );
      if (res.ok) {
        setScreen("thankyou");
      } else {
        setSubmitError(true);
      }
    } catch {
      setSubmitError(true);
    } finally {
      setSubmitting(false);
    }
  }

  if (screen === "welcome") {
    return <BearIntroScreen campaign={campaign} form={form} questionCount={visibleQuestions.length} onStart={startFlow} />;
  }

  if (screen === "privacy") {
    return (
      <PrivacyNotice
        text={form.privacy_notice_text || ""}
        requiresConsent={form.requires_explicit_consent}
        consentText={form.consent_text}
        onAccept={() => setScreen("questions")}
      />
    );
  }

  if (screen === "thankyou") {
    return (
      <ThankYouScreen
        socialLinks={campaign.social_links}
        shareText={campaign.share_text}
        thankYouTitle={campaign.thank_you_title}
        thankYouBody={campaign.thank_you_body}
      />
    );
  }

  if (!currentQuestion) return null;

  const navProps = {
    onPrev: step > 0 ? goPrev : undefined,
    onNext: isLast ? undefined : goNext,
    onSubmit: isLast ? handleSubmit : undefined,
    submitting,
    canProceed: canProceed && (!isLast || !!turnstileToken),
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
      className="relative min-h-screen flex flex-col overscroll-none"
    >
      {/* Fondo responsive: mismas imágenes que las demás pantallas */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        <Image src="/bear/back-phone.png" alt="" fill className="object-cover md:hidden" priority />
        <Image src="/bear/back-desktop.png" alt="" fill className="object-cover hidden md:block" priority />
      </div>
      {/* Capa oscura para legibilidad del contenido sobre la imagen */}
      <div className="fixed inset-0 z-[1] pointer-events-none bg-[#050a18]/75" />

      {/* Todo el contenido en z-[2] para quedar sobre el overlay */}
      <div className="relative z-[2] flex flex-col flex-1 min-h-screen">
      {/* espacio seguro superior (notch / Dynamic Island en mobile) */}
      <div className="h-12 sm:h-8 shrink-0" />

      {/* área scrollable */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-5 sm:px-8 py-6 max-w-2xl mx-auto w-full pb-48 md:pb-10"
      >
        {/* contador simple */}
        <motion.p
          key={`counter-${step}`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-white/40 font-body text-xs mb-4 tracking-wide"
        >
          {step + 1}
        </motion.p>

        {/* pregunta con transición que viene desde abajo */}
        <AnimatePresence mode="wait" custom={direction}>
          <motion.div
            key={currentQuestion.id}
            custom={direction}
            variants={fadeVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.3, ease: "easeOut" }}
          >
            {currentQuestion.description && (
              <p
                className="text-qsm-blue font-body mb-3 opacity-80"
                style={{ fontSize: (() => { const sz = form.description_font_size ?? (form.meta?.description_font_size as number | undefined); return sz ? `${sz}px` : "0.875rem"; })() }}
              >
                <MarkdownText>{currentQuestion.description}</MarkdownText>
              </p>
            )}

            <h2 className="font-heading font-bold text-white text-xl sm:text-2xl leading-snug mb-6">
              <MarkdownText>{currentQuestion.label}</MarkdownText>
              {currentQuestion.is_required && (
                <span className="text-qsm-orange ml-1 text-base">*</span>
              )}
            </h2>

            <div>
              {renderQuestion(currentQuestion, currentAnswer, handleAnswer, {
                showIncompleteWarning: triedToAdvance && currentQuestion.type === "matrix",
                showMinAlert: triedToAdvance && currentQuestion.type === "long_text",
              })}
            </div>

            {isLast && (
              <div className="mt-6" ref={turnstileContainerRef}>
                <TurnstileWidget
                  onVerify={handleTurnstileVerify}
                  onExpire={handleTurnstileExpire}
                  onError={handleTurnstileError}
                />
                {turnstileError && (
                  <p className="text-qsm-orange/80 font-body text-xs mt-2">
                    La verificación falló. Por favor recarga la página e intenta de nuevo.
                  </p>
                )}
              </div>
            )}

            {currentQuestion.is_required && triedToAdvance && !canProceed && (
              <motion.p
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-qsm-orange/80 font-body text-xs mt-3"
              >
                Esta pregunta es obligatoria.
              </motion.p>
            )}
          </motion.div>
        </AnimatePresence>

        {/* botones inline — solo desktop (fuera de AnimatePresence, sin parpadeo) */}
        <div className="hidden md:flex mt-8 items-center gap-3">
          <NavigationButtons {...navProps} inline />
        </div>

        {submitError && (
          <motion.p
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-qsm-orange/80 font-body text-xs mt-3 text-center"
          >
            Error al enviar. Verifica tu conexión e intenta de nuevo.
          </motion.p>
        )}
      </div>

      {/* botones fijos al fondo — solo mobile (el gradiente de fade lo incluye NavigationButtons) */}
      <div className="md:hidden">
        <NavigationButtons {...navProps} />
      </div>

      {/* barra de progreso — siempre al fondo absoluto */}
      <ProgressBar current={step + 1} total={visibleQuestions.length} />
      </div>{/* cierre z-[2] */}
    </motion.div>
  );
}
