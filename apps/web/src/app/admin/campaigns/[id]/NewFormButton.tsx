"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { Form } from "@/lib/types";

interface Props {
  campaignId: string;
  campaignTitle: string;
}

export default function NewFormButton({ campaignId, campaignTitle }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const pending = useRef(false);

  async function handleCreate() {
    if (pending.current) return;
    pending.current = true;
    setLoading(true);
    try {
      const form = await api.post<Form>("/v1/forms", { title: campaignTitle });
      await api.put(`/v1/campaigns/${campaignId}`, { form_id: form.id });
      router.push(`/admin/forms/${form.id}/builder`);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Error al crear formulario");
      pending.current = false;
      setLoading(false);
    }
  }

  return (
    <button
      onClick={handleCreate}
      disabled={loading}
      className="inline-flex items-center gap-1.5 text-xs text-brand hover:underline disabled:opacity-50"
    >
      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
      </svg>
      {loading ? "Creando…" : "Nuevo formulario"}
    </button>
  );
}
