import Link from "next/link";

export default function FirmasPage() {
  return (
    <div>
      {/* Sticky header */}
      <header
        className="sticky top-0 z-10 px-6 py-4 flex items-center justify-between"
        style={{ backgroundColor: "var(--bsurf)", borderBottom: "1px solid var(--bbord)" }}
      >
        <div>
          <h1 className="font-display font-bold text-[18px]" style={{ color: "var(--bink)" }}>
            Firmas
          </h1>
          <p className="text-[12.5px] mt-0.5" style={{ color: "var(--bmut)" }}>
            Firmas registradas por campaña
          </p>
        </div>
      </header>

      {/* Contenido */}
      <div className="p-6 animate-pc-rise flex items-start justify-center pt-16">
        <div
          className="rounded-[20px] p-10 text-center max-w-md w-full"
          style={{ backgroundColor: "var(--bsurf)", border: "1px solid var(--bbord)" }}
        >
          {/* Icono */}
          <div
            className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-5"
            style={{ backgroundColor: "color-mix(in srgb, var(--bp) 12%, transparent)" }}
          >
            <svg
              width="28"
              height="28"
              viewBox="0 0 28 28"
              fill="none"
              stroke="var(--bp)"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M18.5 4l5.5 5.5L10 23.5H4.5V18L18.5 4Z" />
              <path d="M15 7l6 6" />
              <path d="M2 26h8" />
            </svg>
          </div>

          <h2 className="font-display font-bold text-[18px] mb-2" style={{ color: "var(--bink)" }}>
            Selecciona una campaña
          </h2>
          <p className="text-[13.5px] leading-relaxed mb-6" style={{ color: "var(--bmut)" }}>
            Las firmas se gestionan desde cada campaña. Navega a una campaña y usa el botón
            <strong className="font-semibold" style={{ color: "var(--bink)" }}> Firmas</strong> para
            ver las firmas registradas, exportarlas o anularlas.
          </p>
          <Link
            href="/admin/campanas"
            className="inline-flex items-center gap-2 font-semibold text-[14px] text-white rounded-[10px] px-5"
            style={{ backgroundColor: "var(--bp)", minHeight: "42px" }}
          >
            Ir a Campañas →
          </Link>
        </div>
      </div>
    </div>
  );
}
