"use client";

import { useState } from "react";
import { api } from "@/lib/api";

interface Props {
  campaignId: string;
  initialTitle: string;
}

export default function CampaignTitleEditor({ campaignId, initialTitle }: Props) {
  const [title, setTitle] = useState(initialTitle);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(initialTitle);
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    const trimmed = draft.trim();
    if (!trimmed || trimmed === title) { setEditing(false); setDraft(title); return; }
    setSaving(true);
    try {
      await api.put(`/v1/campaigns/${campaignId}`, { title: trimmed });
      setTitle(trimmed);
      setEditing(false);
    } catch {
      alert("No se pudo guardar el nombre.");
    } finally {
      setSaving(false);
    }
  }

  if (editing) {
    return (
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleSave();
            if (e.key === "Escape") { setEditing(false); setDraft(title); }
          }}
          autoFocus
          className="text-2xl font-bold text-gray-900 border-b border-brand focus:outline-none bg-transparent w-full max-w-md"
        />
        <button onClick={handleSave} disabled={saving} className="text-xs text-brand hover:underline disabled:opacity-50 shrink-0">
          {saving ? "Guardando…" : "Guardar"}
        </button>
        <button onClick={() => { setEditing(false); setDraft(title); }} className="text-xs text-gray-400 hover:text-gray-600 shrink-0">
          Cancelar
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={() => { setEditing(true); setDraft(title); }}
      className="group flex items-center gap-2 text-left"
    >
      <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
      <svg className="w-4 h-4 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
      </svg>
    </button>
  );
}
