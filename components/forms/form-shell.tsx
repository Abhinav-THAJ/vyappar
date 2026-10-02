"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * The full-screen form layout used for create/edit screens.
 *
 * The reference opens these as modal dialogs. On the web a dedicated route is
 * deep-linkable, survives a reload and keeps the back button meaningful, so we
 * render the same composition as a page with a sticky header and footer.
 */
export function FormShell({
  title,
  description,
  onCancel,
  children,
  footer,
  width = "lg",
}: {
  title: string;
  description?: string;
  onCancel?: () => void;
  children: React.ReactNode;
  footer: React.ReactNode;
  width?: "md" | "lg" | "xl";
}) {
  const router = useRouter();
  const cancel = onCancel ?? (() => router.back());

  const max = { md: "max-w-2xl", lg: "max-w-4xl", xl: "max-w-6xl" }[width];

  return (
    <div className="flex min-h-full flex-col">
      <div className="sticky top-14 z-20 flex items-center justify-between gap-3 border-b border-[var(--border-subtle)] bg-[var(--surface)] px-4 py-3 sm:px-6">
        <div className="min-w-0">
          <h1 className="truncate text-lg font-semibold tracking-tight">{title}</h1>
          {description ? (
            <p className="mt-0.5 truncate text-[13px] text-[var(--text-muted)]">{description}</p>
          ) : null}
        </div>
        <Button variant="ghost" size="icon" onClick={cancel} aria-label="Close">
          <X className="size-5" />
        </Button>
      </div>

      <div className={cn("mx-auto w-full flex-1 px-4 py-6 sm:px-6", max)}>{children}</div>

      <div className="sticky bottom-0 z-20 border-t border-[var(--border-subtle)] bg-[var(--surface)] px-4 py-3 sm:px-6">
        <div className={cn("mx-auto flex w-full items-center justify-end gap-2", max)}>{footer}</div>
      </div>
    </div>
  );
}

/** A titled group of fields inside a form. */
export function FormSection({
  title,
  description,
  children,
  className,
}: {
  title?: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("surface-card p-5", className)}>
      {title ? (
        <div className="mb-4">
          <h2 className="text-[15px] font-semibold">{title}</h2>
          {description ? (
            <p className="mt-0.5 text-[13px] text-[var(--text-muted)]">{description}</p>
          ) : null}
        </div>
      ) : null}
      {children}
    </section>
  );
}

/** Responsive field grid: one column on phones, two from `sm`. */
export function FormGrid({
  children,
  cols = 2,
  className,
}: {
  children: React.ReactNode;
  cols?: 1 | 2 | 3;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "grid gap-4",
        cols === 2 && "sm:grid-cols-2",
        cols === 3 && "sm:grid-cols-2 lg:grid-cols-3",
        className,
      )}
    >
      {children}
    </div>
  );
}
