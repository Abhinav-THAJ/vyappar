import type { Metadata } from "next";
import { TransactionType } from "@prisma/client";
import { TransactionListPage } from "@/components/txn/txn-list-page";
import { SALE_SIBLINGS } from "@/components/patterns/page-header";

export const metadata: Metadata = { title: "Proforma Invoice" };

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return (
    <TransactionListPage
      type={TransactionType.PROFORMA}
      title="Proforma Invoice"
      siblings={SALE_SIBLINGS}
      createHref="/sale/proforma/new"
      createLabel="Add Proforma"
      basePath="/sale/proforma"
      summary="card"
      emptyTitle="No proforma invoices in this period"
      emptyDescription="Change the date range, or create one now."
      searchParams={await searchParams}
    />
  );
}
