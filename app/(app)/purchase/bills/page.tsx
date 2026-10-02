import type { Metadata } from "next";
import { TransactionType } from "@prisma/client";
import { TransactionListPage } from "@/components/txn/txn-list-page";
import { PURCHASE_SIBLINGS } from "@/components/patterns/page-header";

export const metadata: Metadata = { title: "Purchase Bills" };

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return (
    <TransactionListPage
      type={TransactionType.PURCHASE}
      title="Purchase Bills"
      siblings={PURCHASE_SIBLINGS}
      createHref="/purchase/bills/new"
      createLabel="Add Purchase"
      basePath="/purchase/bills"
      summary="equation"
      emptyTitle="No purchase bills in this period"
      emptyDescription="Change the date range, or create one now."
      searchParams={await searchParams}
    />
  );
}
