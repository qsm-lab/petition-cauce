"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import type { AdminCampaign } from "@/lib/admin-campaigns-api";
import LifecyclePanelAdmin from "./LifecyclePanelAdmin";
import BrandingColorPicker, { autoOnPrimary, isValidHex } from "./BrandingColorPicker";
import RichTextEditor from "@/components/RichTextEditor";
import type { Category } from "@/lib/admin-categories-api";
import type { PrivacyPolicy } from "@/lib/admin-privacy-api";
import type { AdminOrg } from "@/lib/admin-orgs-api";

// ─── Constantes ───────────────────────────────────────────────────────────────

const STATUSES = [
  { value: "draft",  label: "Borrador",  hint: "Visible con banner · firmas de prueba" },
  { value: "active", label: "Activa",    hint: "Recibe firmas reales" },
  { value: "closed", label: "Cerrada",   hint: "Solo lectura · no acepta firmas" },
];

const STATUS_COLORS: Record<string, { bg: string; color: string }> = {
  active: { bg: "#DCE9E6", color: "#16261F" },
  draft:  { bg: "color-mix(in srgb,#ca8a04 10%,transparent)", color: "#92400e" },
  closed: { bg: "#e8f0fe",                                     color: "#1a56db" },
};

const MISSING_LABELS: Record<string, string> = {
  category: "categoría",
  privacy_policy_id: "política de privacidad",
  ends_at: "fecha de cierre",
};

// ─── Helpers UI ───────────────────────────────────────────────────────────────

function PanelSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-[14px] overflow-hidden" style={{ backgroundColor: "var(--bsurf)", border: "1px solid var(--bbord)" }}>
      <div className="px-5 py-3" style={{ background: "var(--bbg)", borderBottom: "1px solid var(--bbord)" }}>
        <p className="font-heading font-bold text-[12.5px] uppercase tracking-[.07em]" style={{ color: "var(--bink)" }}>{title}</p>
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

function Field({ label, hint, children, last = false }: {
  label: string; hint?: string; children: React.ReactNode; last?: boolean;
}) {
  return (
    <div className="px-5 py-4" style={last ? undefined : { borderBottom: "1px solid var(--bbord)" }}>
      <label className="block text-[12px] font-bold uppercase tracking-[.06em] mb-1.5" style={{ color: "var(--bink)" }}>
        {label}
      </label>
      {hint && <p className="text-[12.5px] mb-2.5" style={{ color: "var(--bmut)" }}>{hint}</p>}
      {children}
    </div>
  );
}

function SectionHeader({ title }: { title: string }) {
  return (
    <div className="px-5 py-3" style={{ background: "var(--bbg)", borderBottom: "1px solid var(--bbord)" }}>
      <p className="font-heading font-bold text-[12.5px] uppercase tracking-[.07em]" style={{ color: "var(--bink)" }}>{title}</p>
    </div>
  );
}

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="flex items-center gap-3 cursor-pointer">
      <div
        onClick={() => onChange(!checked)}
        className="relative w-10 h-5 rounded-full transition-colors flex-shrink-0 cursor-pointer"
        style={{ background: checked ? "var(--bp)" : "var(--bbord)" }}
      >
        <div
          className="absolute top-0.5 w-4 h-4 rounded-full transition-transform"
          style={{ background: "white", left: 2, transform: checked ? "translateX(20px)" : "translateX(0)" }}
        />
      </div>
      <span className="text-[13px]" style={{ color: "var(--bink)" }}>{label}</span>
    </label>
  );
}

