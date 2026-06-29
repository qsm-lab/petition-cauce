"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { FormVersion } from "@/lib/types";

interface Props {
  formId: string;
  onRestore: () => void;
}

export default function VersionsPanel({ formId, onRestore }: Props) {
  const [versions, setVersions] = useState<FormVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [restoring, setRestoring] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);

  useEffect(() => {
    api.get<FormVersion[]>(`/v1/forms/${formId}/versions`)
      .then(setVersions)
      .finally(() => setLoading(false));
  }, [formId]);

  async function handleRestore(versionId: string) {
    setRestoring(versionId);
    try {
      await api.post(`/v1/forms/${formId}/versions/${versionId}/restore`, {});
      setConfirmId(null);
      onRestore();
    } finally {
      setRestoring(null);
    }
  }

  if (loading) {
    return (
      <div className="p-4 text-center text-sm text-gray-400">Cargando versiones…</div>
    );
  }

  if (versions.length === 0) {
    return (
      <div className="p-4 text-center">
        <p className="text-sm text-gray-400">Sin versiones guardadas.</p>
        <p className="text-xs text-gray-300 mt-1">Las versiones se guardan automáticamente al editar el formulario.</p>
      </div>
    );
  }

  return (
    <div className="space-y-1 p-2">
      <p className="text-xs text-gray-400 px-2 pb-1">Últimas {versions.length} versiones</p>
      {versions.map((v) => (
        <div
          key={v.id}
          className="flex items-center justify-between gap-2 px-2 py-2 rounded-lg hover:bg-gray-50 group"
        >
          <div className="min-w-0">
            <p className="text-sm text-gray-700 truncate">{v.label}</p>
            <p className="text-xs text-gray-400">v{v.version_number}</p>
          </div>

          {confirmId === v.id ? (
            <div className="flex items-center gap-1.5 shrink-0">
              <span className="text-xs text-amber-600">¿Restaurar?</span>
              <button
                onClick={() => handleRestore(v.id)}
                disabled={restoring === v.id}
                className="text-xs px-2 py-0.5 rounded bg-amber-500 text-white hover:bg-amber-600 disabled:opacity-50 transition-colors"
              >
                {restoring === v.id ? "…" : "Sí"}
              </button>
              <button
                onClick={() => setConfirmId(null)}
                className="text-xs px-2 py-0.5 rounded border border-gray-200 text-gray-500 hover:bg-gray-100 transition-colors"
              >
                No
              </button>
            </div>
          ) : (
            <button
              onClick={() => setConfirmId(v.id)}
              className="text-xs text-brand opacity-0 group-hover:opacity-100 transition-opacity hover:underline shrink-0"
            >
              Restaurar
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
