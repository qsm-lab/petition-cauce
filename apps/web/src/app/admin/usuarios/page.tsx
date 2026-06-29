import { redirect } from "next/navigation";
import { apiServer } from "@/lib/api-server";
import type { User } from "@/lib/types";

type UserRole   = "admin" | "gestor";
type UserStatus = "activo" | "pendiente";

const ROLE_BADGE: Record<UserRole, { bg: string; color: string; label: string }> = {
  admin:  { bg: "#e8f0fe",                                      color: "#1a56db", label: "Administrador" },
  gestor: { bg: "color-mix(in srgb,#18794A 12%,transparent)", color: "#18794A", label: "Gestor"        },
};

const STATUS_BADGE: Record<UserStatus, { bg: string; color: string; label: string }> = {
  activo:    { bg: "color-mix(in srgb,#18794A 12%,transparent)", color: "#18794A", label: "Activo"    },
  pendiente: { bg: "#fff7ed",                                      color: "#c2410c", label: "Pendiente" },
};

function RoleBadge({ role }: { role: UserRole }) {
  const r = ROLE_BADGE[role] ?? ROLE_BADGE.gestor;
  return (
    <span
      className="inline-flex items-center font-bold text-[11px]"
      style={{ background: r.bg, color: r.color, padding: "4px 9px", borderRadius: "99px" }}
    >
      {r.label}
    </span>
  );
}

function StatusBadge({ status }: { status: UserStatus }) {
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

export default async function UsuariosPage() {
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
            Usuarios
          </h1>
          <p className="text-[12.5px] mt-0.5" style={{ color: "var(--bmut)" }}>
            Administradores y gestores de la plataforma
          </p>
        </div>
        <button
          className="flex items-center gap-1.5 font-semibold text-[13px] text-white"
          style={{ backgroundColor: "var(--bp)", padding: "0 16px", minHeight: "38px", borderRadius: "10px" }}
          disabled
          title="Disponible cuando modelo-base esté implementado"
        >
          + Invitar usuario
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
            placeholder="Buscar usuario…"
            className="flex-1 bg-transparent text-[13px] outline-none placeholder:text-[var(--bmut)]"
            style={{ color: "var(--bink)" }}
            disabled
          />
          <select
            className="text-[13px] bg-transparent outline-none"
            style={{ minWidth: "110px", color: "var(--bmut)" }}
            disabled
          >
            <option>Todos los roles</option>
            <option>Administrador</option>
            <option>Gestor</option>
          </select>
          <select
            className="text-[13px] bg-transparent outline-none"
            style={{ minWidth: "110px", color: "var(--bmut)" }}
            disabled
          >
            <option>Todos los estados</option>
            <option>Activo</option>
            <option>Pendiente</option>
            <option>Archivado</option>
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
            <span className="font-bold text-[11px] uppercase tracking-[.05em] flex-none" style={{ width: "210px", color: "var(--bmut)" }}>Usuario</span>
            <span className="font-bold text-[11px] uppercase tracking-[.05em] flex-none" style={{ width: "90px", color: "var(--bmut)" }}>Rol</span>
            <span className="font-bold text-[11px] uppercase tracking-[.05em] flex-none" style={{ width: "170px", color: "var(--bmut)" }}>Organización</span>
            <span className="font-bold text-[11px] uppercase tracking-[.05em] flex-none" style={{ width: "120px", color: "var(--bmut)" }}>Último acceso</span>
            <span className="font-bold text-[11px] uppercase tracking-[.05em] flex-none" style={{ width: "90px", color: "var(--bmut)" }}>Estado</span>
            <span className="font-bold text-[11px] uppercase tracking-[.05em] flex-1 text-right" style={{ color: "var(--bmut)" }}>Acciones</span>
          </div>

          {/* Usuario actual (el admin logueado) */}
          <div
            className="flex items-center px-[18px] py-3"
            style={{ borderBottom: "1px solid color-mix(in srgb, var(--bbord) 50%, transparent)" }}
          >
            <div className="flex-none" style={{ width: "210px" }}>
              <p className="text-[13px] font-semibold" style={{ color: "var(--bink)" }}>
                {user.full_name ?? user.email.split("@")[0]}
              </p>
              <p className="text-[11px]" style={{ color: "var(--bmut)" }}>{user.email}</p>
            </div>
            <div className="flex-none" style={{ width: "90px" }}>
              <RoleBadge role={user.role === "admin" ? "admin" : "gestor"} />
            </div>
            <div className="flex-none" style={{ width: "170px" }}>
              <p className="text-[12px]" style={{ color: "var(--bmut)" }}>—</p>
            </div>
            <div className="flex-none" style={{ width: "120px" }}>
              <p className="text-[12px]" style={{ color: "var(--bmut)" }}>Ahora</p>
            </div>
            <div className="flex-none" style={{ width: "90px" }}>
              <StatusBadge status="activo" />
            </div>
            <div className="flex-1 flex justify-end gap-1.5">
              <button
                className="font-semibold text-[12px]"
                style={{
                  minHeight: "30px", padding: "0 11px", borderRadius: "8px",
                  border: "1.5px solid var(--bbord)", color: "var(--bink)",
                }}
                disabled
              >
                Editar
              </button>
            </div>
          </div>

          <div className="px-[18px] py-5 text-center">
            <p className="text-[12px]" style={{ color: "var(--bmut)" }}>
              La invitación de usuarios estará disponible cuando modelo-base esté implementado.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
