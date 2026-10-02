"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { TransactionType } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { requirePermission, requireCompany } from "@/lib/auth/session";
import { postTransaction } from "@/server/services/posting";
import { financialYearClosing } from "@/server/services/verify";
import { financialYearOf, financialYearRange } from "@/lib/fy";
import { formatDocumentNumber } from "@/lib/numbering";
import { writeAudit } from "@/server/services/audit";
import { runAction, BusinessError, type ActionResult } from "@/server/guards/action";

/** Soft-deleted transactions, newest first. */
export async function listRecycleBin(companyId: string, page = 1, pageSize = 50) {
  const where = { companyId, deletedAt: { not: null } };

  const [total, rows] = await Promise.all([
    prisma.transaction.count({ where }),
    prisma.transaction.findMany({
      where,
      orderBy: { deletedAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        type: true,
        number: true,
        numberPrefix: true,
        date: true,
        deletedAt: true,
        total: true,
        party: { select: { name: true } },
        firm: { select: { name: true } },
      },
    }),
  ]);

  return {
    total,
    rows: rows.map((r) => ({
      id: r.id,
      type: r.type,
      displayNumber: formatDocumentNumber(r.numberPrefix, r.number),
      date: r.date.toISOString(),
      deletedAt: r.deletedAt!.toISOString(),
      total: r.total.toFixed(2),
      partyName: r.party?.name ?? null,
      firmName: r.firm.name,
    })),
  };
}

/**
 * Restore a deleted transaction by re-posting it.
 *
 * The original row's stock and ledger entries were removed when it was
 * deleted, so restoring means running the posting pipeline again from the
 * surviving header and lines — that way the books stay consistent rather than
 * merely un-hiding a row.
 */
export async function restoreTransactionAction(
  raw: unknown,
): Promise<ActionResult<{ id: string }>> {
  return runAction(z.object({ id: z.string().min(1) }), raw, async ({ id }) => {
    const ctx = await requirePermission("transaction.delete");

    const deleted = await prisma.transaction.findFirst({
      where: { id, companyId: ctx.companyId, deletedAt: { not: null } },
      select: {
        id: true,
        type: true,
        number: true,
        numberPrefix: true,
        financialYear: true,
        firmId: true,
        date: true,
        dueDate: true,
        partyId: true,
        expenseCategoryId: true,
        bankAccountId: true,
        stateOfSupply: true,
        isIgst: true,
        discountValue: true,
        discountIsPercent: true,
        additionalCharges: true,
        paidAmount: true,
        paymentMode: true,
        chequeNo: true,
        notes: true,
        terms: true,
        lines: {
          orderBy: { sortOrder: "asc" },
          select: {
            itemId: true,
            description: true,
            hsnSac: true,
            qty: true,
            freeQty: true,
            unitId: true,
            rate: true,
            rateIsTaxInclusive: true,
            discountValue: true,
            discountIsPercent: true,
            taxRateId: true,
            taxRateValue: true,
            cessRate: true,
          },
        },
      },
    });

    if (!deleted) throw new BusinessError("That transaction is not in the recycle bin");

    // The number may have been reused while it was deleted.
    const clash = await prisma.transaction.findFirst({
      where: {
        firmId: deleted.firmId,
        type: deleted.type,
        financialYear: deleted.financialYear,
        number: deleted.number,
        deletedAt: null,
      },
      select: { id: true },
    });

    const charges = Array.isArray(deleted.additionalCharges)
      ? (deleted.additionalCharges as { name: string; amount: string; taxRate?: string | null }[])
      : [];

    const restored = await prisma.$transaction(async (tx) => {
      // Remove the tombstone so its number frees up, then post it afresh.
      await tx.transaction.delete({ where: { id: deleted.id } });

      return postTransaction(
        tx,
        {
          companyId: ctx.companyId,
          firmId: deleted.firmId,
          userId: ctx.user.id,
          fyStartMonth: ctx.fyStartMonth,
          stopSaleOnNegativeStock: false,
        },
        {
          type: deleted.type,
          date: deleted.date,
          dueDate: deleted.dueDate,
          partyId: deleted.partyId,
          expenseCategoryId: deleted.expenseCategoryId,
          bankAccountId: deleted.bankAccountId,
          // A clash means it takes the next free number instead.
          number: clash ? null : deleted.number,
          stateOfSupply: deleted.stateOfSupply,
          isIgst: deleted.isIgst,
          lines: deleted.lines.map((l) => ({
            itemId: l.itemId,
            description: l.description,
            hsnSac: l.hsnSac,
            qty: l.qty.toString(),
            freeQty: l.freeQty.toString(),
            unitId: l.unitId,
            rate: l.rate.toFixed(2),
            rateIsTaxInclusive: l.rateIsTaxInclusive,
            discountValue: l.discountValue.toFixed(2),
            discountIsPercent: l.discountIsPercent,
            taxRateId: l.taxRateId,
            taxRateValue: l.taxRateValue.toString(),
            cessRate: l.cessRate.toString(),
          })),
          billDiscountValue: deleted.discountValue.toFixed(2),
          billDiscountIsPercent: deleted.discountIsPercent,
          additionalCharges: charges,
          paidAmount: deleted.paidAmount.toFixed(2),
          paymentMode: deleted.paymentMode,
          chequeNo: deleted.chequeNo,
          notes: deleted.notes,
          terms: deleted.terms,
        },
      );
    });

    await writeAudit(ctx, {
      entity: "Transaction",
      entityId: restored.id,
      action: "RESTORE",
      after: { number: restored.number, renumbered: !!clash },
    });

    revalidatePath("/utilities/recycle-bin");
    revalidatePath("/dashboard");
    return { id: restored.id };
  });
}

