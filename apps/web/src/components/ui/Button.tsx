import { forwardRef } from "react";
import { cn } from "@/lib/utils";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
type ButtonSize    = "sm" | "md" | "lg";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
}

const base =
  "inline-flex items-center justify-center gap-2 rounded-pill font-display font-bold " +
  "transition-transform duration-100 active:scale-[0.97] focus-visible:outline-none " +
  "focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 " +
  "select-none";

const variants: Record<ButtonVariant, string> = {
  primary:
    "bg-brand-primary text-brand-on-primary " +
    "shadow-[0_8px_22px_color-mix(in_srgb,var(--bp)_34%,transparent)] " +
    "hover:brightness-110 focus-visible:ring-[var(--bp)]",
  secondary:
    "border-[1.5px] border-brand-border bg-brand-bg text-brand-ink " +
    "hover:bg-brand-surface focus-visible:ring-[var(--bp)]",
  ghost:
    "bg-transparent text-brand-primary border-[1.5px] border-brand-border " +
    "hover:bg-brand-bg focus-visible:ring-[var(--bp)]",
  danger:
    "bg-[#d9483b] text-white shadow-[0_6px_16px_rgba(217,72,59,0.3)] " +
    "hover:brightness-110 focus-visible:ring-[#d9483b]",
};

const sizes: Record<ButtonSize, string> = {
  sm: "min-h-[40px] px-4 text-[13px]",
  md: "min-h-[46px] px-5 text-[14px]",
  lg: "min-h-[54px] px-6 text-[17px]",
};

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = "primary", size = "lg", fullWidth, className, children, ...props }, ref) => (
    <button
      ref={ref}
      className={cn(base, variants[variant], sizes[size], fullWidth && "w-full", className)}
      {...props}
    >
      {children}
    </button>
  )
);
Button.displayName = "Button";

export { Button };
export type { ButtonProps, ButtonVariant, ButtonSize };
