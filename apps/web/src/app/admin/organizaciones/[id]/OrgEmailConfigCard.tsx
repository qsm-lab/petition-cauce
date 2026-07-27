"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import type { OrgEmailConfig, OrgEmailConfigUpdate } from "@/lib/admin-orgs-api";

interface Props {
  orgId: string;
  initialConfig: OrgEmailConfig | null;
}

const inputCls = "w-full px-3 py-2 rounded-[8px] text-[13px] outline-none";
const inputStyle = { border: "1px solid var(--bbord)", background: "var(--bbg)", color: "var(--bink)" };
const labelCls = "block text-[11.5px] font-semibold mb-1";
const labelStyle = { color: "var(--bmut)" };
const fieldLabelCls = "text-[11px] font-semibold uppercase tracking-wide mb-0.5";
const fieldLabelStyle = { color: "var(--bmut)" };

type FormState = {
  api_key: string;
  plan: string;
  allowed_domains: string;
  default_from: string;
  default_display_name: string;
  default_reply_to: string;
  status: "active" | "disabled";
};

function emptyForm(cfg: OrgEmailConfig | null): FormState {
  return {
    api_key: "",
    plan: cfg?.plan ?? "free",
    allowed_domains: (cfg?.allowed_domains ?? []).join(", "),
    default_from: cfg?.default_from ?? "",
    default_display_name: cfg?.default_display_name ?? "",
    default_reply_to: cfg?.default_reply_to ?? "",
    status: (cfg?.status as "active" | "disabled") ?? "active",
  };
}

