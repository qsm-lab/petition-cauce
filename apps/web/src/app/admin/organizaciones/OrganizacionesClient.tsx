"use client";

import { useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import type { AdminOrg, OrgCreate } from "@/lib/admin-orgs-api";

const STATUS_BADGE: Record<string, { bg: string; color: string; label: string }> = {
  verificada: { bg: "#DCE9E6", color: "#16261F", label: "Verificada" },
  pendiente: { bg: "#fff7ed", color: "#c2410c", label: "Pendiente" },
  archivada: { bg: "#f3f4f6", color: "#6b7280", label: "Archivada" },
};

function StatusBadge({ status }: { status: string }) {
  const s = STATUS_BADGE[status] ?? STATUS_BADGE.pendiente;
  return (
    <span
      className="inline-flex items-center font-bold text-[11px]"
      style={{ background: s.bg, color: s.color, padding: "4px 9px", borderRadius: "99px" }}
    >
      {s.label}
    </span>
  );
}

const EMPTY_FORM: OrgCreate = {
  name: "", slug: "", domain: "", description: "", contact_email: "", rep_name: "", status: "pendiente",
};

function slugify(s: string) {
  return s.toLowerCase().replace(/[áàä]/g, "a").replace(/[éèë]/g, "e").replace(/[íìï]/g, "i")
    .replace(/[óòö]/g, "o").replace(/[úùü]/g, "u").replace(/ñ/g, "n")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60);
}

interface Props {
  initialOrgs: AdminOrg[];
}

