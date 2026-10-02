import type { Metadata } from "next";
import { TransactionType } from "@prisma/client";
import { TransactionListPage } from "@/components/txn/txn-list-page";
import { SALE_SIBLINGS } from "@/components/patterns/page-header";

export const metadata: Metadata = { title: "Sale Order" };

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return (
    <TransactionListPage
      type={TransactionType.SALE_ORDER}
      title="Sale Order"
      siblings={SALE_SIBLINGS}
      createHref="/sale/orders/new"
      createLabel="Add Sale Order"
      basePath="/sale/orders"
      summary="card"
      emptyTitle="No sale orders in this period"
      emptyDescription="Change the date range, or create one now."
      searchParams={await searchParams}
    />
  );
}
