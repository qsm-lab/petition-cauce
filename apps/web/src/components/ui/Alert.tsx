import { cn } from "@/lib/utils";

type AlertVariant = "info" | "success" | "warning" | "error";

const styles: Record<AlertVariant, { container: string; icon: string }> = {
  info: {
    container: "bg-[#eff6ff] border-[#93c5fd] text-[#1e40af]",
    icon: "ℹ",
  },
  success: {
    container:
      "bg-[color-mix(in_srgb,var(--bsec)_10%,var(--bsurf))] " +
      "border-[color-mix(in_srgb,var(--bsec)_40%,transparent)] text-brand-ink",
    icon: "✓",
  },
  warning: {
    container: "bg-[#fffbeb] border-[#fcd34d] text-[#92400e]",
    icon: "⚠",
  },
  error: {
    container: "bg-[#fef2f2] border-[#fca5a5] text-[#991b1b]",
    icon: "✕",
  },
};

interface AlertProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: AlertVariant;
  title?: string;
  onClose?: () => void;
}

function Alert({ variant = "info", title, onClose, className, children, ...props }: AlertProps) {
  const { container, icon } = styles[variant];

  return (
    <div
      role={variant === "error" ? "alert" : "status"}
      aria-live={variant === "error" ? "assertive" : "polite"}
      className={cn(
        "flex items-start gap-3 rounded-[16px] border-[1.5px] px-4 py-3 text-[13.5px] leading-snug",
        container,
        className
      )}
      {...props}
    >
      <span aria-hidden="true" className="flex-none mt-[1px] font-bold text-[15px]">
        {icon}
      </span>
      <div className="flex-1 min-w-0">
        {title && <p className="font-semibold mb-0.5">{title}</p>}
        <div className="opacity-90">{children}</div>
      </div>
      {onClose && (
        <button
          type="button"
          aria-label="Cerrar"
          onClick={onClose}
          className="flex-none w-6 h-6 flex items-center justify-center rounded-full opacity-60 hover:opacity-100 transition-opacity"
        >
          ✕
        </button>
      )}
    </div>
  );
}

export { Alert };
export type { AlertProps, AlertVariant };
