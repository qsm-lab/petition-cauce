"use client";

import { useState, useEffect } from "react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Question, QuestionType } from "@/lib/types";
import { api } from "@/lib/api";

interface Props {
  question: Question;
  formId: string;
  onUpdate: (id: string, patch: Partial<Question>) => Promise<void>;
  onClose: () => void;
}

const TYPES = [
  { value: "single_choice",   label: "Opción única"    },
  { value: "multiple_choice", label: "Opción múltiple" },
  { value: "text",            label: "Texto corto"     },
  { value: "long_text",       label: "Texto largo"     },
  { value: "likert_scale",    label: "Escala Likert"   },
  { value: "nps",             label: "NPS"             },
  { value: "matrix",          label: "Matriz"          },
  { value: "email",           label: "Email"           },
  { value: "number",          label: "Número"          },
  { value: "date",            label: "Fecha"           },
];

const HAS_OPTIONS = ["single_choice", "multiple_choice"];

interface OptionItem {
  id: string;
  label: string;
  value: string;
  order_index: number;
  meta: Record<string, unknown>;
}

function SortableOption({ opt, onDelete }: { opt: OptionItem; onDelete: (id: string) => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: opt.id });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`flex items-center gap-2 text-sm py-1 rounded px-1 ${isDragging ? "opacity-50 bg-gray-50" : ""}`}
    >
      <button
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing text-gray-300 hover:text-gray-500 shrink-0"
        tabIndex={-1}
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" />
        </svg>
      </button>
      <span className="flex-1 text-gray-700 truncate">{opt.label}</span>
      {opt.meta?.is_other === true && (
        <span className="text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded shrink-0">Otros</span>
      )}
      <button onClick={() => onDelete(opt.id)} className="text-gray-300 hover:text-red-400 text-xs shrink-0">✕</button>
    </div>
  );
}

function SortableMatrixItem({ id, label, onDelete }: { id: string; label: string; onDelete: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`flex items-center gap-2 text-sm py-1 rounded px-1 ${isDragging ? "opacity-50 bg-gray-50" : ""}`}
    >
      <button
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing text-gray-300 hover:text-gray-500 shrink-0"
        tabIndex={-1}
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" />
        </svg>
      </button>
      <span className="flex-1 text-gray-700 truncate">{label}</span>
      <button onClick={onDelete} className="text-gray-300 hover:text-red-400 text-xs shrink-0">✕</button>
    </div>
  );
}

