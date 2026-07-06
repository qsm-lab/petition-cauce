"use client";

import { useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import type { Category, CategoryUpdate } from "@/lib/admin-categories-api";

const PRESET_COLORS = [
  "#15803d", "#0369a1", "#7c3aed", "#b45309", "#be185d",
  "#0f766e", "#c2410c", "#4338ca", "#6d28d9", "#374151",
];

const CAMPAIGN_STATUS: Record<string, { bg: string; color: string; label: string }> = {
  active: { bg: "#DCE9E6", color: "#16261F", label: "Activa" },
  draft: { bg: "#f3f4f6", color: "#6b7280", label: "Borrador" },
  closed: { bg: "#fef2f2", color: "#991b1b", label: "Cerrada" },
  online: { bg: "color-mix(in srgb,#0369a1 12%,transparent)", color: "#0369a1", label: "Online" },
};

interface CampaignSummary {
  id: string;
  title: string;
  status: string;
  slug: string;
}

function ColorPicker({ value, onChange }: { value: string; onChange: (c: string) => void }) {
  return (
    <div className="flex gap-1.5 flex-wrap mt-1">
      {PRESET_COLORS.map((c) => (
        <button
          key={c}
          type="button"
          onClick={() => onChange(c)}
          className="w-5 h-5 rounded-full border-2 transition-transform"
          style={{
            background: c,
            borderColor: value === c ? "var(--bink)" : "transparent",
            transform: value === c ? "scale(1.2)" : "scale(1)",
          }}
        />
      ))}
    </div>
  );
}

function CategoryRow({
  cat,
  onUpdate,
  onArchive,
}: {
  cat: Category;
  onUpdate: (updated: Category) => void;
  onArchive: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState(cat.name);
  const [editColor, setEditColor] = useState(cat.color ?? PRESET_COLORS[0]);
  const [saving, setSaving] = useState(false);
  const [editError, setEditError] = useState("");
  const [campaigns, setCampaigns] = useState<CampaignSummary[] | null>(null);
  const [loadingCampaigns, setLoadingCampaigns] = useState(false);

  async function handleExpand() {
    const next = !open;
    setOpen(next);
    if (next && campaigns === null) {
      setLoadingCampaigns(true);
      try {
        const data = await api.get<CampaignSummary[]>(`/v1/admin/categories/${cat.id}/campaigns`);
        setCampaigns(data ?? []);
      } catch {
        setCampaigns([]);
      } finally {
        setLoadingCampaigns(false);
      }
    }
  }

  async function handleSaveEdit() {
    setSaving(true);
    setEditError("");
    try {
      const payload: CategoryUpdate = { name: editName, color: editColor };
      const updated = await api.patch<Category>(`/v1/admin/categories/${cat.id}`, payload);
      onUpdate(updated);
      setEditing(false);
    } catch {
      setEditError("No se pudo guardar");
    } finally {
      setSaving(false);
    }
  }

  function handleCancelEdit() {
    setEditName(cat.name);
    setEditColor(cat.color ?? PRESET_COLORS[0]);
    setEditError("");
    setEditing(false);
  }

  const inputCls = "w-full px-3 py-2 rounded-[8px] text-[13px] outline-none";
  const inputStyle = { border: "1px solid var(--bbord)", background: "var(--bbg)", color: "var(--bink)" };

  return (
    <div style={{ borderBottom: "1px solid var(--bbord)" }}>
      {/* Fila principal */}
      <div className="flex items-center px-4 py-3 gap-3">
        <button
          type="button"
          onClick={handleExpand}
          className="flex items-center gap-3 flex-1 text-left"
        >
          <span
            className="w-3 h-3 rounded-full flex-shrink-0"
            style={{ background: cat.color ?? "#9ca3af" }}
          />
          <div>
            <p className="text-[13px] font-semibold" style={{ color: "var(--bink)" }}>{cat.name}</p>
            <p className="text-[11px]" style={{ color: "var(--bmut)" }}>{cat.slug}</p>
          </div>
          <span className="ml-1 text-[11px]" style={{ color: "var(--bmut)" }}>{open ? "▲" : "▼"}</span>
        </button>
        <button
          onClick={() => { setEditing(true); setOpen(true); }}
          className="text-[11.5px] font-medium px-3 py-1 rounded-[7px]"
          style={{ background: "var(--bbord)", color: "var(--bink)" }}
        >
          Editar
        </button>
        <button
          onClick={() => onArchive(cat.id)}
          className="text-[11.5px] font-medium px-3 py-1 rounded-[7px]"
          style={{ background: "#fef2f2", color: "#991b1b" }}
        >
          Archivar
        </button>
      </div>

      {/* Panel expandido */}
      {open && (
        <div className="px-4 pb-4 flex flex-col gap-4" style={{ borderTop: "1px solid var(--bbord)", background: "var(--bbg)" }}>

          {/* Edición inline */}
          {editing && (
            <div className="pt-4 flex flex-col gap-3">
              <div>
                <label className="block text-[11.5px] font-semibold mb-1" style={{ color: "var(--bmut)" }}>Nombre</label>
                <input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className={inputCls}
                  style={inputStyle}
                />
              </div>
              <div>
                <label className="block text-[11.5px] font-semibold mb-1" style={{ color: "var(--bmut)" }}>Color</label>
                <ColorPicker value={editColor} onChange={setEditColor} />
              </div>
              {editError && <p className="text-[11.5px] text-red-600">{editError}</p>}
              <div className="flex gap-2">
                <button
                  onClick={handleSaveEdit}
                  disabled={saving}
                  className="font-semibold text-[12px] px-4 py-1.5 rounded-[7px]"
                  style={{ backgroundColor: "var(--bp)", color: "var(--bop)" }}
                >
                  {saving ? "Guardando…" : "Guardar"}
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
          <div className={editing ? "" : "pt-4"}>
            <p className="text-[11px] font-bold uppercase tracking-wide mb-2" style={{ color: "var(--bmut)" }}>
              Campañas vinculadas
            </p>
            {loadingCampaigns ? (
              <p className="text-[12px]" style={{ color: "var(--bmut)" }}>Cargando…</p>
            ) : campaigns === null || campaigns.length === 0 ? (
              <p className="text-[12px]" style={{ color: "var(--bmut)" }}>Sin campañas en esta categoría.</p>
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
                      </div>
                      <Link
                        href={`/admin/campanas/${c.id}`}
                        className="text-[11px] font-medium flex-shrink-0"
                        style={{ color: "var(--bink)" }}
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
  );
}

interface Props {
  initialCategories: Category[];
}

export default function CategoriasList({ initialCategories }: Props) {
  const [categories, setCategories] = useState<Category[]>(initialCategories);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [color, setColor] = useState(PRESET_COLORS[0]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const created = await api.post<Category>("/v1/admin/categories", { name: name.trim(), color });
      setCategories((prev) => [...prev, created]);
      setName("");
      setColor(PRESET_COLORS[0]);
      setShowForm(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "";
      if (msg.includes("Ya existe")) {
        setError("Ya existe una categoría con ese nombre. Búscala en la lista.");
        // Recarga la lista para mostrar la categoría existente
        try {
          const fresh = await api.get<Category[]>("/v1/admin/categories");
          if (fresh) setCategories(fresh);
        } catch { /* silencioso */ }
      } else {
        setError("No se pudo crear la categoría");
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleArchive(id: string) {
    if (!confirm("¿Archivar esta categoría?")) return;
    try {
      await api.patch(`/v1/admin/categories/${id}/archive`, {});
      setCategories((prev) => prev.filter((c) => c.id !== id));
    } catch {
      alert("Error al archivar");
    }
  }

  function handleUpdate(updated: Category) {
    setCategories((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
  }

  return (
    <div className="max-w-[580px]">
      {/* Formulario nueva categoría */}
      {!showForm ? (
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-1.5 font-semibold text-[13px] mb-5"
          style={{ backgroundColor: "var(--bp)", color: "var(--bop)", padding: "0 16px", minHeight: "36px", borderRadius: "10px" }}
        >
          + Nueva categoría
        </button>
      ) : (
        <form
          onSubmit={handleCreate}
          className="mb-5 p-4 rounded-[14px]"
          style={{ backgroundColor: "var(--bsurf)", border: "1px solid var(--bbord)" }}
        >
          <p className="text-[13px] font-bold mb-3" style={{ color: "var(--bink)" }}>Nueva categoría</p>
          <label className="block text-[11.5px] font-semibold mb-1" style={{ color: "var(--bmut)" }}>
            Nombre
          </label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            placeholder="Ej: Agua y ríos"
            className="w-full px-3 py-2 rounded-[8px] text-[13px] outline-none mb-3"
            style={{ border: "1px solid var(--bbord)", background: "var(--bbg)", color: "var(--bink)" }}
          />
          <label className="block text-[11.5px] font-semibold mb-1" style={{ color: "var(--bmut)" }}>
            Color
          </label>
          <ColorPicker value={color} onChange={setColor} />
          {error && <p className="text-[11.5px] text-red-600 mt-2">{error}</p>}
          <div className="flex gap-2 mt-4">
            <button
              type="submit"
              disabled={saving}
              className="font-semibold text-[12.5px] px-4 py-2 rounded-[8px]"
              style={{ backgroundColor: "var(--bp)", color: "var(--bop)" }}
            >
              {saving ? "Guardando…" : "Crear"}
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="font-semibold text-[12.5px] px-4 py-2 rounded-[8px]"
              style={{ background: "var(--bbord)", color: "var(--bmut)" }}
            >
              Cancelar
            </button>
          </div>
        </form>
      )}

      {/* Lista */}
      <div className="rounded-[14px] overflow-hidden" style={{ backgroundColor: "var(--bsurf)", border: "1px solid var(--bbord)" }}>
        {categories.length === 0 ? (
          <div className="px-5 py-12 text-center">
            <p className="text-[14px] font-semibold mb-1" style={{ color: "var(--bink)" }}>
              Sin categorías
            </p>
            <p className="text-[13px]" style={{ color: "var(--bmut)" }}>
              Crea categorías para organizar tus campañas.
            </p>
          </div>
        ) : (
          categories.map((cat) => (
            <CategoryRow key={cat.id} cat={cat} onUpdate={handleUpdate} onArchive={handleArchive} />
          ))
        )}
      </div>
    </div>
  );
}
