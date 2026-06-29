"use client";

import { useState, useEffect } from "react";
import { api } from "@/lib/api";

interface Campaign {
  id: string;
  title: string;
  slug: string;
}

interface Props {
  formId: string;
  initialCampaignId?: string | null;
}

function slugify(text: string) {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, 100);
}

export default function CampaignSelector({ formId, initialCampaignId }: Props) {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [selected, setSelected] = useState(initialCampaignId ?? "none");
  const [newTitle, setNewTitle] = useState("");
  const [newSlug, setNewSlug] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    api.get<Campaign[]>("/v1/campaigns").then(setCampaigns).catch(() => {});
  }, []);

  const currentCampaign = campaigns.find((c) => c.id === selected);

  async function handleSave() {
    setSaving(true);
    try {
      if (selected === "new") {
        const cTitle = newTitle.trim();
        const cSlug = newSlug.trim();
        if (!cTitle || !cSlug) { alert("Ingresa nombre y URL para la nueva campaña."); return; }
        const campaign = await api.post<Campaign>("/v1/campaigns", {
          title: cTitle,
          slug: cSlug,
          form_id: formId,
        });
        await api.put(`/v1/forms/${formId}`, { campaign_id: campaign.id });
        setSelected(campaign.id);
        setCampaigns((prev) => [...prev, campaign]);
      } else if (selected === "none") {
        await api.put(`/v1/forms/${formId}`, { campaign_id: null });
      } else {
        await api.put(`/v1/forms/${formId}`, { campaign_id: selected });
        await api.put(`/v1/campaigns/${selected}`, { form_id: formId });
      }
      setSaved(true);
      setExpanded(false);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Error al guardar");
    } finally {
      setSaving(false);
    }
  }

  if (!expanded) {
    return (
      <button
        onClick={() => setExpanded(true)}
        className="group flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 mt-0.5"
      >
        <span>
          Campaña:{" "}
          <span className="font-medium text-gray-500">
            {currentCampaign?.title ?? (initialCampaignId ? "…" : "Sin campaña")}
          </span>
        </span>
        <svg className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
        </svg>
        {saved && <span className="text-green-600 ml-1">✓</span>}
      </button>
    );
  }

  return (
    <div className="mt-1 flex flex-wrap items-start gap-2">
      <select
        value={selected}
        onChange={(e) => setSelected(e.target.value)}
        className="text-xs border border-gray-200 rounded-lg px-2 py-1 focus:outline-none focus:border-brand bg-white"
      >
        <option value="none">Sin campaña</option>
        <option value="new">+ Nueva campaña</option>
        {campaigns.map((c) => (
          <option key={c.id} value={c.id}>{c.title}</option>
        ))}
      </select>

      {selected === "new" && (
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={newTitle}
            onChange={(e) => { setNewTitle(e.target.value); setNewSlug(slugify(e.target.value)); }}
            placeholder="Nombre campaña"
            className="text-xs border border-gray-200 rounded-lg px-2 py-1 focus:outline-none focus:border-brand w-32"
          />
          <span className="text-xs text-gray-400">/c/</span>
          <input
            type="text"
            value={newSlug}
            onChange={(e) => setNewSlug(slugify(e.target.value))}
            placeholder="url-campana"
            className="text-xs border border-gray-200 rounded-lg px-2 py-1 focus:outline-none focus:border-brand font-mono w-28"
          />
        </div>
      )}

      <button
        onClick={handleSave}
        disabled={saving}
        className="text-xs bg-brand text-white px-3 py-1 rounded-lg hover:opacity-90 disabled:opacity-50"
      >
        {saving ? "Guardando…" : "Guardar"}
      </button>
      <button
        onClick={() => { setExpanded(false); setSelected(initialCampaignId ?? "none"); }}
        className="text-xs text-gray-400 hover:text-gray-600 px-1 py-1"
      >
        Cancelar
      </button>
    </div>
  );
}
