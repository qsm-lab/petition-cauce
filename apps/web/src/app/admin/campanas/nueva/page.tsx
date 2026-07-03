"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 100);
}

const CATEGORIES = [
  { value: "", label: "Sin categoría" },
  { value: "agua", label: "Agua y páramos" },
  { value: "bosques", label: "Bosques" },
  { value: "manglares", label: "Manglares" },
  { value: "mineria", label: "Minería" },
  { value: "aire", label: "Aire" },
  { value: "biodiversidad", label: "Biodiversidad" },
  { value: "otro", label: "Otro" },
];

function Field({ label, hint, children, last = false }: {
  label: string;
  hint?: string;
  children: React.ReactNode;
  last?: boolean;
}) {
  return (
    <div
      className="px-5 py-4"
      style={last ? undefined : { borderBottom: "1px solid var(--bbord)" }}
    >
      <label className="block text-[11px] font-bold uppercase tracking-[.06em] mb-1.5" style={{ color: "var(--bmut)" }}>
        {label}
      </label>
      {hint && (
        <p className="text-[11.5px] mb-2" style={{ color: "var(--bmut)", opacity: 0.7 }}>{hint}</p>
      )}
      {children}
    </div>
  );
}

function SectionHeader({ title }: { title: string }) {
  return (
    <div className="px-5 py-3" style={{ background: "var(--bbg)", borderBottom: "1px solid var(--bbord)" }}>
      <p className="font-bold text-[11px] uppercase tracking-[.06em]" style={{ color: "var(--bmut)" }}>{title}</p>
    </div>
  );
}

