"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { api } from "@/lib/api";
import { Question, Form as FormType } from "@/lib/types";
import SortableQuestion from "./SortableQuestion";
import QuestionEditor from "./QuestionEditor";
import QuestionTypePicker from "./QuestionTypePicker";
import VersionsPanel from "./VersionsPanel";
import CampaignSelector from "./CampaignSelector";

interface Form {
  id: string;
  title: string;
  status: string;
  slug?: string | null;
  campaign_id?: string | null;
  description_font_size?: number;
  cover_image_url?: string;
  og_description?: string;
  og_image_alt?: string;
  questions: Question[];
}

interface Props {
  form: Form;
  campaignId?: string;
}

const STATUS_LABELS: Record<string, string> = {
  draft: "Borrador",
  active: "Activo (pruebas)",
  online: "En línea",
  completed: "Concluido",
  archived: "Archivado",
};

export default function FormBuilder({ form, campaignId }: Props) {
  const router = useRouter();
  const [questions, setQuestions] = useState<Question[]>(
    [...form.questions].sort((a, b) => a.order_index - b.order_index)
  );
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [formStatus, setFormStatus] = useState(form.status);
  const [confirmDeleteAll, setConfirmDeleteAll] = useState(false);
  const [formTitle, setFormTitle] = useState(form.title);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState(form.title);
  const [descFontSize, setDescFontSize] = useState(form.description_font_size || 14);
  const [coverImageUrl, setCoverImageUrl] = useState(form.cover_image_url ?? "");
  const [ogDescription, setOgDescription] = useState(form.og_description ?? "");
  const [ogImageAlt, setOgImageAlt] = useState(form.og_image_alt ?? "");
  const [formSlug, setFormSlug] = useState(form.slug ?? "");
  const [editingSlug, setEditingSlug] = useState(false);
  const [slugDraft, setSlugDraft] = useState(form.slug ?? "");
  const [coverImageSaved, setCoverImageSaved] = useState(false);
  const [ogSaved, setOgSaved] = useState(false);
  const [showVersions, setShowVersions] = useState(false);
  const [versionsKey, setVersionsKey] = useState(0);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const selectedQuestion = questions.find((q) => q.id === selectedId) ?? null;

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = questions.findIndex((q) => q.id === active.id);
    const newIndex = questions.findIndex((q) => q.id === over.id);
    const reordered = arrayMove(questions, oldIndex, newIndex);
    setQuestions(reordered);

    await api.post(`/v1/forms/${form.id}/questions/reorder`, {
      question_ids: reordered.map((q: Question) => q.id),
    });
  }

  async function handleAddQuestion(type: string) {
    const created = await api.post<Question>(`/v1/forms/${form.id}/questions`, {
      type,
      label: "Nueva pregunta",
      order_index: questions.length,
    });
    setQuestions((prev) => [...prev, created]);
    setSelectedId(created.id);
  }

  const handleUpdateQuestion = useCallback(
    async (id: string, patch: Partial<Question>) => {
      setSaving(true);
      try {
        const updated = await api.put<Question>(
          `/v1/forms/${form.id}/questions/${id}`,
          patch
        );
        setQuestions((prev) => prev.map((q) => (q.id === id ? { ...q, ...updated } : q)));
      } finally {
        setSaving(false);
      }
    },
    [form.id]
  );

  async function handleDeleteQuestion(id: string) {
    await api.delete(`/v1/forms/${form.id}/questions/${id}`);
    setQuestions((prev) => prev.filter((q) => q.id !== id));
    if (selectedId === id) setSelectedId(null);
  }

  async function handleSaveFontSize(size: number) {
    setDescFontSize(size);
    await api.put(`/v1/forms/${form.id}`, { description_font_size: size });
  }

  async function handleSaveCoverImage() {
    await api.put(`/v1/forms/${form.id}`, { cover_image_url: coverImageUrl || null });
    setCoverImageSaved(true);
    setTimeout(() => setCoverImageSaved(false), 2000);
  }

  async function handleSaveOg() {
    await api.put(`/v1/forms/${form.id}`, {
      og_description: ogDescription || null,
      og_image_alt: ogImageAlt || null,
    });
    setOgSaved(true);
    setTimeout(() => setOgSaved(false), 2000);
  }

  async function handleDuplicate() {
    setSaving(true);
    try {
      const newForm = await api.post<FormType>(`/v1/forms/${form.id}/duplicate`, {});
      router.push(`/admin/forms/${newForm.id}/builder`);
    } finally {
      setSaving(false);
    }
  }

  function handleVersionRestored() {
    setVersionsKey((k) => k + 1);
    router.refresh();
  }

  async function handleSetStatus(newStatus: string) {
    setSaving(true);
    try {
      await api.put(`/v1/forms/${form.id}`, { status: newStatus });
      if (campaignId) {
        await api.patch(`/v1/campaigns/${campaignId}/status`, { status: newStatus });
      }
      setFormStatus(newStatus);
    } catch (err) {
      console.error("Error al cambiar estado:", err);
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveTitle() {
    if (!titleDraft.trim() || titleDraft === formTitle) {
      setEditingTitle(false);
      setTitleDraft(formTitle);
      return;
    }
    setSaving(true);
    try {
      await api.put(`/v1/forms/${form.id}`, { title: titleDraft.trim() });
      setFormTitle(titleDraft.trim());
      setEditingTitle(false);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Error al guardar el título");
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveSlug() {
    const slug = slugDraft.trim().toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 100);
    if (!slug || slug === formSlug) { setEditingSlug(false); setSlugDraft(formSlug); return; }
    setSaving(true);
    try {
      await api.put(`/v1/forms/${form.id}`, { slug });
      setFormSlug(slug);
      setSlugDraft(slug);
      setEditingSlug(false);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Error al guardar la URL");
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteAll() {
    setSaving(true);
    try {
      for (const q of questions) {
        await api.delete(`/v1/forms/${form.id}/questions/${q.id}`);
      }
      setQuestions([]);
      setSelectedId(null);
    } finally {
      setSaving(false);
      setConfirmDeleteAll(false);
    }
  }

  return (
    <div className="flex gap-6 h-full">
      {/* columna izquierda — metadatos + opciones + lista de preguntas */}
      <div className="flex-1 min-w-0">

        {/* ── Título e identidad del formulario ── */}
        <div className="mb-4">
          {editingTitle ? (
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={titleDraft}
                onChange={(e) => setTitleDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSaveTitle();
                  if (e.key === "Escape") { setEditingTitle(false); setTitleDraft(formTitle); }
                }}
                autoFocus
                className="text-xl font-bold text-gray-900 border-b border-brand focus:outline-none bg-transparent"
              />
              <button onClick={handleSaveTitle} className="text-xs text-brand hover:underline">Guardar</button>
              <button onClick={() => { setEditingTitle(false); setTitleDraft(formTitle); }} className="text-xs text-gray-400 hover:text-gray-600">Cancelar</button>
            </div>
          ) : (
            <button onClick={() => { setEditingTitle(true); setTitleDraft(formTitle); }} className="group flex items-center gap-2">
              <h1 className="text-xl font-bold text-gray-900">{formTitle}</h1>
              <svg className="w-3.5 h-3.5 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
              </svg>
            </button>
          )}

          {/* URL */}
          <div className="mt-1">
            {editingSlug ? (
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-gray-400">/c/</span>
                <input
                  type="text"
                  value={slugDraft}
                  onChange={(e) => setSlugDraft(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleSaveSlug();
                    if (e.key === "Escape") { setEditingSlug(false); setSlugDraft(formSlug); }
                  }}
                  autoFocus
                  placeholder="mi-formulario"
                  className="text-xs font-mono border-b border-brand focus:outline-none bg-transparent w-40"
                />
                <button onClick={handleSaveSlug} className="text-xs text-brand hover:underline">Guardar</button>
                <button onClick={() => { setEditingSlug(false); setSlugDraft(formSlug); }} className="text-xs text-gray-400 hover:text-gray-600">×</button>
              </div>
            ) : (
              <button
                onClick={() => { setEditingSlug(true); setSlugDraft(formSlug); }}
                className="group flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600"
              >
                <span className="font-mono">{formSlug ? `/c/${formSlug}` : "Sin URL pública"}</span>
                <svg className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                </svg>
              </button>
            )}
          </div>

          <CampaignSelector formId={form.id} initialCampaignId={form.campaign_id} />
          {saving && <span className="text-xs text-gray-400 mt-1 block">Guardando…</span>}
        </div>

        {/* ── Separador ── */}
        <hr className="border-gray-200 mb-4" />

        {/* ── Opciones del formulario ── */}
        <div className="space-y-3 mb-4">

          {/* SEO / Open Graph */}
          <div className="rounded-lg border border-gray-200 p-3 space-y-2.5">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">SEO / Redes sociales</p>

            <div>
              <label className="block text-xs text-gray-500 mb-1">Descripción (og:description)</label>
              <textarea
                value={ogDescription}
                onChange={(e) => setOgDescription(e.target.value)}
                onBlur={handleSaveOg}
                rows={3}
                maxLength={300}
                placeholder="Texto que aparece al compartir en WhatsApp, Instagram, X…"
                className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-brand/20 resize-none"
              />
            </div>

            <div>
              <label className="block text-xs text-gray-500 mb-1">Alt de imagen (og:image:alt)</label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={ogImageAlt}
                  onChange={(e) => setOgImageAlt(e.target.value)}
                  onBlur={handleSaveOg}
                  onKeyDown={(e) => e.key === "Enter" && handleSaveOg()}
                  maxLength={120}
                  placeholder="Descripción accesible de la imagen de portada"
                  className="flex-1 text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-brand/20"
                />
                {ogSaved && <span className="text-xs text-green-600 shrink-0">✓</span>}
              </div>
            </div>
          </div>

          {/* Imagen de portada */}
          <div>
            <label className="block text-xs text-gray-500 mb-1">Imagen de portada</label>
            <div className="flex items-center gap-2">
              <input
                type="url"
                value={coverImageUrl}
                onChange={(e) => setCoverImageUrl(e.target.value)}
                onBlur={handleSaveCoverImage}
                onKeyDown={(e) => e.key === "Enter" && handleSaveCoverImage()}
                placeholder="https://… (URL para redes sociales)"
                className="flex-1 text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-brand/20"
              />
              {coverImageSaved && <span className="text-xs text-green-600 shrink-0">✓</span>}
            </div>
          </div>

          {/* Tamaño descripción — ahora select */}
          <div>
            <label className="block text-xs text-gray-500 mb-1">Tamaño de descripción</label>
            <select
              value={descFontSize}
              onChange={(e) => handleSaveFontSize(Number(e.target.value))}
              className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-brand/20"
            >
              {[10, 12, 14, 16, 18, 20, 22].map((s) => (
                <option key={s} value={s}>{s} pt</option>
              ))}
            </select>
          </div>

          {/* Estado */}
          <div>
            <label className="block text-xs text-gray-500 mb-1">Estado</label>
            <select
              value={formStatus}
              onChange={(e) => handleSetStatus(e.target.value)}
              disabled={saving}
              className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-brand/20 disabled:opacity-50"
            >
              <option value="draft">Borrador</option>
              <option value="active">Activo (pruebas)</option>
              <option value="online">En línea</option>
              <option value="completed">Concluido</option>
              <option value="archived">Archivado</option>
            </select>
          </div>

          {/* Acciones */}
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <button
              onClick={handleDuplicate}
              disabled={saving}
              className="px-3 py-1.5 text-xs rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40 transition-colors flex items-center gap-1.5"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              Duplicar
            </button>
            <button
              onClick={() => setShowVersions((v) => !v)}
              className={`px-3 py-1.5 text-xs rounded-lg border transition-colors flex items-center gap-1.5 ${
                showVersions ? "border-brand text-brand bg-brand/5" : "border-gray-200 text-gray-600 hover:bg-gray-50"
              }`}
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Versiones
            </button>
            {!confirmDeleteAll ? (
              <button
                onClick={() => setConfirmDeleteAll(true)}
                disabled={questions.length === 0 || saving}
                className="px-3 py-1.5 text-xs rounded-lg border border-red-200 text-red-500 hover:bg-red-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Eliminar todo
              </button>
            ) : (
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs text-red-600">¿Eliminar todas las preguntas?</span>
                <button onClick={handleDeleteAll} disabled={saving} className="px-3 py-1.5 text-xs rounded-lg bg-red-500 text-white hover:bg-red-600 transition-colors">
                  Sí, eliminar
                </button>
                <button onClick={() => setConfirmDeleteAll(false)} className="px-3 py-1.5 text-xs rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors">
                  Cancelar
                </button>
              </div>
            )}
          </div>
        </div>

        {/* ── Separador ── */}
        <hr className="border-gray-200 mb-4" />

        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext
            items={questions.map((q) => q.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="space-y-2 mb-4">
              {questions.length === 0 && (
                <p className="text-sm text-gray-400 text-center py-8 border-2 border-dashed border-gray-200 rounded-xl">
                  Agrega preguntas desde el panel derecho.
                </p>
              )}
              {questions.map((q, idx) => (
                <SortableQuestion
                  key={q.id}
                  question={q}
                  index={idx}
                  isSelected={q.id === selectedId}
                  onSelect={() => setSelectedId(q.id)}
                  onDelete={() => handleDeleteQuestion(q.id)}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      </div>

      {/* columna derecha — editor, selector de tipo o versiones */}
      <div className="w-80 shrink-0">
        {showVersions ? (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
              <h3 className="text-sm font-semibold text-gray-900">Historial de versiones</h3>
              <button
                onClick={() => setShowVersions(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <VersionsPanel
              key={versionsKey}
              formId={form.id}
              onRestore={handleVersionRestored}
            />
          </div>
        ) : selectedQuestion ? (
          <QuestionEditor
            question={selectedQuestion}
            formId={form.id}
            onUpdate={handleUpdateQuestion}
            onClose={() => setSelectedId(null)}
          />
        ) : (
          <QuestionTypePicker onAdd={handleAddQuestion} />
        )}
      </div>
    </div>
  );
}
