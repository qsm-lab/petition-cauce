"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Question } from "@/lib/types";

interface Props {
  question: Question;
  index: number;
  isSelected: boolean;
  onSelect: () => void;
  onDelete: () => void;
}

const TYPE_LABELS: Record<string, string> = {
  text: "Texto corto",
  long_text: "Texto largo",
  single_choice: "Opción única",
  multiple_choice: "Opción múltiple",
  likert_scale: "Escala Likert",
  nps: "NPS",
  matrix: "Matriz",
  date: "Fecha",
  email: "Email",
  number: "Número",
};

export default function SortableQuestion({ question, index, isSelected, onSelect, onDelete }: Props) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: question.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      onClick={onSelect}
      className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${
        isSelected
          ? "border-brand bg-brand/5"
          : "border-gray-200 bg-white hover:border-gray-300"
      }`}
    >
      {/* handle de drag */}
      <button
        {...attributes}
        {...listeners}
        onClick={(e) => e.stopPropagation()}
        className="text-gray-300 hover:text-gray-500 cursor-grab active:cursor-grabbing"
        aria-label="Arrastrar"
      >
        ⠿
      </button>

      <span className="text-xs text-gray-400 w-5 shrink-0">{index + 1}</span>

      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900 truncate">{question.label}</p>
        <p className="text-xs text-gray-400">{TYPE_LABELS[question.type] ?? question.type}</p>
      </div>

      <button
        onClick={(e) => { e.stopPropagation(); onDelete(); }}
        className="text-gray-300 hover:text-red-400 text-xs shrink-0"
        aria-label="Eliminar"
      >
        ✕
      </button>
    </div>
  );
}
