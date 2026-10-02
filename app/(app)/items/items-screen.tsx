"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  AlertTriangle,
  ChevronDown,
  FileSpreadsheet,
  MoreVertical,
  Plus,
  Search,
  Share2,
  SlidersHorizontal,
  Upload,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge, Money } from "@/components/ui/display";
import { EmptyState } from "@/components/ui/empty-state";
import { Table, THead, TBody, TR, TH, TD, TRMessage } from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/menu";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MasterDetail, ListColumns, ListRow } from "@/components/patterns/master-detail";
import { formatCurrency, formatQty } from "@/lib/format/number";
import { formatDate } from "@/lib/format/date";
import type { ItemListRow, ItemDetail } from "@/server/services/items";
import { cn } from "@/lib/utils";

const TYPE_LABELS: Record<string, string> = {
  SALE: "Sale",
  SALE_RETURN: "Credit Note",
  ESTIMATE: "Estimate",
  PROFORMA: "Proforma",
  SALE_ORDER: "Sale Order",
  DELIVERY_CHALLAN: "Delivery Challan",
  PURCHASE: "Purchase",
  PURCHASE_RETURN: "Debit Note",
  PURCHASE_ORDER: "Purchase Order",
};

interface ItemTransaction {
  id: string;
  transactionId: string;
  type: string;
  displayNumber: string;
  date: string;
  partyName: string | null;
  qty: string;
  rate: string;
  amount: string;
  status: string;
}

/** Items screen (ref-03): tabbed master-detail over products, services, categories and units. */
export function ItemsScreen({
  tab,
  products,
  services,
  categories,
  units,
  detail,
  transactions,
  canWrite,
}: {
  tab: string;
  products: ItemListRow[];
  services: ItemListRow[];
  categories: { id: string; name: string; itemCount: number }[];
  units: { id: string; name: string; shortName: string }[];
  detail: ItemDetail | null;
  transactions: ItemTransaction[];
  canWrite: boolean;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [query, setQuery] = React.useState("");

  const rows = tab === "services" ? services : products;

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (i) =>
        i.name.toLowerCase().includes(q) ||
        i.sku?.toLowerCase().includes(q) ||
        i.hsnSac?.includes(q),
    );
  }, [rows, query]);

  function go(patch: Record<string, string | null>) {
    const next = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v === null) next.delete(k);
      else next.set(k, v);
    }
    router.replace(`/items?${next.toString()}`, { scroll: false });
  }

  return (
    <div className="flex min-h-full flex-col">
      <Tabs value={tab} onValueChange={(v) => go({ tab: v, id: null })}>
        <TabsList>
          <TabsTrigger value="products">Products</TabsTrigger>
          <TabsTrigger value="services">Services</TabsTrigger>
          <TabsTrigger value="categories">Category</TabsTrigger>
          <TabsTrigger value="units">Units</TabsTrigger>
        </TabsList>
      </Tabs>

      {tab === "categories" ? (
        <SimpleList
          title="Categories"
          empty="No categories yet"
          rows={categories.map((c) => ({
            id: c.id,
            primary: c.name,
            trailing: `${c.itemCount} ${c.itemCount === 1 ? "item" : "items"}`,
          }))}
          addHref={canWrite ? "/items/categories/new" : undefined}
          addLabel="Add Category"
        />
      ) : tab === "units" ? (
        <SimpleList
          title="Units"
          empty="No units yet"
          rows={units.map((u) => ({
            id: u.id,
            primary: u.name,
            trailing: u.shortName,
          }))}
          addHref={canWrite ? "/items/units/new" : undefined}
          addLabel="Add Unit"
        />
      ) : (
        <MasterDetail
          hasSelection={!!detail}
          onBack={() => go({ id: null })}
          list={
            <>
              <div className="flex shrink-0 items-center gap-2 border-b border-[var(--border-subtle)] p-3">
                <div className="relative min-w-0 flex-1">
                  <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--text-muted)]" />
                  <Input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search items"
                    aria-label="Search items"
                    className="pl-9"
                  />
                </div>

                {canWrite ? (
                  <div className="flex shrink-0 items-stretch">
                    {/* The split button from ref-03 */}
                    <Button asChild variant="accent" className="rounded-r-none">
                      <Link href="/items/new">
                        <Plus className="size-4" />
                        Add Item
                      </Link>
                    </Button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="accent"
                          size="icon"
                          className="ml-px rounded-l-none px-2"
                          aria-label="More ways to add items"
                        >
                          <ChevronDown className="size-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-56">
                        <DropdownMenuItem onSelect={() => router.push("/items/new?type=PRODUCT")}>
                          Add Product
                        </DropdownMenuItem>
                        <DropdownMenuItem onSelect={() => router.push("/items/new?type=SERVICE")}>
                          Add Service
                        </DropdownMenuItem>
                        <DropdownMenuItem onSelect={() => router.push("/utilities/import-items")}>
                          <Upload />
                          Import from Excel
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                ) : null}
              </div>

              <ListColumns left="Item" right="Quantity" />

              <div className="min-h-0 flex-1 overflow-y-auto">
                {filtered.length === 0 ? (
                  <EmptyState
                    compact
                    tone={query ? "search" : "empty"}
                    title={query ? "No item matches that" : "No items yet"}
                    description={
                      query
                        ? undefined
                        : tab === "services"
                          ? "Add a service to bill for labour or time."
                          : "Add a product to start tracking stock."
                    }
                    action={
                      !query && canWrite ? (
                        <Button asChild size="sm" variant="accent">
                          <Link href="/items/new">
                            <Plus className="size-4" />
                            Add Item
                          </Link>
                        </Button>
                      ) : undefined
                    }
                  />
                ) : (
                  filtered.map((item) => (
                    <ListRow
                      key={item.id}
                      selected={detail?.id === item.id}
                      onSelect={() => go({ id: item.id })}
                      primary={item.name}
                      secondary={item.sku ?? undefined}
                      trailing={
                        item.qty === null ? (
                          <span className="text-[var(--text-muted)]">—</span>
                        ) : (
                          <Money value={Number(item.qty)} className="tnum">
                            {formatQty(item.qty)}
                          </Money>
                        )
                      }
                    />
                  ))
                )}
              </div>
            </>
          }
          detail={
            detail ? (
              <ItemDetailPane detail={detail} transactions={transactions} canWrite={canWrite} />
            ) : (
              <EmptyState
                title="Select an item"
                description="Choose an item on the left to see its stock and transaction history."
              />
            )
          }
        />
      )}
    </div>
  );
}