function MultiCheck({ options, selected, onChange }: {
  options: { value: string; label: string }[];
  selected: string[];
  onChange: (v: string[]) => void;
}) {
  const toggle = (val: string) => {
    const next = selected.includes(val) ? selected.filter((x) => x !== val) : [...selected, val];
    if (next.length > 0) onChange(next);
  };
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((opt) => {
        const active = selected.includes(opt.value);
        return (
          <button
            key={opt.value} type="button" onClick={() => toggle(opt.value)}
            className="px-3 py-1.5 rounded-[8px] text-[12px] font-semibold transition-all"
            style={active
              ? { background: "var(--bp)", color: "var(--bop)" }
              : { background: "var(--bbg)", color: "var(--bink)", border: "1px solid var(--bbord)" }}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 100);
}

export default function CampanaEditorClient({
  campaign,
  categories = [],
  policies = [],
  orgs = [],
}: {
  campaign?: AdminCampaign | null;
  categories?: Category[];
  policies?: PrivacyPolicy[];
  orgs?: AdminOrg[];
}) {
  const router = useRouter();
  const isNew = !campaign;
  const meta = (campaign?.meta ?? {}) as Record<string, unknown>;
  const fc = (meta.form_config ?? {}) as Record<string, unknown>;

  // — Identidad
  const [title, setTitle] = useState(campaign?.title ?? "");
  const [petitionTitle, setPetitionTitle] = useState(campaign?.petition_title ?? "");
  const [slug, setSlug] = useState(campaign?.slug ?? "");
  const [slugManual, setSlugManual] = useState(false);

  // — Portada
  const [heroImageUrl, setHeroImageUrl] = useState(campaign?.hero_image_url ?? "");
  const [heroImageMobileUrl, setHeroImageMobileUrl] = useState((meta.hero_image_mobile_url as string) ?? "");

  // — Lo que pedimos
  const [asks, setAsks] = useState<string[]>(
    Array.isArray(campaign?.asks) && campaign.asks.length > 0 ? campaign.asks : [""]
  );

  // — Texto
  const legacyText =
    (campaign?.petition_body?.paragraphs as string[] | undefined)?.[0]
    ?? (campaign?.petition_body?.texto as string | undefined) ?? "";
  const [petitionHtml, setPetitionHtml] = useState<string>(
    (campaign?.petition_body?.html as string | undefined) ?? (legacyText ? `<p>${legacyText}</p>` : "")
  );

  // — Objetivo
  const [goalCount, setGoalCount] = useState(campaign?.goal_count?.toString() ?? "");
  const [authority, setAuthority] = useState(campaign?.authority ?? "");
  const [showGoal, setShowGoal] = useState((meta.show_goal as boolean) ?? true);
  const [showAuthority, setShowAuthority] = useState((meta.show_authority as boolean) ?? true);

  // — Formulario
  const [signerTypes, setSignerTypes] = useState<string[]>((fc.signer_types as string[]) ?? ["natural"]);
  const [locationModes, setLocationModes] = useState<string[]>((fc.location_modes as string[]) ?? ["nacional"]);
  const [visibilityOptions, setVisibilityOptions] = useState<string[]>((fc.visibility_options as string[]) ?? ["publica", "anonima"]);

  // — Texto de difusión
  const [shareText, setShareText] = useState((meta.share_text as string) ?? "");

  // — Branding
  const brandingMeta = (meta.branding ?? {}) as Record<string, string>;
  const [primaryColor, setPrimaryColor] = useState(brandingMeta.primary_color ?? "");

  // — Ciclo de vida: etapas opcionales (Diálogo/Decisión)
  const lcMeta = (meta.lifecycle_config ?? {}) as { dialogo?: boolean; decision?: boolean };
  const [lifecycleConfig, setLifecycleConfig] = useState({
    dialogo: lcMeta.dialogo !== false,
    decision: lcMeta.decision !== false,
  });

  // — Welcome copy
  const [welcomeTitle, setWelcomeTitle] = useState(campaign?.welcome_title ?? "");
  const [welcomeSlogan, setWelcomeSlogan] = useState(campaign?.welcome_slogan ?? "");
  const [welcomeSlogan2, setWelcomeSlogan2] = useState((meta.welcome_slogan_2 as string) ?? "");
  const [welcomeSlogan3, setWelcomeSlogan3] = useState((meta.welcome_slogan_3 as string) ?? "");
  const [welcomeDescription, setWelcomeDescription] = useState(campaign?.welcome_description ?? "");

  // — Thank you
  const [thankYouTitle, setThankYouTitle] = useState(campaign?.thank_you_title ?? "");
  const [thankYouBody, setThankYouBody] = useState(campaign?.thank_you_body ?? "");

  // — Social links
  const initSocial = (campaign?.social_links ?? {}) as Record<string, string>;
  const [socialInstagram, setSocialInstagram] = useState(initSocial.instagram ?? "");
  const [socialFacebook, setSocialFacebook] = useState(initSocial.facebook ?? "");
  const [socialTiktok, setSocialTiktok] = useState(initSocial.tiktok ?? "");
  const [socialWhatsapp, setSocialWhatsapp] = useState(initSocial.whatsapp ?? "");
  const [socialNewsletter, setSocialNewsletter] = useState(initSocial.newsletter ?? "");
  const [socialWebsite, setSocialWebsite] = useState(initSocial.website ?? "");

  // — Archivos descargables
  const [attachments, setAttachments] = useState<{ title: string; url: string }[]>(
    (meta.attachments as { title: string; url: string }[]) ?? []
  );

  // — Panel derecho
  const [status, setStatus] = useState(campaign?.status ?? "draft");
  const [orgId, setOrgId] = useState((campaign as unknown as { org_id?: string })?.org_id ?? "");
  const [category, setCategory] = useState(campaign?.category ?? "");
  const [endsAt, setEndsAt] = useState(campaign?.ends_at ? campaign.ends_at.slice(0, 10) : "");
  const [privacyPolicyId, setPrivacyPolicyId] = useState(
    (campaign as unknown as { privacy_policy_id?: string })?.privacy_policy_id ?? ""
  );
  const [showQr, setShowQr] = useState((meta.show_qr as boolean) ?? false);
  const [qrGenerated, setQrGenerated] = useState(false);
  const [qrData, setQrData] = useState<string | null>(null);

  // — Estado UI
  const [saving, setSaving] = useState(false);
  const [statusSaving, setStatusSaving] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activationWarning, setActivationWarning] = useState<string[] | null>(null);

  const isLocked = !isNew && (status === "active" || status === "online");

  function handleTitleChange(v: string) {
    setTitle(v);
    if (isNew && !slugManual) setSlug(slugify(v));
  }

  // — Asks helpers
  const setAsk = useCallback((i: number, val: string) => {
    setAsks((prev) => prev.map((a, idx) => (idx === i ? val : a)));
  }, []);
  const removeAsk = useCallback((i: number) => {
    setAsks((prev) => prev.filter((_, idx) => idx !== i));
  }, []);
  const addAsk = useCallback(() => {
    setAsks((prev) => (prev.length < 5 ? [...prev, ""] : prev));
  }, []);

  // — Attachment helpers
  const addAttachment = () => setAttachments((prev) => [...prev, { title: "", url: "" }]);
  const setAttachmentField = (i: number, k: "title" | "url", v: string) =>
    setAttachments((prev) => prev.map((a, idx) => (idx === i ? { ...a, [k]: v } : a)));
  const removeAttachment = (i: number) => setAttachments((prev) => prev.filter((_, idx) => idx !== i));

  // — QR generation
  async function generateQr() {
    try {
      const QRCode = (await import("qrcode")).default;
      const campaignUrl = `${window.location.origin}/c/${campaign!.slug}`;
      const dataUrl = await QRCode.toDataURL(campaignUrl, { width: 200, margin: 1 });
      setQrData(dataUrl);
      setQrGenerated(true);
    } catch (e) {
      console.error("Error generando QR", e);
    }
  }

  const _buildPayload = () => ({
    title: title.trim(),
    petition_title: petitionTitle.trim() || null,
    slug: slug.trim(),
    asks: asks.filter((a) => a.trim()),
    hero_image_url: heroImageUrl.trim() || null,
    hero_image_mobile_url: heroImageMobileUrl.trim() || undefined,
    goal_count: goalCount ? parseInt(goalCount, 10) : null,
    authority: authority.trim() || null,
    petition_body: petitionHtml && petitionHtml !== "<p></p>" ? { html: petitionHtml } : {},
    // URL es lo único obligatorio; título vacío recibe un default en vez de
    // descartar la fila silenciosamente (causaba "no se guardó" al recargar)
    attachments: attachments
      .filter((a) => a.url.trim())
      .map((a) => ({ title: a.title.trim() || "Documento", url: a.url.trim() })),
    category: category || null,
    ends_at: endsAt ? new Date(endsAt).toISOString() : null,
    privacy_policy_id: privacyPolicyId || null,
    org_id: orgId || undefined,
    show_goal: showGoal,
    show_authority: showAuthority,
    form_config: { signer_types: signerTypes, location_modes: locationModes, visibility_options: visibilityOptions },
    show_qr: showQr,
    share_text: shareText.trim() || null,
    lifecycle_config: lifecycleConfig,
    // Branding
    branding: isValidHex(primaryColor)
      ? { primary_color: primaryColor, on_primary_color: autoOnPrimary(primaryColor) }
      : {},
    // Welcome copy
    welcome_title: welcomeTitle.trim() || null,
    welcome_slogan: welcomeSlogan.trim() || null,
    welcome_slogan_2: welcomeSlogan2.trim() || null,
    welcome_slogan_3: welcomeSlogan3.trim() || null,
    welcome_description: welcomeDescription.trim() || null,
    // Thank you
    thank_you_title: thankYouTitle.trim() || null,
    thank_you_body: thankYouBody.trim() || null,
    // Social links
    social_links: {
      instagram:   socialInstagram.trim()   || null,
      facebook:    socialFacebook.trim()    || null,
      tiktok:      socialTiktok.trim()      || null,
      whatsapp:    socialWhatsapp.trim()    || null,
      newsletter:  socialNewsletter.trim()  || null,
      website:     socialWebsite.trim()     || null,
    },
  });

  // — Save
  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!title.trim() || !slug.trim()) {
      setError("El nombre interno y el slug son obligatorios.");
      return;
    }
    setSaving(true);
    setSaved(false);
    try {
      if (isNew) {
        const created = await api.post<AdminCampaign>("/v1/campaigns", _buildPayload());
        router.push(`/admin/campanas/${created.id}`);
        return;
      }
      await api.put(`/v1/campaigns/${campaign!.id}`, {
        ..._buildPayload(),
        qr_code_data: qrGenerated ? qrData : undefined,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error al guardar");
    } finally {
      setSaving(false);
    }
  }

  async function handleStatusChange(newStatus: string) {
    setActivationWarning(null);
    // Validación preemptiva en frontend
    if (newStatus === "active") {
      const missing: string[] = [];
      if (!category) missing.push("category");
      if (!endsAt) missing.push("ends_at");
      if (!privacyPolicyId) missing.push("privacy_policy_id");
      if (missing.length > 0) {
        setActivationWarning(missing);
        return;
      }
    }
    setStatusSaving(true);
    setError(null);
    try {
      await api.patch(`/v1/campaigns/${campaign!.id}/status`, { status: newStatus });
      setStatus(newStatus);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "";
      if (msg.startsWith("{")) {
        try {
          const parsed = JSON.parse(msg);
          if (parsed.error === "missing_required_for_active") {
            setActivationWarning((parsed.missing as string[]) ?? []);
            return;
          }
        } catch { /* fall through */ }
      }
      setError(msg || "Error al cambiar estado");
    } finally {
      setStatusSaving(false);
    }
  }

  async function handleArchive() {
    if (!confirm("¿Archivar esta campaña? No se podrá reactivar fácilmente.")) return;
    setArchiving(true);
    setError(null);
    try {
      await api.patch(`/v1/campaigns/${campaign!.id}/archive`, {});
      router.push("/admin/campanas");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error al archivar";
      setError(msg.includes("activa") ? "Desactiva la campaña antes de archivarla." : msg);
      setArchiving(false);
    }
  }

  const statusStyle = STATUS_COLORS[status] ?? STATUS_COLORS.draft;

  const inputSel = "w-full bg-transparent text-[13px] outline-none";
  const selStyle = { color: "var(--bink)" };

  return (
    <div>
      {/* ── Header ── */}
      <header
        className="sticky top-0 z-10 px-6 py-4"
        style={{ backgroundColor: "var(--bsurf)", borderBottom: "1px solid var(--bbord)" }}
      >
        <nav className="flex items-center gap-1.5 text-[12px] mb-2" style={{ color: "var(--bmut)" }}>
          <Link href="/admin/campanas" className="hover:underline" style={{ color: "var(--bink)", fontWeight: 600 }}>Campañas</Link>
          <span>/</span>
          <span className="font-semibold truncate max-w-[280px]" style={{ color: "var(--bink)" }}>
            {isNew ? "Nueva campaña" : campaign!.title}
          </span>
        </nav>
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <h1 className="font-heading font-bold text-[22px]" style={{ color: "var(--bink)" }}>
              {isNew ? "Nueva campaña" : "Editar campaña"}
            </h1>
            {!isNew && (
              <span className="font-bold text-[11px] px-2.5 py-1 rounded-full" style={{ background: statusStyle.bg, color: statusStyle.color }}>
                {STATUSES.find((s) => s.value === status)?.label ?? status}
              </span>
            )}
          </div>
          {!isNew && (
            <div className="flex items-center gap-2">
              <button
                form="editor-form"
                type="submit"
                disabled={saving}
                className="font-semibold text-[12.5px] px-3.5 py-1.5 rounded-[8px]"
                style={{
                  background: saved ? "#16261F" : saving ? "rgba(215,242,76,0.5)" : "var(--bp)",
                  color: saved ? "#fff" : "var(--bop)",
                  cursor: saving ? "not-allowed" : "pointer",
                  border: "none",
                }}
              >
                {saved ? "✓ Guardado" : saving ? "Guardando…" : "Guardar cambios"}
              </button>
              <Link href={`/admin/campanas/${campaign!.id}/firmas`} className="text-[12.5px] font-semibold px-3.5 py-1.5 rounded-[8px]" style={{ color: "#fff", background: "var(--bink)", border: "none" }}>
                Ver firmas
              </Link>
              <a href={`/c/${campaign!.slug}`} target="_blank" rel="noopener noreferrer" className="text-[12.5px] font-medium px-3 py-1.5 rounded-[8px]" style={{ color: "var(--bmut)", border: "1px solid var(--bbord)" }}>
                Landing ↗
              </a>
            </div>
          )}
        </div>
      </header>

      <div className="p-6 animate-pc-rise">
        <div className="grid gap-5" style={{ gridTemplateColumns: "1fr 360px" }}>

          {/* ── Formulario principal (izquierda) ── */}
          <form id="editor-form" onSubmit={handleSave} className="flex flex-col gap-4">

            {/* Portada */}
            <div className="rounded-[14px] overflow-hidden" style={{ backgroundColor: "var(--bsurf)", border: "1px solid var(--bbord)" }}>
              <SectionHeader title="Portada" />
              <Field label="URL imagen desktop" hint="Imagen principal que aparece en el hero de la campaña (formato horizontal recomendado).">
                <input type="url" value={heroImageUrl} onChange={(e) => setHeroImageUrl(e.target.value)} placeholder="https://…/portada.jpg" className="w-full bg-transparent text-[13px] outline-none placeholder:opacity-40" style={{ color: "var(--bink)" }} />
              </Field>
              <Field label="URL imagen móvil" hint="Opcional. Si se omite, se usa la imagen desktop. Formato cuadrado o vertical recomendado." last>
                <input type="url" value={heroImageMobileUrl} onChange={(e) => setHeroImageMobileUrl(e.target.value)} placeholder="https://…/portada-mobile.jpg" className="w-full bg-transparent text-[13px] outline-none placeholder:opacity-40" style={{ color: "var(--bink)" }} />
              </Field>
            </div>

            {/* Identidad */}
            <div className="rounded-[14px] overflow-hidden" style={{ backgroundColor: "var(--bsurf)", border: "1px solid var(--bbord)" }}>
              <SectionHeader title="Identidad" />
              <Field label="Nombre interno *" hint="Identificador en el admin. No se muestra en el front.">
                <input type="text" value={title} onChange={(e) => handleTitleChange(e.target.value)} maxLength={500} required className="w-full bg-transparent text-[14px] outline-none placeholder:opacity-40" placeholder="Ej: Yasuní 2026" style={{ color: "var(--bink)" }} />
              </Field>
              <Field label="Título de la petición" hint="Lo que verá el firmante como encabezado. Si se deja vacío usa el nombre interno.">
                <input type="text" value={petitionTitle} onChange={(e) => setPetitionTitle(e.target.value)} placeholder={title || "Ej: ¡Alto al proyecto minero en el Yasuní!"} maxLength={500} className="w-full bg-transparent text-[14px] outline-none placeholder:opacity-40" style={{ color: "var(--bink)" }} />
              </Field>
              <Field label="Slug (URL)" last>
                <div className="flex items-center gap-1.5">
                  <span className="text-[13px] flex-shrink-0" style={{ color: "var(--bmut)" }}>/c/</span>
                  <input type="text" value={slug} onChange={(e) => { setSlug(e.target.value); setSlugManual(true); }} maxLength={100} pattern="[a-z0-9\-]+" className="flex-1 bg-transparent text-[13px] font-mono outline-none placeholder:opacity-40" placeholder="yasuni-2026" style={{ color: "var(--bink)" }} />
                </div>
                {isNew && <p className="text-[11.5px] mt-1" style={{ color: "var(--bmut)" }}>Solo letras minúsculas, números y guiones.</p>}
              </Field>
            </div>

            {/* Lo que pedimos */}
            <div className="rounded-[14px] overflow-hidden" style={{ backgroundColor: "var(--bsurf)", border: "1px solid var(--bbord)" }}>
              <SectionHeader title="Lo que pedimos" />
              <div className="px-5 py-4 flex flex-col gap-2">
                {asks.map((ask, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className="text-[11.5px] font-bold flex-shrink-0 w-5 text-center" style={{ color: "var(--bmut)" }}>{String.fromCharCode(65 + i)}.</span>
                    <input
                      type="text"
                      value={ask}
                      onChange={(e) => setAsk(i, e.target.value)}
                      placeholder={`Pedido ${String.fromCharCode(65 + i)}`}
                      maxLength={200}
                      className="flex-1 bg-transparent text-[13px] font-semibold outline-none placeholder:opacity-30 placeholder:font-normal"
                      style={{ color: "var(--bink)" }}
                    />
                    {asks.length > 1 && (
                      <button type="button" onClick={() => removeAsk(i)} className="text-[11px] px-2 py-0.5 rounded-[5px] hover:opacity-70" style={{ color: "#c2410c", background: "#fef2f2" }}>
                        ✕
                      </button>
                    )}
                  </div>
                ))}
                {asks.length < 5 && (
                  <button type="button" onClick={addAsk} className="self-start text-[12px] font-semibold mt-1 hover:opacity-70" style={{ color: "var(--bink)", fontWeight: 600 }}>
                    + Agregar punto
                  </button>
                )}
                <p className="text-[11px] mt-1" style={{ color: "var(--bmut)" }}>Máximo 5 · aparecen en negrita en la landing</p>
              </div>
            </div>

            {/* Texto de la petición */}
            <div className="rounded-[14px] overflow-hidden" style={{ backgroundColor: "var(--bsurf)", border: "1px solid var(--bbord)" }}>
              <SectionHeader title="Texto de la petición" />
              <RichTextEditor value={petitionHtml} onChange={setPetitionHtml} placeholder="Redacta el texto que se presentará ante la autoridad..." minHeight={220} />
            </div>

            {/* Objetivo y destinatario */}
            <div className="rounded-[14px] overflow-hidden" style={{ backgroundColor: "var(--bsurf)", border: "1px solid var(--bbord)" }}>
              <SectionHeader title="Objetivo y destinatario" />
              <Field label="Meta de firmas" hint="Deja en 0 o vacío para campaña sin límite (relámpago).">
                <div className="flex items-center gap-3 mb-3">
                  <input type="number" value={goalCount} onChange={(e) => setGoalCount(e.target.value)} min={0} placeholder="Sin meta definida" className="flex-1 bg-transparent text-[14px] outline-none placeholder:opacity-40" style={{ color: "var(--bink)" }} />
                </div>
                <Toggle checked={showGoal} onChange={setShowGoal} label="Mostrar meta y barra de progreso en el front" />
              </Field>
              <Field label="Autoridad destinataria" last>
                <input type="text" value={authority} onChange={(e) => setAuthority(e.target.value)} placeholder="Ej: Ministerio del Ambiente del Ecuador" className="w-full bg-transparent text-[13px] outline-none placeholder:opacity-40 mb-3" style={{ color: "var(--bink)" }} />
                <Toggle checked={showAuthority} onChange={setShowAuthority} label="Mostrar destinatario en el front" />
              </Field>
            </div>

            {/* Texto de difusión */}
            <div className="rounded-[14px] overflow-hidden" style={{ backgroundColor: "var(--bsurf)", border: "1px solid var(--bbord)" }}>
              <SectionHeader title="Texto de difusión" />
              <Field label="Copy para compartir (WhatsApp, X, Email)" hint="Texto exacto que verán al compartir. Puedes usar emojis (evitar 🌿 🌺 en WhatsApp). Si se omite se construye desde título y eslogan." last>
                <textarea
                  value={shareText}
                  onChange={(e) => setShareText(e.target.value)}
                  placeholder={`${title || "Nombre de la campaña"} — firma aquí: [URL]`}
                  rows={3}
                  maxLength={300}
                  className="w-full bg-transparent text-[13px] outline-none placeholder:opacity-30 resize-none leading-snug"
                  style={{ color: "var(--bink)" }}
                />
                <p className="text-[11px] mt-1" style={{ color: "var(--bmut)" }}>{shareText.length}/300 · La URL se agrega automáticamente</p>
              </Field>
            </div>

            {/* Identidad visual */}
            <div className="rounded-[14px] overflow-hidden" style={{ backgroundColor: "var(--bsurf)", border: "1px solid var(--bbord)" }}>
              <SectionHeader title="Identidad visual" />
              <div className="px-5 py-4 flex flex-col gap-4">
                {/* Color primario */}
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[.06em] mb-2" style={{ color: "var(--bmut)" }}>Color primario (botón CTA)</p>
                  <BrandingColorPicker value={primaryColor} onChange={setPrimaryColor} />
                </div>

                {/* Welcome copy */}
                <div style={{ borderTop: "1px solid var(--bbord)", paddingTop: 14 }}>
                  <p className="text-[11px] font-bold uppercase tracking-[.06em] mb-3" style={{ color: "var(--bmut)" }}>Textos de la landing</p>
                  <div className="flex flex-col gap-3">
                    <div>
                      <label className="text-[11px] mb-1 block" style={{ color: "var(--bmut)" }}>Título de bienvenida</label>
                      <input type="text" value={welcomeTitle} onChange={(e) => setWelcomeTitle(e.target.value)} maxLength={120} placeholder="Ej: Defendemos el Yasuní" className="w-full bg-transparent text-[13px] outline-none placeholder:opacity-40" style={{ color: "var(--bink)", borderBottom: "1px solid var(--bbord)", paddingBottom: 4 }} />
                    </div>
                    <div>
                      <label className="text-[11px] mb-1 block" style={{ color: "var(--bmut)" }}>Eslogan 1</label>
                      <input type="text" value={welcomeSlogan} onChange={(e) => setWelcomeSlogan(e.target.value)} maxLength={200} placeholder="Ej: Cada firma cuenta" className="w-full bg-transparent text-[13px] outline-none placeholder:opacity-40" style={{ color: "var(--bink)", borderBottom: "1px solid var(--bbord)", paddingBottom: 4 }} />
                    </div>
                    <div>
                      <label className="text-[11px] mb-1 block" style={{ color: "var(--bmut)" }}>Eslogan 2</label>
                      <input type="text" value={welcomeSlogan2} onChange={(e) => setWelcomeSlogan2(e.target.value)} maxLength={200} placeholder="Opcional — rota tras el eslogan 1" className="w-full bg-transparent text-[13px] outline-none placeholder:opacity-40" style={{ color: "var(--bink)", borderBottom: "1px solid var(--bbord)", paddingBottom: 4 }} />
                    </div>
                    <div>
                      <label className="text-[11px] mb-1 block" style={{ color: "var(--bmut)" }}>Eslogan 3</label>
                      <input type="text" value={welcomeSlogan3} onChange={(e) => setWelcomeSlogan3(e.target.value)} maxLength={200} placeholder="Opcional — rota tras el eslogan 2" className="w-full bg-transparent text-[13px] outline-none placeholder:opacity-40" style={{ color: "var(--bink)", borderBottom: "1px solid var(--bbord)", paddingBottom: 4 }} />
                      <p className="text-[10.5px] mt-1" style={{ color: "var(--bmut)" }}>Los eslóganes con texto rotan en secuencia sobre la imagen de portada.</p>
                    </div>
                    <div>
                      <label className="text-[11px] mb-1 block" style={{ color: "var(--bmut)" }}>Descripción / cuerpo</label>
                      <textarea value={welcomeDescription} onChange={(e) => setWelcomeDescription(e.target.value)} maxLength={1000} rows={3} placeholder="Texto introductorio de la landing..." className="w-full bg-transparent text-[13px] outline-none placeholder:opacity-40 resize-none" style={{ color: "var(--bink)", borderBottom: "1px solid var(--bbord)", paddingBottom: 4 }} />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Agradecimiento */}
            <div className="rounded-[14px] overflow-hidden" style={{ backgroundColor: "var(--bsurf)", border: "1px solid var(--bbord)" }}>
              <SectionHeader title="Pantalla de agradecimiento" />
              <Field label="Título post-firma" hint="Aparece en la pantalla de confirmación tras firmar.">
                <input type="text" value={thankYouTitle} onChange={(e) => setThankYouTitle(e.target.value)} maxLength={120} placeholder="Ej: ¡Gracias por sumarte!" className="w-full bg-transparent text-[13px] outline-none placeholder:opacity-40" style={{ color: "var(--bink)" }} />
              </Field>
              <Field label="Mensaje de agradecimiento" last>
                <textarea value={thankYouBody} onChange={(e) => setThankYouBody(e.target.value)} maxLength={500} rows={3} placeholder="Ej: Tu firma ayuda a proteger el territorio..." className="w-full bg-transparent text-[13px] outline-none placeholder:opacity-40 resize-none" style={{ color: "var(--bink)" }} />
              </Field>
            </div>

            {/* Redes sociales */}
            <div className="rounded-[14px] overflow-hidden" style={{ backgroundColor: "var(--bsurf)", border: "1px solid var(--bbord)" }}>
              <SectionHeader title="Redes sociales" />
              <div className="px-5 py-4 flex flex-col gap-3">
                {([
                  ["Sitio web",    socialWebsite,    setSocialWebsite,    "https://miorganizacion.org"],
                  ["Instagram",    socialInstagram,  setSocialInstagram,  "https://instagram.com/…"],
                  ["Facebook",     socialFacebook,   setSocialFacebook,   "https://facebook.com/…"],
                  ["TikTok",       socialTiktok,     setSocialTiktok,     "https://tiktok.com/@…"],
                  ["WhatsApp",     socialWhatsapp,   setSocialWhatsapp,   "https://wa.me/…"],
                  ["Newsletter",   socialNewsletter, setSocialNewsletter, "https://…"],
                ] as [string, string, (v: string) => void, string][]).map(([label, val, setter, ph]) => (
                  <div key={label}>
                    <label className="text-[11px] mb-1 block" style={{ color: "var(--bmut)" }}>{label}</label>
                    <input type="url" value={val} onChange={(e) => setter(e.target.value)} placeholder={ph} className="w-full bg-transparent text-[13px] outline-none placeholder:opacity-40" style={{ color: "var(--bink)", borderBottom: "1px solid var(--bbord)", paddingBottom: 4 }} />
                  </div>
                ))}
              </div>
            </div>

            {error && (
              <div className="rounded-[10px] px-4 py-3 text-[13px] font-medium" style={{ backgroundColor: "color-mix(in srgb, #c2410c 10%, transparent)", border: "1px solid color-mix(in srgb, #c2410c 30%, transparent)", color: "#c2410c" }}>
                {error}
              </div>
            )}

            <div className="flex items-center gap-3">
              <button type="submit" disabled={saving} className="font-semibold text-[13px] px-5 py-2.5 rounded-[10px]" style={{ backgroundColor: saved ? "#16261F" : saving ? "rgba(215,242,76,0.5)" : "var(--bp)", color: "var(--bop)", cursor: saving ? "not-allowed" : "pointer" }}>
                {isNew
                  ? (saving ? "Creando…" : "Crear campaña")
                  : (saved ? "✓ Guardado" : saving ? "Guardando…" : "Guardar cambios")}
              </button>
              <Link href="/admin/campanas" className="font-medium text-[13px] px-5 py-2.5 rounded-[10px]" style={{ color: "var(--bmut)", border: "1px solid var(--bbord)" }}>
                {isNew ? "Cancelar" : "Volver"}
              </Link>
            </div>
          </form>

          {/* ── Panel lateral (derecha) ── */}
          <div className="flex flex-col gap-3">

            {/* Estado */}
            <PanelSection title="Estado inicial">
              {isNew ? (
                <>
                  <div
                    className="flex items-start gap-2.5 rounded-[10px] px-3 py-3"
                    style={{
                      background: "color-mix(in srgb,#ca8a04 10%,transparent)",
                      border: "1px solid color-mix(in srgb,#ca8a04 25%,transparent)",
                    }}
                  >
                    <span className="w-2 h-2 rounded-full flex-shrink-0 mt-1" style={{ backgroundColor: "#92400e" }} />
                    <div>
                      <p className="text-[13px] font-semibold" style={{ color: "#92400e" }}>Borrador</p>
                      <p className="text-[11.5px] mt-0.5" style={{ color: "#92400e", opacity: 0.8 }}>
                        Visible con banner · firmas de prueba
                      </p>
                    </div>
                  </div>
                  <p className="text-[11.5px] mt-3" style={{ color: "var(--bmut)" }}>
                    La campaña inicia en modo Borrador. Actívala cuando estés listo.
                  </p>
                </>
              ) : (
                <>
                  {activationWarning && (
                    <div className="mb-3 rounded-[10px] overflow-hidden" style={{ border: "1.5px solid #f59e0b" }}>
                      <div className="px-3 py-2 flex items-center gap-1.5" style={{ background: "#f59e0b" }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="white" aria-hidden="true"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg>
                        <span className="text-[12px] font-bold text-white">No se puede activar</span>
                      </div>
                      <div className="px-3 py-2.5 flex flex-col gap-1.5" style={{ background: "#fffbeb" }}>
                        {activationWarning.map((k) => (
                          <div key={k} className="flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: "#d97706" }} />
                            <span className="text-[12px] font-semibold" style={{ color: "#92400e" }}>
                              Falta: {MISSING_LABELS[k] ?? k}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  <div className="flex flex-col gap-2">
                    {STATUSES.map((s) => {
                      const sc = STATUS_COLORS[s.value] ?? STATUS_COLORS.draft;
                      const isActive = status === s.value;
                      return (
                        <button key={s.value} type="button" disabled={isActive || statusSaving} onClick={() => handleStatusChange(s.value)}
                          className="w-full text-left px-3 py-2.5 rounded-[8px]"
                          style={{ background: isActive ? sc.bg : "transparent", border: `1px solid ${isActive ? sc.color : "var(--bbord)"}`, opacity: statusSaving && !isActive ? 0.5 : 1, cursor: isActive || statusSaving ? "default" : "pointer" }}
                        >
                          <div className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: isActive ? sc.color : "var(--bbord)" }} />
                            <span className="text-[13px] font-semibold" style={{ color: isActive ? sc.color : "var(--bink)" }}>{s.label}</span>
                            {isActive && <span className="ml-auto text-[11px] font-bold" style={{ color: sc.color }}>Actual</span>}
                          </div>
                          <p className="text-[11px] mt-0.5 ml-4" style={{ color: "var(--bmut)" }}>{s.hint}</p>
                        </button>
                      );
                    })}
                  </div>
                </>
              )}
            </PanelSection>

            {/* Organización */}
            {orgs.length > 0 && (
              <PanelSection title="Organización">
                <select value={orgId} onChange={(e) => setOrgId(e.target.value)} className={inputSel} style={selStyle}>
                  {orgs.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
                </select>
              </PanelSection>
            )}

            {/* Categoría */}
            <PanelSection title="Categoría *">
              <select value={category} onChange={(e) => setCategory(e.target.value)} className={inputSel} style={selStyle}>
                <option value="">Sin categoría</option>
                {categories.map((c) => <option key={c.id} value={c.slug}>{c.name}</option>)}
              </select>
              {!category && (
                <p className="text-[11px] mt-1.5" style={{ color: "#92400e" }}>Requerida para activar</p>
              )}
            </PanelSection>

            {/* Fecha de cierre */}
            <PanelSection title="Fecha de cierre *">
              <input type="date" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} className="bg-transparent text-[13px] outline-none w-full" style={{ color: "var(--bink)" }} />
              {!endsAt && (
                <p className="text-[11px] mt-1.5" style={{ color: "#92400e" }}>Requerida para activar</p>
              )}
            </PanelSection>

            {/* Configuración del formulario */}
            <PanelSection title="Configuración formulario">
              <div className="flex flex-col gap-3">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[.05em] mb-1.5" style={{ color: "var(--bmut)" }}>Tipo de firmante</p>
                  <MultiCheck options={[{ value: "natural", label: "Natural" }, { value: "org", label: "Organización" }]} selected={signerTypes} onChange={setSignerTypes} />
                </div>
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[.05em] mb-1.5" style={{ color: "var(--bmut)" }}>Ubicación</p>
                  <MultiCheck options={[{ value: "nacional", label: "Ecuador" }, { value: "internacional", label: "Internacional" }]} selected={locationModes} onChange={setLocationModes} />
                </div>
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[.05em] mb-1.5" style={{ color: "var(--bmut)" }}>Visibilidad</p>
                  <MultiCheck options={[{ value: "publica", label: "Pública" }, { value: "anonima", label: "Anónima" }, { value: "secreta", label: "Secreta" }]} selected={visibilityOptions} onChange={setVisibilityOptions} />
                  <p className="text-[10.5px] mt-1.5" style={{ color: "var(--bmut)" }}>Si Pública está habilitada, es la opción preseleccionada en el formulario de firma.</p>
                </div>
              </div>
            </PanelSection>

            {/* Archivos descargables */}
            <PanelSection title="Archivos (anexos)">
              <div className="flex flex-col gap-2">
                {attachments.map((att, i) => (
                  <div key={i} className="flex flex-col gap-1 pb-2" style={{ borderBottom: "1px solid var(--bbord)" }}>
                    <div className="flex items-center gap-1.5">
                      <input type="text" value={att.title} onChange={(e) => setAttachmentField(i, "title", e.target.value)} placeholder="Nombre" className="flex-1 bg-transparent text-[12px] outline-none placeholder:opacity-30" style={{ color: "var(--bink)" }} />
                      <button type="button" onClick={() => removeAttachment(i)} className="text-[11px] px-1.5 py-0.5 rounded-[4px]" style={{ color: "#c2410c", background: "#fef2f2" }}>✕</button>
                    </div>
                    <input type="url" value={att.url} onChange={(e) => setAttachmentField(i, "url", e.target.value)} placeholder="https://…/archivo.pdf" className="w-full bg-transparent text-[11.5px] outline-none placeholder:opacity-30" style={{ color: "var(--bmut)" }} />
                  </div>
                ))}
                <button type="button" onClick={addAttachment} className="self-start text-[12px] font-semibold hover:opacity-70" style={{ color: "var(--bink)", fontWeight: 600 }}>
                  + Agregar archivo
                </button>
              </div>
            </PanelSection>

            {/* Política de privacidad */}
            <PanelSection title="Política de privacidad *">
              <select value={privacyPolicyId} onChange={(e) => setPrivacyPolicyId(e.target.value)} className={inputSel} style={selStyle}>
                <option value="">Sin política asignada</option>
                {policies.map((p) => <option key={p.id} value={p.id}>{p.title} (v{p.version})</option>)}
              </select>
              {!privacyPolicyId && (
                <p className="text-[11px] mt-1.5" style={{ color: "#92400e" }}>Requerida para activar</p>
              )}
              {policies.length === 0 && (
                <Link href="/admin/politicas-privacidad" className="text-[11.5px] hover:underline mt-1 block" style={{ color: "var(--bink)", fontWeight: 600 }}>
                  → Crear política de privacidad
                </Link>
              )}
            </PanelSection>

            {/* Ciclo de vida — solo en edición */}
            {!isNew && (
              <div className="rounded-[14px] p-4" style={{ backgroundColor: "var(--bsurf)", border: "1px solid var(--bbord)" }}>
                <LifecyclePanelAdmin
                  campaignId={campaign!.id}
                  initialStage={campaign!.lifecycle_stage ?? 0}
                  initialEvents={campaign!.lifecycle_events ?? []}
                  orgName={campaign!.org_name ?? null}
                  orgHasContactEmail={campaign!.org_has_contact_email ?? false}
                  lifecycleConfig={lifecycleConfig}
                  onLifecycleConfigChange={setLifecycleConfig}
                />
              </div>
            )}

            {/* QR — solo en edición */}
            {!isNew && (
              <PanelSection title="Código QR">
                <Toggle checked={showQr} onChange={setShowQr} label="Mostrar QR en la landing" />
                {showQr && (
                  <div className="mt-3 flex flex-col items-center gap-2">
                    {qrData ? (
                      <>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={qrData} alt="QR" className="rounded-[8px]" style={{ width: 120, height: 120 }} />
                        <p className="text-[11px] text-center" style={{ color: "var(--bmut)" }}>Guarda los cambios para publicar el QR</p>
                      </>
                    ) : (
                      <button type="button" onClick={generateQr} className="w-full text-[12.5px] font-semibold py-2 rounded-[8px]" style={{ background: "var(--bbg)", border: "1px solid var(--bbord)", color: "var(--bink)" }}>
                        Generar QR
                      </button>
                    )}
                  </div>
                )}
              </PanelSection>
            )}

            {/* ID — solo en edición */}
            {!isNew && (
              <div className="rounded-[14px] p-4" style={{ backgroundColor: "var(--bsurf)", border: "1px solid var(--bbord)" }}>
                <p className="text-[11px] font-bold uppercase tracking-[.06em] mb-1.5" style={{ color: "var(--bmut)" }}>ID de campaña</p>
                <p className="text-[11px] font-mono break-all select-all" style={{ color: "var(--bmut)" }}>{campaign!.id}</p>
              </div>
            )}

            {/* Zona de peligro — solo en edición */}
            {!isNew && (
              <div className="rounded-[14px] p-4" style={{ backgroundColor: "var(--bsurf)", border: "1px solid var(--bbord)" }}>
                <p className="text-[11px] font-bold uppercase tracking-[.06em] mb-2" style={{ color: "var(--bmut)" }}>Zona de peligro</p>
                <button type="button" disabled={isLocked || archiving} onClick={handleArchive}
                  className="w-full px-3 py-2 rounded-[8px] text-[13px] font-semibold text-left"
                  style={{ background: isLocked ? "var(--bbg)" : "color-mix(in srgb,#c2410c 8%,transparent)", border: `1px solid ${isLocked ? "var(--bbord)" : "color-mix(in srgb,#c2410c 25%,transparent)"}`, color: isLocked ? "var(--bmut)" : "#c2410c", cursor: isLocked ? "not-allowed" : "pointer" }}
                >
                  {archiving ? "Archivando…" : "Archivar campaña"}
                </button>
                {isLocked && <p className="text-[11px] mt-1.5" style={{ color: "var(--bmut)" }}>Cambia el estado a Cerrada o Borrador antes de archivar.</p>}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
