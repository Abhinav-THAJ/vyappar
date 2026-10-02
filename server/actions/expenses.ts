"use server";

import { revalidatePath } from "next/cache";
import { TransactionType } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { requirePermission, requireFirmPermission } from "@/lib/auth/session";
import { expenseSchema } from "@/lib/validators/transaction";
import { zRequiredString, zCuidOptional } from "@/lib/validators/common";
import { parseDateInput, todayIST } from "@/lib/format/date";
import { postTransaction } from "@/server/services/posting";
import { writeAudit } from "@/server/services/audit";
import { runAction, BusinessError, type ActionResult } from "@/server/guards/action";

export const expenseCategorySchema = z.object({
  id: zCuidOptional,
  name: zRequiredString("Category name", 80),
  expenseType: z.enum(["DIRECT", "INDIRECT"]).default("INDIRECT"),
});

/**
 * Create or rename an expense category.
 *
 * The Direct/Indirect type is not decoration: it decides whether the amount
 * lands above or below the gross-profit line in Profit & Loss (D-11).
 */
export async function saveExpenseCategoryAction(
  raw: unknown,
): Promise<ActionResult<{ id: string }>> {
  return runAction(expenseCategorySchema, raw, async (input) => {
    const ctx = await requirePermission("expense.write");

    const duplicate = await ctx.db.expenseCategory.findFirst({
      where: { name: input.name, ...(input.id ? { id: { not: input.id } } : {}) },
      select: { id: true },
    });
    if (duplicate) {
      throw new BusinessError("A category with that name already exists", {
        name: ["A category with that name already exists"],
      });
    }

    const data = { name: input.name, expenseType: input.expenseType };

    const id = input.id
      ? (await ctx.db.expenseCategory.update({ where: { id: input.id }, data })).id
      : (
          await ctx.db.expenseCategory.create({
            data: { ...data, companyId: ctx.companyId },
            select: { id: true },
          })
        ).id;

    revalidatePath("/expenses");
    return { id };
  });
}

export async function deleteExpenseCategoryAction(
  raw: unknown,
): Promise<ActionResult<{ id: string }>> {
  return runAction(z.object({ id: z.string().min(1) }), raw, async ({ id }) => {
    const ctx = await requirePermission("expense.write");

    const used = await ctx.db.transaction.count({ where: { expenseCategoryId: id } });
    if (used > 0) {
      throw new BusinessError(
        `This category has ${used} expense${used === 1 ? "" : "s"} recorded against it.`,
      );
    }

    await ctx.db.expenseCategory.update({ where: { id }, data: { deletedAt: new Date() } });
    revalidatePath("/expenses");
    return { id };
  });
}

/** Record an expense — a lump sum, or itemised lines. */
export async function saveExpenseAction(
  raw: unknown,
): Promise<ActionResult<{ id: string; number: string }>> {
  return runAction(expenseSchema, raw, async (input) => {
    const ctx = await requireFirmPermission("expense.write", input.firmId);
    const date = parseDateInput(input.date) ?? todayIST();

    const category = await ctx.db.expenseCategory.findFirst({
      where: { id: input.expenseCategoryId },
      select: { id: true, name: true },
    });
    if (!category) throw new BusinessError("That expense category no longer exists");

    // A lump-sum expense becomes a single synthetic line so the tax and total
    // maths runs through exactly the same engine as every other document.
    const lines =
      input.lines.length > 0
        ? input.lines.map((l) => ({
            itemId: l.itemId ?? null,
            description: l.description ?? null,
            hsnSac: l.hsnSac ?? null,
            qty: l.qty,
            freeQty: "0",
            unitId: l.unitId ?? null,
            rate: l.rate,
            rateIsTaxInclusive: l.rateIsTaxInclusive,
            discountValue: l.discountValue ?? "0",
            discountIsPercent: l.discountIsPercent,
            taxRateId: l.taxRateId ?? null,
            taxRateValue: l.taxRateValue,
            cessRate: l.cessRate ?? "0",
          }))
        : [
            {
              itemId: null,
              description: category.name,
              hsnSac: null,
              qty: "1",
              freeQty: "0",
              unitId: null,
              rate: input.amount ?? "0",
              rateIsTaxInclusive: false,
              discountValue: "0",
              discountIsPercent: false,
              taxRateId: null,
              taxRateValue: input.taxRateValue ?? "0",
              cessRate: "0",
            },
          ];

    const result = await prisma.$transaction((tx) =>
      postTransaction(
        tx,
        {
          companyId: ctx.companyId,
          firmId: ctx.firmId,
          userId: ctx.user.id,
          fyStartMonth: ctx.fyStartMonth,
          stopSaleOnNegativeStock: false,
        },
        {
          type: TransactionType.EXPENSE,
          date,
          number: input.number ?? null,
          partyId: input.partyId ?? null,
          expenseCategoryId: input.expenseCategoryId,
          bankAccountId: input.bankAccountId ?? null,
          isIgst: input.isIgst,
          lines,
          paidAmount: input.paidAmount ?? "0",
          paymentMode: input.paymentMode,
          notes: input.notes ?? null,
        },
      ),
    );

    await writeAudit(ctx, {
      entity: "Transaction",
      entityId: result.id,
      action: "CREATE",
      firmId: ctx.firmId,
      after: { type: "EXPENSE", category: category.name, total: result.total },
    });

    revalidatePath("/expenses");
    revalidatePath("/dashboard");
    return { id: result.id, number: result.number };
  });
}
