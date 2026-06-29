"use client";

import { useState } from "react";
import { api } from "@/lib/api";

interface Props {
  campaignId: string;
  initialLogoUrl?: string;
  initialTitle?: string;
  initialTitleSize?: string;
  initialDescription?: string;
  initialSlogan?: string;
  initialSloganSize?: string;
  initialTitleColor?: string;
  initialSloganColor?: string;
  initialSlug?: string;
  initialStatus?: string;
}

const SIZE_OPTIONS = ["xl", "2xl", "3xl", "4xl", "5xl"];
const STATUS_OPTIONS = [
  { value: "draft",  label: "Borrador (draft)" },
  { value: "active", label: "Activa (active)" },
  { value: "paused", label: "Pausada (paused)" },
];

export default function WelcomeConfigEditor({
  campaignId,
  initialLogoUrl = "",
  initialTitle = "",
  initialTitleSize = "3xl",
  initialDescription = "",
  initialSlogan = "",
  initialSloganSize = "2xl",
  initialTitleColor = "#FFFFFF",
  initialSloganColor = "#FFFFFF",
  initialSlug = "",
  initialStatus = "draft",
}: Props) {
  const [logoUrl, setLogoUrl] = useState(initialLogoUrl);
  const [title, setTitle] = useState(initialTitle);
  const [titleSize, setTitleSize] = useState(initialTitleSize || "3xl");
  const [description, setDescription] = useState(initialDescription);
  const [slogan, setSlogan] = useState(initialSlogan);
  const [sloganSize, setSloganSize] = useState(initialSloganSize || "2xl");
  const [titleColor, setTitleColor] = useState(initialTitleColor || "#FFFFFF");
  const [sloganColor, setSloganColor] = useState(initialSloganColor || "#FFFFFF");
  const [slug, setSlug] = useState(initialSlug);
  const [status, setStatus] = useState(initialStatus || "draft");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function handleSave() {
    setSaving(true);
    setSaved(false);
    try {
      await api.patch(`/v1/campaigns/${campaignId}/welcome-config`, {
        welcome_logo_url: logoUrl || undefined,
        welcome_title: title || undefined,
        welcome_title_size: titleSize || undefined,
        welcome_description: description || undefined,
        welcome_slogan: slogan || undefined,
        welcome_slogan_size: sloganSize || undefined,
        welcome_title_color: titleColor,
        welcome_slogan_color: sloganColor,
        slug: slug || undefined,
        status: status || undefined,
      });
      setSaved(true);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <h2 className="font-semibold text-gray-900 mb-1">Pantalla de bienvenida</h2>
      <p className="text-xs text-gray-400 mb-4">
        Personaliza el contenido que ve el usuario antes de comenzar la encuesta.
      </p>

      <div className="space-y-3">
        {/* Status */}
        <div>
          <label className="text-xs text-gray-500 block mb-1">Estado de la campaña</label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-brand bg-white"
          >
            {STATUS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>

        {/* Slug */}
        <div>
          <label className="text-xs text-gray-500 block mb-1">Slug (URL)</label>
          <input
            type="text"
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            placeholder="ej: encuesta-ciudadana-2026"
            className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-brand transition-colors"
          />
        </div>

        {/* Logo URL */}
        <div>
          <label className="text-xs text-gray-500 block mb-1">URL del logo (opcional)</label>
          <input
            type="url"
            value={logoUrl}
            onChange={(e) => setLogoUrl(e.target.value)}
            placeholder="https://..."
            className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-brand transition-colors"
          />
        </div>

        {/* Title + size */}
        <div>
          <label className="text-xs text-gray-500 block mb-1">Título principal</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Comunidades, Territorios y Ciudadanos Unidos"
            className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-brand transition-colors"
          />
        </div>
        <div>
          <label className="text-xs text-gray-500 block mb-1">Tamaño del título</label>
          <select
            value={titleSize}
            onChange={(e) => setTitleSize(e.target.value)}
            className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-brand bg-white"
          >
            {SIZE_OPTIONS.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>

        {/* Description */}
        <div>
          <label className="text-xs text-gray-500 block mb-1">Descripción / cuerpo</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
            placeholder="Texto que aparece en el card central..."
            className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-brand transition-colors resize-none"
          />
        </div>

        {/* Slogan + size */}
        <div>
          <label className="text-xs text-gray-500 block mb-1">Slogan</label>
          <input
            type="text"
            value={slogan}
            onChange={(e) => setSlogan(e.target.value)}
            placeholder="Cada respuesta cuenta"
            className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-brand transition-colors"
          />
        </div>
        <div>
          <label className="text-xs text-gray-500 block mb-1">Tamaño del slogan</label>
          <select
            value={sloganSize}
            onChange={(e) => setSloganSize(e.target.value)}
            className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-brand bg-white"
          >
            {SIZE_OPTIONS.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>

        {/* Apariencia de texto */}
        <div className="pt-2 border-t border-gray-100">
          <p className="text-xs font-medium text-gray-600 mb-3">Apariencia de texto</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500 block mb-1">Color del título</label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={titleColor}
                  onChange={(e) => setTitleColor(e.target.value)}
                  className="w-8 h-8 rounded cursor-pointer border border-gray-200"
                />
                <span
                  className="text-xs font-medium px-2 py-1 rounded"
                  style={{ color: titleColor, backgroundColor: "#1a1040" }}
                >
                  Título
                </span>
              </div>
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Color del slogan</label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={sloganColor}
                  onChange={(e) => setSloganColor(e.target.value)}
                  className="w-8 h-8 rounded cursor-pointer border border-gray-200"
                />
                <span
                  className="text-xs font-medium px-2 py-1 rounded"
                  style={{ color: sloganColor, backgroundColor: "#1a1040" }}
                >
                  Slogan
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3 mt-5">
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-4 py-2 bg-brand text-white text-sm font-medium rounded-lg hover:opacity-90 disabled:opacity-50 transition-opacity"
        >
          {saving ? "Guardando…" : "Guardar configuración"}
        </button>
        {saved && <span className="text-xs text-green-600">✓ Guardado</span>}
      </div>
    </div>
  );
}
