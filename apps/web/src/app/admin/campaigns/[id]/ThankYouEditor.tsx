"use client";

import { useState } from "react";
import { api } from "@/lib/api";

interface Props {
  campaignId: string;
  initialTitle?: string;
  initialBody?: string;
}

const DEFAULT_TITLE = "¡Gracias por tu voz!";
const DEFAULT_BODY =
  "Tu participación es fundamental para la comunidad QSM. Con tus respuestas seguimos construyendo un Ecuador libre de minería irresponsable.";

export default function ThankYouEditor({ campaignId, initialTitle, initialBody }: Props) {
  const [title, setTitle] = useState(initialTitle ?? "");
  const [body, setBody] = useState(initialBody ?? "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function handleSave() {
    setSaving(true);
    try {
      await api.patch(`/v1/campaigns/${campaignId}/thank-you`, {
        thank_you_title: title || null,
        thank_you_body: body || null,
      });
      setSaved(true);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <h2 className="font-semibold text-gray-900 mb-1">Pantalla de agradecimiento</h2>
      <p className="text-xs text-gray-400 mb-4">
        Texto que verá el participante al completar la encuesta. Si se deja vacío se usa el texto por defecto.
      </p>

      <div className="space-y-3">
        <div>
          <label className="text-xs text-gray-500 block mb-1">Título</label>
          <input
            type="text"
            value={title}
            onChange={(e) => { setTitle(e.target.value); setSaved(false); }}
            placeholder={DEFAULT_TITLE}
            className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2
              focus:outline-none focus:border-brand transition-colors"
          />
        </div>

        <div>
          <label className="text-xs text-gray-500 block mb-1">Cuerpo del mensaje</label>
          <textarea
            rows={3}
            value={body}
            onChange={(e) => { setBody(e.target.value); setSaved(false); }}
            placeholder={DEFAULT_BODY}
            className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2
              focus:outline-none focus:border-brand transition-colors resize-none"
          />
        </div>
      </div>

      <div className="flex items-center gap-3 mt-4">
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-4 py-2 bg-brand text-white text-sm font-medium rounded-lg
            hover:opacity-90 disabled:opacity-50 transition-opacity"
        >
          {saving ? "Guardando…" : "Guardar texto"}
        </button>
        {saved && <span className="text-xs text-green-600">✓ Guardado</span>}
      </div>
    </div>
  );
}
