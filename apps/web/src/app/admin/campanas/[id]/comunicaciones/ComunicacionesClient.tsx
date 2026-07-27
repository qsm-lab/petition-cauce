"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import RichTextEditor, { type RichTextEditorHandle } from "@/components/RichTextEditor";
import type { AdminCampaign } from "@/lib/admin-campaigns-api";
import {
  getCommsQuota,
  countCommsRecipients,
  previewComms,
  sendComms,
  uploadCommsImage,
  type CommsType,
  type AudienceIn,
  type CtaButtonIn,
  type CommsQuota,
} from "@/lib/comms-api";

const IMAGE_MAX_BYTES = 25 * 1024 * 1024;
const IMAGE_ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

interface Props {
  campaign: AdminCampaign;
}

const TYPES: { id: CommsType; label: string; clase: "anuncios" | "servicio" }[] = [
  { id: "general", label: "Mensaje general", clase: "anuncios" },
  { id: "invitation", label: "Invitación al evento", clase: "servicio" },
  { id: "closing", label: "Aviso de cierre", clase: "servicio" },
];

const SOCIAL_LABELS: Record<string, string> = {
  website: "Sitio web",
  instagram: "Instagram",
  facebook: "Facebook",
  x: "X",
  tiktok: "TikTok",
  whatsapp: "WhatsApp",
};

interface AudienceState {
  natural: boolean;
  org: boolean;
  nacional: boolean;
  internacional: boolean;
  publica: boolean;
  anonima: boolean;
}
const AUDIENCE_DEFAULT: AudienceState = {
  natural: true, org: true, nacional: true, internacional: true, publica: true, anonima: true,
};

interface Draft {
  type: CommsType;
  subject: string;
  bodyHtml: string;
  ctaEnabled: boolean;
  ctas: { text: string; url: string }[];
  includeSocial: boolean;
  audience: AudienceState;
}
const DRAFT_DEFAULT: Draft = {
  type: "general",
  subject: "",
  bodyHtml: "",
  ctaEnabled: false,
  ctas: [{ text: "", url: "" }],
  includeSocial: true,
  audience: AUDIENCE_DEFAULT,
};

function useDraft(key: string) {
  // Estado inicial idéntico en servidor y cliente (esta página se renderiza
  // en el servidor, a diferencia del popup AdherentCommsModal que solo monta
  // tras un click) — leer localStorage en el initializer desincroniza el SSR
  // del cliente y produce un hydration mismatch. Se carga en un efecto
  // (post-hidratación) en su lugar.
  const [draft, setDraft] = useState<Draft>(DRAFT_DEFAULT);
  const [wasRestored, setWasRestored] = useState(false);
  const skipNextSave = useRef(true);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(key);
      if (raw) {
        const parsed = { ...DRAFT_DEFAULT, ...JSON.parse(raw) };
        setDraft(parsed);
        setWasRestored(Boolean(parsed.subject?.trim() || parsed.bodyHtml?.trim()));
      }
    } catch {
      /* storage bloqueado o corrupto */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  useEffect(() => {
    if (skipNextSave.current) {
      skipNextSave.current = false;
      return;
    }
    try {
      window.localStorage.setItem(key, JSON.stringify(draft));
    } catch {
      /* storage lleno o bloqueado */
    }
  }, [key, draft]);

  function clearDraft() {
    try { window.localStorage.removeItem(key); } catch { /* noop */ }
    setDraft(DRAFT_DEFAULT);
    setWasRestored(false);
  }

  return { draft, setDraft, clearDraft, wasRestored };
}

function toAudienceIn(a: AudienceState): AudienceIn {
  const signer_types: string[] = [];
  if (!(a.natural && a.org)) {
    if (a.natural) signer_types.push("natural");
    if (a.org) signer_types.push("org");
  }
  const locations: string[] = [];
  if (!(a.nacional && a.internacional)) {
    if (a.nacional) locations.push("nacional");
    if (a.internacional) locations.push("internacional");
  }
  const visibilities: string[] = [];
  if (!(a.publica && a.anonima)) {
    if (a.publica) visibilities.push("publica");
    if (a.anonima) visibilities.push("anonima");
  }
  return { include_confirmed: true, include_pending: false, signer_types, locations, visibilities };
}

function wordCount(html: string): number {
  const text = html.replace(/<[^>]+>/g, " ").trim();
  return text ? text.split(/\s+/).length : 0;
}

const inputStyle: React.CSSProperties = {
  width: "100%", boxSizing: "border-box", padding: "10px 12px", borderRadius: 10,
  border: "1.5px solid var(--bbord)", fontSize: 14, color: "var(--bink)",
  fontFamily: "inherit", outline: "none", background: "#fff",
};
const fieldLabel: React.CSSProperties = {
  display: "block", fontSize: 12, fontWeight: 700, marginBottom: 6, color: "var(--bink)",
};
const eyebrow: React.CSSProperties = {
  fontSize: 11, fontWeight: 800, letterSpacing: "0.04em", textTransform: "uppercase", color: "var(--bmut)",
};
const cardStyle: React.CSSProperties = {
  background: "var(--bsurf)", border: "1.5px solid var(--bink)", borderRadius: 18,
};

