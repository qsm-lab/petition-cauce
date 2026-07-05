import Link from "next/link";
import { getAdminCampaigns } from "@/lib/admin-campaigns-api";

const STATUS_BADGE: Record<string, { bg: string; color: string; label: string }> = {
  active: { bg: "color-mix(in srgb,#18794A 12%,transparent)", color: "#18794A", label: "Activa" },
  draft: { bg: "#f3f4f6", color: "#6b7280", label: "Borrador" },
  closed: { bg: "#fef2f2", color: "#991b1b", label: "Cerrada" },
  online: { bg: "color-mix(in srgb,#0369a1 12%,transparent)", color: "#0369a1", label: "Online" },
};

export default async function FirmasPage() {
  const campaigns = await getAdminCampaigns();

  return (
    <div>
      <header
        className="sticky top-0 z-10 px-6 py-4 flex items-center justify-between"
        style={{ backgroundColor: "var(--bsurf)", borderBottom: "1px solid var(--bbord)" }}
      >
        <div>
          <h1 className="font-display font-bold text-[18px]" style={{ color: "var(--bink)" }}>
            Firmas
          </h1>
          <p className="text-[12.5px] mt-0.5" style={{ color: "var(--bmut)" }}>
            Resumen por campaña
          </p>
        </div>
      </header>

      <div className="p-6 animate-pc-rise">
        <div
          className="rounded-[14px] overflow-hidden"
          style={{ backgroundColor: "var(--bsurf)", border: "1px solid var(--bbord)" }}
        >
          {/* Header tabla */}
          <div
            className="grid px-5 py-3"
            style={{
              gridTemplateColumns: "1fr 100px 90px 110px",
              borderBottom: "1px solid var(--bbord)",
              backgroundColor: "var(--bbg)",
            }}
          >
            <span className="text-[11px] font-bold uppercase tracking-[.05em]" style={{ color: "var(--bmut)" }}>Campaña</span>
            <span className="text-[11px] font-bold uppercase tracking-[.05em]" style={{ color: "var(--bmut)" }}>Firmas</span>
            <span className="text-[11px] font-bold uppercase tracking-[.05em]" style={{ color: "var(--bmut)" }}>Estado</span>
            <span className="text-[11px] font-bold uppercase tracking-[.05em] text-right" style={{ color: "var(--bmut)" }}>Acciones</span>
          </div>

          {campaigns.length === 0 ? (
            <div className="px-5 py-16 text-center">
              <p className="text-[14px] font-semibold mb-1" style={{ color: "var(--bink)" }}>Sin campañas</p>
              <p className="text-[13px]" style={{ color: "var(--bmut)" }}>Crea una campaña para empezar a recibir firmas.</p>
              <Link href="/admin/campanas" className="inline-flex items-center gap-1.5 mt-4 font-semibold text-[13px] text-white rounded-[9px] px-4 py-2" style={{ backgroundColor: "var(--bp)" }}>
                Ir a Campañas →
              </Link>
            </div>
          ) : (
            campaigns.map((c) => {
              const s = STATUS_BADGE[c.status] ?? { bg: "#f3f4f6", color: "#6b7280", label: c.status };
              return (
                <div
                  key={c.id}
                  className="grid px-5 py-3.5 items-center"
                  style={{
                    gridTemplateColumns: "1fr 100px 90px 110px",
                    borderBottom: "1px solid var(--bbord)",
                  }}
                >
                  <div className="min-w-0 pr-4">
                    <p className="text-[13px] font-semibold truncate" style={{ color: "var(--bink)" }}>{c.title}</p>
                    <p className="text-[11px]" style={{ color: "var(--bmut)" }}>/{c.slug}</p>
                  </div>
                  <div>
                    <span className="font-display font-bold text-[18px]" style={{ color: "var(--bp)", fontFamily: "var(--fd)" }}>
                      {c.confirmed_signatures.toLocaleString("es-EC")}
                    </span>
                    {c.goal_count && (
                      <p className="text-[10.5px]" style={{ color: "var(--bmut)" }}>
                        de {c.goal_count.toLocaleString("es-EC")}
                      </p>
                    )}
                  </div>
                  <div>
                    <span
                      className="inline-flex items-center font-semibold text-[11px]"
                      style={{ background: s.bg, color: s.color, padding: "3px 9px", borderRadius: "99px" }}
                    >
                      {s.label}
                    </span>
                  </div>
                  <div className="flex justify-end">
                    <Link
                      href={`/admin/campanas/${c.id}/firmas`}
                      className="inline-flex items-center gap-1 text-[12px] font-semibold px-3 py-1.5 rounded-[7px]"
                      style={{ background: "color-mix(in srgb,var(--bp) 10%,transparent)", color: "var(--bp)", border: "1px solid color-mix(in srgb,var(--bp) 25%,transparent)" }}
                    >
                      Ver firmas →
                    </Link>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
