import type { Metadata } from "next";
import { TransactionType } from "@prisma/client";
import { EditTransactionPage } from "@/components/txn/txn-pages";

export const metadata: Metadata = { title: "Edit Debit Note" };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <EditTransactionPage type={TransactionType.PURCHASE_RETURN} id={id} />;
}
