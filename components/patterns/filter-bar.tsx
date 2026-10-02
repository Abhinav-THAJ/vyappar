"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { CalendarDays } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTriggerPill,
  SelectValue,
} from "@/components/ui/select";
import { toDateInputValue } from "@/lib/format/date";
import {
  PERIOD_LABELS,
  PERIOD_PRESETS,
  isPeriodPreset,
  resolvePeriod,
  type PeriodPreset,
} from "@/lib/filters";
import { cn } from "@/lib/utils";

export interface FirmOption {
  id: string;
  name: string;
}

export interface UserOption {
  id: string;
  name: string;
}

/**
 * The transaction-list filter bar: period preset, explicit date range, firm and
 * user. Rendered in one pill treatment everywhere (D-12).
 *
 * All state lives in the URL, so a filtered list is linkable, survives a reload
 * and is read on the server for the initial render.
 */
export function FilterBar({
  firms,
  users,
  showFirm = true,
  showUser = true,
  fyStartMonth,
  extra,
  className,
}: {
  firms?: FirmOption[];
  users?: UserOption[];
  showFirm?: boolean;
  showUser?: boolean;
  fyStartMonth: number;
  extra?: React.ReactNode;
  className?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const preset: PeriodPreset = isPeriodPreset(params.get("period"))
    ? (params.get("period") as PeriodPreset)
    : "this-month";

  const resolved = React.useMemo(
    () =>
      resolvePeriod(preset, fyStartMonth, {
        from: params.get("from") ? new Date(params.get("from")!) : undefined,
        to: params.get("to") ? new Date(params.get("to")!) : undefined,
      }),
    [preset, fyStartMonth, params],
  );

  const update = React.useCallback(
    (patch: Record<string, string | null>) => {
      const next = new URLSearchParams(params.toString());
      for (const [key, value] of Object.entries(patch)) {
        if (value === null || value === "") next.delete(key);
        else next.set(key, value);
      }
      // Any filter change resets pagination.
      next.delete("page");
      router.replace(`${pathname}?${next.toString()}`, { scroll: false });
    },
    [params, pathname, router],
  );

  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-2 border-b border-[var(--border-subtle)] bg-[var(--surface)] px-4 py-3 sm:px-6",
        className,
      )}
    >
      <span className="mr-1 text-[13px] text-[var(--text-muted)]">Filter by :</span>

      <Select
        value={preset}
        onValueChange={(v) => {
          if (v === "custom") {
            update({
              period: v,
              from: toDateInputValue(resolved.from),
              to: toDateInputValue(resolved.to),
            });
          } else {
            update({ period: v, from: null, to: null });
          }
        }}
      >
        <SelectTriggerPill aria-label="Period">
          <SelectValue>{PERIOD_LABELS[preset]}</SelectValue>
        </SelectTriggerPill>
        <SelectContent>
          {PERIOD_PRESETS.map((p) => (
            <SelectItem key={p} value={p}>
              {PERIOD_LABELS[p]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Explicit range. Editing a date switches the preset to Custom. */}
      <div className="inline-flex h-9 items-center gap-1.5 rounded-full bg-[var(--surface-3)] px-3 text-[13px]">
        <CalendarDays className="size-4 shrink-0 text-[var(--text-muted)]" />
        <input
          type="date"
          aria-label="From date"
          value={toDateInputValue(resolved.from)}
          onChange={(e) => update({ period: "custom", from: e.target.value })}
          className="w-[118px] bg-transparent outline-none"
        />
        <span className="text-[var(--text-muted)]">To</span>
        <input
          type="date"
          aria-label="To date"
          value={toDateInputValue(resolved.to)}
          onChange={(e) => update({ period: "custom", to: e.target.value })}
          className="w-[118px] bg-transparent outline-none"
        />
      </div>

      {showFirm && firms && firms.length > 1 ? (
        <Select
          value={params.get("firmId") ?? "all"}
          onValueChange={(v) => update({ firmId: v === "all" ? null : v })}
        >
          <SelectTriggerPill aria-label="Firm">
            <SelectValue>
              {params.get("firmId")
                ? (firms.find((f) => f.id === params.get("firmId"))?.name ?? "All Firms")
                : "All Firms"}
            </SelectValue>
          </SelectTriggerPill>
          <SelectContent>
            <SelectItem value="all">All Firms</SelectItem>
            {firms.map((f) => (
              <SelectItem key={f.id} value={f.id}>
                {f.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : null}

      {showUser && users && users.length > 1 ? (
        <Select
          value={params.get("userId") ?? "all"}
          onValueChange={(v) => update({ userId: v === "all" ? null : v })}
        >
          <SelectTriggerPill aria-label="User">
            <SelectValue>
              {params.get("userId")
                ? (users.find((u) => u.id === params.get("userId"))?.name ?? "All Users")
                : "All Users"}
            </SelectValue>
          </SelectTriggerPill>
          <SelectContent>
            <SelectItem value="all">All Users</SelectItem>
            {users.map((u) => (
              <SelectItem key={u.id} value={u.id}>
                {u.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : null}

      {extra}
    </div>
  );
}

// Note: readFilterParams deliberately lives in lib/filters and is NOT re-exported
// here. Anything exported from a "use client" module becomes a client reference,
// so a server component importing it through this file would crash at request
// time. Import it from "@/lib/filters" instead.
