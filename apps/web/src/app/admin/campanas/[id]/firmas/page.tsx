import Link from "next/link";
import { getAdminSignatures, type AdminSignatureItem } from "@/lib/admin-signatures-api";
import FiltrosBar from "./FiltrosBar";
import ExportCsvButton from "./ExportCsvButton";
import ExportAbsolutoButton from "./ExportAbsolutoButton";
import RemindPendingButton from "./RemindPendingButton";
import VisibilityCell from "./VisibilityCell";
import ArchiveModal from "./ArchiveModal";

function displayName(sig: AdminSignatureItem): string {
  if (sig.signer_type === "org" && sig.org_name) {
    return sig.name ? `(${sig.org_name}) ${sig.name}` : `(${sig.org_name})`;
  }
  return sig.name ?? "—";
}

function OrigenCell({ provincia, country }: { provincia: string | null; country: string | null }) {
  if (country) {
    return (
      <span
        className="inline-flex items-center font-semibold text-[11px]"
        style={{ background: "color-mix(in srgb, #2B4EEA 10%, transparent)", color: "#2B4EEA", padding: "3px 8px", borderRadius: "99px" }}
        aria-label={`Origen internacional: ${country}`}
      >
        {country}
      </span>
    );
  }
  if (provincia) {
    return <span style={{ color: "var(--bmut)" }}>{provincia}</span>;
  }
  return <span style={{ color: "var(--bmut)" }}>—</span>;
}

// ─── Badges ─────────────────────────────────────────────────────────────────

const VISIBILITY_BADGE: Record<string, { label: string; bg: string; color: string }> = {
  publica:  { label: "Pública",  bg: "#DCE9E6", color: "#16261F" },
  anonima:  { label: "Anónima",  bg: "var(--bbg)",                                  color: "var(--bmut)" },
  secreta:  { label: "Secreta",  bg: "color-mix(in srgb,#c2410c 10%,transparent)", color: "#c2410c" },
};

const STATUS_BADGE: Record<string, { label: string; bg: string; color: string }> = {
  confirmed:            { label: "Confirmada", bg: "#DCE9E6", color: "#16261F" },
  pending_confirmation: { label: "Pendiente",  bg: "color-mix(in srgb,#b45309 12%,transparent)", color: "#b45309" },
  anulada:              { label: "Anulada",    bg: "color-mix(in srgb,#c2410c 10%,transparent)", color: "#c2410c" },
};

function StatusBadge({ s: sv }: { s: string }) {
  const s = STATUS_BADGE[sv] ?? STATUS_BADGE.pending_confirmation;
  return (
    <span
      className="inline-flex items-center font-semibold text-[11px]"
      style={{ background: s.bg, color: s.color, padding: "3px 8px", borderRadius: "99px" }}
      aria-label={`Estado: ${s.label}`}
    >
      {s.label}
    </span>
  );
}

// ─── Paginación ──────────────────────────────────────────────────────────────

function buildUrl(
  page: number,
  params: { provincia: string; visibility: string; status: string },
): string {
  const qs = new URLSearchParams();
  if (page > 1) qs.set("page", String(page));
  if (params.provincia) qs.set("provincia", params.provincia);
  if (params.visibility) qs.set("visibility", params.visibility);
  if (params.status) qs.set("status", params.status);
  const s = qs.toString();
  return s ? `?${s}` : "?page=1";
}

// ─── Fecha legible ───────────────────────────────────────────────────────────

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("es-EC", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Guayaquil",
  });
}

// ─── Página ──────────────────────────────────────────────────────────────────

interface PageProps {
  params: { id: string };
  searchParams: {
    page?: string;
    provincia?: string;
    visibility?: string;
    status?: string;
  };
}

