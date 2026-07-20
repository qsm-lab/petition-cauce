"use client";

import { useRef, useState } from "react";
import {
  previewEventInvitation,
  sendEventInvitation,
  previewClosingNotification,
  sendClosingNotification,
  notifySigners,
  type EventInvitationData,
  type ClosingNotificationData,
} from "@/lib/admin-lifecycle-api";

interface Props {
  campaignId: string;
  onClose: () => void;
}

type Tab = "event" | "closing" | "message";

const inputStyle: React.CSSProperties = {
  width: "100%", boxSizing: "border-box", padding: "8px 10px", borderRadius: 10,
  border: "1.5px solid var(--bbord)", fontSize: 13, color: "#16261F",
  fontFamily: "inherit", outline: "none",
};

const labelStyle: React.CSSProperties = {
  display: "block", fontSize: 11, fontWeight: 700, letterSpacing: "0.04em",
  textTransform: "uppercase", color: "rgba(22,38,31,0.5)", marginBottom: 4,
};

/** Borrador persistido en localStorage — sobrevive a cambiar de pestaña o
 * cerrar el popup. No hay borrador server-side (eso queda para cuando se
 * construya historial/programación, ver conversación). */
function useDraft<T extends object>(key: string, initial: T) {
  const restoredNonEmpty = useRef(false);
  const [state, setState] = useState<T>(() => {
    if (typeof window === "undefined") return initial;
    try {
      const raw = window.localStorage.getItem(key);
      if (!raw) return initial;
      const parsed = { ...initial, ...JSON.parse(raw) };
      restoredNonEmpty.current = Object.values(parsed).some((v) => (typeof v === "string" ? v.trim() : Array.isArray(v) ? v.length : v));
      return parsed;
    } catch {
      return initial;
    }
  });

  function set<K extends keyof T>(field: K, value: T[K]) {
    setState((prev) => {
      const next = { ...prev, [field]: value };
      try { window.localStorage.setItem(key, JSON.stringify(next)); } catch { /* storage lleno o bloqueado */ }
      return next;
    });
  }

  function clearDraft() {
    try { window.localStorage.removeItem(key); } catch { /* noop */ }
    setState(initial);
  }

  return { state, set, clearDraft, wasRestored: restoredNonEmpty.current };
}

function DraftBanner({ visible, onDiscard }: { visible: boolean; onDiscard: () => void }) {
  if (!visible) return null;
  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8,
      fontSize: 12, color: "#7a8a72", background: "var(--bbg)", borderRadius: 8, padding: "6px 10px",
    }}>
      <span>Se restauró un borrador guardado en este navegador.</span>
      <button type="button" onClick={onDiscard} style={{ border: "none", background: "transparent", color: "#c2410c", cursor: "pointer", fontSize: 12, fontWeight: 700, whiteSpace: "nowrap" }}>
        Descartar
      </button>
    </div>
  );
}

const toolbarBtnStyle: React.CSSProperties = {
  border: "1.5px solid var(--bbord)", background: "#fff", borderRadius: 6,
  width: 24, height: 24, fontSize: 12, cursor: "pointer", color: "#16261F",
  display: "flex", alignItems: "center", justifyContent: "center", padding: 0,
};

/** Textarea con negrita/cursiva (envuelve la selección con asteriscos dobles
 * o simples, mismo formato que interpreta _render_message_html en el
 * backend) y saltos de línea nativos — una línea en blanco separa párrafos
 * en el email. */
function MessageField({
  value, onChange, rows = 2, placeholder,
}: { value: string; onChange: (v: string) => void; rows?: number; placeholder?: string }) {
  const ref = useRef<HTMLTextAreaElement>(null);

  function wrap(marker: string) {
    const el = ref.current;
    if (!el) return;
    const { selectionStart, selectionEnd } = el;
    const selected = value.slice(selectionStart, selectionEnd) || "texto";
    const next = value.slice(0, selectionStart) + marker + selected + marker + value.slice(selectionEnd);
    onChange(next);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(selectionStart + marker.length, selectionStart + marker.length + selected.length);
    });
  }

  return (
    <div>
      <div style={{ display: "flex", gap: 4, marginBottom: 4 }}>
        <button type="button" onClick={() => wrap("**")} style={{ ...toolbarBtnStyle, fontWeight: 800 }} aria-label="Negrita" title="Negrita">B</button>
        <button type="button" onClick={() => wrap("*")} style={{ ...toolbarBtnStyle, fontStyle: "italic" }} aria-label="Cursiva" title="Cursiva">I</button>
      </div>
      <textarea
        ref={ref}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={rows}
        style={{ ...inputStyle, resize: "vertical" }}
      />
      <p style={{ margin: "4px 0 0", fontSize: 11, color: "rgba(22,38,31,0.45)" }}>
        **negrita**, *cursiva*. Una línea en blanco separa párrafos.
      </p>
    </div>
  );
}

