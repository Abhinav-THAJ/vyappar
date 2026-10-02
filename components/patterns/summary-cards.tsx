import * as React from "react";
import { ArrowDown, ArrowUp, TrendingUp } from "lucide-react";
import { formatCurrency, formatPercent } from "@/lib/format/number";
import { cn } from "@/lib/utils";

/**
 * The "Total Receivable" / "Total Payable" pair from the dashboard: a large
 * figure, a sub-line, and a circular directional badge.
 */
export function KpiCard({
  label,
  amount,
  sub,
  direction,
  href,
  decimals = 0,
}: {
  label: string;
  amount: number | string;
  sub?: React.ReactNode;
  direction: "in" | "out";
  href?: string;
  decimals?: number;
}) {
  const Wrapper = href ? "a" : "div";

  return (
    <Wrapper
      {...(href ? { href } : {})}
      className={cn(
        "surface-card flex items-start justify-between gap-4 p-5",
        href && "transition-colors hover:bg-[var(--surface-2)]",
      )}
    >
      <div className="min-w-0">
        <div className="text-[13px] text-[var(--text-secondary)]">{label}</div>
        <div className="tnum mt-1.5 text-2xl font-semibold tracking-tight sm:text-[28px]">
          {formatCurrency(amount, { decimals })}
        </div>
        {sub ? <div className="mt-1.5 text-[13px] text-[var(--text-muted)]">{sub}</div> : null}
      </div>

      <span
        className={cn(
          "grid size-10 shrink-0 place-items-center rounded-full",
          direction === "in"
            ? "bg-[var(--color-positive-soft)] text-[var(--color-positive)]"
            : "bg-[var(--color-negative-soft)] text-[var(--color-negative)]",
        )}
        aria-hidden
      >
        {direction === "in" ? <ArrowDown className="size-5" /> : <ArrowUp className="size-5" />}
      </span>
    </Wrapper>
  );
}

/**
 * The list-screen summary: a headline total, a period-over-period chip, and an
 * optional received/balance split (ref-04).
 */
export function ListSummaryCard({
  label,
  total,
  changePercent,
  splits,
  className,
}: {
  label: string;
  total: number | string;
  changePercent?: number | null;
  splits?: { label: string; value: number | string }[];
  className?: string;
}) {
  const positive = (changePercent ?? 0) >= 0;

  return (
    <div className={cn("surface-card inline-flex min-w-[280px] flex-col gap-2 p-5", className)}>
      <div className="flex items-start justify-between gap-6">
        <div>
          <div className="text-[13px] text-[var(--text-secondary)]">{label}</div>
          <div className="tnum mt-1 text-2xl font-semibold tracking-tight">
            {formatCurrency(total)}
          </div>
        </div>

        {changePercent !== undefined ? (
          <span
            className={cn(
              "inline-flex shrink-0 flex-col items-end rounded-lg px-2 py-1 text-right",
              changePercent === null
                ? "text-[var(--text-muted)]"
                : positive
                  ? "bg-[var(--color-positive-soft)] text-[var(--color-positive)]"
                  : "bg-[var(--color-negative-soft)] text-[var(--color-negative)]",
            )}
          >
            <span className="inline-flex items-center gap-1 text-[13px] font-semibold">
              {changePercent === null ? "—" : formatPercent(changePercent)}
              {changePercent !== null ? <TrendingUp className="size-3.5" /> : null}
            </span>
            <span className="text-[11px] opacity-80">vs last period</span>
          </span>
        ) : null}
      </div>

      {splits && splits.length > 0 ? (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-[var(--border-subtle)] pt-2 text-[13px]">
          {splits.map((s) => (
            <span key={s.label} className="text-[var(--text-secondary)]">
              {s.label}: <span className="tnum font-medium">{formatCurrency(s.value)}</span>
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}

/**
 * The paid + unpaid = total equation on Purchase Bills (ref-05).
 */
export function EquationChips({
  parts,
}: {
  parts: { label: string; value: number | string; tone: "positive" | "info" | "total" }[];
}) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      {parts.map((part, i) => (
        <React.Fragment key={part.label}>
          {i > 0 ? (
            <span className="text-lg text-[var(--text-muted)]">{i === parts.length - 1 ? "=" : "+"}</span>
          ) : null}
          <div
            className={cn(
              "min-w-[150px] rounded-lg px-4 py-3",
              part.tone === "positive" && "bg-[var(--color-positive-soft)]",
              part.tone === "info" && "bg-brand-50 dark:bg-brand-950/60",
              part.tone === "total" && "bg-[var(--color-warning-soft)]",
            )}
          >
            <div className="text-[13px] text-[var(--text-secondary)]">{part.label}</div>
            <div className="tnum mt-0.5 text-lg font-semibold">{formatCurrency(part.value)}</div>
          </div>
        </React.Fragment>
      ))}
    </div>
  );
}
