"use client";

import { useState } from "react";
import Link from "next/link";
import LinkExistingFormModal from "./LinkExistingFormModal";

interface FormItem {
  id: string;
  title: string;
  status: string;
  questions: { id: string }[];
}

interface Props {
  campaignId: string;
  form: FormItem | null;
}

const STATUS_LABELS: Record<string, string> = {
  draft: "Borrador",
  active: "Activo",
  online: "En línea",
  completed: "Concluido",
  archived: "Archivado",
};

const STATUS_COLORS: Record<string, string> = {
  active: "text-green-600",
  online: "text-blue-600",
  draft: "text-gray-400",
  completed: "text-orange-500",
  archived: "text-gray-300",
};

export default function LinkedFormsSection({ campaignId, form }: Props) {
  const [showModal, setShowModal] = useState(false);

  return (
    <>
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h2 className="font-semibold text-gray-900 mb-4">Formulario vinculado</h2>

        {form ? (
          <div className="space-y-3">
            {/* Formulario actual */}
            <div className="flex items-start justify-between gap-3 p-3 rounded-lg bg-gray-50 border border-gray-100">
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{form.title}</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {form.questions.length} pregunta{form.questions.length !== 1 ? "s" : ""}
                  {" · "}
                  <span className={STATUS_COLORS[form.status] ?? "text-gray-400"}>
                    {STATUS_LABELS[form.status] ?? form.status}
                  </span>
                </p>
              </div>
              <Link
                href={`/admin/forms/${form.id}/builder`}
                className="text-xs text-brand hover:underline shrink-0 mt-0.5"
              >
                Editar →
              </Link>
            </div>

            {/* Acciones */}
            <div className="flex items-center gap-4 pt-1">
              <Link
                href={`/admin/forms/new?campaign=${campaignId}`}
                className="inline-flex items-center gap-1.5 text-xs text-brand hover:underline"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Nuevo formulario
              </Link>
              <button
                onClick={() => setShowModal(true)}
                className="inline-flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 hover:underline"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                </svg>
                Más formularios
              </button>
            </div>
          </div>
        ) : (
          <div className="text-center py-4 space-y-3">
            <p className="text-sm text-gray-400">Sin formulario asociado</p>
            <div className="flex justify-center gap-4">
              <Link
                href={`/admin/forms/new?campaign=${campaignId}`}
                className="inline-flex items-center gap-1.5 text-xs text-brand hover:underline"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Crear nuevo formulario
              </Link>
              <button
                onClick={() => setShowModal(true)}
                className="inline-flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 hover:underline"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                </svg>
                Vincular existente
              </button>
            </div>
          </div>
        )}
      </div>

      {showModal && (
        <LinkExistingFormModal
          campaignId={campaignId}
          onClose={() => setShowModal(false)}
        />
      )}
    </>
  );
}