export default function NuevaCampanaPage() {
  const router = useRouter();

  const [title, setTitle] = useState("");
  const [petitionTitle, setPetitionTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [slugManual, setSlugManual] = useState(false);
  const [category, setCategory] = useState("");
  const [goalCount, setGoalCount] = useState("");
  const [authority, setAuthority] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleTitleChange(v: string) {
    setTitle(v);
    if (!slugManual) setSlug(slugify(v));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!title.trim() || !slug.trim()) {
      setError("El nombre interno y el slug son obligatorios.");
      return;
    }
    setLoading(true);
    try {
      const body: Record<string, unknown> = {
        title: title.trim(),
        slug: slug.trim(),
      };
      if (petitionTitle.trim()) body.petition_title = petitionTitle.trim();
      if (category) body.category = category;
      if (goalCount) body.goal_count = parseInt(goalCount, 10);
      if (authority.trim()) body.authority = authority.trim();
      if (endsAt) body.ends_at = new Date(endsAt).toISOString();

      const campaign = await api.post<{ id: string }>("/v1/campaigns", body);
      router.push(`/admin/campanas/${campaign.id}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error al crear la campaña");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      {/* Header */}
      <header
        className="sticky top-0 z-10 px-6 py-4"
        style={{ backgroundColor: "var(--bsurf)", borderBottom: "1px solid var(--bbord)" }}
      >
        <nav className="flex items-center gap-1.5 text-[12px] mb-2" style={{ color: "var(--bmut)" }}>
          <Link href="/admin/campanas" className="hover:underline" style={{ color: "var(--bp)" }}>
            Campañas
          </Link>
          <span>/</span>
          <span className="font-semibold" style={{ color: "var(--bink)" }}>Nueva campaña</span>
        </nav>
        <h1 className="font-display font-bold text-[18px]" style={{ color: "var(--bink)" }}>
          Nueva campaña
        </h1>
      </header>

      <div className="p-6 animate-pc-rise">
        <div className="grid gap-5" style={{ gridTemplateColumns: "1fr 300px" }}>

          {/* Formulario principal */}
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">

            <div className="rounded-[14px] overflow-hidden" style={{ backgroundColor: "var(--bsurf)", border: "1px solid var(--bbord)" }}>
              <SectionHeader title="Identidad" />
              <Field label="Nombre interno *" hint="Identificador en el admin. No se muestra en el front.">
                <input
                  type="text"
                  value={title}
                  onChange={(e) => handleTitleChange(e.target.value)}
                  placeholder="Ej: Yasuní 2026"
                  maxLength={500}
                  required
                  className="w-full bg-transparent text-[14px] outline-none placeholder:opacity-40"
                  style={{ color: "var(--bink)" }}
                />
              </Field>
              <Field label="Título de la petición" hint="Encabezado visible para el firmante. Si se deja vacío usa el nombre interno.">
                <input
                  type="text"
                  value={petitionTitle}
                  onChange={(e) => setPetitionTitle(e.target.value)}
                  placeholder={title || "Ej: ¡Alto al proyecto minero en el Yasuní!"}
                  maxLength={500}
                  className="w-full bg-transparent text-[14px] outline-none placeholder:opacity-40"
                  style={{ color: "var(--bink)" }}
                />
              </Field>
              <Field label="Slug (URL) *">
                <div className="flex items-center gap-2">
                  <span className="text-[13px] flex-shrink-0" style={{ color: "var(--bmut)" }}>/?slug=</span>
                  <input
                    type="text"
                    value={slug}
                    onChange={(e) => { setSlug(e.target.value); setSlugManual(true); }}
                    placeholder="yasuni-2026"
                    maxLength={100}
                    pattern="[a-z0-9\-]+"
                    required
                    className="flex-1 bg-transparent text-[13px] font-mono outline-none placeholder:opacity-40"
                    style={{ color: "var(--bink)" }}
                  />
                </div>
                <p className="text-[11.5px] mt-1.5" style={{ color: "var(--bmut)" }}>
                  Solo letras minúsculas, números y guiones.
                </p>
              </Field>
              <Field label="Categoría" last>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full bg-transparent text-[13px] outline-none"
                  style={{ color: "var(--bink)" }}
                >
                  {CATEGORIES.map((c) => (
                    <option key={c.value} value={c.value}>{c.label}</option>
                  ))}
                </select>
              </Field>
            </div>

            <div className="rounded-[14px] overflow-hidden" style={{ backgroundColor: "var(--bsurf)", border: "1px solid var(--bbord)" }}>
              <SectionHeader title="Objetivo y destinatario" />
              <Field label="Meta de firmas" hint="Deja vacío para campaña sin límite (relámpago).">
                <input
                  type="number"
                  value={goalCount}
                  onChange={(e) => setGoalCount(e.target.value)}
                  placeholder="Sin meta definida"
                  min={0}
                  className="w-full bg-transparent text-[14px] outline-none placeholder:opacity-40"
                  style={{ color: "var(--bink)" }}
                />
              </Field>
              <Field label="Autoridad destinataria" last>
                <input
                  type="text"
                  value={authority}
                  onChange={(e) => setAuthority(e.target.value)}
                  placeholder="Ej: Ministerio del Ambiente del Ecuador"
                  className="w-full bg-transparent text-[13px] outline-none placeholder:opacity-40"
                  style={{ color: "var(--bink)" }}
                />
              </Field>
            </div>

            <div className="rounded-[14px] overflow-hidden" style={{ backgroundColor: "var(--bsurf)", border: "1px solid var(--bbord)" }}>
              <SectionHeader title="Temporalidad" />
              <Field label="Fecha de cierre" hint="Opcional. La campaña se puede cerrar manualmente en cualquier momento." last>
                <input
                  type="date"
                  value={endsAt}
                  onChange={(e) => setEndsAt(e.target.value)}
                  className="bg-transparent text-[13px] outline-none"
                  style={{ color: "var(--bink)" }}
                />
              </Field>
            </div>

            {error && (
              <div
                className="rounded-[10px] px-4 py-3 text-[13px] font-medium"
                style={{
                  backgroundColor: "color-mix(in srgb, #c2410c 10%, transparent)",
                  border: "1px solid color-mix(in srgb, #c2410c 30%, transparent)",
                  color: "#c2410c",
                }}
              >
                {error}
              </div>
            )}

            <div className="flex items-center gap-3">
              <button
                type="submit"
                disabled={loading}
                className="font-semibold text-[13px] text-white px-5 py-2.5 rounded-[10px]"
                style={{
                  backgroundColor: loading ? "color-mix(in srgb, var(--bp) 60%, transparent)" : "var(--bp)",
                  cursor: loading ? "not-allowed" : "pointer",
                }}
              >
                {loading ? "Creando…" : "Crear campaña"}
              </button>
              <Link
                href="/admin/campanas"
                className="font-medium text-[13px] px-5 py-2.5 rounded-[10px]"
                style={{ color: "var(--bmut)", border: "1px solid var(--bbord)" }}
              >
                Cancelar
              </Link>
            </div>
          </form>

          {/* Panel lateral informativo */}
          <div>
            <div
              className="rounded-[14px] overflow-hidden"
              style={{ backgroundColor: "var(--bsurf)", border: "1px solid var(--bbord)" }}
            >
              <div className="px-4 py-3" style={{ borderBottom: "1px solid var(--bbord)" }}>
                <p className="font-bold text-[12px] uppercase tracking-[.06em]" style={{ color: "var(--bmut)" }}>
                  Estado inicial
                </p>
              </div>
              <div className="p-4">
                <div
                  className="flex items-start gap-2.5 rounded-[10px] px-3 py-3"
                  style={{
                    background: "color-mix(in srgb,#ca8a04 10%,transparent)",
                    border: "1px solid color-mix(in srgb,#ca8a04 25%,transparent)",
                  }}
                >
                  <span
                    className="w-2 h-2 rounded-full flex-shrink-0 mt-1"
                    style={{ backgroundColor: "#92400e" }}
                  />
                  <div>
                    <p className="text-[13px] font-semibold" style={{ color: "#92400e" }}>Borrador</p>
                    <p className="text-[11.5px] mt-0.5" style={{ color: "#92400e", opacity: 0.8 }}>
                      Visible con banner · firmas de prueba · activa cuando estés listo
                    </p>
                  </div>
                </div>
                <p className="text-[11.5px] mt-3" style={{ color: "var(--bmut)" }}>
                  La campaña inicia en modo Borrador. Configura todos los detalles y actívala cuando estés listo.
                </p>
              </div>
            </div>

            <div
              className="rounded-[14px] mt-3 p-4"
              style={{ backgroundColor: "var(--bsurf)", border: "1px solid var(--bbord)" }}
            >
              <p className="text-[11px] font-bold uppercase tracking-[.06em] mb-2" style={{ color: "var(--bmut)" }}>
                Después de crear
              </p>
              <ul className="text-[12px] flex flex-col gap-1.5" style={{ color: "var(--bmut)" }}>
                <li>→ Configura el texto de la petición</li>
                <li>→ Ajusta el formulario de firma</li>
                <li>→ Prueba el flujo completo</li>
                <li>→ Activa la campaña cuando esté lista</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
