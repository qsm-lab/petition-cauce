"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import type { AdminOrg, OrgUpdate } from "@/lib/admin-orgs-api";

const STATUS_BADGE: Record<string, { bg: string; color: string; label: string }> = {
  verificada: { bg: "color-mix(in srgb,#18794A 12%,transparent)", color: "#18794A", label: "Verificada" },
  pendiente: { bg: "#fff7ed", color: "#c2410c", label: "Pendiente" },
  archivada: { bg: "#f3f4f6", color: "#6b7280", label: "Archivada" },
};

const CAMPAIGN_STATUS: Record<string, { bg: string; color: string; label: string }> = {
  active: { bg: "color-mix(in srgb,#18794A 12%,transparent)", color: "#18794A", label: "Activa" },
  draft: { bg: "#f3f4f6", color: "#6b7280", label: "Borrador" },
  closed: { bg: "#fef2f2", color: "#991b1b", label: "Cerrada" },
  online: { bg: "color-mix(in srgb,#0369a1 12%,transparent)", color: "#0369a1", label: "Online" },
};

function StatusBadge({ status }: { status: string }) {
  const s = STATUS_BADGE[status] ?? STATUS_BADGE.pendiente;
  return (
    <span
      className="inline-flex items-center font-bold text-[11px]"
      style={{ background: s.bg, color: s.color, padding: "3px 9px", borderRadius: "99px" }}
    >
      {s.label}
    </span>
  );
}

function CampaignStatusBadge({ status }: { status: string }) {
  const s = CAMPAIGN_STATUS[status] ?? { bg: "#f3f4f6", color: "#6b7280", label: status };
  return (
    <span
      className="inline-flex items-center font-semibold text-[10.5px]"
      style={{ background: s.bg, color: s.color, padding: "2px 8px", borderRadius: "99px" }}
    >
      {s.label}
    </span>
  );
}

interface CampaignSummary {
  id: string;
  title: string;
  status: string;
  slug: string;
}

interface Props {
  initialOrg: AdminOrg;
  initialCampaigns: CampaignSummary[];
}

function slugify(s: string) {
  return s.toLowerCase()
    .replace(/[áàä]/g, "a").replace(/[éèë]/g, "e").replace(/[íìï]/g, "i")
    .replace(/[óòö]/g, "o").replace(/[úùü]/g, "u").replace(/ñ/g, "n")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60);
}

