"use client";

interface ExportCsvButtonProps {
  campaignId: string;
  total: number;
  provincia: string;
  visibility: string;
  status: string;
}

export default function ExportCsvButton({
  campaignId,
  total,
  provincia,
  visibility,
  status,
}: ExportCsvButtonProps) {
  const disabled = total === 0;

  const handleExport = () => {
    const base = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8011";
    const qs = new URLSearchParams();
    if (provincia) qs.set("provincia", provincia);
    if (visibility) qs.set("visibility", visibility);
    if (status) qs.set("status", status);
    const query = qs.toString();
    window.open(
      `${base}/v1/admin/campaigns/${campaignId}/signatures/export.csv${query ? `?${query}` : ""}`,
      "_blank",
    );
  };

  return (
    <button
      onClick={handleExport}
      disabled={disabled}
      aria-disabled={disabled}
      className="flex items-center gap-1.5 font-semibold text-[13px] rounded-[9px] px-4"
      style={{
        minHeight: "34px",
        backgroundColor: disabled
          ? "var(--bbord)"
          : "color-mix(in srgb, var(--bp) 12%, transparent)",
        color: disabled ? "var(--bmut)" : "var(--bp)",
        border: `1px solid ${disabled ? "var(--bbord)" : "color-mix(in srgb, var(--bp) 25%, transparent)"}`,
        cursor: disabled ? "not-allowed" : "pointer",
      }}
    >
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M7 1v8M4 6l3 3 3-3" />
        <path d="M1 10v1a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2v-1" />
      </svg>
      Exportar CSV
    </button>
  );
}
