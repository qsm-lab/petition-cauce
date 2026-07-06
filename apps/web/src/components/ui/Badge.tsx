import { cn } from "@/lib/utils";

/** Estados del ciclo de vida de una campaña */
type LifecycleStatus = "draft" | "active" | "collecting" | "delivered" | "dialog" | "decided";

/** Badges de categoría temática */
type CategoryVariant = "category";

type BadgeVariant = LifecycleStatus | CategoryVariant;

const LIFECYCLE_LABELS: Record<LifecycleStatus, string> = {
  draft:      "Borrador",
  active:     "Lanzada",
  collecting: "Recolección",
  delivered:  "Entregada",
  dialog:     "En diálogo",
  decided:    "Decidida",
};

const variantStyles: Record<BadgeVariant, string> = {
  /* Ciclo de vida */
  draft:      "bg-[#EDF4F1] text-[rgba(22,38,31,0.6)] border border-[rgba(22,38,31,0.18)]",
  active:     "bg-brand-primary text-brand-on-primary",   /* Lime + Ink */
  collecting: "bg-brand-primary text-brand-on-primary",   /* Lime + Ink */
  delivered:  "bg-[#d97706] text-white",                  /* ámbar */
  dialog:     "bg-[#2563eb] text-white",                  /* azul */
  decided:    "bg-[#16a34a] text-white",                  /* verde oscuro */
  /* Categoría temática */
  category:   "bg-brand-secondary text-brand-ink",        /* Green Light + Ink */
};

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  /** Para badges de ciclo de vida, muestra el label canónico automáticamente */
  lifecycle?: LifecycleStatus;
}

function Badge({ variant, lifecycle, className, children, ...props }: BadgeProps) {
  const resolvedVariant: BadgeVariant = lifecycle ?? variant ?? "active";
  const label = lifecycle ? LIFECYCLE_LABELS[lifecycle] : children;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-pill px-3 py-1 " +
          "font-sans text-[11.5px] font-bold leading-none",
        variantStyles[resolvedVariant],
        className
      )}
      {...props}
    >
      {label}
    </span>
  );
}

export { Badge, LIFECYCLE_LABELS };
export type { BadgeProps, BadgeVariant, LifecycleStatus };