function TestEmailsField({
  emails, onChange,
}: { emails: string[]; onChange: (v: string[]) => void }) {
  const [value, setValue] = useState("");

  function add() {
    const v = value.trim();
    if (v && !emails.includes(v)) onChange([...emails, v]);
    setValue("");
  }

  return (
    <div>
      <label style={labelStyle}>Emails de prueba</label>
      <div style={{ display: "flex", gap: 6, marginBottom: 6 }}>
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }}
          placeholder="tucorreo@ejemplo.com"
          style={{ ...inputStyle, flex: 1 }}
        />
        <button type="button" onClick={add} style={{
          padding: "0 14px", borderRadius: 10, fontSize: 12, fontWeight: 700, cursor: "pointer",
          background: "var(--bbg)", border: "1.5px solid var(--bbord)", color: "#16261F",
        }}>
          Agregar
        </button>
      </div>
      {emails.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {emails.map((e) => (
            <span key={e} style={{
              display: "flex", alignItems: "center", gap: 6, fontSize: 12,
              background: "var(--bbg)", borderRadius: 20, padding: "4px 10px", color: "#16261F",
            }}>
              {e}
              <button
                type="button"
                onClick={() => onChange(emails.filter((x) => x !== e))}
                style={{ border: "none", background: "transparent", cursor: "pointer", color: "rgba(22,38,31,0.5)", fontSize: 13, lineHeight: 1, padding: 0 }}
                aria-label={`Quitar ${e}`}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

interface EventDraft {
  eventTitle: string;
  eventDatetime: string;
  eventSubtitle: string;
  eventLocation: string;
  eventMapUrl: string;
  eventImageUrl: string;
  message: string;
  subject: string;
}
const EVENT_DRAFT_DEFAULT: EventDraft = {
  eventTitle: "", eventDatetime: "", eventSubtitle: "", eventLocation: "",
  eventMapUrl: "", eventImageUrl: "", message: "", subject: "",
};

function EventInvitationTab({ campaignId }: { campaignId: string }) {
  const { state: d, set, clearDraft, wasRestored } = useDraft(`adherent-comms:${campaignId}:event`, EVENT_DRAFT_DEFAULT);
  const [testEmails, setTestEmails] = useState<string[]>([]);
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [recipientCount, setRecipientCount] = useState<number | null>(null);
  const [loading, setLoading] = useState<"" | "preview" | "test" | "real">("");
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function buildData(): EventInvitationData {
    return {
      event_title: d.eventTitle || null,
      event_subtitle: d.eventSubtitle || null,
      event_datetime: d.eventDatetime ? new Date(d.eventDatetime).toISOString() : "",
      event_location: d.eventLocation,
      event_map_url: d.eventMapUrl || null,
      event_image_url: d.eventImageUrl || null,
      message: d.message || null,
      subject: d.subject || null,
    };
  }

  const canSubmit = d.eventDatetime.trim() && d.eventLocation.trim();

  async function handlePreview() {
    if (!canSubmit) return;
    setLoading("preview"); setError(null);
    try {
      const res = await previewEventInvitation(campaignId, buildData());
      setPreviewHtml(res.html);
      setRecipientCount(res.recipient_count);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error al generar la vista previa");
    } finally {
      setLoading("");
    }
  }

  async function handleSendTest() {
    if (!canSubmit || testEmails.length === 0) return;
    setLoading("test"); setResult(null); setError(null);
    try {
      const res = await sendEventInvitation(campaignId, buildData(), testEmails);
      setResult(`✓ Prueba enviada a ${res.sent_count} dirección(es).`);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error al enviar la prueba");
    } finally {
      setLoading("");
    }
  }

  async function handleSendReal() {
    if (!canSubmit) return;
    if (!confirm(`Esto envía la invitación a ${recipientCount ?? "?"} firmante(s) reales. ¿Confirmás?`)) return;
    setLoading("real"); setResult(null); setError(null);
    try {
      const res = await sendEventInvitation(campaignId, buildData());
      setResult(`✓ Invitación enviada a ${res.sent_count} firmante(s).`);
      clearDraft();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error al enviar la invitación");
    } finally {
      setLoading("");
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <DraftBanner visible={wasRestored} onDiscard={clearDraft} />
      <p style={{ margin: 0, fontSize: 12, color: "rgba(22,38,31,0.55)" }}>
        Se envía a firmas confirmadas y nacionales (país no registrado).
      </p>
      <div>
        <label style={labelStyle}>Título del evento (opcional)</label>
        <input value={d.eventTitle} onChange={(e) => set("eventTitle", e.target.value)} placeholder="Entrega de la petición" style={inputStyle} />
      </div>
      <div style={{ display: "flex", gap: 10 }}>
        <div style={{ flex: 1 }}>
          <label style={labelStyle}>Fecha y hora *</label>
          <input type="datetime-local" value={d.eventDatetime} onChange={(e) => set("eventDatetime", e.target.value)} style={inputStyle} />
        </div>
      </div>
      <div>
        <label style={labelStyle}>Lugar *</label>
        <input value={d.eventLocation} onChange={(e) => set("eventLocation", e.target.value)} placeholder="Cancillería, Quito" style={inputStyle} />
      </div>
      <div>
        <label style={labelStyle}>Subtítulo del recuadro (opcional)</label>
        <input value={d.eventSubtitle} onChange={(e) => set("eventSubtitle", e.target.value)} placeholder="Frente a la sede principal" style={inputStyle} />
      </div>
      <div>
        <label style={labelStyle}>Link de mapa (opcional)</label>
        <input value={d.eventMapUrl} onChange={(e) => set("eventMapUrl", e.target.value)} placeholder="https://maps.google.com/…" style={inputStyle} />
      </div>
      <div>
        <label style={labelStyle}>Imagen de branding — URL (opcional)</label>
        <input value={d.eventImageUrl} onChange={(e) => set("eventImageUrl", e.target.value)} placeholder="https://…" style={inputStyle} />
      </div>
      <div>
        <label style={labelStyle}>Mensaje adicional (opcional)</label>
        <MessageField value={d.message} onChange={(v) => set("message", v)} />
      </div>
      <div>
        <label style={labelStyle}>Asunto (opcional)</label>
        <input value={d.subject} onChange={(e) => set("subject", e.target.value)} placeholder="Te invitamos: entrega de la petición" style={inputStyle} />
      </div>

      <button type="button" onClick={handlePreview} disabled={!canSubmit || loading !== ""} style={secondaryBtnStyle(!canSubmit)}>
        {loading === "preview" ? "Generando…" : "Vista previa"}
      </button>

      {previewHtml && (
        <>
          <iframe srcDoc={previewHtml} title="Vista previa del email" style={{ width: "100%", height: 420, border: "1.5px solid var(--bbord)", borderRadius: 12 }} />
          {recipientCount !== null && (
            <p style={{ margin: 0, fontSize: 12, color: "rgba(22,38,31,0.55)" }}>
              Audiencia real actual: <strong>{recipientCount}</strong> firmante(s).
            </p>
          )}

          <div style={{ borderTop: "1px solid var(--bbord)", paddingTop: 12, display: "flex", flexDirection: "column", gap: 8 }}>
            <TestEmailsField emails={testEmails} onChange={setTestEmails} />
            <button type="button" onClick={handleSendTest} disabled={testEmails.length === 0 || loading !== ""} style={secondaryBtnStyle(testEmails.length === 0)}>
              {loading === "test" ? "Enviando…" : "Enviar prueba"}
            </button>
          </div>

          <div style={{ borderTop: "1px solid var(--bbord)", paddingTop: 12 }}>
            <button type="button" onClick={handleSendReal} disabled={loading !== ""} style={primaryBtnStyle(false)}>
              {loading === "real" ? "Enviando…" : `Enviar a firmantes (${recipientCount ?? "…"})`}
            </button>
          </div>
        </>
      )}

      {result && <p style={resultStyle(true)}>{result}</p>}
      {error && <p style={resultStyle(false)}>{error}</p>}
    </div>
  );
}

interface ClosingDraft {
  subtitle: string;
  imageUrl: string;
  message: string;
  subject: string;
}
const CLOSING_DRAFT_DEFAULT: ClosingDraft = { subtitle: "", imageUrl: "", message: "", subject: "" };

function ClosingNotificationTab({ campaignId }: { campaignId: string }) {
  const { state: d, set, clearDraft, wasRestored } = useDraft(`adherent-comms:${campaignId}:closing`, CLOSING_DRAFT_DEFAULT);
  const [testEmails, setTestEmails] = useState<string[]>([]);
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [finalCount, setFinalCount] = useState<number | null>(null);
  const [recipientCount, setRecipientCount] = useState<number | null>(null);
  const [loading, setLoading] = useState<"" | "preview" | "test" | "real">("");
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function buildData(): ClosingNotificationData {
    return {
      subtitle: d.subtitle || null,
      image_url: d.imageUrl || null,
      message: d.message || null,
      subject: d.subject || null,
    };
  }

  async function handlePreview() {
    setLoading("preview"); setError(null);
    try {
      const res = await previewClosingNotification(campaignId, buildData());
      setPreviewHtml(res.html);
      setFinalCount(res.final_count);
      setRecipientCount(res.recipient_count);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error al generar la vista previa");
    } finally {
      setLoading("");
    }
  }

  async function handleSendTest() {
    if (testEmails.length === 0) return;
    setLoading("test"); setResult(null); setError(null);
    try {
      const res = await sendClosingNotification(campaignId, buildData(), testEmails);
      setResult(`✓ Prueba enviada a ${res.sent_count} dirección(es).`);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error al enviar la prueba");
    } finally {
      setLoading("");
    }
  }

  async function handleSendReal() {
    if (!confirm(`Esto envía el aviso de cierre a ${recipientCount ?? "?"} firmante(s) reales, con un total de ${finalCount ?? "?"} firmas. ¿Confirmás?`)) return;
    setLoading("real"); setResult(null); setError(null);
    try {
      const res = await sendClosingNotification(campaignId, buildData());
      setResult(`✓ Aviso de cierre enviado a ${res.sent_count} firmante(s).`);
      clearDraft();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error al enviar el aviso de cierre");
    } finally {
      setLoading("");
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <DraftBanner visible={wasRestored} onDiscard={clearDraft} />
      <p style={{ margin: 0, fontSize: 12, color: "rgba(22,38,31,0.55)" }}>
        Incluye el conteo final y los enlaces de redes/newsletter ya cargados en la campaña. Se envía a todas las firmas confirmadas (nacional + internacional).
      </p>
      <div>
        <label style={labelStyle}>Subtítulo del recuadro (opcional)</label>
        <input value={d.subtitle} onChange={(e) => set("subtitle", e.target.value)} placeholder="Resultado final" style={inputStyle} />
      </div>
      <div>
        <label style={labelStyle}>Imagen de branding — URL (opcional)</label>
        <input value={d.imageUrl} onChange={(e) => set("imageUrl", e.target.value)} placeholder="https://…" style={inputStyle} />
      </div>
      <div>
        <label style={labelStyle}>Mensaje adicional (opcional)</label>
        <MessageField value={d.message} onChange={(v) => set("message", v)} />
      </div>
      <div>
        <label style={labelStyle}>Asunto (opcional)</label>
        <input value={d.subject} onChange={(e) => set("subject", e.target.value)} placeholder="La campaña cerró" style={inputStyle} />
      </div>

      <button type="button" onClick={handlePreview} disabled={loading !== ""} style={secondaryBtnStyle(false)}>
        {loading === "preview" ? "Generando…" : "Vista previa"}
      </button>

      {previewHtml && (
        <>
          <iframe srcDoc={previewHtml} title="Vista previa del email" style={{ width: "100%", height: 420, border: "1.5px solid var(--bbord)", borderRadius: 12 }} />
          <p style={{ margin: 0, fontSize: 12, color: "rgba(22,38,31,0.55)" }}>
            Conteo final: <strong>{finalCount}</strong> · Destinatarios: <strong>{recipientCount}</strong>
          </p>

          <div style={{ borderTop: "1px solid var(--bbord)", paddingTop: 12, display: "flex", flexDirection: "column", gap: 8 }}>
            <TestEmailsField emails={testEmails} onChange={setTestEmails} />
            <button type="button" onClick={handleSendTest} disabled={testEmails.length === 0 || loading !== ""} style={secondaryBtnStyle(testEmails.length === 0)}>
              {loading === "test" ? "Enviando…" : "Enviar prueba"}
            </button>
          </div>

          <div style={{ borderTop: "1px solid var(--bbord)", paddingTop: 12 }}>
            <button type="button" onClick={handleSendReal} disabled={loading !== ""} style={primaryBtnStyle(false)}>
              {loading === "real" ? "Enviando…" : `Enviar a firmantes (${recipientCount ?? "…"})`}
            </button>
          </div>
        </>
      )}

      {result && <p style={resultStyle(true)}>{result}</p>}
      {error && <p style={resultStyle(false)}>{error}</p>}
    </div>
  );
}

interface MessageDraft {
  message: string;
}
const MESSAGE_DRAFT_DEFAULT: MessageDraft = { message: "" };

function MessageTab({ campaignId }: { campaignId: string }) {
  const { state: d, set, clearDraft, wasRestored } = useDraft(`adherent-comms:${campaignId}:message`, MESSAGE_DRAFT_DEFAULT);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  async function handleSend() {
    if (!d.message.trim()) return;
    setSending(true); setResult(null);
    try {
      const res = await notifySigners(campaignId, d.message);
      setResult(
        res.sent_count === 0
          ? "Sin firmantes suscritos a notificaciones."
          : `✓ ${res.sent_count} email(s) enviados a firmantes.`
      );
      if (res.sent_count > 0) clearDraft();
    } catch (e: unknown) {
      setResult(e instanceof Error ? e.message : "Error al enviar");
    } finally {
      setSending(false);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <DraftBanner visible={wasRestored} onDiscard={clearDraft} />
      <p style={{ margin: 0, fontSize: 12, color: "rgba(22,38,31,0.55)" }}>
        Mensaje libre, sin plantilla ni vista previa. Solo se envía a firmantes que consintieron recibir novedades.
      </p>
      <MessageField
        value={d.message}
        onChange={(v) => set("message", v)}
        rows={4}
        placeholder="Escribe el mensaje para los firmantes…"
      />
      {result && <p style={resultStyle(result.startsWith("✓"))}>{result}</p>}
      <button
        type="button"
        onClick={handleSend}
        disabled={sending || !d.message.trim()}
        style={primaryBtnStyle(sending || !d.message.trim())}
      >
        {sending ? "Enviando…" : "Enviar a firmantes"}
      </button>
    </div>
  );
}

function secondaryBtnStyle(disabled: boolean): React.CSSProperties {
  return {
    width: "100%", padding: "9px 0", borderRadius: 10, fontSize: 13, fontWeight: 700,
    cursor: disabled ? "not-allowed" : "pointer",
    background: "transparent", border: "1.5px solid var(--bbord)", color: "#16261F",
    opacity: disabled ? 0.45 : 1,
  };
}

function primaryBtnStyle(disabled: boolean): React.CSSProperties {
  return {
    width: "100%", padding: "10px 0", borderRadius: 10, fontSize: 13, fontWeight: 700,
    cursor: disabled ? "not-allowed" : "pointer",
    background: disabled ? "rgba(22,38,31,0.08)" : "#16261F",
    color: disabled ? "rgba(22,38,31,0.35)" : "#fff",
    border: "none",
  };
}

function resultStyle(ok: boolean): React.CSSProperties {
  return {
    fontSize: 12, margin: 0, padding: "8px 10px", borderRadius: 8,
    color: ok ? "#3d6b35" : "#c2410c",
    background: ok ? "color-mix(in srgb,#3d6b35 8%,transparent)" : "color-mix(in srgb,#c2410c 8%,transparent)",
  };
}

export default function AdherentCommsModal({ campaignId, onClose }: Props) {
  const [tab, setTab] = useState<Tab>("event");

  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 50,
        display: "flex", alignItems: "center", justifyContent: "center",
        background: "rgba(22,38,31,0.5)", padding: "16px",
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%", maxWidth: 560, maxHeight: "90vh", overflowY: "auto",
          background: "#fff", borderRadius: 20, padding: "24px 24px 20px",
          boxShadow: "0 12px 40px rgba(22,38,31,0.18)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: "#16261F" }}>Comunicación con adherentes</h2>
          <button
            onClick={onClose}
            aria-label="Cerrar"
            style={{ border: "none", background: "transparent", cursor: "pointer", fontSize: 20, color: "rgba(22,38,31,0.5)", lineHeight: 1 }}
          >
            ×
          </button>
        </div>

        <div style={{ display: "flex", gap: 6, marginBottom: 16 }}>
          {([["event", "Invitación al evento"], ["closing", "Aviso de cierre"], ["message", "Mensaje libre"]] as const).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              style={{
                flex: 1, padding: "8px 0", borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: "pointer",
                background: tab === key ? "#16261F" : "var(--bbg)",
                color: tab === key ? "#fff" : "#16261F",
                border: "1.5px solid var(--bbord)",
              }}
            >
              {label}
            </button>
          ))}
        </div>

        {tab === "event" && <EventInvitationTab campaignId={campaignId} />}
        {tab === "closing" && <ClosingNotificationTab campaignId={campaignId} />}
        {tab === "message" && <MessageTab campaignId={campaignId} />}
      </div>
    </div>
  );
}
