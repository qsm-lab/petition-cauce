"use client";

import { useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import type { PrivacyPolicy, PrivacyPolicyCreate, PrivacyPolicyUpdate } from "@/lib/admin-privacy-api";

const BASE_LEGAL_LABELS: Record<string, string> = {
  consentimiento_expreso: "Consentimiento expreso",
  interes_legitimo: "Interés legítimo",
  obligacion_legal: "Obligación legal",
  contrato: "Ejecución de contrato",
};

const CAMPAIGN_STATUS: Record<string, { bg: string; color: string; label: string }> = {
  active: { bg: "color-mix(in srgb,#18794A 12%,transparent)", color: "#18794A", label: "Activa" },
  draft: { bg: "#f3f4f6", color: "#6b7280", label: "Borrador" },
  closed: { bg: "#fef2f2", color: "#991b1b", label: "Cerrada" },
  online: { bg: "color-mix(in srgb,#0369a1 12%,transparent)", color: "#0369a1", label: "Online" },
};

interface CampaignSummary {
  id: string;
  title: string;
  status: string;
  slug: string;
  org_name?: string;
}

function ContratoModal({ text, onClose }: { text: string; onClose: () => void }) {
  async function handleCopy() {
    await navigator.clipboard.writeText(text);
    alert("Texto copiado al portapapeles.");
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,.5)" }}
      onClick={onClose}
    >
      <div
        className="flex flex-col rounded-[16px] overflow-hidden w-full max-w-[760px] max-h-[85vh]"
        style={{ backgroundColor: "var(--bsurf)", border: "1px solid var(--bbord)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="flex items-center justify-between px-5 py-3.5 flex-shrink-0"
          style={{ borderBottom: "1px solid var(--bbord)", backgroundColor: "var(--bbg)" }}
        >
          <p className="text-[13px] font-bold" style={{ color: "var(--bink)" }}>
            Template — Contrato de Encargo LOPDP
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={handleCopy}
              className="text-[12px] font-semibold px-3 py-1.5 rounded-[7px]"
              style={{ background: "var(--bbord)", color: "var(--bink)" }}
            >
              Copiar texto
            </button>
            <button
              onClick={onClose}
              aria-label="Cerrar"
              className="flex items-center justify-center rounded-[7px] hover:opacity-80 transition-opacity"
              style={{ width: 32, height: 32, background: "#fef2f2", color: "#991b1b" }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
                <path d="M18 6 6 18M6 6l12 12"/>
              </svg>
            </button>
          </div>
        </div>
        <pre
          className="flex-1 overflow-auto px-5 py-4 text-[12px] leading-relaxed whitespace-pre-wrap font-mono"
          style={{ color: "var(--bink)" }}
        >
          {text}
        </pre>
        <div
          className="px-5 py-3 flex-shrink-0 text-[11px]"
          style={{ borderTop: "1px solid var(--bbord)", color: "var(--bmut)", backgroundColor: "var(--bbg)" }}
        >
          Este es un borrador de template. Los campos de campaña (autoridad, alcance) se rellenan al crear el contrato vinculado a cada campaña.
        </div>
      </div>
    </div>
  );
}

function PolicyCard({
  policy,
  onUpdate,
  onArchive,
}: {
  policy: PrivacyPolicy;
  onUpdate: (updated: PrivacyPolicy) => void;
  onArchive: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<PrivacyPolicyUpdate>({
    title: policy.title,
    aviso_firmante: policy.aviso_firmante,
    aviso_organizacion: policy.aviso_organizacion,
    base_legal: policy.base_legal,
    data_contact_email: policy.data_contact_email ?? "",
  });
  const [saving, setSaving] = useState(false);
  const [editError, setEditError] = useState("");
  const [campaigns, setCampaigns] = useState<CampaignSummary[] | null>(null);
  const [loadingCampaigns, setLoadingCampaigns] = useState(false);
  const [contratoText, setContratoText] = useState<string | null>(null);
  const [loadingContrato, setLoadingContrato] = useState(false);
  const [showContrato, setShowContrato] = useState(false);

  async function handleExpand() {
    const next = !open;
    setOpen(next);
    if (next && campaigns === null) {
      setLoadingCampaigns(true);
      try {
        const data = await api.get<CampaignSummary[]>(`/v1/admin/privacy-policies/${policy.id}/campaigns`);
        setCampaigns(data ?? []);
      } catch {
        setCampaigns([]);
      } finally {
        setLoadingCampaigns(false);
      }
    }
  }

  async function handleShowContrato() {
    if (contratoText) {
      setShowContrato(true);
      return;
    }
    setLoadingContrato(true);
    try {
      const data = await api.get<{ text: string }>(`/v1/admin/privacy-policies/${policy.id}/contrato-preview`);
      setContratoText(data.text);
      setShowContrato(true);
    } catch {
      alert("No se pudo cargar el template de contrato");
    } finally {
      setLoadingContrato(false);
    }
  }

  function setField(k: keyof PrivacyPolicyUpdate, v: string) {
    setForm((prev) => ({ ...prev, [k]: v }));
  }

  async function handleSave() {
    setSaving(true);
    setEditError("");
    try {
      const payload: PrivacyPolicyUpdate = {
        ...form,
        data_contact_email: form.data_contact_email || undefined,
      };
      const updated = await api.patch<PrivacyPolicy>(`/v1/admin/privacy-policies/${policy.id}`, payload);
      onUpdate(updated);
      setEditing(false);
    } catch {
      setEditError("No se pudo guardar los cambios.");
    } finally {
      setSaving(false);
    }
  }

  function handleCancelEdit() {
    setForm({
      title: policy.title,
      aviso_firmante: policy.aviso_firmante,
      aviso_organizacion: policy.aviso_organizacion,
      base_legal: policy.base_legal,
      data_contact_email: policy.data_contact_email ?? "",
    });
    setEditError("");
    setEditing(false);
  }

  const inputCls = "w-full px-3 py-2 rounded-[8px] text-[13px] outline-none";
  const inputStyle = { border: "1px solid var(--bbord)", background: "var(--bbg)", color: "var(--bink)" };
  const labelCls = "block text-[11.5px] font-semibold mb-1";
  const labelStyle = { color: "var(--bmut)" };

  return (
    <>
      {showContrato && contratoText && (
        <ContratoModal text={contratoText} onClose={() => setShowContrato(false)} />
      )}

      <div style={{ borderBottom: "1px solid var(--bbord)" }}>
        {/* Header colapsable */}
        <div className="flex items-center">
          <button
            className="flex items-center justify-between flex-1 px-4 py-3 text-left"
            onClick={handleExpand}
          >
            <div className="flex items-center gap-3">
              <span className="text-[13px] font-semibold" style={{ color: "var(--bink)" }}>
                {policy.title}
              </span>
              <span
                className="text-[10.5px] font-semibold px-2 py-0.5 rounded-full"
                style={{ background: "color-mix(in srgb,var(--bp) 12%,transparent)", color: "var(--bp)" }}
              >
                v{policy.version}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-[11px]" style={{ color: "var(--bmut)" }}>
                {BASE_LEGAL_LABELS[policy.base_legal] ?? policy.base_legal}
              </span>
              <span className="text-[12px]" style={{ color: "var(--bmut)" }}>{open ? "▲" : "▼"}</span>
            </div>
          </button>
        </div>

        {/* Panel expandido */}
        {open && (
          <div className="px-4 pb-5 flex flex-col gap-4" style={{ borderTop: "1px solid var(--bbord)", background: "var(--bbg)" }}>

            {/* Vista o edición */}
            {!editing ? (
              <div className="pt-4 flex flex-col gap-3">
                {policy.aviso_firmante && (
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-wide mb-1" style={{ color: "var(--bmut)" }}>
                      Aviso al firmante
                    </p>
                    <p className="text-[12.5px] whitespace-pre-wrap" style={{ color: "var(--bink)" }}>
                      {policy.aviso_firmante}
                    </p>
                  </div>
                )}
                {policy.aviso_organizacion && (
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-wide mb-1" style={{ color: "var(--bmut)" }}>
                      Aviso a la organización
                    </p>
                    <p className="text-[12.5px] whitespace-pre-wrap" style={{ color: "var(--bink)" }}>
                      {policy.aviso_organizacion}
                    </p>
                  </div>
                )}
                {policy.data_contact_email && (
                  <p className="text-[11.5px]" style={{ color: "var(--bmut)" }}>
                    Contacto DPO: {policy.data_contact_email}
                  </p>
                )}
                <div className="flex gap-2 flex-wrap pt-1">
                  <button
                    onClick={() => setEditing(true)}
                    className="text-[11.5px] font-semibold px-3 py-1.5 rounded-[7px]"
                    style={{ background: "var(--bbord)", color: "var(--bink)" }}
                  >
                    Editar política
                  </button>
                  <button
                    onClick={handleShowContrato}
                    disabled={loadingContrato}
                    className="text-[11.5px] font-semibold px-3 py-1.5 rounded-[7px] disabled:opacity-50"
                    style={{ background: "color-mix(in srgb,var(--bp) 12%,transparent)", color: "var(--bp)" }}
                  >
                    {loadingContrato ? "Cargando…" : "Ver contrato LOPDP"}
                  </button>
                  <button
                    onClick={() => onArchive(policy.id)}
                    className="text-[11.5px] font-medium px-3 py-1.5 rounded-[7px]"
                    style={{ background: "#fef2f2", color: "#991b1b" }}
                  >
                    Archivar política
                  </button>
                </div>
              </div>
            ) : (
              <div className="pt-4 flex flex-col gap-3">
                <div>
                  <label className={labelCls} style={labelStyle}>Título interno</label>
                  <input className={inputCls} style={inputStyle} required value={form.title ?? ""} onChange={(e) => setField("title", e.target.value)} />
                </div>
                <div>
                  <label className={labelCls} style={labelStyle}>Base legal</label>
                  <select className={inputCls} style={inputStyle} value={form.base_legal ?? ""} onChange={(e) => setField("base_legal", e.target.value)}>
                    {Object.entries(BASE_LEGAL_LABELS).map(([v, l]) => (
                      <option key={v} value={v}>{l}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelCls} style={labelStyle}>Aviso al firmante</label>
                  <textarea className={inputCls} style={inputStyle} rows={4} value={form.aviso_firmante ?? ""} onChange={(e) => setField("aviso_firmante", e.target.value)} />
                </div>
                <div>
                  <label className={labelCls} style={labelStyle}>Aviso a la organización</label>
                  <textarea className={inputCls} style={inputStyle} rows={3} value={form.aviso_organizacion ?? ""} onChange={(e) => setField("aviso_organizacion", e.target.value)} />
                </div>
                <div>
                  <label className={labelCls} style={labelStyle}>Email de contacto DPO (opcional)</label>
                  <input type="email" className={inputCls} style={inputStyle} value={form.data_contact_email ?? ""} onChange={(e) => setField("data_contact_email", e.target.value)} />
                </div>
                {editError && <p className="text-[11.5px] text-red-600">{editError}</p>}
                <div className="flex gap-2">
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="font-semibold text-[12px] text-white px-4 py-1.5 rounded-[7px]"
                    style={{ backgroundColor: "var(--bp)" }}
                  >
                    {saving ? "Guardando…" : "Guardar cambios"}
                  </button>
                  <button
                    onClick={handleCancelEdit}
                    className="font-semibold text-[12px] px-4 py-1.5 rounded-[7px]"
                    style={{ background: "var(--bbord)", color: "var(--bmut)" }}
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            )}

            {/* Campañas vinculadas */}
            <div style={{ borderTop: "1px solid var(--bbord)", paddingTop: "12px" }}>
              <p className="text-[11px] font-bold uppercase tracking-wide mb-2" style={{ color: "var(--bmut)" }}>
                Campañas que usan esta política
              </p>
              {loadingCampaigns ? (
                <p className="text-[12px]" style={{ color: "var(--bmut)" }}>Cargando…</p>
              ) : campaigns === null || campaigns.length === 0 ? (
                <p className="text-[12px]" style={{ color: "var(--bmut)" }}>Ninguna campaña usa esta política.</p>
              ) : (
                <div className="flex flex-col gap-1.5">
                  {campaigns.map((c) => {
                    const s = CAMPAIGN_STATUS[c.status] ?? { bg: "#f3f4f6", color: "#6b7280", label: c.status };
                    return (
                      <div key={c.id} className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2 min-w-0">
                          <span
                            className="text-[10.5px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0"
                            style={{ background: s.bg, color: s.color }}
                          >
                            {s.label}
                          </span>
                          <span className="text-[12.5px] truncate" style={{ color: "var(--bink)" }}>{c.title}</span>
                          {c.org_name && (
                            <span className="text-[11px] flex-shrink-0" style={{ color: "var(--bmut)" }}>· {c.org_name}</span>
                          )}
                        </div>
                        <Link
                          href={`/admin/campanas/${c.id}`}
                          className="text-[11px] font-medium flex-shrink-0"
                          style={{ color: "var(--bp)" }}
                        >
                          Editar →
                        </Link>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </>
  );
}

const EMPTY_FORM: PrivacyPolicyCreate = {
  title: "",
  aviso_firmante: "",
  aviso_organizacion: "",
  base_legal: "consentimiento_expreso",
  data_contact_email: "",
};

interface Props {
  initialPolicies: PrivacyPolicy[];
}

export default function PoliticasList({ initialPolicies }: Props) {
  const [policies, setPolicies] = useState<PrivacyPolicy[]>(initialPolicies);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<PrivacyPolicyCreate>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function setField(k: keyof PrivacyPolicyCreate, v: string) {
    setForm((prev) => ({ ...prev, [k]: v }));
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const payload = { ...form, data_contact_email: form.data_contact_email || undefined };
      const created = await api.post<PrivacyPolicy>("/v1/admin/privacy-policies", payload);
      setPolicies((prev) => [created, ...prev]);
      setForm(EMPTY_FORM);
      setShowForm(false);
    } catch {
      setError("No se pudo crear la política");
    } finally {
      setSaving(false);
    }
  }

  async function handleArchive(id: string) {
    if (!confirm("¿Archivar esta política? Las campañas que la usen quedarán sin política asignada.")) return;
    try {
      await api.patch(`/v1/admin/privacy-policies/${id}/archive`, {});
      setPolicies((prev) => prev.filter((p) => p.id !== id));
    } catch {
      alert("Error al archivar");
    }
  }

  function handleUpdate(updated: PrivacyPolicy) {
    setPolicies((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
  }

  const inputCls = "w-full px-3 py-2 rounded-[8px] text-[13px] outline-none";
  const inputStyle = { border: "1px solid var(--bbord)", background: "var(--bbg)", color: "var(--bink)" };
  const labelCls = "block text-[11.5px] font-semibold mb-1";
  const labelStyle = { color: "var(--bmut)" };

  return (
    <div className="max-w-[680px]">
      {!showForm ? (
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-1.5 font-semibold text-[13px] text-white mb-5"
          style={{ backgroundColor: "var(--bp)", padding: "0 16px", minHeight: "36px", borderRadius: "10px" }}
        >
          + Nueva política
        </button>
      ) : (
        <form
          onSubmit={handleCreate}
          className="mb-5 p-5 rounded-[14px] flex flex-col gap-4"
          style={{ backgroundColor: "var(--bsurf)", border: "1px solid var(--bbord)" }}
        >
          <p className="text-[13px] font-bold" style={{ color: "var(--bink)" }}>Nueva política de privacidad</p>

          <div>
            <label className={labelCls} style={labelStyle}>Título interno</label>
            <input className={inputCls} style={inputStyle} required value={form.title} onChange={(e) => setField("title", e.target.value)} placeholder="Ej: Política campaña agua 2025" />
          </div>

          <div>
            <label className={labelCls} style={labelStyle}>Base legal</label>
            <select className={inputCls} style={inputStyle} value={form.base_legal} onChange={(e) => setField("base_legal", e.target.value)}>
              {Object.entries(BASE_LEGAL_LABELS).map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </select>
          </div>

          <div>
            <label className={labelCls} style={labelStyle}>Aviso al firmante (texto que verá quien firma)</label>
            <textarea className={inputCls} style={inputStyle} rows={4} value={form.aviso_firmante} onChange={(e) => setField("aviso_firmante", e.target.value)} placeholder="Al firmar esta petición consientes que tus datos sean tratados por..." />
          </div>

          <div>
            <label className={labelCls} style={labelStyle}>Aviso a la organización (uso interno)</label>
            <textarea className={inputCls} style={inputStyle} rows={3} value={form.aviso_organizacion} onChange={(e) => setField("aviso_organizacion", e.target.value)} placeholder="Los datos recopilados serán tratados por la organización para..." />
          </div>

          <div>
            <label className={labelCls} style={labelStyle}>Email de contacto DPO (opcional)</label>
            <input type="email" className={inputCls} style={inputStyle} value={form.data_contact_email} onChange={(e) => setField("data_contact_email", e.target.value)} placeholder="dpo@tuorganizacion.ec" />
          </div>

          {error && <p className="text-[11.5px] text-red-600">{error}</p>}

          <div className="flex gap-2">
            <button type="submit" disabled={saving} className="font-semibold text-[12.5px] text-white px-4 py-2 rounded-[8px]" style={{ backgroundColor: "var(--bp)" }}>
              {saving ? "Guardando…" : "Crear política"}
            </button>
            <button type="button" onClick={() => setShowForm(false)} className="font-semibold text-[12.5px] px-4 py-2 rounded-[8px]" style={{ background: "var(--bbord)", color: "var(--bmut)" }}>
              Cancelar
            </button>
          </div>
        </form>
      )}

      <div className="rounded-[14px] overflow-hidden" style={{ backgroundColor: "var(--bsurf)", border: "1px solid var(--bbord)" }}>
        {policies.length === 0 ? (
          <div className="px-5 py-12 text-center">
            <p className="text-[14px] font-semibold mb-1" style={{ color: "var(--bink)" }}>Sin políticas registradas</p>
            <p className="text-[13px]" style={{ color: "var(--bmut)" }}>Crea una política para vincularla a tus campañas.</p>
          </div>
        ) : (
          policies.map((p) => (
            <PolicyCard key={p.id} policy={p} onUpdate={handleUpdate} onArchive={handleArchive} />
          ))
        )}
      </div>
    </div>
  );
}
