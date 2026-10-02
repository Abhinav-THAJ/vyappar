import type { Metadata } from "next";
import { TransactionType } from "@prisma/client";
import { NewTransactionPage } from "@/components/txn/txn-pages";

export const metadata: Metadata = { title: "New Sale Order" };

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ duplicate?: string; from?: string }>;
}) {
  const { duplicate, from } = await searchParams;
  return (
    <NewTransactionPage
      type={TransactionType.SALE_ORDER}
      duplicateOf={duplicate}
      convertedFromId={from}
    />
  );
}
