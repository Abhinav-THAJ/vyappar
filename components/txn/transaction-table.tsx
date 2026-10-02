"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  ChevronLeft,
  ChevronRight,
  FileSpreadsheet,
  MoreVertical,
  Pencil,
  Printer,
  Search,
  Share2,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/display";
import { EmptyState } from "@/components/ui/empty-state";
import { Table, THead, TBody, TR, TH, TD, TRMessage } from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/menu";
import { formatCurrency } from "@/lib/format/number";
import { formatDate } from "@/lib/format/date";
import type { TransactionRow } from "@/server/services/transactions";
import { cn } from "@/lib/utils";

const PAYMENT_LABELS: Record<string, string> = {
  CASH: "Cash",
  CHEQUE: "Cheque",
  BANK: "Bank",
  UPI: "UPI",
  CARD: "Card",
  NEFT: "NEFT",
  OTHER: "Other",
};

const TYPE_LABELS: Record<string, string> = {
  SALE: "Sale",
  SALE_RETURN: "Credit Note",
  ESTIMATE: "Estimate",
  PROFORMA: "Proforma",
  SALE_ORDER: "Sale Order",
  DELIVERY_CHALLAN: "Delivery Challan",
  PAYMENT_IN: "Payment-In",
  PURCHASE: "Purchase",
  PURCHASE_RETURN: "Debit Note",
  PURCHASE_ORDER: "Purchase Order",
  PAYMENT_OUT: "Payment-Out",
  EXPENSE: "Expense",
};

/**
 * The transaction table from ref-04: search, export and print in a toolbar,
 * sortable columns, a row action cluster, and server-side pagination so the
 * screen stays fast at 10,000+ rows.
 */
