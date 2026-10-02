"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Download, FileJson, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/display";
import { EmptyState } from "@/components/ui/empty-state";
import { Table, THead, TBody, TR, TH, TD, TRMessage } from "@/components/ui/table";
import { Combobox, type ComboboxOption } from "@/components/forms/combobox";
import { formatCurrency, formatNumber, formatQty, formatPercent } from "@/lib/format/number";
import { formatDate } from "@/lib/format/date";
import { searchPartiesAction } from "@/server/actions/parties";
import { searchItemsAction } from "@/server/actions/items";
import type { ReportColumn, ReportResult } from "@/server/services/reports/types";
import { cn } from "@/lib/utils";

/** Render one report: summary chips, filters, table, totals and exports. */
export function ReportView({
  slug,
  title,
  description,
  columns,
  result,
  partyFilter,
  itemFilter,
  requiresFirm,
  firms,
  activeFirmId,
  isGstr1,
}: {
  slug: string;
  title: string;
  description: string;
  columns: ReportColumn[];
  result: ReportResult;
  partyFilter: boolean;
  itemFilter: boolean;
  requiresFirm: boolean;
  firms: { id: string; name: string }[];
  activeFirmId: string | null;
  isGstr1: boolean;
}) {
  const router = useRouter();
  const params = useSearchParams();

  const searchParties = React.useCallback(async (query: string): Promise<ComboboxOption[]> => {
    const rows = await searchPartiesAction(query);
    return rows.map((r) => ({ value: r.id, label: r.name, hint: r.phone ?? undefined }));
  }, []);

  const searchItems = React.useCallback(async (query: string): Promise<ComboboxOption[]> => {
    const rows = await searchItemsAction(query);
    return rows.map((r) => ({ value: r.id, label: r.name, hint: r.sku ?? undefined }));
  }, []);

  function setParam(key: string, value: string | null) {
    const next = new URLSearchParams(params.toString());
    if (value === null) next.delete(key);
    else next.set(key, value);
    router.replace(`/reports/${slug}?${next.toString()}`, { scroll: false });
  }

  const exportHref = `/api/export/report?slug=${encodeURIComponent(slug)}&${params.toString()}`;
  const jsonHref = `/api/export/gstr1?${params.toString()}`;

  return (
    <div className="space-y-4 p-4 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
          <p className="mt-0.5 text-[13px] text-[var(--text-muted)]">{description}</p>
        </div>

        <div className="flex items-center gap-2">
          {isGstr1 ? (
            <Button asChild variant="outline" size="sm">
              <a href={jsonHref} download>
                <FileJson className="size-4" />
                GSTR-1 JSON
              </a>
            </Button>
          ) : null}
          <Button asChild variant="outline" size="sm">
            <a href={exportHref} download>
              <Download className="size-4" />
              Excel
            </a>
          </Button>
          <Button size="sm" onClick={() => window.print()}>
            <Printer className="size-4" />
            Print
          </Button>
        </div>
      </div>

      {/* Report-specific filters */}
      {partyFilter || itemFilter || (requiresFirm && firms.length > 1) ? (
        <div className="no-print flex flex-wrap items-end gap-3 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface)] p-3">
          {requiresFirm && firms.length > 1 ? (
            <div className="min-w-[200px]">
              <label
                htmlFor="reportFirm"
                className="mb-1 block text-[12px] font-medium text-[var(--text-secondary)]"
              >
                Firm (required)
              </label>
              <select
                id="reportFirm"
                value={activeFirmId ?? ""}
                onChange={(e) => setParam("firmId", e.target.value || null)}
                className="h-9 w-full rounded-lg border border-[var(--border-strong)] bg-[var(--surface)] px-3 text-sm"
              >
                {firms.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </select>
            </div>
          ) : null}

          {partyFilter ? (
            <div className="min-w-[220px]">
              <label className="mb-1 block text-[12px] font-medium text-[var(--text-secondary)]">
                Party
              </label>
              <Combobox
                value={
                  params.get("partyId")
                    ? { value: params.get("partyId")!, label: params.get("partyName") ?? "Selected party" }
                    : null
                }
                onChange={(option) => {
                  const next = new URLSearchParams(params.toString());
                  next.set("partyId", option.value);
                  next.set("partyName", option.label);
                  router.replace(`/reports/${slug}?${next.toString()}`, { scroll: false });
                }}
                onSearch={searchParties}
                placeholder="All parties"
              />
            </div>
          ) : null}

          {itemFilter ? (
            <div className="min-w-[220px]">
              <label className="mb-1 block text-[12px] font-medium text-[var(--text-secondary)]">
                Item
              </label>
              <Combobox
                value={
                  params.get("itemId")
                    ? { value: params.get("itemId")!, label: params.get("itemName") ?? "Selected item" }
                    : null
                }
                onChange={(option) => {
                  const next = new URLSearchParams(params.toString());
                  next.set("itemId", option.value);
                  next.set("itemName", option.label);
                  router.replace(`/reports/${slug}?${next.toString()}`, { scroll: false });
                }}
                onSearch={searchItems}
                placeholder="All items"
              />
            </div>
          ) : null}

          {params.get("partyId") || params.get("itemId") ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                const next = new URLSearchParams(params.toString());
                for (const k of ["partyId", "partyName", "itemId", "itemName"]) next.delete(k);
                router.replace(`/reports/${slug}?${next.toString()}`, { scroll: false });
              }}
            >
              Clear
            </Button>
          ) : null}
        </div>
      ) : null}

      {/* Summary */}
      {result.summary && result.summary.length > 0 ? (
        <div className="flex flex-wrap gap-3">
          {result.summary.map((chip) => (
            <div key={chip.label} className="surface-card min-w-[160px] px-4 py-3">
              <div className="text-[12px] text-[var(--text-muted)]">{chip.label}</div>
              <div
                className={cn(
                  "tnum mt-0.5 text-[17px] font-semibold",
                  chip.tone === "positive" && "text-[var(--color-positive)]",
                  chip.tone === "negative" && "text-[var(--color-negative)]",
                )}
              >
                {chip.value}
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {result.note ? (
        <p className="rounded-lg bg-[var(--surface-3)] px-3 py-2 text-[12px] text-[var(--text-secondary)]">
          {result.note}
        </p>
      ) : null}

      {/* Table */}
      <div className="surface-card overflow-hidden">
        <Table>
          <THead>
            <TR className="hover:bg-transparent">
              {columns.map((col) => (
                <TH key={col.key} align={col.align ?? "left"} className={cn(col.secondary && "hidden md:table-cell")}>
                  {col.label}
                </TH>
              ))}
            </TR>
          </THead>

          <TBody>
            {result.rows.length === 0 ? (
              <TRMessage colSpan={columns.length}>
                <EmptyState
                  title="Nothing to report"
                  description="No data matches these filters. Try a wider date range."
                />
              </TRMessage>
            ) : (
              result.rows.map((row, i) => (
                <TR key={row._id ?? i} className={cn(row._group === "Result" && "font-semibold")}>
                  {columns.map((col) => (
                    <TD
                      key={col.key}
                      align={col.align ?? "left"}
                      numeric={col.format === "money" || col.format === "qty" || col.format === "number"}
                      className={cn(col.secondary && "hidden md:table-cell")}
                    >
                      {formatCell(row[col.key], col)}
                    </TD>
                  ))}
                </TR>
              ))
            )}
          </TBody>

          {result.totals && result.rows.length > 0 ? (
            <tfoot className="border-t-2 border-[var(--border-strong)] bg-[var(--surface-2)]">
              <tr>
                {columns.map((col, i) => (
                  <TD
                    key={col.key}
                    align={col.align ?? "left"}
                    numeric={col.total}
                    className={cn("font-semibold", col.secondary && "hidden md:table-cell")}
                  >
                    {i === 0
                      ? "Total"
                      : col.total && result.totals?.[col.key] !== undefined
                        ? formatCell(result.totals[col.key] ?? 0, col)
                        : ""}
                  </TD>
                ))}
              </tr>
            </tfoot>
          ) : null}
        </Table>
      </div>
    </div>
  );
}

function formatCell(value: unknown, col: ReportColumn): React.ReactNode {
  if (value === null || value === undefined || value === "") return "—";

  switch (col.format) {
    case "money":
      return formatCurrency(Number(value));
    case "qty":
      return formatQty(String(value));
    case "percent":
      return formatPercent(Number(value), 2);
    case "number":
      return formatNumber(Number(value), { decimals: 0 });
    case "date":
      return formatDate(String(value));
    default: {
      const text = String(value);
      // Badge the supply type so intra vs inter reads at a glance.
      if (text === "Inter-state") return <Badge variant="warning">Inter-state</Badge>;
      if (text === "Intra-state") return <Badge variant="brand">Intra-state</Badge>;
      return text;
    }
  }
}
