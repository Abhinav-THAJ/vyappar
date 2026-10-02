import type { Metadata } from "next";
import { TransactionType } from "@prisma/client";
import { TransactionListPage } from "@/components/txn/txn-list-page";
import { SALE_SIBLINGS } from "@/components/patterns/page-header";

export const metadata: Metadata = { title: "Payment-In" };

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return (
    <TransactionListPage
      type={TransactionType.PAYMENT_IN}
      title="Payment-In"
      siblings={SALE_SIBLINGS}
      createHref="/sale/payments-in/new"
      createLabel="Add Payment-In"
      basePath="/sale/payments-in"
      summary="card"
      summaryLabel="Total Amount"
      emptyTitle="No Transactions to show"
      emptyDescription="You haven't added any transactions yet."
      searchParams={await searchParams}
    />
  );
}
