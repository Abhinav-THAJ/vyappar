import type { Metadata } from "next";
import { requireCompany } from "@/lib/auth/session";
import { can } from "@/lib/auth/permissions";
import { listTransfers, listBankAccounts } from "@/server/services/cashbank";
import { readFilterParams } from "@/lib/filters";
import { FilterBar } from "@/components/patterns/filter-bar";
import { PageHeader } from "@/components/patterns/page-header";
import { CASH_BANK_SIBLINGS } from "../banks/banks-screen";
import { TransfersScreen } from "./transfers-screen";

export const metadata: Metadata = { title: "Transfers" };

export default async function TransfersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const ctx = await requireCompany();
  const filters = readFilterParams(await searchParams, ctx.fyStartMonth);

  const [transfers, accounts] = await Promise.all([
    listTransfers(ctx.companyId, filters.range),
    listBankAccounts(ctx.companyId),
  ]);

  return (
    <div className="flex min-h-full flex-col">
      <PageHeader
        title="Transfers"
        siblings={CASH_BANK_SIBLINGS}
        description="Money moving between your own accounts"
      />
      <FilterBar fyStartMonth={ctx.fyStartMonth} showFirm={false} showUser={false} />
      <TransfersScreen
        transfers={transfers}
        accounts={accounts.map((a) => ({ id: a.id, displayName: a.displayName }))}
        canWrite={can(ctx.role, "cashbank.write")}
      />
    </div>
  );
}
