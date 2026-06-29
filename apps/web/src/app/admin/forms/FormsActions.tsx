"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";

interface Props {
  formId: string;
}

export default function FormsActions({ formId }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleArchive() {
    if (!confirm("¿Archivar este formulario? Podrás restaurarlo desde la Papelera.")) return;
    setLoading(true);
    try {
      await api.delete(`/v1/forms/${formId}`);
      router.refresh();
    } catch {
      alert("No se pudo archivar el formulario.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={handleArchive}
      disabled={loading}
      className="text-gray-400 text-xs hover:text-red-500 disabled:opacity-40 transition-colors"
    >
      {loading ? "…" : "Archivar"}
    </button>
  );
}
