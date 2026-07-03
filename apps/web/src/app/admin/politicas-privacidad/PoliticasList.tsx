"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import type { PrivacyPolicy, PrivacyPolicyCreate } from "@/lib/admin-privacy-api";

const BASE_LEGAL_LABELS: Record<string, string> = {
  consentimiento_expreso: "Consentimiento expreso",
  interes_legitimo: "Interés legítimo",
  obligacion_legal: "Obligación legal",
  contrato: "Ejecución de contrato",
};

function PolicyCard({ policy, onArchive }: { policy: PrivacyPolicy; onArchive: (id: string) => void }) {
  const [open, setOpen] = useState(false);

  return (
    <div style={{ borderBottom: "1px solid var(--bbord)" }}>
      <button
        className="w-full flex items-center justify-between px-4 py-3 text-left"
        onClick={() => setOpen((v) => !v)}
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

      {open && (
        <div className="px-4 pb-4 flex flex-col gap-3">
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
          <button
            onClick={() => onArchive(policy.id)}
            className="self-start text-[11.5px] font-medium px-3 py-1 rounded-[7px]"
            style={{ background: "#fef2f2", color: "#991b1b" }}
          >
            Archivar política
          </button>
        </div>
      )}
    </div>
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
            <select
              className={inputCls}
              style={inputStyle}
              value={form.base_legal}
              onChange={(e) => setField("base_legal", e.target.value)}
            >
              {Object.entries(BASE_LEGAL_LABELS).map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </select>
          </div>

          <div>
            <label className={labelCls} style={labelStyle}>Aviso al firmante (texto que verá quien firma)</label>
            <textarea
              className={inputCls}
              style={inputStyle}
              rows={4}
              value={form.aviso_firmante}
              onChange={(e) => setField("aviso_firmante", e.target.value)}
              placeholder="Al firmar esta petición consientes que tus datos sean tratados por..."
            />
          </div>

          <div>
            <label className={labelCls} style={labelStyle}>Aviso a la organización (uso interno)</label>
            <textarea
              className={inputCls}
              style={inputStyle}
              rows={3}
              value={form.aviso_organizacion}
              onChange={(e) => setField("aviso_organizacion", e.target.value)}
              placeholder="Los datos recopilados serán tratados por la organización para..."
            />
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
          policies.map((p) => <PolicyCard key={p.id} policy={p} onArchive={handleArchive} />)
        )}
      </div>
    </div>
  );
}
