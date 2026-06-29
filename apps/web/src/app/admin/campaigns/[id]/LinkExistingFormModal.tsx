"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";

interface FormItem {
  id: string;
  title: string;
  status: string;
  campaign_id: string | null;
  questions: { id: string }[];
}

interface CampaignItem {
  id: string;
  title: string;
}

interface Props {
  campaignId: string;
  onClose: () => void;
}

const STATUS_LABELS: Record<string, string> = {
  draft: "Borrador",
  active: "Activo",
  online: "En línea",
  completed: "Concluido",
};

export default function LinkExistingFormModal({ campaignId, onClose }: Props) {
  const router = useRouter();
  const [forms, setForms] = useState<FormItem[]>([]);
  const [campaigns, setCampaigns] = useState<Record<string, CampaignItem>>({});
  const [selected, setSelected] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.all([
      api.get<FormItem[]>("/v1/forms"),
      api.get<CampaignItem[]>("/v1/campaigns"),
    ]).then(([fs, cs]) => {
      setForms(fs ?? []);
      setCampaigns(Object.fromEntries((cs ?? []).map((c) => [c.id, c])));
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  async function handleLink() {
    if (!selected) return;
    const form = forms.find((f) => f.id === selected);
    if (!form) return;

    const prevCampaign = form.campaign_id ? campaigns[form.campaign_id] : null;
    const msg = prevCampaign
      ? `Este formulario actualmente pertenece a la campaña "${prevCampaign.title}". Al vincularlo aquí quedará desvinculado de esa campaña. Las métricas e historial de respuestas permanecen en la campaña original.\n\n¿Continuar?`
      : `¿Vincular "${form.title}" a esta campaña?`;

    if (!confirm(msg)) return;

    setSaving(true);
    try {
      await api.put(`/v1/forms/${selected}`, { campaign_id: campaignId });
      await api.put(`/v1/campaigns/${campaignId}`, { form_id: selected });
      router.refresh();
      onClose();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Error al vincular formulario");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">Vincular formulario existente</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
        </div>

        <div className="px-5 py-4">
          <p className="text-xs text-gray-500 mb-3">
            Selecciona un formulario para vincularlo a esta campaña. Si ya pertenece a otra campaña, quedará desvinculado de ella (las métricas de esa campaña no se ven afectadas).
          </p>

          {loading ? (
            <p className="text-sm text-gray-400 py-4 text-center">Cargando formularios…</p>
          ) : forms.length === 0 ? (
            <p className="text-sm text-gray-400 py-4 text-center">No hay formularios disponibles.</p>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {forms.map((f) => {
                const prevCampaign = f.campaign_id ? campaigns[f.campaign_id] : null;
                return (
                  <label
                    key={f.id}
                    className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                      selected === f.id
                        ? "border-brand bg-brand/5"
                        : "border-gray-200 hover:border-gray-300"
                    }`}
                  >
                    <input
                      type="radio"
                      name="form"
                      value={f.id}
                      checked={selected === f.id}
                      onChange={() => setSelected(f.id)}
                      className="mt-0.5 accent-brand"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{f.title}</p>
                      <p className="text-xs text-gray-400">
                        {f.questions.length} preguntas · {STATUS_LABELS[f.status] ?? f.status}
                      </p>
                      {prevCampaign && (
                        <p className="text-xs text-amber-600 mt-0.5">
                          Actualmente en: {prevCampaign.title}
                        </p>
                      )}
                    </div>
                  </label>
                );
              })}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3 px-5 py-4 border-t border-gray-100">
          <button onClick={onClose} className="text-sm text-gray-600 hover:text-gray-900 px-4 py-2">
            Cancelar
          </button>
          <button
            onClick={handleLink}
            disabled={!selected || saving}
            className="text-sm bg-brand text-white px-4 py-2 rounded-lg hover:opacity-90 disabled:opacity-50"
          >
            {saving ? "Vinculando…" : "Vincular formulario"}
          </button>
        </div>
      </div>
    </div>
  );
}
