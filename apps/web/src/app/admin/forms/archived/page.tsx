import Link from "next/link";
import { apiServer } from "@/lib/api-server";
import ArchivedFormsList from "./ArchivedFormsList";

interface FormItem {
  id: string;
  title: string;
  updated_at: string;
  questions: { id: string }[];
}

export default async function ArchivedFormsPage() {
  const forms = await apiServer<FormItem[]>("/v1/forms/archived") ?? [];

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-3">
          <Link href="/admin/forms" className="text-gray-400 hover:text-gray-600 text-sm">
            ← Formularios
          </Link>
          <span className="text-gray-300">/</span>
          <h1 className="text-2xl font-bold text-gray-900">Papelera</h1>
        </div>
      </div>

      <p className="text-sm text-gray-500 mb-4">
        Los formularios archivados se muestran aquí. Puedes restaurarlos a estado borrador o eliminarlos permanentemente.
      </p>

      <ArchivedFormsList initialForms={forms} />
    </div>
  );
}
