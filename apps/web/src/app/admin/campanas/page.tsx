import Link from "next/link";
import { getAdminCampaigns, type AdminCampaignListItem } from "@/lib/admin-campaigns-api";

// ─── Badges ──────────────────────────────────────────────────────────────────

const STATUS_BADGE: Record<string, { bg: string; color: string; label: string }> = {
  active:  { bg: "color-mix(in srgb,#18794A 12%,transparent)", color: "#18794A", label: "Activa"   },
  draft:   { bg: "var(--bbg)",                                  color: "var(--bmut)",  label: "Borrador" },
  closed:  { bg: "#e8f0fe",                                     color: "#1a56db",      label: "Cerrada"  },
  pending: { bg: "#fff7ed",                                     color: "#c2410c",      label: "Pendiente"},
};

function StatusBadge({ status }: { status: string }) {
  const s = STATUS_BADGE[status] ?? STATUS_BADGE.draft;
  return (
    <span
      className="inline-flex items-center font-bold text-[11px]"
      style={{ background: s.bg, color: s.color, padding: "4px 9px", borderRadius: "99px" }}
    >
      {s.label}
    </span>
  );
}

// ─── Barra de progreso ────────────────────────────────────────────────────────

function ProgressBar({ confirmed, goal }: { confirmed: number; goal: number | null }) {
  if (!goal) {
    return (
      <span className="text-[12.5px]" style={{ color: "var(--bink)" }}>
        <strong>{confirmed.toLocaleString("es-EC")}</strong>
        <span style={{ color: "var(--bmut)" }}> firmas</span>
      </span>
    );
  }
  const pct = Math.min(100, Math.round((confirmed / goal) * 100));
  return (
    <div>
      <div className="flex items-center gap-1.5 mb-1">
        <span className="text-[12.5px] font-bold" style={{ color: "var(--bink)" }}>
          {confirmed.toLocaleString("es-EC")}
        </span>
        <span className="text-[11px]" style={{ color: "var(--bmut)" }}>
          / {goal.toLocaleString("es-EC")} ({pct}%)
        </span>
      </div>
      <div className="h-1.5 rounded-full overflow-hidden" style={{ width: "120px", backgroundColor: "var(--bbord)" }}>
        <div
          className="h-full rounded-full"
          style={{ width: `${pct}%`, backgroundColor: "var(--bp)" }}
        />
      </div>
    </div>
  );
}

// ─── Fecha ────────────────────────────────────────────────────────────────────

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("es-EC", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

// ─── Página ──────────────────────────────────────────────────────────────────

export default async function CampanasPage() {
  const campanas = await getAdminCampaigns();

  return (
    <div>
      {/* Sticky header */}
      <header
        className="sticky top-0 z-10 px-6 py-4 flex items-center justify-between"
        style={{ backgroundColor: "var(--bsurf)", borderBottom: "1px solid var(--bbord)" }}
      >
        <div>
          <h1 className="font-display font-bold text-[18px]" style={{ color: "var(--bink)" }}>
            Campañas
          </h1>
          <p className="text-[12.5px] mt-0.5" style={{ color: "var(--bmut)" }}>
            {campanas.length > 0
              ? `${campanas.length} campaña${campanas.length !== 1 ? "s" : ""}`
              : "Gestión de campañas de petición"}
          </p>
        </div>
        <Link
          href="/admin/campanas/nueva"
          className="flex items-center gap-1.5 font-semibold text-[13px] text-white"
          style={{
            backgroundColor: "var(--bp)",
            padding: "0 16px",
            minHeight: "38px",
            borderRadius: "10px",
            textDecoration: "none",
          }}
        >
          + Nueva campaña
        </Link>
      </header>

      {/* Contenido */}
      <div className="p-6 animate-pc-rise">
        {/* Tabla */}
        <div
          className="rounded-[14px] overflow-hidden"
          style={{ backgroundColor: "var(--bsurf)", border: "1px solid var(--bbord)" }}
        >
          <div
            className="flex items-center gap-0 px-[18px] py-3"
            style={{ borderBottom: "1px solid var(--bbord)", backgroundColor: "var(--bbg)" }}
          >
            <span className="font-bold text-[11px] uppercase tracking-[.05em] flex-1" style={{ color: "var(--bmut)" }}>
              Campaña
            </span>
            <span className="font-bold text-[11px] uppercase tracking-[.05em] flex-none w-[160px]" style={{ color: "var(--bmut)" }}>
              Progreso
            </span>
            <span className="font-bold text-[11px] uppercase tracking-[.05em] flex-none w-[90px]" style={{ color: "var(--bmut)" }}>
              Estado
            </span>
            <span className="font-bold text-[11px] uppercase tracking-[.05em] flex-none w-[100px]" style={{ color: "var(--bmut)" }}>
              Cierre
            </span>
            <span className="font-bold text-[11px] uppercase tracking-[.05em] flex-none w-[100px] text-right" style={{ color: "var(--bmut)" }}>
              Acciones
            </span>
          </div>

          {campanas.length === 0 ? (
            <div className="px-[18px] py-12 text-center">
              <p className="text-[14px] font-semibold mb-1" style={{ color: "var(--bink)" }}>
                Sin campañas todavía
              </p>
              <p className="text-[13px] mb-4" style={{ color: "var(--bmut)" }}>
                Crea tu primera campaña de petición.
              </p>
              <Link
                href="/admin/campanas/nueva"
                className="inline-flex items-center gap-1 text-[13px] font-semibold px-4 py-2 rounded-[8px] text-white"
                style={{ backgroundColor: "var(--bp)" }}
              >
                + Nueva campaña
              </Link>
            </div>
          ) : (
            campanas.map((c: AdminCampaignListItem, i: number) => (
              <div
                key={c.id}
                className="flex items-center px-[18px] py-3.5"
                style={{
                  borderBottom: i < campanas.length - 1 ? "1px solid color-mix(in srgb, var(--bbord) 60%, transparent)" : undefined,
                }}
              >
                {/* Título + slug */}
                <div className="flex-1 min-w-0 pr-4">
                  <p className="font-semibold text-[13.5px] truncate" style={{ color: "var(--bink)" }}>
                    {c.title}
                  </p>
                  <p className="text-[11.5px] mt-0.5 truncate font-mono" style={{ color: "var(--bmut)" }}>
                    /{c.slug}
                  </p>
                </div>

                {/* Progreso */}
                <div className="flex-none w-[160px]">
                  <ProgressBar confirmed={c.confirmed_signatures} goal={c.goal_count} />
                </div>

                {/* Estado */}
                <div className="flex-none w-[90px]">
                  <StatusBadge status={c.status} />
                </div>

                {/* Cierre */}
                <div className="flex-none w-[100px]">
                  <span className="text-[12.5px]" style={{ color: "var(--bmut)" }}>
                    {fmtDate(c.ends_at)}
                  </span>
                </div>

                {/* Acciones */}
                <div className="flex-none w-[100px] flex items-center justify-end gap-2">
                  <Link
                    href={`/admin/campanas/${c.id}/firmas`}
                    className="text-[12px] font-semibold px-2.5 py-1 rounded-[6px]"
                    style={{
                      color: "var(--bp)",
                      border: "1px solid color-mix(in srgb, var(--bp) 30%, transparent)",
                    }}
                  >
                    Firmas
                  </Link>
                  <Link
                    href={`/admin/campanas/${c.id}`}
                    className="text-[12px] font-semibold px-2.5 py-1 rounded-[6px]"
                    style={{
                      color: "var(--bink)",
                      border: "1px solid var(--bbord)",
                    }}
                  >
                    Editar
                  </Link>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
