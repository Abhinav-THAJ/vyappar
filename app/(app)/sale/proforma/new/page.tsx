import type { Metadata } from "next";
import { TransactionType } from "@prisma/client";
import { NewTransactionPage } from "@/components/txn/txn-pages";

export const metadata: Metadata = { title: "New Proforma Invoice" };

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ duplicate?: string; from?: string }>;
}) {
  const { duplicate, from } = await searchParams;
  return (
    <NewTransactionPage
      type={TransactionType.PROFORMA}
      duplicateOf={duplicate}
      convertedFromId={from}
    />
  );
}
