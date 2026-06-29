import Link from "next/link";

// Datos stub — los KPIs reales se conectarán cuando modelo-base + endpoints /v1/admin/dashboard existan
const KPI_DATA = [
  { label: "Total firmas", value: "0",   trend: "Sin datos aún",  trendColor: "var(--bmut)", alert: false },
  { label: "Campañas activas", value: "0", trend: "Sin campañas", trendColor: "var(--bmut)", alert: false },
  { label: "Pendientes revisión", value: "0", trend: "Sin pendientes", trendColor: "#c2410c", alert: false },
  { label: "Tasa de conversión", value: "—",  trend: "Sin datos aún",  trendColor: "var(--bmut)", alert: false },
];

const ACTIVITY_STUB = [
  { text: "Sistema iniciado correctamente", time: "Ahora", recent: true },
  { text: "Base de datos conectada", time: "Ahora", recent: true },
  { text: "Panel de administración listo", time: "Ahora", recent: false },
];

export default function ResumenPage() {
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
          {KPI_DATA.map((kpi) => (
            <div
              key={kpi.label}
              className="rounded-[14px] p-5"
              style={{
                backgroundColor: "var(--bsurf)",
                border: `1px solid ${kpi.alert ? "color-mix(in srgb, #c2410c 30%, var(--bbord))" : "var(--bbord)"}`,
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
        <div className="grid gap-5" style={{ gridTemplateColumns: "1fr 300px" }}>
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
                style={{ color: "var(--bp)" }}
              >
                Ver todas →
              </Link>
            </div>
            <div className="px-[18px] py-10 text-center">
              <p className="text-[13px]" style={{ color: "var(--bmut)" }}>
                Las campañas aparecerán aquí cuando el módulo de peticiones esté activo.
              </p>
              <Link
                href="/admin/campanas"
                className="mt-3 inline-flex items-center gap-1 text-[12.5px] font-semibold"
                style={{ color: "var(--bp)" }}
              >
                Ir a Campañas →
              </Link>
            </div>
          </div>

          {/* Actividad reciente */}
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
                Actividad reciente
              </h2>
            </div>
            <ul>
              {ACTIVITY_STUB.map((item, i) => (
                <li
                  key={i}
                  className="flex gap-2.5 px-4 py-2.5"
                  style={{
                    borderBottom:
                      i < ACTIVITY_STUB.length - 1
                        ? "1px solid color-mix(in srgb, var(--bbord) 50%, transparent)"
                        : undefined,
                  }}
                >
                  <span
                    className="mt-1 flex-shrink-0 rounded-full"
                    style={{
                      width: "8px",
                      height: "8px",
                      backgroundColor: item.recent ? "var(--bp)" : "var(--bbord)",
                    }}
                  />
                  <div className="flex-1 min-w-0">
                    <p
                      className="text-[12.5px] leading-snug"
                      style={{ color: "var(--bink)" }}
                    >
                      {item.text}
                    </p>
                    <p className="text-[11px] mt-0.5" style={{ color: "var(--bmut)" }}>
                      {item.time}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
