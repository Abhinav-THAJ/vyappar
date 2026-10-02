import type { Metadata } from "next";
import { TransactionType } from "@prisma/client";
import { TransactionListPage } from "@/components/txn/txn-list-page";
import { SALE_SIBLINGS } from "@/components/patterns/page-header";

export const metadata: Metadata = { title: "Sale Return/ Credit Note" };

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return (
    <TransactionListPage
      type={TransactionType.SALE_RETURN}
      title="Sale Return/ Credit Note"
      siblings={SALE_SIBLINGS}
      createHref="/sale/credit-notes/new"
      createLabel="Add Credit Note"
      basePath="/sale/credit-notes"
      summary="card"
      emptyTitle="No credit notes in this period"
      emptyDescription="Change the date range, or create one now."
      searchParams={await searchParams}
    />
  );
}
