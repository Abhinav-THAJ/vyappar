"use client";

import * as React from "react";
import { ChevronLeft, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/**
 * The master-detail split used by Parties, Items and Expenses: a searchable
 * list on the left, a detail pane on the right, first row auto-selected.
 *
 * On phones the two panes become a drill-down — the list fills the screen and
 * the detail slides over it with a back control (A-28).
 */
export function MasterDetail({
  list,
  detail,
  hasSelection,
  onBack,
  listWidth = "md",
  className,
}: {
  list: React.ReactNode;
  detail: React.ReactNode;
  hasSelection: boolean;
  onBack?: () => void;
  listWidth?: "sm" | "md" | "lg";
  className?: string;
}) {
  const width = {
    sm: "lg:w-[320px]",
    md: "lg:w-[390px]",
    lg: "lg:w-[460px]",
  }[listWidth];

  return (
    <div className={cn("flex min-h-0 flex-1 gap-4 p-4 sm:px-6", className)}>
      <div
        className={cn(
          "surface-card flex min-h-0 w-full shrink-0 flex-col overflow-hidden lg:w-auto",
          width,
          hasSelection && "hidden lg:flex",
        )}
      >
        {list}
      </div>

      <div
        className={cn(
          "surface-card min-h-0 min-w-0 flex-1 flex-col overflow-hidden",
          hasSelection ? "flex" : "hidden lg:flex",
        )}
      >
        {hasSelection && onBack ? (
          <button
            type="button"
            onClick={onBack}
            className="flex items-center gap-1 border-b border-[var(--border-subtle)] px-4 py-2.5 text-[13px] font-medium text-[var(--text-secondary)] lg:hidden"
          >
            <ChevronLeft className="size-4" />
            Back to list
          </button>
        ) : null}
        {detail}
      </div>
    </div>
  );
}

/** The search field that heads every master list. */
export function ListSearch({
  value,
  onChange,
  placeholder,
  children,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex shrink-0 items-center gap-2 border-b border-[var(--border-subtle)] p-3",
        className,
      )}
    >
      <div className="relative min-w-0 flex-1">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--text-muted)]" />
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="pl-9"
          aria-label={placeholder}
        />
      </div>
      {children}
    </div>
  );
}

/** The two-column header above a master list, e.g. "ITEM | QUANTITY". */
export function ListColumns({
  left,
  right,
  className,
}: {
  left: React.ReactNode;
  right: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-between gap-2 border-b border-[var(--border-subtle)] bg-[var(--surface-2)] px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-[var(--text-muted)]",
        className,
      )}
    >
      <span>{left}</span>
      <span>{right}</span>
    </div>
  );
}

/** A selectable row in a master list. */
export function ListRow({
  selected,
  onSelect,
  primary,
  secondary,
  trailing,
  actions,
  className,
}: {
  selected: boolean;
  onSelect: () => void;
  primary: React.ReactNode;
  secondary?: React.ReactNode;
  trailing?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "group/row relative flex items-center gap-2 border-b border-[var(--border-subtle)] px-4 transition-colors",
        selected ? "bg-brand-50 dark:bg-brand-950/50" : "hover:bg-[var(--surface-2)]",
        className,
      )}
    >
      {selected ? (
        <span className="absolute inset-y-0 left-0 w-[3px] bg-brand-600" aria-hidden />
      ) : null}
      <button
        type="button"
        onClick={onSelect}
        className="flex min-w-0 flex-1 items-center justify-between gap-3 py-3 text-left"
        aria-current={selected || undefined}
      >
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13.5px]">{primary}</span>
          {secondary ? (
            <span className="mt-0.5 block truncate text-[12px] text-[var(--text-muted)]">
              {secondary}
            </span>
          ) : null}
        </span>
        {trailing ? <span className="shrink-0 text-[13px]">{trailing}</span> : null}
      </button>
      {actions ? (
        <span className="shrink-0 opacity-0 transition-opacity focus-within:opacity-100 group-hover/row:opacity-100">
          {actions}
        </span>
      ) : null}
    </div>
  );
}
