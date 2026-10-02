import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { LedgerAccountType } from "@prisma/client";
import { requireCompany } from "@/lib/auth/session";
import { accountStatement, listBankAccounts } from "@/server/services/cashbank";
import { readFilterParams } from "@/lib/filters";
import { FilterBar } from "@/components/patterns/filter-bar";
import { PageHeader } from "@/components/patterns/page-header";
import { LedgerTable } from "@/components/patterns/ledger-table";
import { CASH_BANK_SIBLINGS } from "../banks-screen";

export const metadata: Metadata = { title: "Bank Statement" };

export default async function BankStatementPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const ctx = await requireCompany();
  const filters = readFilterParams(await searchParams, ctx.fyStartMonth);

  const accounts = await listBankAccounts(ctx.companyId);
  const account = accounts.find((a) => a.id === id);
  if (!account) notFound();

  const statement = await accountStatement(
    ctx.companyId,
    { type: LedgerAccountType.BANK, bankAccountId: id },
    filters.range,
  );

  return (
    <div className="flex min-h-full flex-col">
      <PageHeader
        title={account.displayName}
        siblings={CASH_BANK_SIBLINGS}
        description={[account.bankName, account.accountNumber].filter(Boolean).join(" · ")}
      />
      <FilterBar fyStartMonth={ctx.fyStartMonth} showFirm={false} showUser={false} />
      <div className="p-4 sm:p-6">
        <LedgerTable
          rows={statement.rows}
          opening={statement.opening}
          closing={statement.closing}
          emptyTitle="No movements in this period"
        />
      </div>
    </div>
  );
}
