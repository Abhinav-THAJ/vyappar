"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export type InputProps = React.InputHTMLAttributes<HTMLInputElement> & {
  invalid?: boolean;
};

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, invalid, ...props }, ref) => (
    <input
      ref={ref}
      aria-invalid={invalid || undefined}
      className={cn(
        "flex h-9 w-full rounded-lg border bg-[var(--surface)] px-3 py-1 text-sm transition-colors",
        "placeholder:text-[var(--text-muted)]",
        "disabled:cursor-not-allowed disabled:opacity-60",
        invalid
          ? "border-[var(--color-negative)]"
          : "border-[var(--border-strong)] focus-visible:border-brand-500",
        className,
      )}
      {...props}
    />
  ),
);
Input.displayName = "Input";

export const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement> & { invalid?: boolean }
>(({ className, invalid, ...props }, ref) => (
  <textarea
    ref={ref}
    aria-invalid={invalid || undefined}
    className={cn(
      "flex min-h-[72px] w-full rounded-lg border bg-[var(--surface)] px-3 py-2 text-sm",
      "placeholder:text-[var(--text-muted)] disabled:opacity-60",
      invalid ? "border-[var(--color-negative)]" : "border-[var(--border-strong)] focus-visible:border-brand-500",
      className,
    )}
    {...props}
  />
));
Textarea.displayName = "Textarea";
