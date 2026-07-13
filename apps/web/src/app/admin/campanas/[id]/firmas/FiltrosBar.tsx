"use client";

import { useRef } from "react";
import { PROVINCIAS } from "@/lib/provincias";

interface FiltrosBarProps {
  currentProvincia: string;
  currentVisibility: string;
  currentStatus: string;
}

export default function FiltrosBar({
  currentProvincia,
  currentVisibility,
  currentStatus,
}: FiltrosBarProps) {
  const formRef = useRef<HTMLFormElement>(null);

  const handleChange = () => formRef.current?.requestSubmit();

  const selectClass =
    "text-[13px] bg-transparent outline-none cursor-pointer px-2 py-1.5 rounded-[7px]";
  const selectStyle = { color: "var(--bink)", minWidth: "140px" };

  return (
    <form ref={formRef} method="GET" className="flex items-center gap-3 flex-wrap">
      {/* reset page a 1 cuando cambian filtros */}
      <input type="hidden" name="page" value="1" />

      <span className="text-[12px] font-semibold uppercase tracking-[.05em]" style={{ color: "var(--bmut)" }}>
        Filtrar por
      </span>

      <select
        name="provincia"
        defaultValue={currentProvincia}
        onChange={handleChange}
        className={selectClass}
        style={selectStyle}
        aria-label="Filtrar por origen"
      >
        <option value="">Todo origen</option>
        {PROVINCIAS.map((p) => (
          <option key={p} value={p}>{p}</option>
        ))}
        <option value="internacional">Internacional (todos los países)</option>
      </select>

      <select
        name="visibility"
        defaultValue={currentVisibility}
        onChange={handleChange}
        className={selectClass}
        style={selectStyle}
        aria-label="Filtrar por visibilidad"
      >
        <option value="">Toda visibilidad</option>
        <option value="publica">Pública</option>
        <option value="anonima">Anónima</option>
        <option value="secreta">Secreta</option>
      </select>

      <select
        name="status"
        defaultValue={currentStatus}
        onChange={handleChange}
        className={selectClass}
        style={selectStyle}
        aria-label="Filtrar por estado"
      >
        <option value="">Todos los estados</option>
        <option value="confirmed">Confirmada</option>
        <option value="pending_confirmation">Pendiente</option>
        <option value="anulada">Anulada</option>
      </select>
    </form>
  );
}
