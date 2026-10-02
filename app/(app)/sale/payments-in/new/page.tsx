import type { Metadata } from "next";
import { TransactionType } from "@prisma/client";
import { requireFirm } from "@/lib/auth/session";
import { PaymentForm } from "@/components/txn/payment-form";

export const metadata: Metadata = { title: "New Payment-In" };

export default async function Page() {
  const ctx = await requireFirm();

  const [firms, bankAccounts] = await Promise.all([
    ctx.db.firm.findMany({
      where: { isActive: true },
      orderBy: [{ isDefault: "desc" }, { name: "asc" }],
      select: { id: true, name: true },
    }),
    ctx.db.bankAccount.findMany({
      where: { isActive: true },
      orderBy: { displayName: "asc" },
      select: { id: true, displayName: true },
    }),
  ]);

  return (
    <PaymentForm
      type={TransactionType.PAYMENT_IN}
      firms={firms}
      activeFirmId={ctx.firmId}
      bankAccounts={bankAccounts}
    />
  );
}
