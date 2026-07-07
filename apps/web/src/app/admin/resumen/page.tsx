import Link from "next/link";
import { getDashboardSummary } from "@/lib/admin-campaigns-api";

const STATUS_BADGE: Record<string, { bg: string; color: string; label: string }> = {
  active:  { bg: "#DCE9E6", color: "#16261F", label: "Activa"   },
  draft:   { bg: "var(--bbg)",                                  color: "var(--bmut)",  label: "Borrador" },
  closed:  { bg: "#e8f0fe",                                     color: "#1a56db",      label: "Cerrada"  },
};

function StatusBadge({ status }: { status: string }) {
  const s = STATUS_BADGE[status] ?? STATUS_BADGE.draft;
  return (
    <span
      className="inline-flex items-center font-bold text-[11px]"
      style={{ background: s.bg, color: s.color, padding: "3px 8px", borderRadius: "99px" }}
    >
      {s.label}
    </span>
  );
}

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("es-EC", { day: "2-digit", month: "short", year: "numeric", timeZone: "America/Guayaquil" });
}

export default async function ResumenPage() {
  const summary = await getDashboardSummary();

  const kpis = [
    {
      label: "Firmas confirmadas",
      value: summary ? summary.total_confirmed_signatures.toLocaleString("es-EC") : "—",
      trend: summary ? (summary.total_confirmed_signatures > 0 ? "Total acumulado" : "Sin firmas aún") : "Sin datos",
      trendColor: "var(--bmut)",
    },
    {
      label: "Campañas activas",
      value: summary ? String(summary.active_campaigns) : "—",
      trend: summary ? (summary.active_campaigns > 0 ? "En recolección" : "Sin campañas activas") : "Sin datos",
      trendColor: summary?.active_campaigns ? "#16261F" : "var(--bmut)",
    },
    {
      label: "En borrador",
      value: summary ? String(summary.draft_campaigns) : "—",
      trend: summary ? (summary.draft_campaigns > 0 ? "Pendientes de activar" : "Sin borradores") : "Sin datos",
      trendColor: "var(--bmut)",
    },
    {
      label: "Meta total",
      value: summary?.total_goal ? summary.total_goal.toLocaleString("es-EC") : "—",
      trend: summary?.total_goal ? "firmas objetivo" : "Sin meta definida",
      trendColor: "var(--bmut)",
    },
  ];

  return (
    <div>
      {/* Sticky header */}
      <header
        className="sticky top-0 z-10 px-6 py-4 flex items-center justify-between"
        style={{ backgroundColor: "var(--bsurf)", borderBottom: "1px solid var(--bbord)" }}
      >
        <div>
          <h1 className="font-display font-bold text-[18px]" style={{ color: "var(--bink)" }}>
            Resumen
          </h1>
          <p className="text-[12.5px] mt-0.5" style={{ color: "var(--bmut)" }}>
            Vista general de la plataforma
          </p>
        </div>
      </header>

      {/* Contenido */}
      <div className="p-6 animate-pc-rise">
        {/* KPIs */}
        <div className="grid grid-cols-4 gap-4 mb-5">
          {kpis.map((kpi) => (
            <div
              key={kpi.label}
              className="rounded-[14px] p-5"
              style={{
                backgroundColor: "var(--bsurf)",
                border: "1px solid var(--bbord)",
              }}
            >
              <p
                className="text-[11px] uppercase font-bold tracking-[.06em] mb-2"
                style={{ color: "var(--bmut)" }}
              >
                {kpi.label}
              </p>
              <p
                className="font-display font-extrabold text-[28px] mb-1.5 leading-none"
                style={{ color: "var(--bink)" }}
              >
                {kpi.value}
              </p>
              <p className="text-[12px] font-semibold" style={{ color: kpi.trendColor }}>
                {kpi.trend}
              </p>
            </div>
          ))}
        </div>

        {/* Dos columnas */}
        <div className="grid gap-5" style={{ gridTemplateColumns: "1fr 320px" }}>
          {/* Campañas recientes */}
          <div
            className="rounded-[14px] overflow-hidden"
            style={{ backgroundColor: "var(--bsurf)", border: "1px solid var(--bbord)" }}
          >
            <div
              className="flex items-center justify-between px-[18px] py-3.5"
              style={{ borderBottom: "1px solid var(--bbord)" }}
            >
              <h2
                className="font-display font-bold text-[14px]"
                style={{ color: "var(--bink)" }}
              >
                Campañas recientes
              </h2>
              <Link
                href="/admin/campanas"
                className="text-[12.5px] font-medium"
                style={{ color: "var(--bink)", fontWeight: 600 }}
              >
                Ver todas →
              </Link>
            </div>

            {!summary || summary.recent_campaigns.length === 0 ? (
              <div className="px-[18px] py-10 text-center">
                <p className="text-[13px]" style={{ color: "var(--bmut)" }}>
                  Aún no hay campañas creadas.
                </p>
                <Link
                  href="/admin/campanas/nueva"
                  className="mt-3 inline-flex items-center gap-1 text-[12.5px] font-semibold"
                  style={{ color: "var(--bink)", fontWeight: 600 }}
                >
                  Crear primera campaña →
                </Link>
              </div>
            ) : (
              summary.recent_campaigns.map((c, i) => (
                <div
                  key={c.id}
                  className="flex items-center px-[18px] py-3.5 gap-4"
                  style={{
                    borderBottom:
                      i < summary.recent_campaigns.length - 1
                        ? "1px solid color-mix(in srgb, var(--bbord) 60%, transparent)"
                        : undefined,
                  }}
                >
                  <div className="flex-1 min-w-0">
                    <Link
                      href={`/admin/campanas/${c.id}`}
                      className="font-semibold text-[13px] truncate block hover:underline"
                      style={{ color: "var(--bink)" }}
                    >
                      {c.title}
                    </Link>
                    <p className="text-[12px] mt-0.5" style={{ color: "var(--bmut)" }}>
                      <strong style={{ color: "var(--bink)" }}>
                        {c.confirmed_signatures.toLocaleString("es-EC")}
                      </strong>
                      {c.goal_count ? ` / ${c.goal_count.toLocaleString("es-EC")}` : ""} firmas
                    </p>
                  </div>
                  <div className="flex-shrink-0 flex flex-col items-end gap-1">
                    <StatusBadge status={c.status} />
                    <span className="text-[11px]" style={{ color: "var(--bmut)" }}>
                      {fmtDate(c.ends_at)}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Accesos rápidos */}
          <div
            className="rounded-[14px] overflow-hidden"
            style={{ backgroundColor: "var(--bsurf)", border: "1px solid var(--bbord)" }}
          >
            <div
              className="px-[18px] py-3.5"
              style={{ borderBottom: "1px solid var(--bbord)" }}
            >
              <h2
                className="font-display font-bold text-[14px]"
                style={{ color: "var(--bink)" }}
              >
                Accesos rápidos
              </h2>
            </div>
            <div className="p-5 flex flex-col gap-2">
              <Link
                href="/admin/campanas/nueva"
                className="flex items-center gap-2.5 px-3 py-2.5 rounded-[8px] text-[13px] font-semibold"
                style={{ backgroundColor: "var(--bp)", color: "var(--bop)" }}
              >
                <span>+</span>
                Nueva campaña
              </Link>
              {summary?.recent_campaigns[0] && (
                <Link
                  href={`/admin/campanas/${summary.recent_campaigns[0].id}/firmas`}
                  className="flex items-center gap-2.5 px-3 py-2.5 rounded-[8px] text-[13px] font-semibold"
                  style={{
                    color: "var(--bink)",
                    border: "1px solid var(--bbord)",
                  }}
                >
                  <span style={{ color: "var(--bink)" }}>↗</span>
                  Firmas: {summary.recent_campaigns[0].title.slice(0, 22)}…
                </Link>
              )}
              <Link
                href="/admin/campanas"
                className="flex items-center gap-2.5 px-3 py-2.5 rounded-[8px] text-[13px] font-medium"
                style={{
                  color: "var(--bmut)",
                  border: "1px solid var(--bbord)",
                }}
              >
                <span>≡</span>
                Todas las campañas
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