export function TransactionTable({
  rows,
  total,
  page,
  pageSize,
  emptyTitle,
  emptyDescription,
  createHref,
  createLabel,
  basePath,
  showParty = true,
  showFirm = false,
}: {
  rows: TransactionRow[];
  total: number;
  page: number;
  pageSize: number;
  emptyTitle: string;
  emptyDescription: string;
  createHref?: string;
  createLabel?: string;
  basePath: string;
  showParty?: boolean;
  showFirm?: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [query, setQuery] = React.useState(params.get("q") ?? "");

  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const columnCount = 7 + (showParty ? 1 : 0) + (showFirm ? 1 : 0);

  const update = React.useCallback(
    (patch: Record<string, string | null>) => {
      const next = new URLSearchParams(params.toString());
      for (const [k, v] of Object.entries(patch)) {
        if (v === null || v === "") next.delete(k);
        else next.set(k, v);
      }
      router.replace(`${pathname}?${next.toString()}`, { scroll: false });
    },
    [params, pathname, router],
  );

  // Debounce the search so typing does not fire a request per keystroke.
  React.useEffect(() => {
    const current = params.get("q") ?? "";
    if (query === current) return;
    const timer = setTimeout(() => update({ q: query || null, page: null }), 300);
    return () => clearTimeout(timer);
  }, [query, params, update]);

  function toggleSort(field: string) {
    const currentSort = params.get("sort") ?? "date";
    const currentDir = params.get("dir") ?? "desc";
    const dir = currentSort === field && currentDir === "desc" ? "asc" : "desc";
    update({ sort: field, dir });
  }

  const sort = params.get("sort") ?? "date";
  const dir = params.get("dir") ?? "desc";

  return (
    <div className="surface-card flex min-h-0 flex-col overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border-subtle)] p-3">
        <h2 className="text-[15px] font-semibold">Transactions</h2>

        <div className="flex items-center gap-2">
          <div className="relative w-full sm:w-64">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--text-muted)]" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search"
              aria-label="Search transactions"
              className="pl-9"
            />
          </div>
          <button
            type="button"
            className="grid size-9 place-items-center rounded-lg text-[var(--color-positive)] transition-colors hover:bg-[var(--surface-3)]"
            aria-label="Export to Excel"
            title="Export to Excel"
            onClick={() => router.push(`/api/export/transactions?${params.toString()}`)}
          >
            <FileSpreadsheet className="size-[18px]" />
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="grid size-9 place-items-center rounded-lg text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-3)]"
            aria-label="Print"
            title="Print"
          >
            <Printer className="size-[18px]" />
          </button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-auto">
        <Table>
          <THead>
            <TR className="hover:bg-transparent">
              <SortableTH field="date" label="Date" sort={sort} dir={dir} onSort={toggleSort} />
              <SortableTH field="number" label="Invoice no" sort={sort} dir={dir} onSort={toggleSort} />
              {showParty ? <TH>Party Name</TH> : null}
              {showFirm ? <TH>Firm</TH> : null}
              <TH>Transaction</TH>
              <TH>Payment Type</TH>
              <SortableTH field="total" label="Amount" sort={sort} dir={dir} onSort={toggleSort} align="right" />
              <SortableTH field="balance" label="Balance" sort={sort} dir={dir} onSort={toggleSort} align="right" />
              <TH align="right">Actions</TH>
            </TR>
          </THead>

          <TBody>
            {rows.length === 0 ? (
              <TRMessage colSpan={columnCount}>
                <EmptyState
                  title={emptyTitle}
                  description={emptyDescription}
                  action={
                    createHref && createLabel ? (
                      <Button asChild>
                        <Link href={createHref}>{createLabel}</Link>
                      </Button>
                    ) : undefined
                  }
                />
              </TRMessage>
            ) : (
              rows.map((row) => (
                <TR key={row.id}>
                  <TD className="whitespace-nowrap">{formatDate(row.date)}</TD>
                  <TD className="whitespace-nowrap font-medium">{row.displayNumber}</TD>
                  {showParty ? (
                    <TD className="max-w-[220px]">
                      <span className="block truncate">{row.partyName ?? "—"}</span>
                    </TD>
                  ) : null}
                  {showFirm ? <TD className="max-w-[160px] truncate">{row.firmName}</TD> : null}
                  <TD className="whitespace-nowrap">
                    {TYPE_LABELS[row.type] ?? row.type}
                    {row.isOverdue ? (
                      <Badge variant="negative" className="ml-2">
                        Overdue
                      </Badge>
                    ) : null}
                  </TD>
                  <TD className="whitespace-nowrap text-[var(--text-secondary)]">
                    {row.paymentMode ? (PAYMENT_LABELS[row.paymentMode] ?? row.paymentMode) : "—"}
                  </TD>
                  <TD align="right" numeric className="whitespace-nowrap font-medium">
                    {formatCurrency(row.total)}
                  </TD>
                  <TD
                    align="right"
                    numeric
                    className={cn(
                      "whitespace-nowrap",
                      Number(row.balanceAmount) > 0
                        ? "text-[var(--color-negative)]"
                        : "text-[var(--text-muted)]",
                    )}
                  >
                    {formatCurrency(row.balanceAmount)}
                  </TD>
                  <TD align="right">
                    <div className="flex items-center justify-end gap-0.5">
                      <Link
                        href={`/print/${row.id}`}
                        className="grid size-8 place-items-center rounded-md text-[var(--text-muted)] transition-colors hover:bg-[var(--surface-3)] hover:text-[var(--text-primary)]"
                        aria-label={`Print ${row.displayNumber}`}
                      >
                        <Printer className="size-4" />
                      </Link>
                      <Link
                        href={`/print/${row.id}?share=1`}
                        className="grid size-8 place-items-center rounded-md text-[var(--text-muted)] transition-colors hover:bg-[var(--surface-3)] hover:text-[var(--text-primary)]"
                        aria-label={`Share ${row.displayNumber}`}
                      >
                        <Share2 className="size-4" />
                      </Link>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button
                            type="button"
                            className="grid size-8 place-items-center rounded-md text-[var(--text-muted)] transition-colors hover:bg-[var(--surface-3)]"
                            aria-label={`More actions for ${row.displayNumber}`}
                          >
                            <MoreVertical className="size-4" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48">
                          <DropdownMenuItem onSelect={() => router.push(`${basePath}/${row.id}`)}>
                            View
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onSelect={() => router.push(`${basePath}/${row.id}/edit`)}
                          >
                            <Pencil />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onSelect={() => router.push(`${basePath}/new?duplicate=${row.id}`)}
                          >
                            Duplicate
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            destructive
                            onSelect={() => router.push(`${basePath}/${row.id}?delete=1`)}
                          >
                            <Trash2 />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </TD>
                </TR>
              ))
            )}
          </TBody>
        </Table>
      </div>

      {total > pageSize ? (
        <div className="flex items-center justify-between gap-3 border-t border-[var(--border-subtle)] px-4 py-3 text-[13px]">
          <span className="text-[var(--text-muted)]">
            {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)} of {total}
          </span>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="iconSm"
              disabled={page <= 1}
              onClick={() => update({ page: String(page - 1) })}
              aria-label="Previous page"
            >
              <ChevronLeft className="size-4" />
            </Button>
            <span className="px-2 tabular-nums">
              {page} / {pageCount}
            </span>
            <Button
              variant="outline"
              size="iconSm"
              disabled={page >= pageCount}
              onClick={() => update({ page: String(page + 1) })}
              aria-label="Next page"
            >
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function SortableTH({
  field,
  label,
  sort,
  dir,
  onSort,
  align = "left",
}: {
  field: string;
  label: string;
  sort: string;
  dir: string;
  onSort: (field: string) => void;
  align?: "left" | "right";
}) {
  const active = sort === field;
  // aria-sort belongs on the header cell itself, not on the button inside it.
  return (
    <TH align={align} aria-sort={active ? (dir === "asc" ? "ascending" : "descending") : "none"}>
      <button
        type="button"
        onClick={() => onSort(field)}
        className={cn(
          "inline-flex items-center gap-1 uppercase transition-colors hover:text-[var(--text-primary)]",
          active && "text-[var(--text-primary)]",
        )}
      >
        {label}
        {active ? <span aria-hidden>{dir === "asc" ? "↑" : "↓"}</span> : null}
      </button>
    </TH>
  );
}
