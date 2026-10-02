import type { Metadata } from "next";
import { TransactionType } from "@prisma/client";
import { TransactionListPage } from "@/components/txn/txn-list-page";
import { PURCHASE_SIBLINGS } from "@/components/patterns/page-header";

export const metadata: Metadata = { title: "Purchase Return/ Dr. Note" };

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return (
    <TransactionListPage
      type={TransactionType.PURCHASE_RETURN}
      title="Purchase Return/ Dr. Note"
      siblings={PURCHASE_SIBLINGS}
      createHref="/purchase/debit-notes/new"
      createLabel="Add Debit Note"
      basePath="/purchase/debit-notes"
      summary="card"
      emptyTitle="No debit notes in this period"
      emptyDescription="Change the date range, or create one now."
      searchParams={await searchParams}
    />
  );
}
