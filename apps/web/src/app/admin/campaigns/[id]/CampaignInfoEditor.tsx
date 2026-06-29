"use client";

import { useState } from "react";
import { api } from "@/lib/api";

const PROTECTION_OPTIONS = [
  { value: "Anónimo",     label: "Anónimo",     desc: "No se almacenan datos identificables" },
  { value: "Seudónimo",   label: "Seudónimo",   desc: "Datos con código sin nombre real" },
  { value: "Identificado",label: "Identificado",desc: "Datos vinculados a identidad real" },
];

interface Props {
  campaignId: string;
  initialDescription?: string;
  initialDataProtectionLevel?: string;
}

export default function CampaignInfoEditor({ campaignId, initialDescription, initialDataProtectionLevel }: Props) {
  const [description, setDescription] = useState(initialDescription ?? "");
  const [level, setLevel] = useState(initialDataProtectionLevel ?? "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function handleSave() {
    setSaving(true);
    try {
      await api.patch(`/v1/campaigns/${campaignId}/info`, {
        description: description || null,
        data_protection_level: level || null,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <h2 className="font-semibold text-gray-900 mb-4">Información adicional</h2>

      <div className="space-y-4">
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Descripción</label>
          <textarea
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe el propósito de esta campaña…"
            className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand/20 resize-none"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-700 mb-2">Nivel de protección de datos</label>
          <div className="grid grid-cols-3 gap-2">
            {PROTECTION_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setLevel(opt.value === level ? "" : opt.value)}
                className={`text-left px-3 py-2.5 rounded-lg border text-xs transition-colors ${
                  level === opt.value
                    ? "border-brand bg-brand/5 text-brand"
                    : "border-gray-200 text-gray-600 hover:border-gray-300"
                }`}
              >
                <div className="font-medium">{opt.label}</div>
                <div className="text-gray-400 mt-0.5 leading-tight">{opt.desc}</div>
              </button>
            ))}
          </div>
        </div>

        <div className="flex justify-end gap-2">
          {saved && <span className="text-xs text-green-600 self-center">Guardado</span>}
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-1.5 text-sm bg-brand text-white rounded-lg hover:opacity-90 disabled:opacity-50 transition-opacity"
          >
            {saving ? "Guardando…" : "Guardar"}
          </button>
        </div>
      </div>
    </div>
  );
}