export default function OrgDetailClient({ initialOrg, initialCampaigns }: Props) {
  const router = useRouter();
  const [org, setOrg] = useState<AdminOrg>(initialOrg);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<OrgUpdate>({
    name: initialOrg.name,
    slug: initialOrg.slug,
    rep_name: initialOrg.rep_name ?? "",
    contact_email: initialOrg.contact_email ?? "",
    domain: initialOrg.domain ?? "",
    description: initialOrg.description ?? "",
    status: initialOrg.status,
    logo_url: initialOrg.logo_url ?? "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function setField(k: keyof OrgUpdate, v: string) {
    setForm((prev) => {
      const next = { ...prev, [k]: v };
      if (k === "name" && !prev.slug) next.slug = slugify(v);
      return next;
    });
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const payload: OrgUpdate = {
        name: form.name || undefined,
        slug: form.slug || undefined,
        rep_name: form.rep_name || undefined,
        contact_email: form.contact_email || undefined,
        domain: form.domain || undefined,
        description: form.description || undefined,
        status: form.status,
        logo_url: form.logo_url || null,
      };
      const updated = await api.patch<AdminOrg>(`/v1/admin/organizaciones/${org.id}`, payload);
      setOrg((prev) => ({ ...updated, active_campaigns: prev.active_campaigns }));
      setEditing(false);
    } catch {
      setError("No se pudo guardar los cambios.");
    } finally {
      setSaving(false);
    }
  }

  function handleCancelEdit() {
    setForm({
      name: org.name,
      slug: org.slug,
      rep_name: org.rep_name ?? "",
      contact_email: org.contact_email ?? "",
      domain: org.domain ?? "",
      description: org.description ?? "",
      status: org.status,
      logo_url: org.logo_url ?? "",
    });
    setEditing(false);
    setError("");
  }

  async function handleVerify() {
    try {
      const updated = await api.patch<AdminOrg>(`/v1/admin/organizaciones/${org.id}`, { status: "verificada" });
      setOrg((prev) => ({ ...updated, active_campaigns: prev.active_campaigns }));
      setForm((prev) => ({ ...prev, status: "verificada" }));
    } catch {
      alert("Error al verificar");
    }
  }

  async function handleArchive() {
    if (org.active_campaigns > 0) {
      alert("No se puede archivar: la organización tiene campañas activas.");
      return;
    }
    if (!confirm("¿Archivar esta organización? Esta acción no se puede deshacer fácilmente.")) return;
    try {
      await api.patch(`/v1/admin/organizaciones/${org.id}/archive`, {});
      router.push("/admin/organizaciones");
    } catch {
      alert("Error al archivar");
    }
  }

  const inputCls = "w-full px-3 py-2 rounded-[8px] text-[13px] outline-none";
  const inputStyle = { border: "1px solid var(--bbord)", background: "var(--bbg)", color: "var(--bink)" };
  const labelCls = "block text-[11.5px] font-semibold mb-1";
  const labelStyle = { color: "var(--bmut)" };

  return (
    <div className="max-w-[820px] flex flex-col gap-5">

      {/* Ficha de la organización */}
      <div
        className="rounded-[14px] overflow-hidden"
        style={{ backgroundColor: "var(--bsurf)", border: "1px solid var(--bbord)" }}
      >
        <div
          className="px-5 py-3.5 flex items-center justify-between"
          style={{ borderBottom: "1px solid var(--bbord)", backgroundColor: "var(--bbg)" }}
        >
          <div className="flex items-center gap-3">
            <p className="text-[13px] font-bold" style={{ color: "var(--bink)" }}>Datos de la organización</p>
            <StatusBadge status={org.status} />
          </div>
          {!editing && (
            <button
              onClick={() => setEditing(true)}
              className="text-[12px] font-semibold px-3 py-1.5 rounded-[8px]"
              style={{ background: "var(--bbord)", color: "var(--bink)" }}
            >
              Editar
            </button>
          )}
        </div>

        {!editing ? (
          <div className="px-5 py-4 grid grid-cols-2 gap-x-8 gap-y-3">
            {[
              ["Nombre", org.name],
              ["Slug", org.slug],
              ["Responsable legal", org.rep_name],
              ["Email de contacto", org.contact_email],
              ["Dominio principal", org.domain],
            ].map(([label, value]) => (
              <div key={label as string}>
                <p className="text-[11px] font-semibold uppercase tracking-wide mb-0.5" style={{ color: "var(--bmut)" }}>{label}</p>
                <p className="text-[13px]" style={{ color: value ? "var(--bink)" : "var(--bmut)" }}>
                  {value || "—"}
                </p>
              </div>
            ))}
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide mb-0.5" style={{ color: "var(--bmut)" }}>Logotipo (URL)</p>
              {org.logo_url ? (
                <div className="flex items-center gap-2">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={org.logo_url} alt={org.name} className="rounded-[6px] object-contain" style={{ width: 36, height: 36, border: "1px solid var(--bbord)" }} />
                  <p className="text-[11px] break-all" style={{ color: "var(--bmut)" }}>{org.logo_url}</p>
                </div>
              ) : (
                <p className="text-[13px]" style={{ color: "var(--bmut)" }}>—</p>
              )}
            </div>
            {org.description && (
              <div className="col-span-2">
                <p className="text-[11px] font-semibold uppercase tracking-wide mb-0.5" style={{ color: "var(--bmut)" }}>Descripción</p>
                <p className="text-[13px]" style={{ color: "var(--bink)" }}>{org.description}</p>
              </div>
            )}
          </div>
        ) : (
          <form onSubmit={handleSave} className="px-5 py-4 flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelCls} style={labelStyle}>Nombre</label>
                <input required className={inputCls} style={inputStyle} value={form.name ?? ""} onChange={(e) => setField("name", e.target.value)} />
              </div>
              <div>
                <label className={labelCls} style={labelStyle}>Slug (URL)</label>
                <input required className={inputCls} style={inputStyle} value={form.slug ?? ""} onChange={(e) => setField("slug", e.target.value)} />
              </div>
              <div>
                <label className={labelCls} style={labelStyle}>Responsable legal</label>
                <input className={inputCls} style={inputStyle} value={form.rep_name ?? ""} onChange={(e) => setField("rep_name", e.target.value)} />
              </div>
              <div>
                <label className={labelCls} style={labelStyle}>Email de contacto</label>
                <input type="email" className={inputCls} style={inputStyle} value={form.contact_email ?? ""} onChange={(e) => setField("contact_email", e.target.value)} />
              </div>
              <div>
                <label className={labelCls} style={labelStyle}>Dominio principal</label>
                <input className={inputCls} style={inputStyle} value={form.domain ?? ""} onChange={(e) => setField("domain", e.target.value)} />
              </div>
              <div>
                <label className={labelCls} style={labelStyle}>Estado</label>
                <select className={inputCls} style={inputStyle} value={form.status ?? ""} onChange={(e) => setField("status", e.target.value)}>
                  <option value="pendiente">Pendiente</option>
                  <option value="verificada">Verificada</option>
                  <option value="archivada">Archivada</option>
                </select>
              </div>
            </div>
            <div className="col-span-2">
              <label className={labelCls} style={labelStyle}>URL del logotipo</label>
              <input type="url" className={inputCls} style={inputStyle} value={form.logo_url ?? ""} onChange={(e) => setField("logo_url", e.target.value)} placeholder="https://…/logo.png" />
              <p className="text-[11px] mt-1" style={{ color: "var(--bmut)" }}>Aparece en la esquina inferior izquierda del hero en cada campaña vinculada.</p>
            </div>
            <div className="col-span-2">
              <label className={labelCls} style={labelStyle}>Descripción</label>
              <textarea className={inputCls} style={inputStyle} rows={2} value={form.description ?? ""} onChange={(e) => setField("description", e.target.value)} />
            </div>
            {error && <p className="text-[11.5px] text-red-600">{error}</p>}
            <div className="flex gap-2">
              <button type="submit" disabled={saving} className="font-semibold text-[12.5px] text-white px-4 py-2 rounded-[8px]" style={{ backgroundColor: "var(--bp)" }}>
                {saving ? "Guardando…" : "Guardar cambios"}
              </button>
              <button type="button" onClick={handleCancelEdit} className="font-semibold text-[12.5px] px-4 py-2 rounded-[8px]" style={{ background: "var(--bbord)", color: "var(--bmut)" }}>
                Cancelar
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Acciones */}
      {!editing && (
        <div className="flex gap-2">
          {org.status === "pendiente" && (
            <button
              onClick={handleVerify}
              className="text-[12px] font-semibold px-4 py-2 rounded-[9px]"
              style={{ background: "color-mix(in srgb,#18794A 12%,transparent)", color: "#18794A" }}
            >
              Marcar como verificada
            </button>
          )}
          <button
            onClick={handleArchive}
            disabled={org.status === "archivada"}
            className="text-[12px] font-semibold px-4 py-2 rounded-[9px] disabled:opacity-50"
            style={{ background: "#fef2f2", color: "#991b1b" }}
          >
            Archivar organización
          </button>
        </div>
      )}

      {/* Campañas vinculadas */}
      <div
        className="rounded-[14px] overflow-hidden"
        style={{ backgroundColor: "var(--bsurf)", border: "1px solid var(--bbord)" }}
      >
        <div
          className="px-5 py-3.5"
          style={{ borderBottom: "1px solid var(--bbord)", backgroundColor: "var(--bbg)" }}
        >
          <p className="text-[13px] font-bold" style={{ color: "var(--bink)" }}>
            Campañas vinculadas
            <span className="ml-2 text-[11px] font-semibold px-2 py-0.5 rounded-full" style={{ background: "var(--bbord)", color: "var(--bmut)" }}>
              {initialCampaigns.length}
            </span>
          </p>
        </div>

        {initialCampaigns.length === 0 ? (
          <div className="px-5 py-10 text-center">
            <p className="text-[13px]" style={{ color: "var(--bmut)" }}>Sin campañas vinculadas.</p>
          </div>
        ) : (
          initialCampaigns.map((c) => (
            <div
              key={c.id}
              className="flex items-center px-5 py-3 gap-4"
              style={{ borderBottom: "1px solid var(--bbord)" }}
            >
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-semibold truncate" style={{ color: "var(--bink)" }}>{c.title}</p>
                <p className="text-[11px]" style={{ color: "var(--bmut)" }}>/{c.slug}</p>
              </div>
              <CampaignStatusBadge status={c.status} />
              <Link
                href={`/admin/campanas/${c.id}`}
                className="text-[11.5px] font-semibold px-3 py-1.5 rounded-[7px] flex-shrink-0"
                style={{ background: "var(--bbord)", color: "var(--bink)" }}
              >
                Editar
              </Link>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
