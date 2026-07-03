"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import type { Category } from "@/lib/admin-categories-api";

const PRESET_COLORS = [
  "#15803d", "#0369a1", "#7c3aed", "#b45309", "#be185d",
  "#0f766e", "#c2410c", "#4338ca", "#6d28d9", "#374151",
];

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

function CategoryChip({ cat, onArchive }: { cat: Category; onArchive: (id: string) => void }) {
  return (
    <div
      className="flex items-center justify-between px-4 py-3"
      style={{ borderBottom: "1px solid var(--bbord)" }}
    >
      <div className="flex items-center gap-3">
        <span
          className="w-3 h-3 rounded-full flex-shrink-0"
          style={{ background: cat.color ?? "#9ca3af" }}
        />
        <div>
          <p className="text-[13px] font-semibold" style={{ color: "var(--bink)" }}>{cat.name}</p>
          <p className="text-[11px]" style={{ color: "var(--bmut)" }}>{cat.slug}</p>
        </div>
      </div>
      <button
        onClick={() => onArchive(cat.id)}
        className="text-[11.5px] font-medium px-3 py-1 rounded-[7px] transition-colors hover:opacity-80"
        style={{ background: "#fef2f2", color: "#991b1b" }}
      >
        Archivar
      </button>
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
      const created = await api.post<Category>("/v1/admin/categories", { name, color });
      setCategories((prev) => [...prev, created]);
      setName("");
      setColor(PRESET_COLORS[0]);
      setShowForm(false);
    } catch {
      setError("No se pudo crear la categoría");
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

  return (
    <div className="max-w-[580px]">
      {/* Formulario nueva categoría */}
      {!showForm ? (
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-1.5 font-semibold text-[13px] text-white mb-5"
          style={{ backgroundColor: "var(--bp)", padding: "0 16px", minHeight: "36px", borderRadius: "10px" }}
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
            style={{
              border: "1px solid var(--bbord)",
              background: "var(--bbg)",
              color: "var(--bink)",
            }}
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
              className="font-semibold text-[12.5px] text-white px-4 py-2 rounded-[8px]"
              style={{ backgroundColor: "var(--bp)" }}
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
            <CategoryChip key={cat.id} cat={cat} onArchive={handleArchive} />
          ))
        )}
      </div>
    </div>
  );
}