function ItemDetailPane({
  detail,
  transactions,
  canWrite,
}: {
  detail: ItemDetail;
  transactions: ItemTransaction[];
  canWrite: boolean;
}) {
  const qty = detail.qty === null ? null : Number(detail.qty);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="shrink-0 border-b border-[var(--border-subtle)] p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            <h2 className="truncate text-lg font-semibold">{detail.name}</h2>
            <Badge variant={detail.type === "SERVICE" ? "brand" : "neutral"}>
              {detail.type === "SERVICE" ? "Service" : "Product"}
            </Badge>
            <button
              type="button"
              className="rounded p-1 text-[var(--text-muted)] transition-colors hover:bg-[var(--surface-3)]"
              aria-label="Share item"
            >
              <Share2 className="size-4" />
            </button>
          </div>

          <div className="flex items-center gap-2">
            {canWrite && detail.type === "PRODUCT" ? (
              <Button asChild variant="secondary">
                <Link href={`/items/${detail.id}/adjust`}>
                  <SlidersHorizontal className="size-4" />
                  Adjust Item
                </Link>
              </Button>
            ) : null}
            {canWrite ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className="grid size-9 place-items-center rounded-lg text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-3)]"
                    aria-label="More item actions"
                  >
                    <MoreVertical className="size-[18px]" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onSelect={() => window.location.assign(`/items/${detail.id}/edit`)}>
                    Edit item
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : null}
          </div>
        </div>

        {/* Metrics: note the (incl)/(excl) markers, which are per price field (D-07) */}
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Metric
              label="Sale Price"
              value={formatCurrency(detail.salePrice)}
              suffix={detail.salePriceTaxInclusive ? "(incl)" : "(excl)"}
            />
            <Metric
              label="Purchase Price"
              value={formatCurrency(detail.purchasePrice)}
              suffix={detail.purchasePriceTaxInclusive ? "(incl)" : "(excl)"}
            />
            {detail.wholesalePrice ? (
              <Metric label="Wholesale Price" value={formatCurrency(detail.wholesalePrice)} />
            ) : null}
          </div>

          {detail.type === "PRODUCT" ? (
            <div className="space-y-2 sm:text-right">
              <div className="flex items-center gap-2 sm:justify-end">
                {detail.isLow ? (
                  <AlertTriangle className="size-4 text-[var(--color-negative)]" />
                ) : null}
                <span className="text-[13px] text-[var(--text-secondary)]">Stock Quantity:</span>
                <Money value={qty ?? 0} className="text-[15px] font-semibold">
                  {formatQty(detail.qty)}
                </Money>
              </div>
              <div className="text-[13px] text-[var(--text-secondary)] sm:text-right">
                Stock Value:{" "}
                <span className="tnum font-medium text-[var(--text-primary)]">
                  {formatCurrency(detail.stockValue ?? 0)}
                </span>
              </div>
              <div className="text-[12px] text-[var(--text-muted)] sm:text-right">
                Minimum level {formatQty(detail.minStockQty)}
              </div>
            </div>
          ) : null}
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-1 text-[12px] text-[var(--text-muted)]">
          {detail.hsnSac ? <span>HSN/SAC: {detail.hsnSac}</span> : null}
          {detail.unitShort ? <span>Unit: {detail.unitShort}</span> : null}
          {detail.taxRateName ? <span>Tax: {detail.taxRateName}</span> : null}
          {detail.categories.map((c) => (
            <Badge key={c.id} variant="neutral">
              {c.name}
            </Badge>
          ))}
        </div>
      </div>

      <div className="flex shrink-0 items-center justify-between gap-3 border-b border-[var(--border-subtle)] px-4 py-3 sm:px-5">
        <h3 className="text-[15px] font-semibold">Transactions</h3>
        <Link
          href={`/api/export/item-ledger?itemId=${detail.id}`}
          className="grid size-9 place-items-center rounded-lg text-[var(--color-positive)] transition-colors hover:bg-[var(--surface-3)]"
          aria-label="Export to Excel"
          title="Export to Excel"
        >
          <FileSpreadsheet className="size-[18px]" />
        </Link>
      </div>

      <div className="min-h-0 flex-1 overflow-auto">
        <Table>
          <THead>
            <TR className="hover:bg-transparent">
              <TH>Type</TH>
              <TH>Invoice/Ref No.</TH>
              <TH>Name</TH>
              <TH>Date</TH>
              <TH align="right">Quantity</TH>
              <TH align="right">Price/Unit</TH>
              <TH>Status</TH>
            </TR>
          </THead>
          <TBody>
            {transactions.length === 0 ? (
              <TRMessage colSpan={7}>
                <EmptyState
                  compact
                  title="No transactions for this item"
                  description="Sales and purchases using this item will appear here."
                />
              </TRMessage>
            ) : (
              transactions.map((t) => (
                <TR key={t.id}>
                  <TD className="whitespace-nowrap">
                    <span
                      className={cn(
                        "mr-2 inline-block size-1.5 rounded-full align-middle",
                        t.status === "PAID"
                          ? "bg-[var(--color-positive)]"
                          : "bg-[var(--color-warning)]",
                      )}
                      aria-hidden
                    />
                    {TYPE_LABELS[t.type] ?? t.type}
                  </TD>
                  <TD className="whitespace-nowrap font-medium">{t.displayNumber}</TD>
                  <TD className="max-w-[180px]">
                    <span className="block truncate">{t.partyName ?? "—"}</span>
                  </TD>
                  <TD className="whitespace-nowrap">{formatDate(t.date)}</TD>
                  <TD align="right" numeric>
                    {formatQty(t.qty)}
                  </TD>
                  <TD align="right" numeric>
                    {formatCurrency(t.rate)}
                  </TD>
                  <TD className="text-[var(--text-secondary)]">{t.status}</TD>
                </TR>
              ))
            )}
          </TBody>
        </Table>
      </div>
    </div>
  );
}