/** Permanently remove a deleted transaction. */
export async function purgeTransactionAction(
  raw: unknown,
): Promise<ActionResult<{ id: string }>> {
  return runAction(z.object({ id: z.string().min(1) }), raw, async ({ id }) => {
    const ctx = await requirePermission("transaction.delete");

    const deleted = await prisma.transaction.findFirst({
      where: { id, companyId: ctx.companyId, deletedAt: { not: null } },
      select: { id: true, number: true, numberPrefix: true, type: true },
    });
    if (!deleted) throw new BusinessError("That transaction is not in the recycle bin");

    await prisma.transaction.delete({ where: { id } });

    await writeAudit(ctx, {
      entity: "Transaction",
      entityId: id,
      action: "DELETE",
      before: { number: formatDocumentNumber(deleted.numberPrefix, deleted.number), purged: true },
    });

    revalidatePath("/utilities/recycle-bin");
    return { id };
  });
}

const fyCloseSchema = z.object({
  financialYear: z.string().regex(/^\d{4}-\d{2}$/, "Choose a financial year"),
  confirm: z.literal(true, {
    errorMap: () => ({ message: "Tick the box to confirm" }),
  }),
});

export interface FyCloseOutcome {
  financialYear: string;
  partiesCarried: number;
  itemsCarried: number;
  cash: string;
}

/**
 * Close a financial year.
 *
 * Carries closing party, cash, bank and stock balances into the new year as
 * opening figures. It is additive — nothing from the closed year is deleted or
 * edited, so the old year's reports keep producing the same numbers.
 */
export async function closeFinancialYearAction(
  raw: unknown,
): Promise<ActionResult<FyCloseOutcome>> {
  return runAction(fyCloseSchema, raw, async ({ financialYear }) => {
    const ctx = await requirePermission("settings.write");

    const range = financialYearRange(financialYear, ctx.fyStartMonth);
    const current = financialYearOf(new Date(), ctx.fyStartMonth);

    if (financialYear === current) {
      throw new BusinessError(
        "That financial year is still running. Close it after it ends.",
        { financialYear: ["This year has not finished yet"] },
      );
    }

    const closing = await financialYearClosing(ctx.companyId, range.to);

    // Opening balances live on the master records, so carrying forward is an
    // update to Party and Item rather than a new set of transactions.
    await prisma.$transaction(async (tx) => {
      for (const party of closing.parties) {
        const balance = Number(party.balance);
        await tx.party.updateMany({
          where: { id: party.partyId, companyId: ctx.companyId },
          data: {
            openingBalance: Math.abs(balance).toFixed(2),
            openingBalanceType: balance >= 0 ? "TO_RECEIVE" : "TO_PAY",
            openingAsOf: range.to,
          },
        });
      }

      for (const item of closing.stock) {
        await tx.item.updateMany({
          where: { id: item.itemId, companyId: ctx.companyId },
          data: { openingQty: item.qty, openingAsOf: range.to },
        });
      }
    });

    await writeAudit(ctx, {
      entity: "Company",
      entityId: ctx.companyId,
      action: "UPDATE",
      after: { closedFinancialYear: financialYear },
    });

    revalidatePath("/utilities/fy-close");
    return {
      financialYear,
      partiesCarried: closing.parties.length,
      itemsCarried: closing.stock.length,
      cash: closing.cash,
    };
  });
}

/** Counts shown on the utilities landing page. */
export async function utilitiesOverview() {
  const ctx = await requireCompany();

  const [parties, items, transactions, deleted] = await Promise.all([
    ctx.db.party.count(),
    ctx.db.item.count(),
    ctx.db.transaction.count({ where: { type: { not: TransactionType.STOCK_ADJUSTMENT } } }),
    prisma.transaction.count({ where: { companyId: ctx.companyId, deletedAt: { not: null } } }),
  ]);

  return { parties, items, transactions, deleted };
}
