import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { TransactionType } from "@prisma/client";
import { requireCompany } from "@/lib/auth/session";
import { KpiCard } from "@/components/patterns/summary-cards";
import { readFilterParams } from "@/lib/filters";
import { previousPeriod, PERIOD_LABELS } from "@/lib/filters";
import { receivablePayable, cashBalance, bankBalances, lowStockItems } from "@/server/services/balances";
import { transactionTotals, salesByDay, listTransactions } from "@/server/services/transactions";
import { percentChange, formatCurrency, formatPercent, formatQty } from "@/lib/format/number";
import { formatDate } from "@/lib/format/date";
import { SalesChart } from "./sales-chart";
import { PeriodPicker } from "./period-picker";

export const metadata: Metadata = { title: "Home" };

const MOST_USED_REPORTS = [
  { label: "Sale Report", href: "/reports/sale" },
  { label: "All Transactions", href: "/reports/all-transactions" },
  { label: "Daybook Report", href: "/reports/day-book" },
  { label: "Party Statement", href: "/reports/party-statement" },
];

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const ctx = await requireCompany();
  const params = await searchParams;
  const filters = readFilterParams(params, ctx.fyStartMonth);
  const prev = previousPeriod(filters.preset, filters.range);

  const [rp, totals, prevTotals, chart, cash, banks, lowStock, recent] = await Promise.all([
    receivablePayable(ctx.companyId),
    transactionTotals(ctx.companyId, {
      type: TransactionType.SALE,
      from: filters.range.from,
      to: filters.range.to,
    }),
    transactionTotals(ctx.companyId, {
      type: TransactionType.SALE,
      from: prev.from,
      to: prev.to,
    }),
    salesByDay(ctx.companyId, filters.range.from, filters.range.to),
    cashBalance(ctx.companyId),
    bankBalances(ctx.companyId),
    lowStockItems(ctx.companyId, 6),
    listTransactions(ctx.companyId, {
      type: [
        TransactionType.SALE,
        TransactionType.PURCHASE,
        TransactionType.PAYMENT_IN,
        TransactionType.PAYMENT_OUT,
      ],
      from: filters.range.from,
      to: filters.range.to,
      page: 1,
      pageSize: 6,
    }),
  ]);

  const change = percentChange(totals.total, prevTotals.total);
  const bankTotal = [...banks.values()].reduce((acc, b) => acc.plus(b), cash.times(0));

  return (
    <div className="p-4 sm:p-6">
      <div className="grid gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        {/* Main column */}
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <KpiCard
              label="Total Receivable"
              amount={rp.receivable.toFixed(2)}
              sub={`From ${rp.receivableParties} ${rp.receivableParties === 1 ? "Party" : "Parties"}`}
              direction="in"
              href="/reports/all-parties?filter=receivable"
            />
            <KpiCard
              label="Total Payable"
              amount={rp.payable.toFixed(2)}
              sub={`From ${rp.payableParties} ${rp.payableParties === 1 ? "Party" : "Parties"}`}
              direction="out"
              href="/reports/all-parties?filter=payable"
            />
          </div>

          {/* Total Sale + chart */}
          <div className="surface-card p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="text-[13px] text-[var(--text-secondary)]">Total Sale</div>
                <div className="mt-1 flex flex-wrap items-baseline gap-3">
                  <span className="tnum text-2xl font-semibold tracking-tight sm:text-[28px]">
                    {formatCurrency(totals.total, { decimals: 0 })}
                  </span>
                  {change !== null ? (
                    <span
                      className={
                        change.greaterThanOrEqualTo(0)
                          ? "text-[13px] font-medium text-[var(--color-positive)]"
                          : "text-[13px] font-medium text-[var(--color-negative)]"
                      }
                    >
                      {formatPercent(change.abs(), 0)}{" "}
                      {change.greaterThanOrEqualTo(0) ? "more than" : "less than"} last period
                    </span>
                  ) : (
                    <span className="text-[13px] text-[var(--text-muted)]">
                      No sales in the previous period
                    </span>
                  )}
                </div>
              </div>

              <PeriodPicker current={filters.preset} label={PERIOD_LABELS[filters.preset]} />
            </div>

            <div className="mt-6">
              <SalesChart data={chart} />
            </div>
          </div>

          {/* Most Used Reports */}
          <div className="surface-card p-5">
            <div className="flex items-center justify-between">
              <h2 className="text-[15px] font-semibold">Most Used Reports</h2>
              <Link href="/reports/sale" className="text-[13px] text-brand-600 hover:underline">
                View All
              </Link>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {MOST_USED_REPORTS.map((r) => (
                <Link
                  key={r.href}
                  href={r.href}
                  className="flex items-center justify-between gap-2 rounded-lg border border-[var(--border-subtle)] px-4 py-3.5 text-[13px] font-medium transition-colors hover:border-brand-300 hover:bg-[var(--surface-2)]"
                >
                  <span className="truncate">{r.label}</span>
                  <ChevronRight className="size-4 shrink-0 text-[var(--text-muted)]" />
                </Link>
              ))}
            </div>
          </div>
        </div>

        {/* Right rail */}
        <div className="space-y-4">
          <Widget title="Cash & Bank">
            <div className="space-y-2.5">
              <Row label="Cash in hand" value={formatCurrency(cash.toFixed(2))} />
              <Row label="Bank accounts" value={formatCurrency(bankTotal.toFixed(2))} />
            </div>
            <Link
              href="/cash-bank/cash"
              className="mt-4 inline-block text-[13px] text-brand-600 hover:underline"
            >
              View all accounts
            </Link>
          </Widget>

          <Widget title="Low stock">
            {lowStock.length === 0 ? (
              <p className="text-[13px] text-[var(--text-muted)]">
                Every item is above its minimum level.
              </p>
            ) : (
              <div className="space-y-2.5">
                {lowStock.map((item) => (
                  <Row
                    key={item.id}
                    label={item.name}
                    value={formatQty(item.onHand.toString())}
                    tone={item.onHand.lessThanOrEqualTo(0) ? "negative" : "warning"}
                  />
                ))}
              </div>
            )}
            <Link
              href="/reports/low-stock"
              className="mt-4 inline-block text-[13px] text-brand-600 hover:underline"
            >
              Low stock report
            </Link>
          </Widget>

          <Widget title="Recent transactions">
            {recent.rows.length === 0 ? (
              <p className="text-[13px] text-[var(--text-muted)]">
                Nothing recorded in this period yet.
              </p>
            ) : (
              <div className="space-y-3">
                {recent.rows.map((t) => (
                  <div key={t.id} className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate text-[13px] font-medium">
                        {t.partyName ?? t.displayNumber}
                      </div>
                      <div className="text-[12px] text-[var(--text-muted)]">
                        {formatDate(t.date)} · {t.displayNumber}
                      </div>
                    </div>
                    <span className="tnum shrink-0 text-[13px] font-medium">
                      {formatCurrency(t.total)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </Widget>
        </div>
      </div>
    </div>
  );
}

function Widget({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="surface-card p-5">
      <h2 className="text-[15px] font-semibold">{title}</h2>
      <div className="mt-3.5">{children}</div>
    </section>
  );
}

function Row({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "negative" | "warning";
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="min-w-0 flex-1 truncate text-[13px] text-[var(--text-secondary)]">
        {label}
      </span>
      <span
        className={
          tone === "negative"
            ? "tnum shrink-0 text-[13px] font-medium text-[var(--color-negative)]"
            : tone === "warning"
              ? "tnum shrink-0 text-[13px] font-medium text-[var(--color-warning)]"
              : "tnum shrink-0 text-[13px] font-medium"
        }
      >
        {value}
      </span>
    </div>
  );
}
