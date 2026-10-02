import type { Metadata } from "next";
import { TransactionType } from "@prisma/client";
import { TransactionListPage } from "@/components/txn/txn-list-page";
import { SALE_SIBLINGS } from "@/components/patterns/page-header";

export const metadata: Metadata = { title: "Sale Invoices" };

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return (
    <TransactionListPage
      type={TransactionType.SALE}
      title="Sale Invoices"
      siblings={SALE_SIBLINGS}
      createHref="/sale/invoices/new"
      createLabel="Add Sale"
      basePath="/sale/invoices"
      summary="card"
      summaryLabel="Total Sales Amount"
      emptyTitle="No sale invoices in this period"
      emptyDescription="Change the date range, or raise your first invoice."
      searchParams={await searchParams}
    />
  );
}
