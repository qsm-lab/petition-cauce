"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import type { SocialLinks } from "@/lib/types";

const LINK_FIELDS: { key: keyof SocialLinks; label: string; placeholder: string }[] = [
  { key: "instagram",  label: "Instagram",        placeholder: "https://instagram.com/quitosinmineria" },
  { key: "facebook",   label: "Facebook",          placeholder: "https://facebook.com/qsm" },
  { key: "tiktok",     label: "TikTok",            placeholder: "https://tiktok.com/@qsm" },
  { key: "whatsapp",   label: "WhatsApp / Grupos", placeholder: "https://wa.me/..." },
  { key: "newsletter", label: "Newsletter",        placeholder: "https://..." },
  { key: "website",    label: "Sitio web",         placeholder: "https://quitosinmineria.org" },
];

interface Props {
  campaignId: string;
  initial?: SocialLinks;
  initialShareText?: string;
}

export default function SocialLinksEditor({ campaignId, initial = {}, initialShareText = "" }: Props) {
  const [links, setLinks] = useState<SocialLinks>(initial);
  const [shareText, setShareText] = useState(initialShareText);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  function handleChange(key: keyof SocialLinks, value: string) {
    setLinks((prev) => ({ ...prev, [key]: value || undefined }));
    setSaved(false);
  }

  async function handleSave() {
    setSaving(true);
    try {
      await api.patch(`/v1/campaigns/${campaignId}/social-links`, {
        ...links,
        share_text: shareText || null,
      });
      setSaved(true);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <h2 className="font-semibold text-gray-900 mb-1">Redes sociales y compartir</h2>
      <p className="text-xs text-gray-400 mb-4">
        Los enlaces aparecen en la pantalla de agradecimiento. El texto de compartir se usa al difundir la encuesta por WhatsApp.
      </p>

      <div className="mb-4">
        <label className="text-xs text-gray-500 block mb-1">Texto para compartir la encuesta</label>
        <textarea
          value={shareText}
          onChange={(e) => { setShareText(e.target.value); setSaved(false); }}
          rows={2}
          maxLength={300}
          placeholder="Participé en la encuesta de Quito Sin Minería ¡Tú también puedes hacerlo!"
          className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-brand resize-none"
        />
        <p className="text-xs text-gray-300 text-right">{shareText.length}/300</p>
      </div>

      <div className="space-y-3">
        {LINK_FIELDS.map(({ key, label, placeholder }) => (
          <div key={key}>
            <label className="text-xs text-gray-500 block mb-1">{label}</label>
            <input
              type="url"
              value={links[key] ?? ""}
              onChange={(e) => handleChange(key, e.target.value)}
              placeholder={placeholder}
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2
                focus:outline-none focus:border-brand transition-colors"
            />
          </div>
        ))}
      </div>

      <div className="flex items-center gap-3 mt-5">
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-4 py-2 bg-brand text-white text-sm font-medium rounded-lg
            hover:opacity-90 disabled:opacity-50 transition-opacity"
        >
          {saving ? "Guardando…" : "Guardar"}
        </button>
        {saved && <span className="text-xs text-green-600">✓ Guardado</span>}
      </div>
    </div>
  );
}