export default function OrgEmailConfigCard({ orgId, initialConfig }: Props) {
  const [config, setConfig] = useState<OrgEmailConfig | null>(initialConfig);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm(initialConfig));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [testTo, setTestTo] = useState("");
  const [testStatus, setTestStatus] = useState<"idle" | "sending" | "ok" | "error">("idle");

  function setField<K extends keyof FormState>(k: K, v: FormState[K]) {
    setForm((prev) => ({ ...prev, [k]: v }));
  }

  function startEdit() {
    setForm(emptyForm(config));
    setError("");
    setEditing(true);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const payload: OrgEmailConfigUpdate = {
        provider: "resend",
        plan: form.plan,
        allowed_domains: form.allowed_domains
          .split(",")
          .map((d) => d.trim())
          .filter(Boolean),
        default_from: form.default_from || undefined,
        default_display_name: form.default_display_name || undefined,
        default_reply_to: form.default_reply_to || undefined,
        status: form.status,
        ...(form.api_key ? { api_key: form.api_key } : {}),
      };
      const updated = await api.put<OrgEmailConfig>(`/v1/admin/organizaciones/${orgId}/email-config`, payload);
      setConfig(updated);
      setEditing(false);
    } catch {
      setError("No se pudo guardar la configuración.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!confirm("¿Eliminar la configuración propia? La organización volverá a usar el proveedor de plataforma.")) return;
    try {
      await api.delete(`/v1/admin/organizaciones/${orgId}/email-config`);
      setConfig(null);
      setEditing(false);
    } catch {
      alert("No se pudo eliminar la configuración.");
    }
  }

  async function handleTest() {
    if (!testTo.trim()) return;
    setTestStatus("sending");
    try {
      await api.post(`/v1/admin/organizaciones/${orgId}/email-config/test`, { to: testTo.trim() });
      setTestStatus("ok");
    } catch {
      setTestStatus("error");
    }
  }

  // Una org recién creada ya tiene una fila de config (R2b: dominio + provider
  // default) pero SIN credenciales — sigue usando la plataforma hasta que se
  // complete con una API key real, así que la card la trata como "no
  // configurada" (no "Resend · configurada") para no ser engañosa.
  const isConfigured = Boolean(config?.has_credentials);

  const dailyPct =
    config?.daily_quota && config.daily_used != null
      ? Math.min(100, Math.round((config.daily_used / config.daily_quota) * 100))
      : null;

  return (
    <div className="rounded-[14px] overflow-hidden" style={{ backgroundColor: "var(--bsurf)", border: "1px solid var(--bbord)" }}>
      <div
        className="px-5 py-3.5 flex items-center justify-between"
        style={{ borderBottom: "1px solid var(--bbord)", backgroundColor: "var(--bbg)" }}
      >
        <div className="flex items-center gap-2.5">
          <p className="text-[13px] font-bold" style={{ color: "var(--bink)" }}>Configuración de email</p>
          <span
            className="inline-flex items-center font-bold text-[11px]"
            style={{
              background: isConfigured ? "var(--bsec)" : "#f3f4f6",
              color: isConfigured ? "var(--bink)" : "#6b7280",
              padding: "3px 9px",
              borderRadius: "99px",
            }}
          >
            {isConfigured ? "Resend · configurada" : "Usa la de plataforma"}
          </span>
        </div>
        {!editing && (
          <button
            onClick={startEdit}
            className="text-[12px] font-semibold px-3 py-1.5 rounded-[8px]"
            style={{ background: isConfigured ? "var(--bbord)" : "var(--bp)", color: isConfigured ? "var(--bink)" : "var(--bop)" }}
          >
            {isConfigured ? "Editar" : "Configurar"}
          </button>
        )}
      </div>

      {!editing ? (
        <div className="px-5 py-4">
          {!config || !config.has_credentials ? (
            <p className="text-[13px]" style={{ color: "var(--bmut)" }}>
              Esta organización no tiene proveedor de email propio configurado — sus correos se
              envían con la cuenta de plataforma (Resend). Configuralo si necesita su propio
              remitente, dominio o cuota.
            </p>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-x-8 gap-y-3">
                <div>
                  <p className={fieldLabelCls} style={fieldLabelStyle}>Proveedor</p>
                  <p className="text-[13px]" style={{ color: "var(--bink)" }}>Resend</p>
                </div>
                <div>
                  <p className={fieldLabelCls} style={fieldLabelStyle}>Plan</p>
                  <p className="text-[13px]" style={{ color: "var(--bink)" }}>{config.plan ?? "—"}</p>
                </div>
                <div>
                  <p className={fieldLabelCls} style={fieldLabelStyle}>Remitente por defecto</p>
                  <p className="text-[13px] break-words" style={{ color: config.default_from ? "var(--bink)" : "var(--bmut)" }}>
                    {config.default_display_name && config.default_from
                      ? `${config.default_display_name} <${config.default_from}>`
                      : config.default_from || "—"}
                  </p>
                </div>
                <div>
                  <p className={fieldLabelCls} style={fieldLabelStyle}>Reply-to</p>
                  <p className="text-[13px] break-words" style={{ color: config.default_reply_to ? "var(--bink)" : "var(--bmut)" }}>
                    {config.default_reply_to || "—"}
                  </p>
                </div>
                <div className="col-span-2">
                  <p className={fieldLabelCls} style={fieldLabelStyle}>Dominios permitidos</p>
                  <p className="text-[13px]" style={{ color: config.allowed_domains.length ? "var(--bink)" : "var(--bmut)" }}>
                    {config.allowed_domains.length ? config.allowed_domains.join(", ") : "—"}
                  </p>
                </div>
              </div>

              <div style={{ height: 1, background: "var(--bbord)", margin: "18px 0" }} />

              <p className={fieldLabelCls} style={{ ...fieldLabelStyle, marginBottom: 8 }}>Consumo de hoy</p>
              {dailyPct !== null ? (
                <>
                  <div className="flex items-center gap-2.5 mb-1">
                    <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: "var(--bbord)" }}>
                      <div className="h-full" style={{ width: `${dailyPct}%`, background: "var(--bp)" }} />
                    </div>
                    <span className="text-[11.5px] font-bold whitespace-nowrap" style={{ color: "var(--bink)" }}>
                      {config.daily_used} / {config.daily_quota} diarias
                    </span>
                  </div>
                </>
              ) : (
                <p className="text-[12.5px]" style={{ color: "var(--bink)" }}>{config.daily_used} enviados hoy (sin límite diario declarado)</p>
              )}
              <p className="text-[11px] mt-1" style={{ color: "var(--bmut)" }}>
                Cuota mensual: {config.monthly_used}{config.monthly_quota ? ` / ${config.monthly_quota}` : ""}
                {config.provider_snapshot ? " · actualizado con el último envío (Resend)" : ""}
              </p>
            </>
          )}
        </div>
      ) : (
        <form onSubmit={handleSave} className="px-5 py-4 flex flex-col gap-4">
          <div>
            <label className={labelCls} style={labelStyle}>Proveedor</label>
            <select className={inputCls} style={inputStyle} value="resend" disabled>
              <option value="resend">Resend</option>
            </select>
            <p className="text-[11px] mt-1" style={{ color: "var(--bmut)" }}>
              Por ahora solo Resend (Fase 1). SMTP y otros proveedores se agregan cuando una
              organización lo necesite.
            </p>
          </div>

          <div>
            <label className={labelCls} style={labelStyle}>API key de Resend</label>
            <input
              type="password"
              className={inputCls}
              style={inputStyle}
              value={form.api_key}
              onChange={(e) => setField("api_key", e.target.value)}
              placeholder={config?.has_credentials ? "•••••••••• (configurada — dejar en blanco para conservarla)" : "re_..."}
            />
            <p className="text-[11px] mt-1" style={{ color: "var(--bmut)" }}>
              Nunca se muestra en claro. Se cifra en reposo con clave dedicada.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls} style={labelStyle}>Plan</label>
              <select className={inputCls} style={inputStyle} value={form.plan} onChange={(e) => setField("plan", e.target.value)}>
                <option value="free">Free (100/día · 3.000/mes)</option>
                <option value="pro">Pro (sin límite diario · 50.000/mes)</option>
              </select>
            </div>
            <div>
              <label className={labelCls} style={labelStyle}>Dominios permitidos</label>
              <input
                className={inputCls}
                style={inputStyle}
                value={form.allowed_domains}
                onChange={(e) => setField("allowed_domains", e.target.value)}
                placeholder="accionecologica.org"
              />
              <p className="text-[11px] mt-1" style={{ color: "var(--bmut)" }}>Separados por coma.</p>
            </div>
            <div>
              <label className={labelCls} style={labelStyle}>Remitente por defecto (from)</label>
              <input
                type="email"
                className={inputCls}
                style={inputStyle}
                value={form.default_from}
                onChange={(e) => setField("default_from", e.target.value)}
                placeholder="hola@accionecologica.org"
              />
            </div>
            <div>
              <label className={labelCls} style={labelStyle}>Nombre a mostrar</label>
              <input
                className={inputCls}
                style={inputStyle}
                value={form.default_display_name}
                onChange={(e) => setField("default_display_name", e.target.value)}
              />
            </div>
            <div>
              <label className={labelCls} style={labelStyle}>Reply-to</label>
              <input
                type="email"
                className={inputCls}
                style={inputStyle}
                value={form.default_reply_to}
                onChange={(e) => setField("default_reply_to", e.target.value)}
              />
            </div>
            <div>
              <label className={labelCls} style={labelStyle}>Estado</label>
              <select
                className={inputCls}
                style={inputStyle}
                value={form.status}
                onChange={(e) => setField("status", e.target.value as "active" | "disabled")}
              >
                <option value="active">Activa</option>
                <option value="disabled">Deshabilitada</option>
              </select>
            </div>
          </div>

          {config && (
            <>
              <div style={{ height: 1, background: "var(--bbord)" }} />
              <div>
                <p className={fieldLabelCls} style={{ ...fieldLabelStyle, marginBottom: 6 }}>Probar configuración</p>
                <div className="flex gap-2">
                  <input
                    type="email"
                    className={inputCls}
                    style={inputStyle}
                    value={testTo}
                    onChange={(e) => { setTestTo(e.target.value); setTestStatus("idle"); }}
                    placeholder="direccion-de-prueba@correo.com"
                  />
                  <button
                    type="button"
                    onClick={handleTest}
                    disabled={testStatus === "sending" || !testTo.trim()}
                    className="text-[12px] font-semibold px-4 py-2 rounded-[8px] whitespace-nowrap disabled:opacity-50"
                    style={{ background: "var(--bbord)", color: "var(--bink)" }}
                  >
                    {testStatus === "sending" ? "Enviando…" : "Enviar prueba"}
                  </button>
                </div>
                {testStatus === "ok" && <p className="text-[11.5px] mt-1.5" style={{ color: "#166534" }}>Enviado — revisá la bandeja de {testTo}.</p>}
                {testStatus === "error" && <p className="text-[11.5px] mt-1.5 text-red-600">No se pudo enviar — revisá la configuración.</p>}
                <p className="text-[11px] mt-1" style={{ color: "var(--bmut)" }}>Máximo 5 pruebas por minuto.</p>
              </div>
            </>
          )}

          {error && <p className="text-[11.5px] text-red-600">{error}</p>}

          <div style={{ height: 1, background: "var(--bbord)" }} />

          <div className="flex items-center justify-between">
            {config ? (
              <button
                type="button"
                onClick={handleDelete}
                className="text-[12px] font-semibold px-4 py-2 rounded-[8px]"
                style={{ background: "#fef2f2", color: "#991b1b" }}
              >
                Eliminar configuración (usar plataforma)
              </button>
            ) : <span />}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => { setEditing(false); setError(""); }}
                className="text-[12px] font-semibold px-4 py-2 rounded-[8px]"
                style={{ background: "var(--bbord)", color: "var(--bmut)" }}
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={saving}
                className="text-[12px] font-semibold px-4 py-2 rounded-[8px]"
                style={{ backgroundColor: "var(--bp)", color: "var(--bop)" }}
              >
                {saving ? "Guardando…" : "Guardar"}
              </button>
            </div>
          </div>
        </form>
      )}
    </div>
  );
}
