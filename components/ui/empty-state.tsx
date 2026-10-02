import * as React from "react";
import { FileText, Inbox, SearchX, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

type EmptyTone = "empty" | "search" | "error";

const ICONS: Record<EmptyTone, React.ElementType> = {
  empty: Inbox,
  search: SearchX,
  error: AlertTriangle,
};

/**
 * The canonical empty state seen on Purchase Bills, Payment-Out and Expenses:
 * a soft illustration tile, a headline, a sub-line and a primary action.
 * Our illustration is an original composition of lucide glyphs, not a copy.
 */
export function EmptyState({
  title,
  description,
  action,
  tone = "empty",
  className,
  compact = false,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  tone?: EmptyTone;
  className?: string;
  compact?: boolean;
}) {
  const Icon = ICONS[tone];

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center px-6 text-center",
        compact ? "py-10" : "py-20",
        className,
      )}
    >
      <div
        className={cn(
          "relative mb-5 flex items-center justify-center rounded-2xl",
          compact ? "size-16" : "size-24",
          tone === "error"
            ? "bg-[var(--color-negative-soft)]"
            : "bg-brand-50 dark:bg-brand-950/60",
        )}
        aria-hidden
      >
        <Icon
          className={cn(
            compact ? "size-7" : "size-10",
            tone === "error" ? "text-[var(--color-negative)]" : "text-brand-500",
          )}
          strokeWidth={1.5}
        />
        {tone === "empty" ? (
          <>
            <FileText
              className="absolute -right-1 -top-1 size-5 rotate-12 text-brand-300"
              strokeWidth={1.5}
            />
            <FileText
              className="absolute -bottom-1 -left-1 size-4 -rotate-12 text-brand-200"
              strokeWidth={1.5}
            />
          </>
        ) : null}
      </div>

      <h3 className={cn("font-semibold", compact ? "text-sm" : "text-base")}>{title}</h3>
      {description ? (
        <p className="mt-1.5 max-w-sm text-[13px] leading-relaxed text-[var(--text-muted)]">
          {description}
        </p>
      ) : null}
      {action ? <div className="mt-6">{action}</div> : null}
    </div>
  );
}
