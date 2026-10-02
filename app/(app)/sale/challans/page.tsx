import type { Metadata } from "next";
import { TransactionType } from "@prisma/client";
import { TransactionListPage } from "@/components/txn/txn-list-page";
import { SALE_SIBLINGS } from "@/components/patterns/page-header";

export const metadata: Metadata = { title: "Delivery Challan" };

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return (
    <TransactionListPage
      type={TransactionType.DELIVERY_CHALLAN}
      title="Delivery Challan"
      siblings={SALE_SIBLINGS}
      createHref="/sale/challans/new"
      createLabel="Add Challan"
      basePath="/sale/challans"
      summary="none"
      emptyTitle="No delivery challans in this period"
      emptyDescription="Change the date range, or create one now."
      searchParams={await searchParams}
    />
  );
}
