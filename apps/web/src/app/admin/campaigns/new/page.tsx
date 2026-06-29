"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";
import { Campaign, Form } from "@/lib/types";

function slugify(text: string) {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

export default function NewCampaignPage() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [accessMode, setAccessMode] = useState("public");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function handleTitleChange(v: string) {
    setTitle(v);
    if (!slugTouched) setSlug(slugify(v));
  }

  function handleSlugChange(v: string) {
    setSlugTouched(true);
    setSlug(slugify(v));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !slug.trim()) return;

    setSaving(true);
    setError("");
    try {
      // 1. Crear formulario en blanco
      const form = await api.post<Form>("/v1/forms", { title: title.trim() });
      // 2. Crear campaña vinculada al formulario
      await api.post<Campaign>("/v1/campaigns", {
        form_id: form.id,
        title: title.trim(),
        slug: slug.trim(),
        access_mode: accessMode,
      });
      // 3. Ir al constructor del formulario
      router.push(`/admin/forms/${form.id}/builder`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al crear la campaña");
      setSaving(false);
    }
  }

  return (
    <div className="max-w-lg">
      <div className="flex items-center gap-2 text-sm text-gray-500 mb-6">
        <Link href="/admin/campaigns" className="hover:text-gray-900">Campañas</Link>
        <span>/</span>
        <span className="text-gray-900">Nueva campaña</span>
      </div>

      <h1 className="text-2xl font-bold text-gray-900 mb-1">Nueva campaña</h1>
      <p className="text-sm text-gray-500 mb-6">
        Se crea la campaña con un formulario en blanco. Luego puedes agregar preguntas desde el constructor.
      </p>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Título</label>
          <input
            type="text"
            value={title}
            onChange={(e) => handleTitleChange(e.target.value)}
            placeholder="Encuesta de satisfacción 2026"
            required
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand/20"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Slug (URL pública)</label>
          <div className="flex items-center border border-gray-200 rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-brand/20">
            <span className="px-3 py-2 text-sm text-gray-400 bg-gray-50 border-r border-gray-200 shrink-0">
              /c/
            </span>
            <input
              type="text"
              value={slug}
              onChange={(e) => handleSlugChange(e.target.value)}
              placeholder="encuesta-satisfaccion-2026"
              required
              className="flex-1 px-3 py-2 text-sm focus:outline-none"
            />
          </div>
          <p className="text-xs text-gray-400 mt-1">Solo letras, números y guiones</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Modo de acceso</label>
          <select
            value={accessMode}
            onChange={(e) => setAccessMode(e.target.value)}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand/20 bg-white"
          >
            <option value="public">Público (cualquier persona)</option>
            <option value="allowlist">Lista de permitidos</option>
            <option value="token">Con token</option>
          </select>
        </div>

        {error && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            {error}
          </p>
        )}

        <div className="flex gap-3 pt-2">
          <Link
            href="/admin/campaigns"
            className="px-4 py-2 text-sm border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Cancelar
          </Link>
          <button
            type="submit"
            disabled={saving || !title.trim() || !slug.trim()}
            className="px-4 py-2 text-sm bg-brand text-white rounded-lg hover:opacity-90 disabled:opacity-50 transition-opacity"
          >
            {saving ? "Creando…" : "Crear campaña y formulario"}
          </button>
        </div>
      </form>
    </div>
  );
}
