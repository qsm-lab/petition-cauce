"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";

interface FormItem {
  id: string;
  title: string;
  updated_at: string;
  questions: { id: string }[];
}

interface Props {
  initialForms: FormItem[];
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("es-EC", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "America/Guayaquil",
  });
}

export default function ArchivedFormsList({ initialForms }: Props) {
  const router = useRouter();
  const [forms, setForms] = useState(initialForms);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  async function handleUnarchive(id: string) {
    setLoadingId(id);
    try {
      await api.post(`/v1/forms/${id}/unarchive`, {});
      setForms((prev) => prev.filter((f) => f.id !== id));
      router.refresh();
    } catch {
      alert("No se pudo restaurar el formulario.");
    } finally {
      setLoadingId(null);
    }
  }

  async function handleDeletePermanent(id: string) {
    setLoadingId(id);
    try {
      await api.delete(`/v1/forms/${id}/permanent`);
      setForms((prev) => prev.filter((f) => f.id !== id));
      setConfirmDeleteId(null);
    } catch {
      alert("No se pudo eliminar el formulario.");
    } finally {
      setLoadingId(null);
    }
  }

  if (forms.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-10 text-center">
        <p className="text-gray-400 text-sm">La papelera está vacía.</p>
      </div>
    );
  }

  return (
    <>
      <div className="bg-white rounded-xl border border-gray-200">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs text-gray-500 border-b border-gray-100">
              <th className="text-left px-5 py-3 font-medium">Título</th>
              <th className="text-left px-5 py-3 font-medium">Archivado</th>
              <th className="text-right px-5 py-3 font-medium">Preguntas</th>
              <th className="px-5 py-3" />
            </tr>
          </thead>
          <tbody>
            {forms.map((f) => {
              const busy = loadingId === f.id;
              return (
                <tr key={f.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50">
                  <td className="px-5 py-3 font-medium text-gray-700">{f.title}</td>
                  <td className="px-5 py-3 text-gray-400">{formatDate(f.updated_at)}</td>
                  <td className="px-5 py-3 text-right text-gray-600">{f.questions.length}</td>
                  <td className="px-5 py-3 text-right">
                    <div className="flex justify-end gap-3">
                      <button
                        onClick={() => handleUnarchive(f.id)}
                        disabled={busy}
                        className="text-brand text-xs hover:underline disabled:opacity-40"
                      >
                        {busy && loadingId === f.id ? "Restaurando…" : "Restaurar"}
                      </button>
                      <button
                        onClick={() => setConfirmDeleteId(f.id)}
                        disabled={busy}
                        className="text-red-500 text-xs hover:underline disabled:opacity-40"
                      >
                        Eliminar
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Diálogo de confirmación de eliminación permanente */}
      {confirmDeleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl p-6 max-w-sm w-full mx-4">
            <h2 className="text-base font-semibold text-gray-900 mb-2">¿Eliminar permanentemente?</h2>
            <p className="text-sm text-gray-500 mb-5">
              Esta acción no se puede deshacer. El formulario y todas sus preguntas serán eliminados de forma definitiva.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setConfirmDeleteId(null)}
                className="text-sm text-gray-600 hover:text-gray-900 px-4 py-2"
              >
                Cancelar
              </button>
              <button
                onClick={() => handleDeletePermanent(confirmDeleteId)}
                disabled={loadingId === confirmDeleteId}
                className="text-sm bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 disabled:opacity-50"
              >
                {loadingId === confirmDeleteId ? "Eliminando…" : "Eliminar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
