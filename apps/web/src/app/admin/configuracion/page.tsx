"use client";

import { useState } from "react";

type ToggleProps = { checked: boolean; onChange: (v: boolean) => void; label: string };

function Toggle({ checked, onChange, label }: ToggleProps) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className="flex-shrink-0 relative"
      style={{
        width: "42px",
        height: "24px",
        borderRadius: "99px",
        backgroundColor: checked ? "var(--bp)" : "var(--bbord)",
        transition: "background-color 150ms ease",
      }}
    >
      <span
        className="absolute top-[2px] bg-white rounded-full"
        style={{
          width: "20px",
          height: "20px",
          boxShadow: "0 1px 3px rgba(0,0,0,.18)",
          left: checked ? "calc(100% - 22px)" : "2px",
          transition: "left 150ms ease",
        }}
      />
    </button>
  );
}

type SectionId = "plataforma" | "notificaciones" | "seguridad";

const NAV_SECTIONS: { id: SectionId; label: string }[] = [
  { id: "plataforma",      label: "Plataforma" },
  { id: "notificaciones",  label: "Notificaciones" },
  { id: "seguridad",       label: "Seguridad" },
];

export default function ConfiguracionPage() {
  const [activeSection, setActiveSection] = useState<SectionId>("plataforma");

  const [notif, setNotif] = useState({
    nueva_firma:          true,
    meta_alcanzada:       true,
    nueva_organizacion:   true,
    campanas_por_vencer:  false,
  });

  const [seg, setSeg] = useState({
    twofa_obligatorio:    true,
    sesion_inactividad:   true,
    notif_login:          false,
  });

  function toggleNotif(key: keyof typeof notif) {
    setNotif((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  function toggleSeg(key: keyof typeof seg) {
    setSeg((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  return (
    <div>
      {/* Sticky header */}
      <header
        className="sticky top-0 z-10 px-6 py-4 flex items-center justify-between"
        style={{ backgroundColor: "var(--bsurf)", borderBottom: "1px solid var(--bbord)" }}
      >
        <div>
          <h1 className="font-display font-bold text-[18px]" style={{ color: "var(--bink)" }}>
            Configuración
          </h1>
          <p className="text-[12.5px] mt-0.5" style={{ color: "var(--bmut)" }}>
            Ajustes generales de la plataforma
          </p>
        </div>
        <button
          className="font-semibold text-[13px] text-white"
          style={{ backgroundColor: "var(--bp)", padding: "0 18px", minHeight: "38px", borderRadius: "10px" }}
          disabled
          title="La persistencia de configuración estará disponible cuando los endpoints existan"
        >
          Guardar cambios
        </button>
      </header>

      {/* Contenido */}
      <div className="p-6 animate-pc-rise" style={{ display: "grid", gridTemplateColumns: "190px 1fr", gap: "24px" }}>
        {/* Left nav */}
        <div className="sticky" style={{ top: "80px", alignSelf: "start" }}>
          <nav
            className="rounded-[14px] p-2"
            style={{ backgroundColor: "var(--bsurf)", border: "1px solid var(--bbord)" }}
          >
            {NAV_SECTIONS.map((s) => (
              <button
                key={s.id}
                onClick={() => setActiveSection(s.id)}
                className="w-full text-left rounded-[9px] text-[13px]"
                style={{
                  padding: "9px 12px",
                  backgroundColor:
                    activeSection === s.id
                      ? "color-mix(in srgb, var(--bp) 10%, transparent)"
                      : "transparent",
                  color: activeSection === s.id ? "var(--bp)" : "var(--bmut)",
                  fontWeight: activeSection === s.id ? 700 : 500,
                }}
              >
                {s.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Right column */}
        <div className="flex flex-col gap-5">
          {/* Plataforma */}
          {activeSection === "plataforma" && (
            <div
              className="rounded-[14px] p-6"
              style={{ backgroundColor: "var(--bsurf)", border: "1px solid var(--bbord)" }}
            >
              <h2 className="font-display font-bold text-[15px] mb-5" style={{ color: "var(--bink)" }}>
                Plataforma
              </h2>
              <div className="flex flex-col gap-4">
                <FormField label="Nombre de la plataforma" defaultValue="Cauce Petition" />
                <FormField label="URL base" defaultValue="https://cauce.ecuadornotlc.org" monospace />
                <FormField label="Descripción breve" defaultValue="Plataforma de campañas ambientales en Ecuador" />
                <FormField label="Correo remitente" defaultValue="noreply@cauce.ecuadornotlc.org" type="email" monospace />
              </div>
            </div>
          )}

          {/* Notificaciones */}
          {activeSection === "notificaciones" && (
            <div
              className="rounded-[14px] p-6"
              style={{ backgroundColor: "var(--bsurf)", border: "1px solid var(--bbord)" }}
            >
              <h2 className="font-display font-bold text-[15px] mb-5" style={{ color: "var(--bink)" }}>
                Notificaciones por correo
              </h2>
              <div className="flex flex-col gap-4">
                <ToggleRow
                  label="Nueva firma recibida"
                  checked={notif.nueva_firma}
                  onChange={() => toggleNotif("nueva_firma")}
                />
                <ToggleRow
                  label="Meta de firmas alcanzada"
                  checked={notif.meta_alcanzada}
                  onChange={() => toggleNotif("meta_alcanzada")}
                />
                <ToggleRow
                  label="Nueva organización registrada"
                  checked={notif.nueva_organizacion}
                  onChange={() => toggleNotif("nueva_organizacion")}
                />
                <ToggleRow
                  label="Campañas próximas a vencer"
                  checked={notif.campanas_por_vencer}
                  onChange={() => toggleNotif("campanas_por_vencer")}
                />
              </div>
            </div>
          )}

          {/* Seguridad */}
          {activeSection === "seguridad" && (
            <div
              className="rounded-[14px] p-6"
              style={{ backgroundColor: "var(--bsurf)", border: "1px solid var(--bbord)" }}
            >
              <h2 className="font-display font-bold text-[15px] mb-5" style={{ color: "var(--bink)" }}>
                Seguridad
              </h2>
              <div className="flex flex-col gap-4">
                <ToggleRow
                  label="2FA obligatorio para administradores"
                  checked={seg.twofa_obligatorio}
                  onChange={() => toggleSeg("twofa_obligatorio")}
                />
                <ToggleRow
                  label="Cierre de sesión por inactividad (8h)"
                  checked={seg.sesion_inactividad}
                  onChange={() => toggleSeg("sesion_inactividad")}
                />
                <ToggleRow
                  label="Notificación de inicio de sesión"
                  checked={seg.notif_login}
                  onChange={() => toggleSeg("notif_login")}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function FormField({
  label,
  defaultValue,
  type = "text",
  monospace = false,
}: {
  label: string;
  defaultValue: string;
  type?: string;
  monospace?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[13px] font-semibold" style={{ color: "var(--bink)" }}>
        {label}
      </label>
      <input
        type={type}
        defaultValue={defaultValue}
        className="text-[13.5px] outline-none transition-colors"
        style={{
          minHeight: "44px",
          padding: "0 14px",
          borderRadius: "10px",
          backgroundColor: "var(--bbg)",
          border: "1.5px solid var(--bbord)",
          color: "var(--bink)",
          fontFamily: monospace ? "'Inter', monospace" : undefined,
        }}
        disabled
        title="La edición estará disponible cuando los endpoints existan"
      />
    </div>
  );
}

function ToggleRow({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <div
      className="flex items-center justify-between gap-4 py-3"
      style={{ borderBottom: "1px solid color-mix(in srgb, var(--bbord) 50%, transparent)" }}
    >
      <span className="text-[13.5px]" style={{ color: "var(--bink)" }}>
        {label}
      </span>
      <Toggle checked={checked} onChange={onChange} label={label} />
    </div>
  );
}