export default function OrganizacionesClient({ initialOrgs }: Props) {
  const [orgs, setOrgs] = useState<AdminOrg[]>(initialOrgs);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<OrgCreate>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function setField(k: keyof OrgCreate, v: string) {
    setForm((prev) => {
      const updated = { ...prev, [k]: v };
      if (k === "name" && !prev.slug) updated.slug = slugify(v);
      return updated;
    });
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const payload = {
        ...form,
        domain: form.domain || undefined,
        description: form.description || undefined,
        contact_email: form.contact_email || undefined,
        rep_name: form.rep_name || undefined,
      };
      const created = await api.post<AdminOrg>("/v1/admin/organizaciones", payload);
      setOrgs((prev) => [...prev, { ...created, active_campaigns: 0 }]);
      setForm(EMPTY_FORM);
      setShowForm(false);
    } catch {
      setError("No se pudo crear la organización. Verifica que el slug sea único.");
    } finally {
      setSaving(false);
    }
  }

  async function handleVerify(id: string) {
    try {
      const updated = await api.patch<AdminOrg>(`/v1/admin/organizaciones/${id}`, { status: "verificada" });
      setOrgs((prev) => prev.map((o) => (o.id === id ? { ...updated, active_campaigns: o.active_campaigns } : o)));
    } catch {
      alert("Error al actualizar estado");
    }
  }

  async function handleArchive(id: string, activeCampaigns: number) {
    if (activeCampaigns > 0) {
      alert("No se puede archivar: tiene campañas activas.");
      return;
    }
    if (!confirm("¿Archivar esta organización?")) return;
    try {
      await api.patch(`/v1/admin/organizaciones/${id}/archive`, {});
      setOrgs((prev) => prev.filter((o) => o.id !== id));
    } catch {
      alert("Error al archivar");
    }
  }

  const inputCls = "w-full px-3 py-2 rounded-[8px] text-[13px] outline-none";
  const inputStyle = { border: "1px solid var(--bbord)", background: "var(--bbg)", color: "var(--bink)" };
  const labelCls = "block text-[11.5px] font-semibold mb-1";
  const labelStyle = { color: "var(--bmut)" };

  return (
    <div>
      {/* Formulario nueva org */}
      {!showForm ? (
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-1.5 font-semibold text-[13px] mb-5"
          style={{ backgroundColor: "var(--bp)", color: "var(--bop)", padding: "0 16px", minHeight: "36px", borderRadius: "10px" }}
        >
          + Nueva organización
        </button>
      ) : (
        <form
          onSubmit={handleCreate}
          className="mb-5 p-5 rounded-[14px]"
          style={{ backgroundColor: "var(--bsurf)", border: "1px solid var(--bbord)" }}
        >
          <p className="text-[13px] font-bold mb-4" style={{ color: "var(--bink)" }}>Nueva organización</p>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className={labelCls} style={labelStyle}>Nombre</label>
              <input required className={inputCls} style={inputStyle} value={form.name} onChange={(e) => setField("name", e.target.value)} placeholder="Ej: Acción Ecológica" />
            </div>
            <div>
              <label className={labelCls} style={labelStyle}>Slug (URL)</label>
              <input required className={inputCls} style={inputStyle} value={form.slug} onChange={(e) => setField("slug", e.target.value)} placeholder="accion-ecologica" />
            </div>
            <div>
              <label className={labelCls} style={labelStyle}>Responsable legal</label>
              <input className={inputCls} style={inputStyle} value={form.rep_name} onChange={(e) => setField("rep_name", e.target.value)} placeholder="Nombre completo" />
            </div>
            <div>
              <label className={labelCls} style={labelStyle}>Email de contacto</label>
              <input type="email" className={inputCls} style={inputStyle} value={form.contact_email} onChange={(e) => setField("contact_email", e.target.value)} placeholder="contacto@org.ec" />
            </div>
            <div>
              <label className={labelCls} style={labelStyle}>Dominio principal</label>
              <input className={inputCls} style={inputStyle} value={form.domain} onChange={(e) => setField("domain", e.target.value)} placeholder="accionecologica.org" />
            </div>
            <div>
              <label className={labelCls} style={labelStyle}>Estado inicial</label>
              <select className={inputCls} style={inputStyle} value={form.status} onChange={(e) => setField("status", e.target.value)}>
                <option value="pendiente">Pendiente</option>
                <option value="verificada">Verificada</option>
              </select>
            </div>
          </div>
          <div className="mb-4">
            <label className={labelCls} style={labelStyle}>Descripción (opcional)</label>
            <textarea className={inputCls} style={inputStyle} rows={2} value={form.description} onChange={(e) => setField("description", e.target.value)} placeholder="Breve descripción de la organización" />
          </div>
          {error && <p className="text-[11.5px] text-red-600 mb-3">{error}</p>}
          <div className="flex gap-2">
            <button type="submit" disabled={saving} className="font-semibold text-[12.5px] px-4 py-2 rounded-[8px]" style={{ backgroundColor: "var(--bp)", color: "var(--bop)" }}>
              {saving ? "Guardando…" : "Crear organización"}
            </button>
            <button type="button" onClick={() => setShowForm(false)} className="font-semibold text-[12.5px] px-4 py-2 rounded-[8px]" style={{ background: "var(--bbord)", color: "var(--bmut)" }}>
              Cancelar
            </button>
          </div>
        </form>
      )}

      {/* Tabla */}
      <div className="rounded-[14px] overflow-hidden" style={{ backgroundColor: "var(--bsurf)", border: "1px solid var(--bbord)" }}>
        {/* Header */}
        <div
          className="flex items-center px-[18px] py-3"
          style={{ borderBottom: "1px solid var(--bbord)", backgroundColor: "var(--bbg)" }}
        >
          <span className="font-bold text-[11px] uppercase tracking-[.05em] flex-none" style={{ width: "230px", color: "var(--bmut)" }}>Organización</span>
          <span className="font-bold text-[11px] uppercase tracking-[.05em] flex-none" style={{ width: "140px", color: "var(--bmut)" }}>Responsable</span>
          <span className="font-bold text-[11px] uppercase tracking-[.05em] flex-none" style={{ width: "80px", color: "var(--bmut)" }}>Activas</span>
          <span className="font-bold text-[11px] uppercase tracking-[.05em] flex-none" style={{ width: "105px", color: "var(--bmut)" }}>Estado</span>
          <span className="font-bold text-[11px] uppercase tracking-[.05em] flex-1 text-right" style={{ color: "var(--bmut)" }}>Acciones</span>
        </div>

        {orgs.length === 0 ? (
          <div className="px-[18px] py-12 text-center">
            <p className="text-[14px] font-semibold mb-1" style={{ color: "var(--bink)" }}>Sin organizaciones registradas</p>
            <p className="text-[13px]" style={{ color: "var(--bmut)" }}>Crea la primera organización para empezar.</p>
          </div>
        ) : (
          orgs.map((org) => (
            <div
              key={org.id}
              className="flex items-center px-[18px] py-3"
              style={{ borderBottom: "1px solid var(--bbord)" }}
            >
              <div className="flex-none" style={{ width: "230px" }}>
                <p className="text-[13px] font-semibold" style={{ color: "var(--bink)" }}>{org.name}</p>
                <p className="text-[11px]" style={{ color: "var(--bmut)" }}>{org.slug}</p>
              </div>
              <div className="flex-none text-[12.5px]" style={{ width: "140px", color: "var(--bink)" }}>
                {org.rep_name ?? <span style={{ color: "var(--bmut)" }}>—</span>}
              </div>
              <div className="flex-none text-[12.5px] font-semibold" style={{ width: "80px", color: "var(--bink)" }}>
                {org.active_campaigns}
              </div>
              <div className="flex-none" style={{ width: "105px" }}>
                <StatusBadge status={org.status} />
              </div>
              <div className="flex-1 flex justify-end gap-2">
                {org.status === "pendiente" && (
                  <button
                    onClick={() => handleVerify(org.id)}
                    className="text-[11.5px] font-medium px-3 py-1 rounded-[7px]"
                    style={{ background: "#DCE9E6", color: "#16261F" }}
                  >
                    Verificar
                  </button>
                )}
                <button
                  onClick={() => handleArchive(org.id, org.active_campaigns)}
                  className="text-[11.5px] font-medium px-3 py-1 rounded-[7px]"
                  style={{ background: "#fef2f2", color: "#991b1b" }}
                  disabled={org.status === "archivada"}
                >
                  Archivar
                </button>
                <Link
                  href={`/admin/organizaciones/${org.id}`}
                  className="text-[11.5px] font-medium px-3 py-1 rounded-[7px]"
                  style={{ background: "var(--bbord)", color: "var(--bink)" }}
                >
                  Ver
                </Link>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
