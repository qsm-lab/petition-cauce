"use client";

const TYPES = [
  { type: "single_choice",   label: "Opción única",     icon: "◉" },
  { type: "multiple_choice", label: "Opción múltiple",  icon: "☑" },
  { type: "text",            label: "Texto corto",      icon: "Aa" },
  { type: "long_text",       label: "Texto largo",      icon: "¶"  },
  { type: "likert_scale",    label: "Escala Likert",    icon: "⊞" },
  { type: "nps",             label: "NPS",              icon: "★" },
  { type: "matrix",          label: "Matriz",           icon: "⊟" },
  { type: "email",           label: "Email",            icon: "@"  },
  { type: "number",          label: "Número",           icon: "#"  },
  { type: "date",            label: "Fecha",            icon: "▦" },
];

interface Props {
  onAdd: (type: string) => void;
}

export default function QuestionTypePicker({ onAdd }: Props) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <h2 className="font-semibold text-gray-900 mb-3 text-sm">Agregar pregunta</h2>
      <div className="space-y-1">
        {TYPES.map(({ type, label, icon }) => (
          <button
            key={type}
            onClick={() => onAdd(type)}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-gray-700 hover:bg-gray-50 transition-colors text-left"
          >
            <span className="text-gray-400 w-5 text-center">{icon}</span>
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}