function Metric({
  label,
  value,
  suffix,
}: {
  label: string;
  value: string;
  suffix?: string;
}) {
  return (
    <div className="text-[13px]">
      <span className="text-[var(--text-secondary)]">{label}: </span>
      <span className="tnum font-semibold text-[var(--text-primary)]">{value}</span>
      {suffix ? <span className="ml-1 text-[var(--text-muted)]">{suffix}</span> : null}
    </div>
  );
}

function SimpleList({
  title,
  empty,
  rows,
  addHref,
  addLabel,
}: {
  title: string;
  empty: string;
  rows: { id: string; primary: string; trailing: string }[];
  addHref?: string;
  addLabel: string;
}) {
  return (
    <div className="p-4 sm:p-6">
      <div className="surface-card overflow-hidden">
        <div className="flex items-center justify-between border-b border-[var(--border-subtle)] p-4">
          <h2 className="text-[15px] font-semibold">{title}</h2>
          {addHref ? (
            <Button asChild size="sm" variant="accent">
              <Link href={addHref}>
                <Plus className="size-4" />
                {addLabel}
              </Link>
            </Button>
          ) : null}
        </div>

        {rows.length === 0 ? (
          <EmptyState compact title={empty} />
        ) : (
          <ul className="divide-y divide-[var(--border-subtle)]">
            {rows.map((row) => (
              <li key={row.id} className="flex items-center justify-between gap-3 px-4 py-3">
                <span className="min-w-0 flex-1 truncate text-[13.5px]">{row.primary}</span>
                <span className="shrink-0 text-[13px] text-[var(--text-muted)]">
                  {row.trailing}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
