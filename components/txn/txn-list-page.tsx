import Link from "next/link";
import { Plus } from "lucide-react";
import type { TransactionType } from "@prisma/client";
import { requireCompany } from "@/lib/auth/session";
import { readFilterParams } from "@/lib/filters";
import { FilterBar } from "@/components/patterns/filter-bar";
import { PageHeader, type SiblingScreen } from "@/components/patterns/page-header";
import { ListSummaryCard, EquationChips } from "@/components/patterns/summary-cards";
import { previousPeriod } from "@/lib/filters";
import { Button } from "@/components/ui/button";
import { percentChange } from "@/lib/format/number";
import { listTransactions, transactionTotals } from "@/server/services/transactions";
import { TransactionTable } from "./transaction-table";

/**
 * The shared list screen behind every document type.
 *
 * `summary: "equation"` renders the paid + unpaid = total chips from the
 * Purchase Bills screen; `"card"` renders the total + delta + received/balance
 * card from Sale Invoices.
 */
export async function TransactionListPage({
  type,
  title,
  siblings,
  createHref,
  createLabel,
  basePath,
  summary = "card",
  summaryLabel,
  emptyTitle,
  emptyDescription,
  searchParams,
}: {
  type: TransactionType;
  title: string;
  siblings?: SiblingScreen[];
  createHref: string;
  createLabel: string;
  basePath: string;
  summary?: "card" | "equation" | "none";
  summaryLabel?: string;
  emptyTitle: string;
  emptyDescription: string;
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const ctx = await requireCompany();
  const filters = readFilterParams(searchParams, ctx.fyStartMonth);

  const [firms, rows, totals, prevTotals] = await Promise.all([
    ctx.db.firm.findMany({
      where: { isActive: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    listTransactions(ctx.companyId, {
      type,
      from: filters.range.from,
      to: filters.range.to,
      firmId: filters.firmId,
      q: filters.q,
      page: filters.page,
      pageSize: filters.pageSize,
      sort: filters.sort,
      dir: filters.dir,
    }),
    transactionTotals(ctx.companyId, {
      type,
      from: filters.range.from,
      to: filters.range.to,
      firmId: filters.firmId,
    }),
    (async () => {
      const prev = previousPeriod(filters.preset, filters.range);
      return transactionTotals(ctx.companyId, {
        type,
        from: prev.from,
        to: prev.to,
        firmId: filters.firmId,
      });
    })(),
  ]);

  const change = percentChange(totals.total, prevTotals.total);

  return (
    <div className="flex min-h-full flex-col">
      <PageHeader
        title={title}
        siblings={siblings}
        settingsHref="/settings/transaction"
        actions={
          <Button asChild>
            <Link href={createHref}>
              <Plus className="size-4" />
              {createLabel}
            </Link>
          </Button>
        }
      />

      <FilterBar firms={firms} fyStartMonth={ctx.fyStartMonth} showUser={false} />

      {summary !== "none" ? (
        <div className="px-4 py-4 sm:px-6">
          {summary === "equation" ? (
            <EquationChips
              parts={[
                { label: "Paid", value: totals.received, tone: "positive" },
                { label: "Unpaid", value: totals.balance, tone: "info" },
                { label: "Total", value: totals.total, tone: "total" },
              ]}
            />
          ) : (
            <ListSummaryCard
              label={summaryLabel ?? `Total ${title}`}
              total={totals.total}
              changePercent={change ? Number(change.toFixed(2)) : change === null ? null : 0}
              splits={[
                { label: "Received", value: totals.received },
                { label: "Balance", value: totals.balance },
              ]}
            />
          )}
        </div>
      ) : null}

      <div className="min-h-0 flex-1 px-4 pb-6 sm:px-6">
        <TransactionTable
          rows={rows.rows}
          total={rows.total}
          page={filters.page}
          pageSize={filters.pageSize}
          emptyTitle={emptyTitle}
          emptyDescription={emptyDescription}
          createHref={createHref}
          createLabel={createLabel}
          basePath={basePath}
          showFirm={firms.length > 1 && !filters.firmId}
        />
      </div>
    </div>
  );
}
