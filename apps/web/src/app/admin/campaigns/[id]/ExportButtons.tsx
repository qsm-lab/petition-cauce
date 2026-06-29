"use client";

export default function ExportButtons({ campaignId }: { campaignId: string }) {
  const base = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8011";

  const download = (format: string, anonymized = true) => {
    window.open(
      `${base}/v1/exports/${campaignId}?format=${format}&anonymized=${anonymized}`,
      "_blank",
    );
  };

  return (
    <div className="space-y-2">
      <ExportBtn label="Descargar CSV (anonimizado)" onClick={() => download("csv")} />
      <ExportBtn label="Descargar Excel (anonimizado)" onClick={() => download("xlsx")} />
      <ExportBtn label="Descargar JSON (anonimizado)" onClick={() => download("json")} />
      <ExportBtn label="Descargar CSV (datos completos)" onClick={() => download("csv", false)} />
    </div>
  );
}

function ExportBtn({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-full text-left px-3 py-2 rounded-lg text-sm text-gray-700 hover:bg-gray-50 border border-gray-200 transition-colors"
    >
      {label}
    </button>
  );
}
