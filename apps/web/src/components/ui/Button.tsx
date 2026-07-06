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
  "inline-flex items-center justify-center gap-2 rounded-pill font-body font-bold " +
  "transition-all duration-100 active:scale-[0.97] focus-visible:outline-none " +
  "focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 " +
  "select-none";

const variants: Record<ButtonVariant, string> = {
  primary:
    "bg-brand-primary text-brand-on-primary " +
    "hover:brightness-95 focus-visible:ring-[var(--bp)]",
  secondary:
    "border-[1.5px] border-[rgba(22,38,31,0.3)] bg-white text-brand-ink " +
    "hover:bg-brand-bg focus-visible:ring-[var(--bink)]",
  ghost:
    "bg-transparent text-brand-ink border-[1.5px] border-[rgba(22,38,31,0.25)] " +
    "hover:bg-brand-bg focus-visible:ring-[var(--bink)]",
  danger:
    "bg-[#d9483b] text-white shadow-[0_4px_12px_rgba(217,72,59,0.25)] " +
    "hover:brightness-105 focus-visible:ring-[#d9483b]",
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
