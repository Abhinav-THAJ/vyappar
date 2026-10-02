import type { Metadata } from "next";
import { TransactionType } from "@prisma/client";
import { requireCompany } from "@/lib/auth/session";
import { can } from "@/lib/auth/permissions";
import { prisma } from "@/lib/db/prisma";
import { formatDocumentNumber } from "@/lib/numbering";
import { ExpensesScreen, type ExpenseCategoryRow } from "./expenses-screen";

export const metadata: Metadata = { title: "Expenses" };

export default async function ExpensesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const ctx = await requireCompany();
  const params = await searchParams;
  const selectedId = typeof params.categoryId === "string" ? params.categoryId : undefined;

  const categories = await ctx.db.expenseCategory.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true, expenseType: true },
  });

  // Totals per category, summed from the expense transactions themselves.
  const totals = await prisma.transaction.groupBy({
    by: ["expenseCategoryId"],
    where: {
      companyId: ctx.companyId,
      type: TransactionType.EXPENSE,
      deletedAt: null,
      expenseCategoryId: { not: null },
    },
    _sum: { total: true, balanceAmount: true },
  });

  const totalMap = new Map(
    totals.map((t) => [
      t.expenseCategoryId,
      {
        total: t._sum.total?.toFixed(2) ?? "0.00",
        balance: t._sum.balanceAmount?.toFixed(2) ?? "0.00",
      },
    ]),
  );

  const rows: ExpenseCategoryRow[] = categories.map((c) => ({
    id: c.id,
    name: c.name,
    expenseType: c.expenseType,
    total: totalMap.get(c.id)?.total ?? "0.00",
    balance: totalMap.get(c.id)?.balance ?? "0.00",
  }));

  const activeId = selectedId ?? rows[0]?.id;
  const selected = rows.find((r) => r.id === activeId) ?? null;

  const expenses = activeId
    ? await prisma.transaction.findMany({
        where: {
          companyId: ctx.companyId,
          type: TransactionType.EXPENSE,
          expenseCategoryId: activeId,
          deletedAt: null,
        },
        orderBy: { date: "desc" },
        take: 200,
        select: {
          id: true,
          number: true,
          numberPrefix: true,
          date: true,
          paymentMode: true,
          total: true,
          balanceAmount: true,
          party: { select: { name: true } },
        },
      })
    : [];

  return (
    <ExpensesScreen
      categories={rows}
      selected={selected}
      expenses={expenses.map((e) => ({
        id: e.id,
        displayNumber: formatDocumentNumber(e.numberPrefix, e.number),
        date: e.date.toISOString(),
        partyName: e.party?.name ?? null,
        paymentMode: e.paymentMode,
        total: e.total.toFixed(2),
        balance: e.balanceAmount.toFixed(2),
      }))}
      canWrite={can(ctx.role, "expense.write")}
    />
  );
}
