import type { Metadata } from "next";
import { TransactionType } from "@prisma/client";
import { TransactionListPage } from "@/components/txn/txn-list-page";
import { SALE_SIBLINGS } from "@/components/patterns/page-header";

export const metadata: Metadata = { title: "Estimate/ Quotation" };

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return (
    <TransactionListPage
      type={TransactionType.ESTIMATE}
      title="Estimate/ Quotation"
      siblings={SALE_SIBLINGS}
      createHref="/sale/estimates/new"
      createLabel="Add Estimate"
      basePath="/sale/estimates"
      summary="card"
      emptyTitle="No estimates in this period"
      emptyDescription="Change the date range, or create one now."
      searchParams={await searchParams}
    />
  );
}