export default function QuestionEditor({ question, formId, onUpdate, onClose }: Props) {
  const [label, setLabel] = useState(question.label);
  const [description, setDescription] = useState(question.description ?? "");
  const [type, setType] = useState(question.type);
  const [isRequired, setIsRequired] = useState(question.is_required);
  const [options, setOptions] = useState<OptionItem[]>(
    [...(question.options ?? [])].sort((a, b) => a.order_index - b.order_index).map((o) => ({
      ...o, meta: (o.meta as Record<string, unknown>) ?? {},
    }))
  );
  const [newOption, setNewOption] = useState("");
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  // multiple_choice
  const [hasMaxChoices, setHasMaxChoices] = useState(((question.validation?.max_choices as number) ?? 0) > 0);
  const [maxChoices, setMaxChoices] = useState((question.validation?.max_choices as number) || 3);

  // matrix
  const [matrixItems, setMatrixItems] = useState<string[]>((question.validation?.items as string[]) || []);
  const [newMatrixItem, setNewMatrixItem] = useState("");
  const [scaleLabels, setScaleLabels] = useState<Record<number, string>>(() => {
    const ex = (question.validation?.scale_labels as Record<string, string>) || {};
    return { 1: ex["1"] || "", 2: ex["2"] || "", 3: ex["3"] || "", 4: ex["4"] || "", 5: ex["5"] || "" };
  });

  // nps
  const [npsLabelMin, setNpsLabelMin] = useState((question.validation?.label_min as string) || "");
  const [npsLabelMid, setNpsLabelMid] = useState((question.validation?.label_mid as string) || "");
  const [npsLabelMax, setNpsLabelMax] = useState((question.validation?.label_max as string) || "");
  const [npsDetractorMax, setNpsDetractorMax] = useState((question.validation?.detractor_max as number) ?? 6);
  const [npsPromoterMin, setNpsPromoterMin] = useState((question.validation?.promoter_min as number) ?? 9);

  // likert
  const [likertPoints, setLikertPoints] = useState<number>(() => {
    const min = (question.validation?.min as number) || 1;
    const max = (question.validation?.max as number) || 5;
    const pts = max - min + 1;
    return [3, 5, 7, 9].includes(pts) ? pts : 5;
  });
  const [likertLabelMin, setLikertLabelMin] = useState(() => {
    const labels = (question.validation?.labels as Record<string, string>) || {};
    return labels["1"] || "";
  });
  const [likertLabelMax, setLikertLabelMax] = useState(() => {
    const labels = (question.validation?.labels as Record<string, string>) || {};
    const max = (question.validation?.max as number) || 5;
    return labels[String(max)] || "";
  });

  // long_text
  const [minChars, setMinChars] = useState((question.validation?.min_length as number) || 0);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  useEffect(() => {
    setLabel(question.label);
    setDescription(question.description ?? "");
    setType(question.type);
    setIsRequired(question.is_required);
    setOptions([...(question.options ?? [])].sort((a, b) => a.order_index - b.order_index).map((o) => ({
      ...o, meta: (o.meta as Record<string, unknown>) ?? {},
    })));
    setDirty(false);
    setHasMaxChoices(((question.validation?.max_choices as number) ?? 0) > 0);
    setMaxChoices((question.validation?.max_choices as number) || 3);
    setMatrixItems((question.validation?.items as string[]) || []);
    setNewMatrixItem("");
    const ex = (question.validation?.scale_labels as Record<string, string>) || {};
    setScaleLabels({ 1: ex["1"] || "", 2: ex["2"] || "", 3: ex["3"] || "", 4: ex["4"] || "", 5: ex["5"] || "" });
    setNpsLabelMin((question.validation?.label_min as string) || "");
    setNpsLabelMid((question.validation?.label_mid as string) || "");
    setNpsLabelMax((question.validation?.label_max as string) || "");
    setNpsDetractorMax((question.validation?.detractor_max as number) ?? 6);
    setNpsPromoterMin((question.validation?.promoter_min as number) ?? 9);
    const min = (question.validation?.min as number) || 1;
    const max = (question.validation?.max as number) || 5;
    const pts = max - min + 1;
    setLikertPoints([3, 5, 7, 9].includes(pts) ? pts : 5);
    const lbs = (question.validation?.labels as Record<string, string>) || {};
    setLikertLabelMin(lbs["1"] || "");
    setLikertLabelMax(lbs[String(max)] || "");
    setMinChars((question.validation?.min_length as number) || 0);
  }, [question.id]);

  function markDirty() { setDirty(true); }

  function buildValidation(): Record<string, unknown> | undefined {
    if (type === "multiple_choice") {
      return hasMaxChoices ? { max_choices: maxChoices } : {};
    }
    if (type === "matrix") {
      const labels: Record<string, string> = {};
      Object.entries(scaleLabels).forEach(([k, v]) => {
        if ((v as string).trim()) labels[k] = (v as string).trim();
      });
      return {
        ...question.validation,
        items: matrixItems,
        ...(Object.keys(labels).length > 0 ? { scale_labels: labels } : {}),
      };
    }
    if (type === "nps") {
      return {
        ...question.validation,
        label_min: npsLabelMin || undefined,
        label_mid: npsLabelMid || undefined,
        label_max: npsLabelMax || undefined,
        detractor_max: npsDetractorMax,
        promoter_min: npsPromoterMin,
      };
    }
    if (type === "likert_scale") {
      const labels: Record<string, string> = {};
      if (likertLabelMin.trim()) labels["1"] = likertLabelMin.trim();
      if (likertLabelMax.trim()) labels[String(likertPoints)] = likertLabelMax.trim();
      return {
        ...question.validation,
        min: 1,
        max: likertPoints,
        ...(Object.keys(labels).length > 0 ? { labels } : {}),
      };
    }
    if (type === "long_text") {
      return { ...question.validation, min_length: minChars > 0 ? minChars : undefined };
    }
    return undefined;
  }

  async function handleSave() {
    setSaving(true);
    try {
      const validation = buildValidation();
      await onUpdate(question.id, {
        label,
        description: description || undefined,
        type,
        is_required: isRequired,
        ...(validation !== undefined ? { validation } : {}),
      });
      setDirty(false);
    } finally {
      setSaving(false);
    }
  }

  function handleTypeChange(newType: string) {
    setType(newType as QuestionType);
    markDirty();
  }

  async function handleAddOption() {
    if (!newOption.trim()) return;
    const created = await api.post<OptionItem>(
      `/v1/forms/${formId}/questions/${question.id}/options`,
      {
        label: newOption.trim(),
        value: newOption.trim().toLowerCase().replace(/\s+/g, "_"),
        order_index: options.length,
        meta: {},
      }
    );
    setOptions((prev) => [...prev, { ...created, meta: created.meta ?? {} }]);
    setNewOption("");
  }

  async function handleAddOtrosOption() {
    const created = await api.post<OptionItem>(
      `/v1/forms/${formId}/questions/${question.id}/options`,
      {
        label: "Otros",
        value: "otros",
        order_index: 999,
        meta: { is_other: true },
      }
    );
    setOptions((prev) => [...prev, { ...created, meta: { is_other: true } }]);
  }

  async function handleDeleteOption(optionId: string) {
    await api.delete(`/v1/forms/${formId}/questions/${question.id}/options/${optionId}`);
    setOptions((prev) => prev.filter((o) => o.id !== optionId));
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    setOptions((prev) => {
      const oldIdx = prev.findIndex((o) => o.id === active.id);
      const newIdx = prev.findIndex((o) => o.id === over.id);
      const reordered = arrayMove(prev, oldIdx, newIdx);
      reordered.forEach((opt, idx) => {
        api.put(`/v1/forms/${formId}/questions/${question.id}/options/${opt.id}`, {
          order_index: idx,
        }).catch(() => {});
      });
      return reordered;
    });
  }

  function handleMatrixItemDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIdx = matrixItems.findIndex((_, i) => `item-${i}` === active.id);
    const newIdx = matrixItems.findIndex((_, i) => `item-${i}` === over.id);
    if (oldIdx === -1 || newIdx === -1) return;
    setMatrixItems((prev) => arrayMove(prev, oldIdx, newIdx));
    markDirty();
  }

  function addMatrixItem() {
    if (!newMatrixItem.trim()) return;
    setMatrixItems((prev) => [...prev, newMatrixItem.trim()]);
    setNewMatrixItem("");
    markDirty();
  }

  const hasOtherOption = options.some((o) => o.meta?.is_other === true);

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 sticky top-0 overflow-y-auto max-h-screen">
      <div className="flex justify-between items-center mb-4">
        <h2 className="font-semibold text-gray-900 text-sm">Editar pregunta</h2>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xs">✕</button>
      </div>

      <div className="space-y-4">
        <div>
          <label className="text-xs text-gray-500 block mb-1">Texto</label>
          <textarea
            value={label}
            onChange={(e) => { setLabel(e.target.value); markDirty(); }}
            rows={2}
            className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-brand resize-none"
          />
          <p className="text-xs text-gray-300 mt-0.5">Formatos: **negrilla** · *cursiva* · ==resaltado==</p>
        </div>

        <div>
          <label className="text-xs text-gray-500 block mb-1">Descripción</label>
          <textarea
            value={description}
            onChange={(e) => { setDescription(e.target.value); markDirty(); }}
            rows={2}
            placeholder="Instrucción o aclaración (opcional)"
            className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-brand resize-none"
          />
          <p className="text-xs text-gray-300 mt-0.5">Formatos: **negrilla** · *cursiva* · ==resaltado==</p>
        </div>

        <div>
          <label className="text-xs text-gray-500 block mb-1">Tipo de pregunta</label>
          <select
            value={type}
            onChange={(e) => handleTypeChange(e.target.value)}
            className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-brand bg-white"
          >
            {TYPES.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </div>

        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={isRequired}
            onChange={() => { setIsRequired((v) => !v); markDirty(); }}
            className="rounded border-gray-300"
          />
          <span className="text-sm text-gray-700">Obligatoria</span>
        </label>

        {/* long_text: mínimo de caracteres */}
        {type === "long_text" && (
          <div>
            <label className="text-xs text-gray-500 block mb-1">Mínimo de caracteres (0 = sin límite)</label>
            <input
              type="number"
              min={0}
              max={2000}
              value={minChars}
              onChange={(e) => { setMinChars(parseInt(e.target.value) || 0); markDirty(); }}
              className="w-24 text-sm border border-gray-200 rounded-lg px-2 py-1 focus:outline-none focus:border-brand"
            />
          </div>
        )}

        {/* multiple_choice: límite de selección */}
        {type === "multiple_choice" && (
          <div>
            <label className="text-xs text-gray-500 block mb-2">Límite de selección</label>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="has-max"
                checked={hasMaxChoices}
                onChange={(e) => { setHasMaxChoices(e.target.checked); markDirty(); }}
                className="rounded border-gray-300"
              />
              <label htmlFor="has-max" className="text-sm text-gray-700 cursor-pointer">
                Limitar máximo de opciones
              </label>
            </div>
            {hasMaxChoices && (
              <input
                type="number"
                min={1}
                max={20}
                value={maxChoices}
                onChange={(e) => { setMaxChoices(parseInt(e.target.value) || 1); markDirty(); }}
                className="mt-2 w-20 text-sm border border-gray-200 rounded-lg px-2 py-1 focus:outline-none focus:border-brand"
              />
            )}
          </div>
        )}

        {/* likert_scale: puntos y etiquetas extremos */}
        {type === "likert_scale" && (
          <div className="space-y-3">
            <label className="text-xs text-gray-500 block">Escala Likert</label>
            <div>
              <label className="text-xs text-gray-400 block mb-1">Puntos en la escala</label>
              <div className="flex gap-2">
                {[3, 5, 7, 9].map((n) => (
                  <button
                    key={n}
                    onClick={() => { setLikertPoints(n); markDirty(); }}
                    className={`w-9 h-9 rounded-lg border text-sm font-medium transition-colors ${
                      likertPoints === n
                        ? "border-brand bg-brand/10 text-brand"
                        : "border-gray-200 text-gray-500 hover:border-gray-300"
                    }`}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-xs text-gray-400 block mb-1">Etiqueta extremo bajo (1)</label>
              <input
                maxLength={30}
                value={likertLabelMin}
                onChange={(e) => { setLikertLabelMin(e.target.value); markDirty(); }}
                placeholder="Totalmente en desacuerdo"
                className="w-full text-sm border border-gray-200 rounded-lg px-2 py-1 focus:outline-none focus:border-brand"
              />
            </div>
            <div>
              <label className="text-xs text-gray-400 block mb-1">Etiqueta extremo alto ({likertPoints})</label>
              <input
                maxLength={30}
                value={likertLabelMax}
                onChange={(e) => { setLikertLabelMax(e.target.value); markDirty(); }}
                placeholder="Totalmente de acuerdo"
                className="w-full text-sm border border-gray-200 rounded-lg px-2 py-1 focus:outline-none focus:border-brand"
              />
            </div>
          </div>
        )}

        {/* nps: configuración */}
        {type === "nps" && (
          <div className="space-y-3">
            <label className="text-xs text-gray-500 block">Configuración NPS</label>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs text-gray-400 block mb-1">Detractores (0 a X)</label>
                <select
                  value={npsDetractorMax}
                  onChange={(e) => { setNpsDetractorMax(parseInt(e.target.value)); markDirty(); }}
                  className="w-full text-sm border border-gray-200 rounded-lg px-2 py-1 focus:outline-none"
                >
                  {[4, 5, 6, 7].map((n) => <option key={n} value={n}>{n}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-400 block mb-1">Promotores (X a 10)</label>
                <select
                  value={npsPromoterMin}
                  onChange={(e) => { setNpsPromoterMin(parseInt(e.target.value)); markDirty(); }}
                  className="w-full text-sm border border-gray-200 rounded-lg px-2 py-1 focus:outline-none"
                >
                  {[7, 8, 9, 10].map((n) => <option key={n} value={n}>{n}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="text-xs text-gray-400 block mb-1">Etiqueta extremo bajo</label>
              <input maxLength={20} value={npsLabelMin} onChange={(e) => { setNpsLabelMin(e.target.value); markDirty(); }} placeholder="No lo recomendaría" className="w-full text-sm border border-gray-200 rounded-lg px-2 py-1 focus:outline-none" />
            </div>
            <div>
              <label className="text-xs text-gray-400 block mb-1">Etiqueta zona neutral</label>
              <input maxLength={20} value={npsLabelMid} onChange={(e) => { setNpsLabelMid(e.target.value); markDirty(); }} placeholder="Neutro" className="w-full text-sm border border-gray-200 rounded-lg px-2 py-1 focus:outline-none" />
            </div>
            <div>
              <label className="text-xs text-gray-400 block mb-1">Etiqueta extremo alto</label>
              <input maxLength={20} value={npsLabelMax} onChange={(e) => { setNpsLabelMax(e.target.value); markDirty(); }} placeholder="Lo recomendaría totalmente" className="w-full text-sm border border-gray-200 rounded-lg px-2 py-1 focus:outline-none" />
            </div>
          </div>
        )}

        <button
          onClick={handleSave}
          disabled={!dirty || saving}
          className="w-full py-2 rounded-lg text-sm font-medium transition-colors
            disabled:bg-gray-100 disabled:text-gray-400
            enabled:bg-brand enabled:text-white enabled:hover:opacity-90"
        >
          {saving ? "Guardando…" : dirty ? "Guardar cambios" : "Sin cambios"}
        </button>

        {/* matrix: ítems + etiquetas de escala */}
        {type === "matrix" && (
          <div className="space-y-4">
            <div>
              <label className="text-xs text-gray-500 block mb-2">Sub-preguntas (ítems)</label>
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleMatrixItemDragEnd}>
                <SortableContext items={matrixItems.map((_, i) => `item-${i}`)} strategy={verticalListSortingStrategy}>
                  <div className="space-y-0.5 mb-2">
                    {matrixItems.map((item, i) => (
                      <SortableMatrixItem
                        key={`item-${i}`}
                        id={`item-${i}`}
                        label={item}
                        onDelete={() => { setMatrixItems((prev) => prev.filter((_, idx) => idx !== i)); markDirty(); }}
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
              <div className="flex gap-2">
                <input type="text" value={newMatrixItem} onChange={(e) => setNewMatrixItem(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") addMatrixItem(); }} placeholder="Nuevo ítem…" className="flex-1 text-sm border border-gray-200 rounded-lg px-2 py-1 focus:outline-none focus:border-brand" />
                <button onClick={addMatrixItem} className="text-xs text-brand hover:underline shrink-0">+ Agregar</button>
              </div>
            </div>

            <div>
              <label className="text-xs text-gray-500 block mb-2">
                Etiquetas de columna <span className="text-gray-300 font-normal">(opcional)</span>
              </label>
              <div className="grid grid-cols-5 gap-1">
                {([1, 2, 3, 4, 5] as const).map((n) => (
                  <div key={n}>
                    <p className="text-xs text-gray-400 text-center mb-0.5">{n}</p>
                    <input
                      type="text"
                      maxLength={15}
                      value={scaleLabels[n] || ""}
                      onChange={(e) => { setScaleLabels((prev) => ({ ...prev, [n]: e.target.value })); markDirty(); }}
                      className="w-full text-xs border border-gray-200 rounded px-1 py-1 text-center focus:outline-none focus:border-brand"
                    />
                  </div>
                ))}
              </div>
              <p className="text-xs text-gray-300 mt-1">Ej: 1 = Nunca · 5 = Siempre</p>
            </div>
          </div>
        )}

        {/* single/multiple choice: opciones */}
        {HAS_OPTIONS.includes(type) && (
          <div>
            <label className="text-xs text-gray-500 block mb-2">
              Opciones <span className="text-gray-400 font-normal">(arrastra para reordenar)</span>
            </label>

            {options.length === 0 && (
              <p className="text-xs text-gray-400 italic mb-2">Sin opciones todavía.</p>
            )}

            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={options.map((o) => o.id)} strategy={verticalListSortingStrategy}>
                <div className="space-y-0.5 mb-2">
                  {options.map((opt) => (
                    <SortableOption key={opt.id} opt={opt} onDelete={handleDeleteOption} />
                  ))}
                </div>
              </SortableContext>
            </DndContext>

            <div className="flex gap-2 mt-1">
              <input
                type="text"
                value={newOption}
                onChange={(e) => setNewOption(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAddOption()}
                placeholder="Nueva opción…"
                className="flex-1 text-sm border border-gray-200 rounded-lg px-2 py-1 focus:outline-none focus:border-brand"
              />
              <button onClick={handleAddOption} className="text-xs text-brand hover:underline shrink-0">+ Agregar</button>
            </div>

            {!hasOtherOption && (
              <button
                onClick={handleAddOtrosOption}
                className="mt-2 w-full text-xs text-amber-600 border border-amber-200 rounded-lg py-1.5 hover:bg-amber-50 transition-colors"
              >
                + Agregar opción "Otros"
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
