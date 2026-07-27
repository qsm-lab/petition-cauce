import Link from "next/link";
import { getAdminCampaign } from "@/lib/admin-campaigns-api";
import ComunicacionesClient from "./ComunicacionesClient";

interface PageProps {
  params: { id: string };
}

export default async function ComunicacionesPage({ params }: PageProps) {
  const campaign = await getAdminCampaign(params.id);

  if (!campaign) {
    return (
      <div className="p-6">
        <div
          className="rounded-[14px] p-10 text-center"
          style={{ backgroundColor: "var(--bsurf)", border: "1px solid var(--bbord)" }}
        >
          <p className="font-semibold text-[15px] mb-1" style={{ color: "var(--bink)" }}>
            Campaña no encontrada
          </p>
          <p className="text-[13px] mb-4" style={{ color: "var(--bmut)" }}>
            Puede que no exista o no tengas acceso.
          </p>
          <Link href="/admin/campanas" className="text-[13px] font-semibold" style={{ color: "var(--bp)" }}>
            ← Volver a campañas
          </Link>
        </div>
      </div>
    );
  }

  return <ComunicacionesClient campaign={campaign} />;
}
