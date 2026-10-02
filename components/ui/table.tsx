import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Bare table elements styled to the reference tables: uppercase column
 * headers, a hairline under the header, hoverable rows, tabular figures in
 * every numeric cell.
 */

export function Table({ className, ...props }: React.HTMLAttributes<HTMLTableElement>) {
  return (
    <div className="w-full overflow-x-auto">
      <table className={cn("w-full caption-bottom border-collapse text-sm", className)} {...props} />
    </div>
  );
}

export function THead({ className, ...props }: React.HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <thead
      className={cn("border-b border-[var(--border-subtle)] bg-[var(--surface-2)]", className)}
      {...props}
    />
  );
}

export function TBody({ className, ...props }: React.HTMLAttributes<HTMLTableSectionElement>) {
  return <tbody className={cn("divide-y divide-[var(--border-subtle)]", className)} {...props} />;
}

export function TR({ className, ...props }: React.HTMLAttributes<HTMLTableRowElement>) {
  return (
    <tr
      className={cn("transition-colors hover:bg-[var(--surface-2)] data-[selected=true]:bg-brand-50/60 dark:data-[selected=true]:bg-brand-950/40", className)}
      {...props}
    />
  );
}

export function TH({
  className,
  align = "left",
  ...props
}: React.ThHTMLAttributes<HTMLTableCellElement> & { align?: "left" | "right" | "center" }) {
  return (
    <th
      scope="col"
      className={cn(
        "whitespace-nowrap px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-[var(--text-muted)]",
        align === "right" && "text-right",
        align === "center" && "text-center",
        align === "left" && "text-left",
        className,
      )}
      {...props}
    />
  );
}

export function TD({
  className,
  align = "left",
  numeric = false,
  ...props
}: React.TdHTMLAttributes<HTMLTableCellElement> & {
  align?: "left" | "right" | "center";
  numeric?: boolean;
}) {
  return (
    <td
      className={cn(
        "px-4 py-3 align-middle",
        align === "right" && "text-right",
        align === "center" && "text-center",
        numeric && "tnum",
        className,
      )}
      {...props}
    />
  );
}

/** A full-width row used for loading, empty and error states inside a table. */
export function TRMessage({ colSpan, children }: { colSpan: number; children: React.ReactNode }) {
  return (
    <tr>
      <td colSpan={colSpan} className="p-0">
        {children}
      </td>
    </tr>
  );
}
