"use client";

import * as React from "react";
import * as SeparatorPrimitive from "@radix-ui/react-separator";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import * as PopoverPrimitive from "@radix-ui/react-popover";
import { cva, type VariantProps } from "class-variance-authority";
import { Info } from "lucide-react";
import { cn } from "@/lib/utils";

/* -------------------------------------------------------------------------- */
/* Badge                                                                       */
/* -------------------------------------------------------------------------- */

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide",
  {
    variants: {
      variant: {
        neutral: "bg-[var(--surface-3)] text-[var(--text-secondary)]",
        brand: "bg-brand-100 text-brand-800 dark:bg-brand-900 dark:text-brand-200",
        accent: "bg-accent-100 text-accent-800 dark:bg-accent-900 dark:text-accent-100",
        positive: "bg-[var(--color-positive-soft)] text-[var(--color-positive)]",
        negative: "bg-[var(--color-negative-soft)] text-[var(--color-negative)]",
        warning: "bg-[var(--color-warning-soft)] text-[var(--color-warning)]",
        outline: "border border-[var(--border-strong)] text-[var(--text-secondary)]",
      },
    },
    defaultVariants: { variant: "neutral" },
  },
);

export function Badge({
  className,
  variant,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}

/* -------------------------------------------------------------------------- */
/* Separator                                                                   */
/* -------------------------------------------------------------------------- */

export const Separator = React.forwardRef<
  React.ElementRef<typeof SeparatorPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof SeparatorPrimitive.Root>
>(({ className, orientation = "horizontal", decorative = true, ...props }, ref) => (
  <SeparatorPrimitive.Root
    ref={ref}
    decorative={decorative}
    orientation={orientation}
    className={cn(
      "shrink-0 bg-[var(--border-subtle)]",
      orientation === "horizontal" ? "h-px w-full" : "h-full w-px",
      className,
    )}
    {...props}
  />
));
Separator.displayName = "Separator";

/* -------------------------------------------------------------------------- */
/* Skeleton                                                                    */
/* -------------------------------------------------------------------------- */

export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("animate-pulse rounded-md bg-[var(--surface-sunken)]", className)}
      {...props}
    />
  );
}

export function SkeletonRows({ rows = 6, className }: { rows?: number; className?: string }) {
  return (
    <div className={cn("space-y-2", className)}>
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-11 w-full" />
      ))}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Tooltip                                                                     */
/* -------------------------------------------------------------------------- */

export const TooltipProvider = TooltipPrimitive.Provider;
export const TooltipRoot = TooltipPrimitive.Root;
export const TooltipTrigger = TooltipPrimitive.Trigger;

export const TooltipContent = React.forwardRef<
  React.ElementRef<typeof TooltipPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Content>
>(({ className, sideOffset = 6, ...props }, ref) => (
  <TooltipPrimitive.Portal>
    <TooltipPrimitive.Content
      ref={ref}
      sideOffset={sideOffset}
      className={cn(
        "z-50 max-w-xs rounded-md bg-ink-950 px-2.5 py-1.5 text-[12px] leading-snug text-white shadow-lg",
        className,
      )}
      {...props}
    />
  </TooltipPrimitive.Portal>
));
TooltipContent.displayName = "TooltipContent";

/** Convenience wrapper for the common case. */
export function Tooltip({
  content,
  children,
  side = "top",
}: {
  content: React.ReactNode;
  children: React.ReactNode;
  side?: "top" | "right" | "bottom" | "left";
}) {
  if (!content) return <>{children}</>;
  return (
    <TooltipRoot>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side={side}>{content}</TooltipContent>
    </TooltipRoot>
  );
}

/** The small circled "i" beside nearly every Settings control (ref-11). */
export function InfoHint({ text, className }: { text: string; className?: string }) {
  return (
    <Tooltip content={text}>
      <button
        type="button"
        aria-label={text}
        className={cn(
          "inline-flex size-4 items-center justify-center rounded-full text-[var(--text-muted)] transition-colors hover:text-[var(--text-secondary)]",
          className,
        )}
      >
        <Info className="size-3.5" />
      </button>
    </Tooltip>
  );
}

/* -------------------------------------------------------------------------- */
/* Popover                                                                     */
/* -------------------------------------------------------------------------- */

export const Popover = PopoverPrimitive.Root;
export const PopoverTrigger = PopoverPrimitive.Trigger;
export const PopoverAnchor = PopoverPrimitive.Anchor;

export const PopoverContent = React.forwardRef<
  React.ElementRef<typeof PopoverPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof PopoverPrimitive.Content>
>(({ className, align = "start", sideOffset = 6, ...props }, ref) => (
  <PopoverPrimitive.Portal>
    <PopoverPrimitive.Content
      ref={ref}
      align={align}
      sideOffset={sideOffset}
      className={cn(
        "z-50 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface)] p-3 shadow-lg outline-none",
        className,
      )}
      {...props}
    />
  </PopoverPrimitive.Portal>
));
PopoverContent.displayName = "PopoverContent";

/* -------------------------------------------------------------------------- */
/* Money                                                                       */
/* -------------------------------------------------------------------------- */

/**
 * A money cell. Receivables read positive/green and payables negative/red,
 * matching the colour language of ref-01 and ref-02.
 */
export function Money({
  children,
  tone = "auto",
  value,
  className,
}: {
  children: React.ReactNode;
  tone?: "auto" | "positive" | "negative" | "muted" | "plain";
  value?: number;
  className?: string;
}) {
  const resolved =
    tone === "auto"
      ? value === undefined || value === 0
        ? "muted"
        : value > 0
          ? "positive"
          : "negative"
      : tone;

  return (
    <span
      className={cn(
        "tnum",
        resolved === "positive" && "text-[var(--color-positive)]",
        resolved === "negative" && "text-[var(--color-negative)]",
        resolved === "muted" && "text-[var(--text-muted)]",
        className,
      )}
    >
      {children}
    </span>
  );
}