function TypePill({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: "9px 16px", fontSize: 13, fontWeight: 700, borderRadius: 30, cursor: "pointer",
        border: "1.5px solid var(--bink)",
        background: active ? "var(--bink)" : "#fff",
        color: active ? "#fff" : "var(--bink)",
      }}
    >
      {children}
    </button>
  );
}

function Toggle({ checked, onChange, disabled }: { checked: boolean; onChange: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={disabled ? undefined : onChange}
      aria-pressed={checked}
      disabled={disabled}
      style={{
        width: 40, height: 23, borderRadius: 99, position: "relative", flexShrink: 0, border: "none",
        cursor: disabled ? "not-allowed" : "pointer",
        background: checked ? "#16261F" : "rgba(22,38,31,0.15)",
        opacity: disabled ? 0.5 : 1,
      }}
    >
      <span style={{
        width: 17, height: 17, borderRadius: "50%", background: "#fff", position: "absolute", top: 3,
        left: checked ? 20 : 3, transition: "left .15s",
      }} />
    </button>
  );
}

function Checkbox({ label, checked, onChange, disabled, note }: {
  label: string; checked: boolean; onChange?: () => void; disabled?: boolean; note?: string;
}) {
  return (
    <label
      style={{
        display: "flex", alignItems: "center", gap: 9, fontSize: 13.5, fontWeight: 600, padding: "5px 0",
        color: "var(--bink)", cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.5 : 1,
      }}
      title={note}
    >
      <input type="checkbox" checked={checked} disabled={disabled} onChange={onChange} style={{ width: 17, height: 17, accentColor: "var(--bp)" }} />
      {label}
    </label>
  );
}

interface ContentPayload {
  type: CommsType;
  subject: string;
  body_html: string;
  ctas: CtaButtonIn[];
  include_social: boolean;
}

