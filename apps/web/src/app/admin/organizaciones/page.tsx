import { redirect } from "next/navigation";
import { apiServer } from "@/lib/api-server";
import type { User } from "@/lib/types";

type OrgStatus = "verificada" | "pendiente" | "archivada";

const STATUS_BADGE: Record<OrgStatus, { bg: string; color: string; label: string }> = {
  verificada: { bg: "color-mix(in srgb,#18794A 12%,transparent)", color: "#18794A", label: "Verificada" },
  pendiente:  { bg: "#fff7ed",                                      color: "#c2410c", label: "Pendiente"  },
  archivada:  { bg: "#f3f4f6",                                      color: "#6b7280", label: "Archivada"  },
};

function StatusBadge({ status }: { status: OrgStatus }) {
  const s = STATUS_BADGE[status] ?? STATUS_BADGE.pendiente;
  return (
    <span
      className="inline-flex items-center font-bold text-[11px]"
      style={{ background: s.bg, color: s.color, padding: "4px 9px", borderRadius: "99px" }}
    >
      {s.label}
    </span>
  );
}

export default async function OrganizacionesPage() {
  const user = await apiServer<User>("/v1/auth/me");
  if (!user || user.role !== "admin") redirect("/admin/campanas");

  return (
    <div>
      {/* Sticky header */}
      <header
        className="sticky top-0 z-10 px-6 py-4 flex items-center justify-between"
        style={{ backgroundColor: "var(--bsurf)", borderBottom: "1px solid var(--bbord)" }}
      >
        <div>
          <h1 className="font-display font-bold text-[18px]" style={{ color: "var(--bink)" }}>
            Organizaciones
          </h1>
          <p className="text-[12.5px] mt-0.5" style={{ color: "var(--bmut)" }}>
            Organizaciones responsables de las campañas
          </p>
        </div>
        <button
          className="flex items-center gap-1.5 font-semibold text-[13px] text-white"
          style={{ backgroundColor: "var(--bp)", padding: "0 16px", minHeight: "38px", borderRadius: "10px" }}
          disabled
          title="Disponible cuando modelo-base esté implementado"
        >
          + Nueva organización
        </button>
      </header>

      {/* Contenido */}
      <div className="p-6 animate-pc-rise">
        {/* Filter bar */}
        <div
          className="flex items-center gap-2.5 mb-5 px-4 py-3"
          style={{ backgroundColor: "var(--bsurf)", borderRadius: "12px", border: "1px solid var(--bbord)" }}
        >
          <input
            type="text"
            placeholder="Buscar organización…"
            className="flex-1 bg-transparent text-[13px] outline-none placeholder:text-[var(--bmut)]"
            style={{ color: "var(--bink)" }}
            disabled
          />
          <select
            className="text-[13px] bg-transparent outline-none"
            style={{ minWidth: "130px", color: "var(--bmut)" }}
            disabled
          >
            <option>Todos los estados</option>
            <option>Verificada</option>
            <option>Pendiente</option>
            <option>Archivada</option>
          </select>
        </div>

        {/* Tabla */}
        <div
          className="rounded-[14px] overflow-hidden"
          style={{ backgroundColor: "var(--bsurf)", border: "1px solid var(--bbord)" }}
        >
          <div
            className="flex items-center px-[18px] py-3"
            style={{ borderBottom: "1px solid var(--bbord)", backgroundColor: "var(--bbg)" }}
          >
            <span className="font-bold text-[11px] uppercase tracking-[.05em] flex-none" style={{ width: "230px", color: "var(--bmut)" }}>Organización</span>
            <span className="font-bold text-[11px] uppercase tracking-[.05em] flex-none" style={{ width: "140px", color: "var(--bmut)" }}>Responsable</span>
            <span className="font-bold text-[11px] uppercase tracking-[.05em] flex-none" style={{ width: "80px", color: "var(--bmut)" }}>Activas</span>
            <span className="font-bold text-[11px] uppercase tracking-[.05em] flex-none" style={{ width: "105px", color: "var(--bmut)" }}>Estado</span>
            <span className="font-bold text-[11px] uppercase tracking-[.05em] flex-none" style={{ width: "100px", color: "var(--bmut)" }}>Registro</span>
            <span className="font-bold text-[11px] uppercase tracking-[.05em] flex-1 text-right" style={{ color: "var(--bmut)" }}>Acciones</span>
          </div>

          {/* Empty state */}
          <div className="px-[18px] py-12 text-center">
            <p className="text-[14px] font-semibold mb-1" style={{ color: "var(--bink)" }}>
              Sin organizaciones registradas
            </p>
            <p className="text-[13px]" style={{ color: "var(--bmut)" }}>
              Las organizaciones aparecerán aquí cuando el módulo esté activo.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
