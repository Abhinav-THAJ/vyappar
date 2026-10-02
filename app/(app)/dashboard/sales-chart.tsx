"use client";

import * as React from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatCurrency, indianGroup } from "@/lib/format/number";
import { formatDate } from "@/lib/format/date";
import { toZonedTime } from "date-fns-tz";
import { format } from "date-fns";
import { IST } from "@/lib/format/date";

/**
 * The dashboard sales curve (ref-01): a smooth area chart with daily ticks and
 * a compact Indian-grouped Y axis (200k / 400k / 600k).
 */
export function SalesChart({ data }: { data: { date: string; total: number }[] }) {
  const points = React.useMemo(
    () =>
      data.map((d) => ({
        date: d.date,
        label: format(toZonedTime(new Date(d.date), IST), "d MMM"),
        total: d.total,
      })),
    [data],
  );

  if (points.length === 0) {
    return (
      <div className="flex h-[280px] items-center justify-center rounded-lg bg-[var(--surface-2)] text-[13px] text-[var(--text-muted)]">
        No sales recorded in this period.
      </div>
    );
  }

  return (
    <div className="h-[280px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={points} margin={{ top: 8, right: 8, bottom: 0, left: 8 }}>
          <defs>
            <linearGradient id="salesFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--color-brand-500)" stopOpacity={0.28} />
              <stop offset="100%" stopColor="var(--color-brand-500)" stopOpacity={0.02} />
            </linearGradient>
          </defs>

          <CartesianGrid
            stroke="var(--border-subtle)"
            strokeDasharray="0"
            vertical={false}
          />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 11, fill: "var(--text-muted)" }}
            tickLine={false}
            axisLine={false}
            minTickGap={24}
          />
          <YAxis
            tick={{ fontSize: 11, fill: "var(--text-muted)" }}
            tickLine={false}
            axisLine={false}
            width={52}
            tickFormatter={compactInr}
          />
          <Tooltip
            cursor={{ stroke: "var(--color-brand-400)", strokeWidth: 1 }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const point = payload[0]?.payload as { date: string; total: number } | undefined;
              if (!point) return null;
              return (
                <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface)] px-3 py-2 text-[12px] shadow-lg">
                  <div className="text-[var(--text-muted)]">{formatDate(point.date)}</div>
                  <div className="tnum mt-0.5 font-semibold">{formatCurrency(point.total)}</div>
                </div>
              );
            }}
          />
          <Area
            type="monotone"
            dataKey="total"
            stroke="var(--color-brand-500)"
            strokeWidth={2}
            fill="url(#salesFill)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

/** "800k", "1.2Cr" — compact axis labels in Indian scale units. */
function compactInr(value: number): string {
  if (value === 0) return "0";
  const abs = Math.abs(value);
  if (abs >= 10000000) return `${(value / 10000000).toFixed(abs >= 100000000 ? 0 : 1)}Cr`;
  if (abs >= 100000) return `${(value / 100000).toFixed(abs >= 1000000 ? 0 : 1)}L`;
  if (abs >= 1000) return `${Math.round(value / 1000)}k`;
  return indianGroup(String(Math.round(value)));
}