export default async function FirmasCampanaPage({ params, searchParams }: PageProps) {
  const campaignId = params.id;
  const page = Math.max(1, parseInt(searchParams.page ?? "1", 10) || 1);
  const provincia = searchParams.provincia ?? "";
  const visibility = searchParams.visibility ?? "";
  const status = searchParams.status ?? "";

  const data = await getAdminSignatures(campaignId, {
    page,
    provincia: provincia || undefined,
    visibility: visibility || undefined,
    status: status || undefined,
  });

  const filterParams = { provincia, visibility, status };
  const hasFilters = !!(provincia || visibility || status);

  // ─── Layout ────────────────────────────────────────────────────────────────

  return (
    <div>
      {/* Header */}
      <header
        className="sticky top-0 z-10 px-6 py-4"
        style={{ backgroundColor: "var(--bsurf)", borderBottom: "1px solid var(--bbord)" }}
      >
        {/* Breadcrumb */}
        <nav className="flex items-center gap-1.5 text-[12px] mb-2" style={{ color: "var(--bmut)" }}>
          <Link href="/admin/campanas" className="hover:underline" style={{ color: "var(--bink)", fontWeight: 600 }}>
            Campañas
          </Link>
          <span>/</span>
          <span>{data?.campaign_title ?? "Campaña"}</span>
          <span>/</span>
          <span className="font-semibold" style={{ color: "var(--bink)" }}>Firmas</span>
        </nav>

        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="font-display font-bold text-[18px]" style={{ color: "var(--bink)" }}>
              {data?.campaign_title ?? "Firmas"}
            </h1>
            <p className="text-[12.5px] mt-0.5 font-semibold" style={{ color: "var(--bmut)" }}>
              <span style={{ color: "var(--bink)", fontWeight: 700 }}>{data?.confirmed_count ?? 0}</span>
              {" "}firmas confirmadas
            </p>
          </div>

          {data && (
            <div className="flex items-center gap-2">
              <ExportCsvButton
                campaignId={campaignId}
                total={data.total}
                provincia={provincia}
                visibility={visibility}
                status={status}
              />
              <ExportAbsolutoButton campaignId={campaignId} total={data.confirmed_count} />
            </div>
          )}
        </div>
      </header>

      <div className="p-6 animate-pc-rise">
        {!data ? (
          /* Error / no encontrada */
          <div
            className="rounded-[14px] p-10 text-center"
            style={{ backgroundColor: "var(--bsurf)", border: "1px solid var(--bbord)" }}
          >
            <p className="font-semibold text-[15px]" style={{ color: "var(--bink)" }}>
              No se pudo cargar la información de esta campaña.
            </p>
            <Link
              href="/admin/campanas"
              className="mt-4 inline-flex text-[13px] font-semibold"
              style={{ color: "var(--bink)", fontWeight: 600 }}
            >
              ← Volver a campañas
            </Link>
          </div>
        ) : (
          <>
            {/* Chips de estadísticas */}
            <div
              className="flex items-center justify-between gap-2 mb-5 px-4 py-3 rounded-[12px] text-[13px] font-medium"
              style={{ backgroundColor: "var(--bsurf)", border: "1px solid var(--bbord)" }}
            >
              <div className="flex items-center gap-2">
                <span style={{ color: "var(--bink)" }}>
                  <strong style={{ fontWeight: 700 }}>{data.confirmed_count}</strong>
                  <span style={{ color: "var(--bmut)" }}> confirmadas</span>
                </span>
                <span style={{ color: "var(--bbord)" }}>·</span>
                <span style={{ color: "var(--bink)" }}>
                  <strong style={{ fontWeight: 700 }}>{data.pending_count}</strong>
                  <span style={{ color: "var(--bmut)" }}> pendientes</span>
                </span>
                <span style={{ color: "var(--bbord)" }}>·</span>
                <span style={{ color: "var(--bink)" }}>
                  <strong style={{ fontWeight: 700 }}>{data.anulada_count}</strong>
                  <span style={{ color: "var(--bmut)" }}> anuladas</span>
                </span>
              </div>
              {data.pending_count > 0 && <RemindPendingButton campaignId={campaignId} />}
            </div>

            {/* Filtros */}
            <div
              className="flex items-center gap-3 mb-4 px-4 py-3 rounded-[12px]"
              style={{ backgroundColor: "var(--bsurf)", border: "1px solid var(--bbord)" }}
            >
              <FiltrosBar
                currentProvincia={provincia}
                currentVisibility={visibility}
                currentStatus={status}
              />
            </div>

            {/* Tabla */}
            <div
              className="rounded-[14px] overflow-hidden"
              style={{ backgroundColor: "var(--bsurf)", border: "1px solid var(--bbord)" }}
            >
              <table className="w-full" role="table">
                <thead>
                  <tr style={{ borderBottom: "1px solid var(--bbord)", backgroundColor: "var(--bbg)" }}>
                    {(["Nombre", "Origen", "Visibilidad", "Estado", "Confirmada el", "Registrada el", "Acciones"] as const).map(
                      (col) => (
                        <th
                          key={col}
                          scope="col"
                          className="text-left font-bold text-[11px] uppercase tracking-[.05em] px-4 py-3"
                          style={{ color: "var(--bmut)" }}
                        >
                          {col}
                        </th>
                      ),
                    )}
                  </tr>
                </thead>
                <tbody>
                  {data.items.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-12 text-center">
                        <p className="font-semibold text-[14px] mb-1" style={{ color: "var(--bink)" }}>
                          {hasFilters
                            ? "No hay firmas que coincidan"
                            : "Esta campaña aún no tiene firmas registradas"}
                        </p>
                        {hasFilters && (
                          <Link
                            href="?"
                            className="text-[13px] font-medium"
                            style={{ color: "var(--bink)", fontWeight: 600 }}
                          >
                            Limpiar filtros
                          </Link>
                        )}
                      </td>
                    </tr>
                  ) : (
                    data.items.map((sig: AdminSignatureItem) => (
                      <tr
                        key={sig.id}
                        className={sig.status === "anulada" ? "opacity-[0.45]" : ""}
                        style={{ borderBottom: "1px solid color-mix(in srgb, var(--bbord) 60%, transparent)" }}
                      >
                        <td className="px-4 py-3 text-[13px] font-medium" style={{ color: "var(--bink)" }}>
                          {displayName(sig)}
                        </td>
                        <td className="px-4 py-3 text-[13px]" style={{ color: "var(--bmut)" }}>
                          <OrigenCell provincia={sig.provincia} country={sig.country} />
                        </td>
                        <td className="px-4 py-3">
                          <VisibilityCell campaignId={params.id} signature={sig} />
                        </td>
                        <td className="px-4 py-3">
                          <StatusBadge s={sig.status} />
                        </td>
                        <td className="px-4 py-3 text-[12.5px]" style={{ color: "var(--bmut)" }}>
                          {fmtDate(sig.confirmed_at)}
                        </td>
                        <td className="px-4 py-3 text-[12.5px]" style={{ color: "var(--bmut)" }}>
                          {fmtDate(sig.created_at)}
                        </td>
                        <td className="px-4 py-3">
                          <ArchiveModal campaignId={params.id} signature={sig} />
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Paginación */}
            {data.pages > 1 && (
              <div className="flex items-center justify-between mt-4 px-1">
                <p className="text-[12.5px]" style={{ color: "var(--bmut)" }}>
                  Mostrando{" "}
                  <strong style={{ color: "var(--bink)" }}>
                    {(data.page - 1) * data.per_page + 1}–
                    {Math.min(data.page * data.per_page, data.total)}
                  </strong>{" "}
                  de{" "}
                  <strong style={{ color: "var(--bink)" }}>{data.total}</strong> firmas
                </p>

                <div className="flex items-center gap-2">
                  {data.page <= 1 ? (
                    <span
                      aria-label="Página anterior"
                      aria-disabled="true"
                      className="px-3 py-1.5 rounded-[8px] text-[13px] font-medium select-none"
                      style={{
                        border: "1px solid var(--bbord)",
                        color: "var(--bmut)",
                        opacity: 0.4,
                        cursor: "not-allowed",
                      }}
                    >
                      ← Anterior
                    </span>
                  ) : (
                    <Link
                      href={buildUrl(data.page - 1, filterParams)}
                      aria-label="Página anterior"
                      className="px-3 py-1.5 rounded-[8px] text-[13px] font-medium"
                      style={{
                        border: "1px solid var(--bbord)",
                        color: "var(--bink)",
                        backgroundColor: "var(--bsurf)",
                      }}
                    >
                      ← Anterior
                    </Link>
                  )}

                  <span className="text-[12.5px] font-semibold px-1" style={{ color: "var(--bmut)" }}>
                    {data.page} / {data.pages}
                  </span>

                  {data.page >= data.pages ? (
                    <span
                      aria-label="Página siguiente"
                      aria-disabled="true"
                      className="px-3 py-1.5 rounded-[8px] text-[13px] font-medium select-none"
                      style={{
                        border: "1px solid var(--bbord)",
                        color: "var(--bmut)",
                        opacity: 0.4,
                        cursor: "not-allowed",
                      }}
                    >
                      Siguiente →
                    </span>
                  ) : (
                    <Link
                      href={buildUrl(data.page + 1, filterParams)}
                      aria-label="Página siguiente"
                      className="px-3 py-1.5 rounded-[8px] text-[13px] font-medium"
                      style={{
                        border: "1px solid var(--bbord)",
                        color: "var(--bink)",
                        backgroundColor: "var(--bsurf)",
                      }}
                    >
                      Siguiente →
                    </Link>
                  )}
                </div>
              </div>
            )}

            {/* Rango cuando hay una sola página */}
            {data.pages === 1 && data.total > 0 && (
              <p className="text-[12.5px] mt-3 px-1" style={{ color: "var(--bmut)" }}>
                Mostrando{" "}
                <strong style={{ color: "var(--bink)" }}>
                  1–{data.total}
                </strong>{" "}
                de{" "}
                <strong style={{ color: "var(--bink)" }}>{data.total}</strong> firmas
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
