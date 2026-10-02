import type { Metadata } from "next";
import { TransactionType } from "@prisma/client";
import { TransactionListPage } from "@/components/txn/txn-list-page";
import { PURCHASE_SIBLINGS } from "@/components/patterns/page-header";

export const metadata: Metadata = { title: "Payment-Out" };

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return (
    <TransactionListPage
      type={TransactionType.PAYMENT_OUT}
      title="Payment-Out"
      siblings={PURCHASE_SIBLINGS}
      createHref="/purchase/payments-out/new"
      createLabel="Add Payment-Out"
      basePath="/purchase/payments-out"
      summary="card"
      summaryLabel="Total Amount"
      emptyTitle="No Transactions to show"
      emptyDescription="You haven't added any transactions yet."
      searchParams={await searchParams}
    />
  );
}