export default function ComunicacionesClient({ campaign }: Props) {
  const { draft, setDraft, clearDraft, wasRestored } = useDraft(`comms-center:${campaign.id}`);
  const [dismissedBanner, setDismissedBanner] = useState(false);

  const [editorMode, setEditorMode] = useState<"visual" | "code">("visual");
  const [editorKey, setEditorKey] = useState(0);
  const editorRef = useRef<RichTextEditorHandle>(null);

  const [mediaOpen, setMediaOpen] = useState(false);
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [mediaUploading, setMediaUploading] = useState(false);
  const [mediaError, setMediaError] = useState<string | null>(null);

  const [quota, setQuota] = useState<CommsQuota | null>(null);
  const [count, setCount] = useState<number | null>(null);
  const [countLoading, setCountLoading] = useState(false);

  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [testEmailInput, setTestEmailInput] = useState("");
  const [testEmails, setTestEmails] = useState<string[]>([]);
  const [testSending, setTestSending] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendResult, setSendResult] = useState<string | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);

  const activeType = TYPES.find((t) => t.id === draft.type)!;
  const audienceIn: AudienceIn = toAudienceIn(draft.audience);

  useEffect(() => {
    getCommsQuota(campaign.id).then(setQuota).catch(() => setQuota(null));
  }, [campaign.id]);

  useEffect(() => {
    let cancelled = false;
    setCountLoading(true);
    const t = setTimeout(async () => {
      try {
        const res = await countCommsRecipients(campaign.id, draft.type, audienceIn);
        if (!cancelled) setCount(res.count);
      } catch {
        if (!cancelled) setCount(null);
      } finally {
        if (!cancelled) setCountLoading(false);
      }
    }, 300);
    return () => { cancelled = true; clearTimeout(t); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campaign.id, draft.type, JSON.stringify(audienceIn)]);

  function toggleAudience(field: keyof AudienceState, pairField: keyof AudienceState) {
    setDraft((prev) => {
      const cur = prev.audience[field];
      if (cur && !prev.audience[pairField]) return prev; // no dejar el grupo sin selección
      return { ...prev, audience: { ...prev.audience, [field]: !cur } };
    });
  }

  function resetAudience() {
    setDraft((prev) => ({ ...prev, audience: AUDIENCE_DEFAULT }));
  }

  function switchToVisual() {
    setEditorKey((k) => k + 1);
    setEditorMode("visual");
  }

  function openMedia() {
    setMediaFile(null);
    setMediaError(null);
    setMediaOpen(true);
  }

  function pickMediaFile(file: File | null | undefined) {
    if (!file) return;
    if (!IMAGE_ALLOWED_TYPES.includes(file.type)) {
      setMediaError("Formato no permitido — solo JPG, PNG, WEBP o GIF.");
      setMediaFile(null);
      return;
    }
    if (file.size > IMAGE_MAX_BYTES) {
      setMediaError("El archivo supera los 25 MB.");
      setMediaFile(null);
      return;
    }
    setMediaError(null);
    setMediaFile(file);
  }

  async function insertMedia() {
    if (!mediaFile) return;
    setMediaUploading(true);
    setMediaError(null);
    try {
      const res = await uploadCommsImage(campaign.id, mediaFile);
      editorRef.current?.insertImage(res.url);
      setMediaOpen(false);
      setMediaFile(null);
    } catch (e) {
      setMediaError(e instanceof Error ? e.message : "No se pudo subir la imagen");
    } finally {
      setMediaUploading(false);
    }
  }

  function buildCtas(): CtaButtonIn[] {
    return draft.ctas
      .filter((c) => c.text.trim() && c.url.trim())
      .map((c) => ({ text: c.text.trim(), url: c.url.trim(), enabled: draft.ctaEnabled }));
  }

  function buildContentPayload(): ContentPayload {
    return {
      type: draft.type,
      subject: draft.subject.trim(),
      body_html: draft.bodyHtml,
      ctas: buildCtas(),
      include_social: draft.includeSocial,
    };
  }

  const bodyIsEmpty = wordCount(draft.bodyHtml) === 0;
  const canOperate = draft.subject.trim().length > 0 && !bodyIsEmpty;

  async function openPreview() {
    setPreviewOpen(true);
    setPreviewLoading(true);
    setPreviewError(null);
    setTestResult(null);
    try {
      const res = await previewComms(campaign.id, buildContentPayload());
      setPreviewHtml(res.html);
    } catch (e) {
      setPreviewError(e instanceof Error ? e.message : "Error al generar la vista previa");
    } finally {
      setPreviewLoading(false);
    }
  }

  function addTestEmail() {
    const v = testEmailInput.trim();
    if (v && !testEmails.includes(v)) setTestEmails([...testEmails, v]);
    setTestEmailInput("");
  }

  async function sendTest() {
    if (testEmails.length === 0) return;
    setTestSending(true);
    setTestResult(null);
    try {
      const res = await sendComms(campaign.id, { ...buildContentPayload(), audience: audienceIn, test_emails: testEmails });
      setTestResult(`✓ Prueba enviada a ${res.sent_count} dirección(es).`);
    } catch (e) {
      setTestResult(e instanceof Error ? e.message : "Error al enviar la prueba");
    } finally {
      setTestSending(false);
    }
  }

  async function sendReal() {
    setSending(true);
    setSendError(null);
    try {
      const res = await sendComms(campaign.id, { ...buildContentPayload(), audience: audienceIn });
      setSendResult(`✓ Enviado a ${res.sent_count} de ${res.recipient_count} destinatario(s).`);
      setConfirmOpen(false);
      clearDraft();
    } catch (e) {
      setSendError(e instanceof Error ? e.message : "Error al enviar");
    } finally {
      setSending(false);
    }
  }

  const dailyRemaining = quota?.daily_quota != null ? quota.daily_quota - quota.daily_used : null;
  const quotaExceeded = dailyRemaining != null && count != null && count > dailyRemaining;

  return (
    <div className="p-6" style={{ maxWidth: 1160, margin: "0 auto" }}>
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3 mb-5">
        <div>
          <Link
            href={`/admin/campanas/${campaign.id}`}
            className="inline-flex items-center gap-1 text-[12.5px] font-bold mb-2"
            style={{ color: "var(--bink)", textDecoration: "none" }}
          >
            ← Volver al admin de campaña
          </Link>
          <div style={eyebrow}>Centro de comunicaciones</div>
          <h1 className="font-heading" style={{ fontSize: 28, color: "var(--bink)", lineHeight: 1 }}>{campaign.title}</h1>
          <div className="text-[12.5px] mt-1.5" style={{ color: "var(--bmut)" }}>
            Organización: <strong style={{ color: "var(--bink)" }}>{campaign.org_name || "—"}</strong>
            {quota && (
              <> · Remitente: <strong style={{ color: "var(--bink)" }}>{quota.sender}</strong></>
            )}
          </div>
        </div>
        {quota && (
          <div className="text-right">
            <span
              className="inline-flex items-center font-bold text-[11px]"
              style={{ background: "rgba(43,78,234,0.1)", color: "#2B4EEA", padding: "3px 10px", borderRadius: 99 }}
            >
              {quota.provider} · {quota.plan}
            </span>
            <div className="text-[12px] mt-1.5" style={{ color: "var(--bmut)" }}>
              Cuota hoy: <strong style={{ color: "var(--bink)" }}>{quota.daily_used}{quota.daily_quota != null ? ` / ${quota.daily_quota}` : ""}</strong>
              {quota.monthly_quota != null && <> · mes: {quota.monthly_used} / {quota.monthly_quota}</>}
              {quota.updated_at && (
                <><br /><span className="text-[11px]">actualizado al último envío</span></>
              )}
            </div>
          </div>
        )}
      </div>

      {wasRestored && !dismissedBanner && (
        <div className="flex items-center justify-between gap-2 text-[12px] rounded-[8px] px-3 py-2 mb-4" style={{ color: "#7a8a72", background: "var(--bbg)" }}>
          <span>Se restauró un borrador guardado en este navegador.</span>
          <button type="button" onClick={() => { clearDraft(); setDismissedBanner(true); }} style={{ border: "none", background: "transparent", color: "#c2410c", cursor: "pointer", fontSize: 12, fontWeight: 700 }}>
            Descartar
          </button>
        </div>
      )}

      {sendResult && (
        <p className="text-[12.5px] mb-4 rounded-[8px] px-3 py-2" style={{ color: "#3d6b35", background: "rgba(61,107,53,0.08)" }}>{sendResult}</p>
      )}

      {/* Layout 2 columnas */}
      <div className="grid gap-4 items-start" style={{ gridTemplateColumns: "1.6fr 1fr" }}>

        {/* Columna izquierda: tipo + editor */}
        <div style={{ ...cardStyle, padding: 22 }}>
          <div style={eyebrow}>Tipo de comunicación</div>
          <div className="flex gap-2 flex-wrap mt-2 mb-2">
            {TYPES.map((t) => (
              <TypePill key={t.id} active={draft.type === t.id} onClick={() => setDraft((p) => ({ ...p, type: t.id }))}>
                {t.label}
              </TypePill>
            ))}
          </div>
          <div
            className="inline-flex items-center gap-1.5 text-[11.5px] font-bold rounded-full mb-4"
            style={{
              padding: "4px 12px",
              background: activeType.clase === "anuncios" ? "rgba(61,107,53,0.1)" : "var(--bsec)",
              color: activeType.clase === "anuncios" ? "#3d6b35" : "var(--bink)",
            }}
          >
            ● Clase: {activeType.clase === "anuncios" ? "Anuncios · requiere consentimiento de anuncios" : "Servicio · sobre el propio trámite"}
          </div>

          <label style={fieldLabel}>Asunto</label>
          <input
            type="text"
            value={draft.subject}
            onChange={(e) => setDraft((p) => ({ ...p, subject: e.target.value }))}
            placeholder="Asunto del email"
            style={{ ...inputStyle, marginBottom: 16 }}
          />

          <label style={fieldLabel}>Contenido general</label>
          <div style={{ border: "1.5px solid var(--bink)", borderRadius: 12, overflow: "hidden" }}>
            <div className="flex items-center justify-between px-2.5 py-2" style={{ borderBottom: "1px solid var(--bbord)", background: "var(--bbg)" }}>
              <button
                type="button"
                onClick={openMedia}
                disabled={editorMode !== "visual"}
                style={{
                  padding: "6px 12px", fontSize: 12, fontWeight: 700, borderRadius: 30, cursor: editorMode === "visual" ? "pointer" : "not-allowed",
                  border: "1.5px solid var(--bink)", background: "#fff", color: "var(--bink)", opacity: editorMode === "visual" ? 1 : 0.4,
                  display: "inline-flex", alignItems: "center", gap: 6,
                }}
              >
                🖼 Añadir medios
              </button>
              <div className="inline-flex rounded-lg overflow-hidden">
                <button type="button" onClick={switchToVisual} style={{
                  padding: "6px 14px", fontSize: 12, fontWeight: 700, border: "none", cursor: "pointer",
                  background: editorMode === "visual" ? "var(--bink)" : "#fff", color: editorMode === "visual" ? "#fff" : "var(--bmut)",
                }}>Visual</button>
                <button type="button" onClick={() => setEditorMode("code")} style={{
                  padding: "6px 14px", fontSize: 12, fontWeight: 700, border: "none", cursor: "pointer", borderLeft: "1px solid var(--bbord)",
                  background: editorMode === "code" ? "var(--bink)" : "#fff", color: editorMode === "code" ? "#fff" : "var(--bmut)",
                }}>Código</button>
              </div>
            </div>
            {editorMode === "visual" ? (
              <RichTextEditor
                ref={editorRef}
                key={editorKey}
                value={draft.bodyHtml}
                onChange={(html) => setDraft((p) => ({ ...p, bodyHtml: html }))}
                placeholder="Escribe el contenido del envío…"
                minHeight={180}
                allowImages
              />
            ) : (
              <textarea
                value={draft.bodyHtml}
                onChange={(e) => setDraft((p) => ({ ...p, bodyHtml: e.target.value }))}
                rows={10}
                style={{
                  width: "100%", boxSizing: "border-box", fontFamily: "ui-monospace,Menlo,monospace", fontSize: 12.5,
                  lineHeight: 1.7, padding: 16, border: "none", outline: "none", resize: "vertical", color: "rgba(22,38,31,0.85)",
                }}
              />
            )}
            <div className="px-3 py-1.5 text-[11.5px]" style={{ borderTop: "1px solid var(--bbord)", background: "var(--bbg)", color: "var(--bmut)" }}>
              Número de palabras: {wordCount(draft.bodyHtml)}
            </div>
          </div>
          <p className="text-[11.5px] mt-2.5" style={{ color: "var(--bmut)", lineHeight: 1.5 }}>
            El contenido se envuelve en la plantilla de la plataforma (encabezado, footer y desuscripción) al enviarse.
          </p>

          <hr style={{ border: "none", height: 1, background: "var(--bbord)", margin: "18px 0" }} />

          {/* CTA */}
          <div className="flex items-center justify-between mb-2.5">
            <div style={eyebrow}>Botón de acción (CTA)</div>
            <Toggle checked={draft.ctaEnabled} onChange={() => setDraft((p) => ({ ...p, ctaEnabled: !p.ctaEnabled }))} />
          </div>
          {draft.ctaEnabled && (
            <>
              {draft.ctas.map((cta, i) => (
                <div key={i} className="flex gap-2.5 mb-2 items-end">
                  <div style={{ flex: 1 }}>
                    <label style={{ ...fieldLabel, fontSize: 11 }}>Texto del botón</label>
                    <input
                      type="text"
                      value={cta.text}
                      onChange={(e) => setDraft((p) => ({ ...p, ctas: p.ctas.map((c, j) => j === i ? { ...c, text: e.target.value } : c) }))}
                      placeholder="Firma la petición"
                      style={{ ...inputStyle, padding: "9px 11px", fontSize: 13 }}
                    />
                  </div>
                  <div style={{ flex: 1.4 }}>
                    <label style={{ ...fieldLabel, fontSize: 11 }}>Enlace</label>
                    <input
                      type="url"
                      value={cta.url}
                      onChange={(e) => setDraft((p) => ({ ...p, ctas: p.ctas.map((c, j) => j === i ? { ...c, url: e.target.value } : c) }))}
                      placeholder="https://cauce.ec/..."
                      style={{ ...inputStyle, padding: "9px 11px", fontSize: 13 }}
                    />
                  </div>
                  {draft.ctas.length > 1 && (
                    <button
                      type="button"
                      onClick={() => setDraft((p) => ({ ...p, ctas: p.ctas.filter((_, j) => j !== i) }))}
                      aria-label="Quitar botón"
                      style={{ border: "none", background: "transparent", color: "var(--bmut)", fontSize: 18, cursor: "pointer", padding: "0 4px 9px" }}
                    >×</button>
                  )}
                </div>
              ))}
              <button
                type="button"
                onClick={() => setDraft((p) => ({ ...p, ctas: [...p.ctas, { text: "", url: "" }] }))}
                style={{ border: "none", background: "none", color: "#2B4EEA", fontSize: 12, fontWeight: 700, cursor: "pointer", padding: "2px 0" }}
              >
                ＋ Agregar otro botón
              </button>
            </>
          )}

          <hr style={{ border: "none", height: 1, background: "var(--bbord)", margin: "18px 0" }} />

          {/* Redes sociales */}
          <div className="flex items-center justify-between">
            <div>
              <div style={{ ...eyebrow, marginBottom: 3 }}>Redes sociales</div>
              <div className="text-[12px]" style={{ color: "var(--bmut)" }}>Incluir las cargadas en el admin de la campaña</div>
            </div>
            <Toggle checked={draft.includeSocial} onChange={() => setDraft((p) => ({ ...p, includeSocial: !p.includeSocial }))} />
          </div>
          <div className="flex gap-2 flex-wrap mt-2.5">
            {Object.entries(SOCIAL_LABELS).map(([key, label]) => {
              const loaded = Boolean(campaign.social_links?.[key]);
              return (
                <span
                  key={key}
                  className="text-[11px] font-bold rounded-full px-2.5 py-1"
                  style={loaded
                    ? { background: "var(--bbg)", color: "var(--bink)" }
                    : { background: "#fff", color: "var(--bmut)", border: "1px dashed var(--bbord)" }}
                >
                  {label}{!loaded && " · sin cargar"}
                </span>
              );
            })}
          </div>
        </div>

        {/* Columna derecha: audiencia + acciones */}
        <div className="flex flex-col gap-4">
          <div style={{ ...cardStyle, padding: 20 }}>
            <div className="flex items-center justify-between mb-1">
              <div style={eyebrow}>Audiencia</div>
              <button type="button" onClick={resetAudience} style={{ border: "none", background: "none", color: "#2B4EEA", fontSize: 11.5, fontWeight: 700, cursor: "pointer" }}>
                Restablecer
              </button>
            </div>
            <p className="text-[11.5px] mb-3.5" style={{ color: "var(--bmut)", lineHeight: 1.45 }}>
              Por defecto se incluye a todos. Desmarcá para excluir.
            </p>

            <div className="text-[11px] font-extrabold uppercase tracking-wide mb-0.5" style={{ color: "var(--bmut)" }}>Estado</div>
            <Checkbox label="Confirmadas" checked disabled note="Fase 1 solo envía a firmas confirmadas" />
            <Checkbox label="Pendientes de confirmar" checked={false} disabled note="Disponible en una fase futura (recordatorio de confirmación)" />

            <hr style={{ border: "none", height: 1, background: "var(--bbord)", margin: "12px 0" }} />
            <div className="text-[11px] font-extrabold uppercase tracking-wide mb-0.5" style={{ color: "var(--bmut)" }}>Tipo de firmante</div>
            <div className="grid grid-cols-2">
              <Checkbox label="Natural" checked={draft.audience.natural} onChange={() => toggleAudience("natural", "org")} />
              <Checkbox label="Organización" checked={draft.audience.org} onChange={() => toggleAudience("org", "natural")} />
            </div>

            <hr style={{ border: "none", height: 1, background: "var(--bbord)", margin: "12px 0" }} />
            <div className="text-[11px] font-extrabold uppercase tracking-wide mb-0.5" style={{ color: "var(--bmut)" }}>Ubicación</div>
            <div className="grid grid-cols-2">
              <Checkbox label="Ecuador" checked={draft.audience.nacional} onChange={() => toggleAudience("nacional", "internacional")} />
              <Checkbox label="Internacional" checked={draft.audience.internacional} onChange={() => toggleAudience("internacional", "nacional")} />
            </div>

            <hr style={{ border: "none", height: 1, background: "var(--bbord)", margin: "12px 0" }} />
            <div className="text-[11px] font-extrabold uppercase tracking-wide mb-0.5" style={{ color: "var(--bmut)" }}>Visibilidad</div>
            <div className="grid grid-cols-2">
              <Checkbox label="Pública" checked={draft.audience.publica} onChange={() => toggleAudience("publica", "anonima")} />
              <Checkbox label="Anónima" checked={draft.audience.anonima} onChange={() => toggleAudience("anonima", "publica")} />
            </div>
            <Checkbox label="Secreta" checked={false} disabled note="Las firmas secretas nunca reciben ni se exponen" />
            <p className="text-[11px] mt-1.5" style={{ color: "var(--bmut)", lineHeight: 1.45 }}>
              Las secretas nunca reciben ni exponen datos — solo cuentan.
            </p>
          </div>

          <div style={{ ...cardStyle, padding: 20, background: "var(--bbg)" }}>
            <div className="flex items-baseline gap-2 mb-0.5">
              <div className="font-heading" style={{ fontSize: 34, lineHeight: 1, color: "var(--bink)" }}>
                {countLoading ? "…" : count ?? "—"}
              </div>
              <div className="text-[12.5px]" style={{ color: "var(--bmut)" }}>destinatarios</div>
            </div>
            <p className="text-[11.5px] mb-1" style={{ color: "var(--bmut)", lineHeight: 1.5 }}>
              {activeType.clase === "anuncios"
                ? "filtrados por consentimiento de anuncios + segmento"
                : "confirmadas sobre el propio trámite + segmento"}
            </p>
            {quotaExceeded && (
              <div className="inline-flex items-center gap-1.5 text-[11.5px] font-bold rounded-[8px] mb-4 px-2.5 py-1.5" style={{ background: "rgba(180,83,9,0.12)", color: "#b45309" }}>
                ⚠ Excede el remanente de cuota de hoy ({dailyRemaining}) — la cola automática llega en una fase futura; el envío inmediato puede fallar para el excedente.
              </div>
            )}
            {!quotaExceeded && <div style={{ marginBottom: 16 }} />}

            <div className="flex gap-2 mb-3">
              <button type="button" onClick={openPreview} disabled={!canOperate} style={{
                flex: 1, padding: 9, fontSize: 12.5, fontWeight: 700, borderRadius: 30, cursor: canOperate ? "pointer" : "not-allowed",
                background: "transparent", border: "1.5px solid var(--bbord)", color: "var(--bmut)", opacity: canOperate ? 1 : 0.5,
              }}>
                Vista previa
              </button>
            </div>

            <button
              type="button"
              onClick={() => setConfirmOpen(true)}
              disabled={!canOperate || count === 0}
              style={{
                width: "100%", padding: 15, fontSize: 15, fontWeight: 700, borderRadius: 30, marginBottom: 9,
                cursor: (!canOperate || count === 0) ? "not-allowed" : "pointer",
                background: (!canOperate || count === 0) ? "rgba(22,38,31,0.1)" : "var(--bp)",
                color: (!canOperate || count === 0) ? "var(--bmut)" : "var(--bop)",
                border: "1.5px solid var(--bink)",
              }}
            >
              Enviar ahora
            </button>
            <p className="text-[11px] text-center" style={{ color: "var(--bmut)", lineHeight: 1.5 }}>
              ✓ Borrador guardado automáticamente en este navegador
            </p>
          </div>
        </div>
      </div>

      {/* Modal: Añadir medios (Frame 6) */}
      {mediaOpen && (
        <div
          onClick={() => !mediaUploading && setMediaOpen(false)}
          style={{ position: "fixed", inset: 0, zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(22,38,31,0.5)", padding: 16 }}
        >
          <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 460, background: "#fff", borderRadius: 20, padding: 24 }}>
            <div className="flex items-center justify-between mb-3.5">
              <h2 className="font-heading" style={{ fontSize: 18, color: "var(--bink)" }}>Añadir imagen</h2>
              <button onClick={() => setMediaOpen(false)} aria-label="Cerrar" style={{ border: "none", background: "transparent", cursor: "pointer", fontSize: 20, color: "var(--bmut)" }}>×</button>
            </div>

            <label
              htmlFor="comms-media-input"
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => { e.preventDefault(); pickMediaFile(e.dataTransfer.files?.[0]); }}
              style={{
                display: "block", border: "2px dashed var(--bbord)", borderRadius: 14, padding: "32px 20px",
                textAlign: "center", marginBottom: 14, cursor: "pointer",
              }}
            >
              <div style={{ fontSize: 30, marginBottom: 8 }}>⬆</div>
              <div className="font-bold text-[14px] mb-1" style={{ color: "var(--bink)" }}>Arrastrá una imagen o hacé clic</div>
              <div className="text-[12px]" style={{ color: "var(--bmut)" }}>JPG, PNG, WEBP o GIF · hasta 25 MB</div>
              <input
                id="comms-media-input"
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                onChange={(e) => pickMediaFile(e.target.files?.[0])}
                style={{ display: "none" }}
              />
            </label>

            {mediaFile && (
              <div className="flex items-center gap-3 rounded-[10px] px-3 py-2.5 mb-3.5" style={{ background: "var(--bbg)" }}>
                <div style={{ width: 40, height: 40, borderRadius: 8, background: "var(--bsec)", flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="text-[12.5px] font-semibold truncate" style={{ color: "var(--bink)" }}>{mediaFile.name}</div>
                </div>
                <span className="text-[11px]" style={{ color: "var(--bmut)" }}>{(mediaFile.size / 1024 / 1024).toFixed(1)} MB</span>
              </div>
            )}

            {mediaError && <p className="text-[12px] mb-3" style={{ color: "#c2410c" }}>{mediaError}</p>}

            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setMediaOpen(false)} disabled={mediaUploading} style={{ padding: "10px 18px", fontSize: 13, borderRadius: 10, background: "#fff", border: "1.5px solid var(--bink)", color: "var(--bink)", cursor: "pointer" }}>
                Cancelar
              </button>
              <button type="button" onClick={insertMedia} disabled={!mediaFile || mediaUploading} style={{
                padding: "10px 18px", fontSize: 13, borderRadius: 10, fontWeight: 700,
                background: !mediaFile || mediaUploading ? "rgba(22,38,31,0.1)" : "var(--bp)",
                color: !mediaFile || mediaUploading ? "var(--bmut)" : "var(--bop)",
                border: "1.5px solid var(--bink)", cursor: !mediaFile || mediaUploading ? "not-allowed" : "pointer",
              }}>
                {mediaUploading ? "Subiendo…" : "Insertar"}
              </button>
            </div>
            <p className="text-[11px] mt-3" style={{ color: "var(--bmut)", lineHeight: 1.5 }}>
              SVG no permitido. La imagen se guarda en el servidor y se inserta por URL pública (no como adjunto).
            </p>
          </div>
        </div>
      )}

      {/* Modal: Vista previa + envío de prueba (Frame 3) */}
      {previewOpen && (
        <div
          onClick={() => setPreviewOpen(false)}
          style={{ position: "fixed", inset: 0, zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(22,38,31,0.5)", padding: 16 }}
        >
          <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 560, maxHeight: "90vh", overflowY: "auto", background: "#fff", borderRadius: 20, padding: 22 }}>
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-heading" style={{ fontSize: 18, color: "var(--bink)" }}>Vista previa</h2>
              <button onClick={() => setPreviewOpen(false)} aria-label="Cerrar" style={{ border: "none", background: "transparent", cursor: "pointer", fontSize: 20, color: "var(--bmut)" }}>×</button>
            </div>

            {previewLoading && <p className="text-[13px]" style={{ color: "var(--bmut)" }}>Generando…</p>}
            {previewError && <p className="text-[12.5px]" style={{ color: "#c2410c" }}>{previewError}</p>}
            {previewHtml && (
              <iframe srcDoc={previewHtml} title="Vista previa del email" style={{ width: "100%", height: 380, border: "1.5px solid var(--bbord)", borderRadius: 12, marginBottom: 16 }} />
            )}

            <label style={fieldLabel}>Enviar prueba a</label>
            <div className="flex gap-2 mb-2.5">
              <input
                type="email"
                value={testEmailInput}
                onChange={(e) => setTestEmailInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addTestEmail(); } }}
                placeholder="tucorreo@ejemplo.com"
                style={{ ...inputStyle, flex: 1, padding: "9px 12px", fontSize: 13 }}
              />
              <button type="button" onClick={addTestEmail} style={{ padding: "0 16px", borderRadius: 30, fontSize: 12, fontWeight: 700, cursor: "pointer", background: "#fff", border: "1.5px solid var(--bink)", color: "var(--bink)" }}>
                Agregar
              </button>
            </div>
            {testEmails.length > 0 && (
              <div className="flex gap-1.5 flex-wrap mb-3">
                {testEmails.map((e) => (
                  <span key={e} className="inline-flex items-center gap-1.5 text-[11px] font-bold rounded-full px-2.5 py-1" style={{ background: "var(--bbg)", color: "var(--bink)" }}>
                    {e}
                    <button type="button" onClick={() => setTestEmails(testEmails.filter((x) => x !== e))} aria-label={`Quitar ${e}`} style={{ border: "none", background: "transparent", cursor: "pointer", color: "var(--bmut)" }}>×</button>
                  </span>
                ))}
              </div>
            )}
            <button
              type="button"
              onClick={sendTest}
              disabled={testEmails.length === 0 || testSending}
              style={{
                width: "100%", padding: 12, fontSize: 13, fontWeight: 700, borderRadius: 30,
                cursor: testEmails.length === 0 || testSending ? "not-allowed" : "pointer",
                background: "#fff", border: "1.5px solid var(--bink)", color: "var(--bink)",
                opacity: testEmails.length === 0 || testSending ? 0.5 : 1,
              }}
            >
              {testSending ? "Enviando…" : `Enviar prueba (${testEmails.length} dirección(es))`}
            </button>
            {testResult && <p className="text-[12px] mt-2" style={{ color: testResult.startsWith("✓") ? "#3d6b35" : "#c2410c" }}>{testResult}</p>}
          </div>
        </div>
      )}

      {/* Modal: Confirmar envío real (Frame 7) */}
      {confirmOpen && (
        <div
          onClick={() => !sending && setConfirmOpen(false)}
          style={{ position: "fixed", inset: 0, zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(22,38,31,0.5)", padding: 16 }}
        >
          <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 420, background: "#fff", borderRadius: 20, padding: 26 }}>
            <h2 className="font-heading" style={{ fontSize: 18, color: "var(--bink)", marginBottom: 8 }}>Confirmar envío</h2>
            <p className="text-[13px] mb-3.5" style={{ color: "var(--bmut)", lineHeight: 1.55 }}>
              Vas a enviar <strong style={{ color: "var(--bink)" }}>«{draft.subject}»</strong> a firmantes reales:
            </p>
            <ul className="text-[13px] mb-4" style={{ color: "rgba(22,38,31,0.75)", lineHeight: 1.8, paddingLeft: 18 }}>
              <li><strong>{count ?? "—"}</strong> destinatario(s) ({activeType.label} · {activeType.clase === "anuncios" ? "Anuncios" : "Servicio"})</li>
              {quotaExceeded && <li>Excede el remanente de cuota diaria — el excedente puede fallar en este envío inmediato</li>}
            </ul>
            {sendError && <p className="text-[12.5px] mb-3" style={{ color: "#c2410c" }}>{sendError}</p>}
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setConfirmOpen(false)} disabled={sending} style={{ padding: "10px 18px", fontSize: 13, borderRadius: 10, background: "#fff", border: "1.5px solid var(--bink)", color: "var(--bink)", cursor: "pointer" }}>
                Cancelar
              </button>
              <button type="button" onClick={sendReal} disabled={sending} style={{ padding: "10px 18px", fontSize: 13, borderRadius: 10, background: "var(--bp)", border: "1.5px solid var(--bink)", color: "var(--bop)", fontWeight: 700, cursor: sending ? "not-allowed" : "pointer" }}>
                {sending ? "Enviando…" : "Sí, enviar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
