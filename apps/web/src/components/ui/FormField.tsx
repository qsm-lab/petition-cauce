"use client";

import { forwardRef, useId } from "react";
import { cn } from "@/lib/utils";

interface FormFieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  hint?: string;
  /** Render un <textarea> en lugar de <input> */
  multiline?: boolean;
  rows?: number;
}

const inputBase =
  "w-full min-h-[48px] box-border px-4 rounded-[16px] text-[15px] font-body " +
  "bg-brand-bg text-brand-ink border-[1.5px] border-brand-border " +
  "placeholder:text-brand-muted " +
  "focus:outline-none focus:border-brand-primary " +
  "focus:ring-2 focus:ring-[color-mix(in_srgb,var(--bp)_40%,transparent)] " +
  "disabled:opacity-60 disabled:cursor-not-allowed " +
  "transition-colors duration-150";

const FormField = forwardRef<HTMLInputElement, FormFieldProps>(
  ({ label, error, hint, multiline, rows = 4, className, id: externalId, ...props }, ref) => {
    const generatedId = useId();
    const id = externalId ?? generatedId;
    const hintId = `${id}-hint`;
    const errorId = `${id}-error`;

    return (
      <div className="flex flex-col gap-1.5">
        <label htmlFor={id} className="text-[13px] font-semibold text-brand-ink">
          {label}
        </label>

        {multiline ? (
          <textarea
            id={id}
            rows={rows}
            aria-describedby={[hint && hintId, error && errorId].filter(Boolean).join(" ") || undefined}
            aria-invalid={!!error}
            className={cn(
              inputBase,
              "py-3 resize-y min-h-[96px]",
              error && "border-[#d9483b] focus:border-[#d9483b] focus:ring-[rgba(217,72,59,0.35)]",
              className
            )}
            {...(props as React.TextareaHTMLAttributes<HTMLTextAreaElement>)}
          />
        ) : (
          <input
            ref={ref}
            id={id}
            aria-describedby={[hint && hintId, error && errorId].filter(Boolean).join(" ") || undefined}
            aria-invalid={!!error}
            className={cn(
              inputBase,
              error && "border-[#d9483b] focus:border-[#d9483b] focus:ring-[rgba(217,72,59,0.35)]",
              className
            )}
            {...props}
          />
        )}

        {hint && !error && (
          <p id={hintId} className="text-[11.5px] text-brand-muted leading-snug">
            {hint}
          </p>
        )}
        {error && (
          <p id={errorId} role="alert" className="text-[11.5px] text-[#d9483b] leading-snug">
            {error}
          </p>
        )}
      </div>
    );
  }
);
FormField.displayName = "FormField";

/* ── SelectField: mismo estilo visual, <select> nativo ── */
interface SelectFieldProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  error?: string;
  children: React.ReactNode;
}

const SelectField = forwardRef<HTMLSelectElement, SelectFieldProps>(
  ({ label, error, children, className, id: externalId, ...props }, ref) => {
    const generatedId = useId();
    const id = externalId ?? generatedId;
    const errorId = `${id}-error`;

    return (
      <div className="flex flex-col gap-1.5">
        <label htmlFor={id} className="text-[13px] font-semibold text-brand-ink">
          {label}
        </label>
        <select
          ref={ref}
          id={id}
          aria-describedby={error ? errorId : undefined}
          aria-invalid={!!error}
          className={cn(
            inputBase,
            "appearance-none cursor-pointer",
            error && "border-[#d9483b] focus:border-[#d9483b]",
            className
          )}
          {...props}
        >
          {children}
        </select>
        {error && (
          <p id={errorId} role="alert" className="text-[11.5px] text-[#d9483b] leading-snug">
            {error}
          </p>
        )}
      </div>
    );
  }
);
SelectField.displayName = "SelectField";

export { FormField, SelectField };
export type { FormFieldProps, SelectFieldProps };
