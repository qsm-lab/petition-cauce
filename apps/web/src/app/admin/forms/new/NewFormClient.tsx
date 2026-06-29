"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";

interface Campaign {
  id: string;
  title: string;
  slug: string;
}

interface Form {
  id: string;
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

export default function NewFormClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pending = useRef(false);
  const preselectedCampaign = searchParams.get("campaign") ?? "";

  const [formTitle, setFormTitle] = useState("");
  const [campaigns, setCampaigns] = useState<Campaign[] | null>(null);
  const [campaignId, setCampaignId] = useState<string>(preselectedCampaign || "none");
  const [newCampaignTitle, setNewCampaignTitle] = useState("");
  const [newCampaignSlug, setNewCampaignSlug] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingCampaigns, setLoadingCampaigns] = useState(false);

  useEffect(() => {
    if (preselectedCampaign) loadCampaigns();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadCampaigns() {
    if (campaigns !== null) return;
    setLoadingCampaigns(true);
    try {
      const data = await api.get<Campaign[]>("/v1/campaigns");
      setCampaigns(data);
    } catch {
      setCampaigns([]);
    } finally {
      setLoadingCampaigns(false);
    }
  }

  function handleNewCampaignTitle(v: string) {
    setNewCampaignTitle(v);
    setNewCampaignSlug(slugify(v));
  }

  async function handleCreate() {
    if (pending.current) return;
    const title = formTitle.trim();
    if (!title) { alert("Ingresa un título para el formulario."); return; }

    pending.current = true;
    setLoading(true);
    try {
      const form = await api.post<Form>("/v1/forms", { title });

      let resolvedCampaignId: string | null = null;

      if (campaignId === "new") {
        const cTitle = newCampaignTitle.trim();
        const cSlug = newCampaignSlug.trim();
        if (cTitle && cSlug) {
          const campaign = await api.post<Campaign>("/v1/campaigns", {
            title: cTitle,
            slug: cSlug,
            form_id: form.id,
          });
          resolvedCampaignId = campaign.id;
        }
      } else if (campaignId && campaignId !== "none") {
        await api.put(`/v1/campaigns/${campaignId}`, { form_id: form.id });
        resolvedCampaignId = campaignId;
      }

      if (resolvedCampaignId) {
        await api.put(`/v1/forms/${form.id}`, { campaign_id: resolvedCampaignId });
      }

      router.push(`/admin/forms/${form.id}/builder`);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Error al crear el formulario.");
      pending.current = false;
      setLoading(false);
    }
  }

  return (
    <div className="max-w-lg">
      <div className="flex items-center gap-2 text-sm text-gray-500 mb-6">
        <Link href="/admin/forms" className="hover:text-gray-900">Formularios</Link>
        <span>/</span>
        <span className="text-gray-900">Nuevo formulario</span>
      </div>

      <h1 className="text-2xl font-bold text-gray-900 mb-6">Nuevo formulario</h1>

      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-5">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Título del formulario</label>
          <input
            type="text"
            value={formTitle}
            onChange={(e) => setFormTitle(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleCreate()}
            placeholder="Ej. Encuesta de satisfacción 2026"
            autoFocus
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-brand"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Campaña</label>
          <select
            value={campaignId}
            onChange={(e) => { setCampaignId(e.target.value); loadCampaigns(); }}
            onFocus={loadCampaigns}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-brand bg-white"
          >
            <option value="none">Sin campaña</option>
            <option value="new">+ Nueva campaña</option>
            {loadingCampaigns && <option disabled>Cargando…</option>}
            {(campaigns ?? []).map((c) => (
              <option key={c.id} value={c.id}>{c.title}</option>
            ))}
          </select>
        </div>

        {campaignId === "new" && (
          <div className="space-y-3 pl-3 border-l-2 border-brand/30">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Nombre de la campaña</label>
              <input
                type="text"
                value={newCampaignTitle}
                onChange={(e) => handleNewCampaignTitle(e.target.value)}
                placeholder="Ej. Campaña Quito Sin Minería"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-brand"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">URL de la campaña</label>
              <div className="flex items-center gap-1">
                <span className="text-gray-400 text-sm">/c/</span>
                <input
                  type="text"
                  value={newCampaignSlug}
                  onChange={(e) => setNewCampaignSlug(slugify(e.target.value))}
                  placeholder="nombre-campana"
                  className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-brand font-mono"
                />
              </div>
            </div>
          </div>
        )}

        <button
          onClick={handleCreate}
          disabled={loading || !formTitle.trim()}
          className="w-full bg-brand text-white py-2.5 rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
        >
          {loading ? "Creando…" : "Crear formulario"}
        </button>
      </div>
    </div>
  );
}
