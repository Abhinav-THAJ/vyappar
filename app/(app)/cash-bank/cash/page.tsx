import type { Metadata } from "next";
import { LedgerAccountType } from "@prisma/client";
import { requireCompany } from "@/lib/auth/session";
import { can } from "@/lib/auth/permissions";
import { accountStatement, cashInHand } from "@/server/services/cashbank";
import { readFilterParams } from "@/lib/filters";
import { FilterBar } from "@/components/patterns/filter-bar";
import { PageHeader } from "@/components/patterns/page-header";
import { LedgerTable } from "@/components/patterns/ledger-table";
import { CASH_BANK_SIBLINGS } from "../banks/banks-screen";
import { CashActions } from "./cash-actions";

export const metadata: Metadata = { title: "Cash In Hand" };

export default async function CashPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const ctx = await requireCompany();
  const filters = readFilterParams(await searchParams, ctx.fyStartMonth);

  const [balance, statement] = await Promise.all([
    cashInHand(ctx.companyId),
    accountStatement(ctx.companyId, { type: LedgerAccountType.CASH }, filters.range),
  ]);

  return (
    <div className="flex min-h-full flex-col">
      <PageHeader
        title="Cash In Hand"
        siblings={CASH_BANK_SIBLINGS}
        actions={can(ctx.role, "cashbank.write") ? <CashActions /> : null}
      />

      <FilterBar fyStartMonth={ctx.fyStartMonth} showFirm={false} showUser={false} />

      <div className="p-4 sm:p-6">
        <div className="surface-card mb-4 p-5">
          <div className="text-[13px] text-[var(--text-secondary)]">Cash in hand</div>
          <div className="tnum mt-1 text-2xl font-semibold">
            {new Intl.NumberFormat("en-IN", {
              style: "currency",
              currency: "INR",
              maximumFractionDigits: 2,
            }).format(Number(balance))}
          </div>
        </div>

        <LedgerTable
          rows={statement.rows}
          opening={statement.opening}
          closing={statement.closing}
          emptyTitle="No cash movements in this period"
          emptyDescription="Cash sales, payments and adjustments appear here."
        />
      </div>
    </div>
  );
}
