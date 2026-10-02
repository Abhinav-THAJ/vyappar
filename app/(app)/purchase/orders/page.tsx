import type { Metadata } from "next";
import { TransactionType } from "@prisma/client";
import { TransactionListPage } from "@/components/txn/txn-list-page";
import { PURCHASE_SIBLINGS } from "@/components/patterns/page-header";

export const metadata: Metadata = { title: "Purchase Order" };

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return (
    <TransactionListPage
      type={TransactionType.PURCHASE_ORDER}
      title="Purchase Order"
      siblings={PURCHASE_SIBLINGS}
      createHref="/purchase/orders/new"
      createLabel="Add Purchase Order"
      basePath="/purchase/orders"
      summary="card"
      emptyTitle="No purchase orders in this period"
      emptyDescription="Change the date range, or create one now."
      searchParams={await searchParams}
    />
  );
}
