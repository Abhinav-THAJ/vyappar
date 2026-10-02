"use client";

import * as React from "react";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

/**
 * A labelled control with help text and an error slot. Errors come from the
 * server action's `fieldErrors`, so client and server report the same thing.
 */
export function Field({
  id,
  label,
  required,
  hint,
  error,
  children,
  className,
}: {
  id: string;
  label: string;
  required?: boolean;
  hint?: string;
  error?: string[] | string;
  children: React.ReactNode;
  className?: string;
}) {
  const message = Array.isArray(error) ? error[0] : error;

  return (
    <div className={cn("space-y-1.5", className)}>
      <Label htmlFor={id} required={required}>
        {label}
      </Label>
      {children}
      {message ? (
        <p className="text-[12px] text-[var(--color-negative)]" role="alert">
          {message}
        </p>
      ) : hint ? (
        <p className="text-[12px] text-[var(--text-muted)]">{hint}</p>
      ) : null}
    </div>
  );
}

/** A form-level error banner for anything not tied to one field. */
export function FormError({ message }: { message?: string | null }) {
  if (!message) return null;
  return (
    <div
      className="rounded-lg bg-[var(--color-negative-soft)] px-3 py-2.5 text-[13px] text-[var(--color-negative)]"
      role="alert"
    >
      {message}
    </div>
  );
}

export type FieldErrors = Record<string, string[]>;

/** Pull the first message for a field out of an action result. */
export function fieldError(errors: FieldErrors | undefined, name: string): string | undefined {
  return errors?.[name]?.[0];
}
