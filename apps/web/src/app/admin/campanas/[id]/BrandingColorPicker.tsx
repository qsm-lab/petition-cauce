"use client";

const PRESETS = [
  { name: "Bosque", color: "#D7F24C" },
  { name: "Océano", color: "#0C6FB0" },
  { name: "Fuego",  color: "#E63946" },
];

function isValidHex(v: string): boolean {
  return /^#[0-9a-fA-F]{6}$/.test(v);
}

function autoOnPrimary(hex: string): string {
  if (!isValidHex(hex)) return "#16261F";
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  return 0.299 * r + 0.587 * g + 0.114 * b > 0.5 ? "#16261F" : "#FFFFFF";
}

interface Props {
  value: string;
  onChange: (color: string) => void;
}

export { autoOnPrimary, isValidHex };

export default function BrandingColorPicker({ value, onChange }: Props) {
  const activePreset = PRESETS.find((p) => p.color.toLowerCase() === value.toLowerCase());

  return (
    <div className="flex flex-col gap-3">
      {/* Presets */}
      <div className="flex gap-2">
        {PRESETS.map((p) => {
          const isActive = activePreset?.name === p.name;
          return (
            <button
              key={p.name}
              type="button"
              onClick={() => onChange(p.color)}
              style={{
                padding: "5px 12px", borderRadius: 8, fontSize: 12, fontWeight: 600,
                cursor: "pointer",
                background: isActive ? "#16261F" : "var(--bbg)",
                color: isActive ? "#fff" : "var(--bink)",
                border: isActive ? "none" : "1.5px solid var(--bbord)",
              }}
            >
              {p.name}
            </button>
          );
        })}
      </div>

      {/* Picker + hex manual */}
      <div className="flex items-center gap-3">
        <label style={{ cursor: "pointer", flexShrink: 0 }}>
          <div
            style={{
              width: 36, height: 36, borderRadius: 8,
              background: isValidHex(value) ? value : "#D7F24C",
              border: "2px solid var(--bbord)", overflow: "hidden",
            }}
          >
            <input
              type="color"
              value={isValidHex(value) ? value : "#D7F24C"}
              onChange={(e) => onChange(e.target.value)}
              style={{ opacity: 0, width: "100%", height: "100%", cursor: "pointer" }}
            />
          </div>
        </label>
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="#D7F24C"
          maxLength={7}
          className="font-mono text-[13px] outline-none bg-transparent flex-1"
          style={{
            color: "var(--bink)",
            borderBottom: "1.5px solid var(--bbord)",
            paddingBottom: 2,
          }}
        />
        {/* Mini preview */}
        <div
          style={{
            padding: "4px 10px", borderRadius: 8, fontSize: 11, fontWeight: 700,
            background: isValidHex(value) ? value : "#D7F24C",
            color: autoOnPrimary(isValidHex(value) ? value : "#D7F24C"),
            flexShrink: 0,
          }}
        >
          Firmar
        </div>
      </div>
    </div>
  );
}
