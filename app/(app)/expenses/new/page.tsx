import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireFirmPermission } from "@/lib/auth/session";
import { parseSettings } from "@/lib/validators/settings";
import { ExpenseForm } from "./expense-form";

export const metadata: Metadata = { title: "Add Expense" };

export default async function NewExpensePage() {
  const ctx = await requireFirmPermission("expense.write");

  const [firms, categories, bankAccounts, taxRates, settingsRow] = await Promise.all([
    ctx.db.firm.findMany({
      where: { isActive: true },
      orderBy: [{ isDefault: "desc" }, { name: "asc" }],
      select: { id: true, name: true },
    }),
    ctx.db.expenseCategory.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    ctx.db.bankAccount.findMany({
      where: { isActive: true },
      orderBy: { displayName: "asc" },
      select: { id: true, displayName: true },
    }),
    ctx.db.taxRate.findMany({
      orderBy: { sortOrder: "asc" },
      select: { id: true, name: true, rate: true },
    }),
    ctx.db.settings.findFirst({
      where: { companyId: ctx.companyId },
      select: {
        general: true,
        transaction: true,
        print: true,
        tax: true,
        party: true,
        item: true,
        message: true,
      },
    }),
  ]);

  // An expense needs a category; send them to create one first.
  if (categories.length === 0) redirect("/expenses");

  const settings = parseSettings(settingsRow);

  return (
    <ExpenseForm
      firms={firms}
      activeFirmId={ctx.firmId}
      categories={categories}
      bankAccounts={bankAccounts}
      taxRates={taxRates.map((t) => ({ id: t.id, name: t.name, rate: t.rate.toString() }))}
      gstEnabled={settings.tax.enableGst && ctx.isGstEnabled}
    />
  );
}
