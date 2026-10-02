"use server";

import { revalidatePath } from "next/cache";
import { TransactionType } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { requireFirmPermission, requirePermission } from "@/lib/auth/session";
import {
  transactionSchema,
  paymentSchema,
  deleteTransactionSchema,
  convertTransactionSchema,
  CONVERSIONS,
  isPurchaseSide,
} from "@/lib/validators/transaction";
import { parseDateInput, todayIST } from "@/lib/format/date";
import { parseSettings } from "@/lib/validators/settings";
import { resolvePlaceOfSupply } from "@/lib/gst";
import { postTransaction, reverseTransaction, BEHAVIOUR } from "@/server/services/posting";
import { writeAudit } from "@/server/services/audit";
import { runAction, BusinessError, type ActionResult } from "@/server/guards/action";

const SETTINGS_SELECT = {
  general: true,
  transaction: true,
  print: true,
  tax: true,
  party: true,
  item: true,
  message: true,
} as const;

function permissionFor(type: TransactionType) {
  return isPurchaseSide(type)
    ? type === TransactionType.EXPENSE
      ? ("expense.write" as const)
      : ("purchase.write" as const)
    : ("sale.write" as const);
}

function listPathFor(type: TransactionType): string {
  const map: Partial<Record<TransactionType, string>> = {
    SALE: "/sale/invoices",
    SALE_RETURN: "/sale/credit-notes",
    ESTIMATE: "/sale/estimates",
    PROFORMA: "/sale/proforma",
    SALE_ORDER: "/sale/orders",
    DELIVERY_CHALLAN: "/sale/challans",
    PAYMENT_IN: "/sale/payments-in",
    PURCHASE: "/purchase/bills",
    PURCHASE_RETURN: "/purchase/debit-notes",
    PURCHASE_ORDER: "/purchase/orders",
    PAYMENT_OUT: "/purchase/payments-out",
    EXPENSE: "/expenses",
  };
  return map[type] ?? "/dashboard";
}

/**
 * Save a goods document.
 *
 * Editing re-posts from scratch: the prior movements, ledger entries and
 * allocations are removed and rewritten inside the same transaction, so the
 * books can never be left half-updated.
 */
export async function saveTransactionAction(
  raw: unknown,
): Promise<ActionResult<{ id: string; number: string; prefix: string; total: string }>> {
  return runAction(transactionSchema, raw, async (input) => {
    const ctx = await requireFirmPermission(permissionFor(input.type), input.firmId);

    const settingsRow = await ctx.db.settings.findFirst({
      where: { companyId: ctx.companyId },
      select: SETTINGS_SELECT,
    });
    const settings = parseSettings(settingsRow);

    // Place of supply follows the FIRM's state, because the firm holds the
    // GSTIN and is the legal supplier (D-20).
    const party = input.partyId
      ? await ctx.db.party.findFirst({
          where: { id: input.partyId },
          select: { id: true, stateCode: true, paymentTermDays: true },
        })
      : null;

    if (input.partyId && !party) throw new BusinessError("That party no longer exists");

    const pos = resolvePlaceOfSupply({
      firmStateCode: ctx.firmStateCode,
      partyStateCode: party?.stateCode ?? null,
      overrideStateCode: input.stateOfSupply ?? null,
    });

    const date = parseDateInput(input.date) ?? todayIST();

    // Fall back to the party's payment terms when no due date was typed.
    let dueDate = input.dueDate ? parseDateInput(input.dueDate) : null;
    if (!dueDate && party?.paymentTermDays && BEHAVIOUR[input.type].ledger) {
      dueDate = new Date(date.getTime() + party.paymentTermDays * 86_400_000);
    }

    const postingInput = {
      type: input.type,
      date,
      dueDate,
      partyId: input.partyId ?? null,
      expenseCategoryId: input.expenseCategoryId ?? null,
      bankAccountId: input.bankAccountId ?? null,
      number: input.number ?? null,
      stateOfSupply: pos.stateCode,
      isIgst: pos.isIgst,
      lines: input.lines.map((line) => ({
        itemId: line.itemId ?? null,
        description: line.description ?? null,
        hsnSac: line.hsnSac ?? null,
        qty: line.qty,
        freeQty: line.freeQty ?? "0",
        unitId: line.unitId ?? null,
        rate: line.rate,
        rateIsTaxInclusive: line.rateIsTaxInclusive,
        discountValue: line.discountValue ?? "0",
        discountIsPercent: line.discountIsPercent,
        taxRateId: line.taxRateId ?? null,
        taxRateValue: line.taxRateValue,
        cessRate: line.cessRate ?? "0",
      })),
      billDiscountValue: input.billDiscountValue ?? "0",
      billDiscountIsPercent: input.billDiscountIsPercent,
      additionalCharges: input.additionalCharges.map((c) => ({
        name: c.name,
        amount: c.amount,
        taxRate: c.taxRate ?? null,
      })),
      tcsRate: input.tcsRate ?? "0",
      roundOffEnabled: input.roundOffEnabled,
      roundOffMode: input.roundOffMode,
      paidAmount: input.paidAmount ?? "0",
      paymentMode: input.paymentMode ?? null,
      chequeNo: input.chequeNo ?? null,
      notes: input.notes ?? null,
      terms: input.terms ?? null,
      convertedFromId: input.convertedFromId ?? null,
    };

    const postingCtx = {
      companyId: ctx.companyId,
      firmId: ctx.firmId,
      userId: ctx.user.id,
      fyStartMonth: ctx.fyStartMonth,
      stopSaleOnNegativeStock: settings.general.stopSaleOnNegativeStock,
    };

    const result = await prisma.$transaction(async (tx) => {
      if (input.id) {
        const existing = await tx.transaction.findFirst({
          where: { id: input.id, companyId: ctx.companyId, deletedAt: null },
          select: { id: true, number: true, type: true, convertedFromId: true },
        });
        if (!existing) throw new BusinessError("That transaction no longer exists");

        // Keep the original number unless the user typed a new one.
        const keepNumber = input.number ?? existing.number;

        await tx.transaction.update({
          where: { id: existing.id },
          data: { deletedAt: new Date() },
        });
        await tx.stockMovement.deleteMany({ where: { transactionId: existing.id } });
        await tx.ledgerEntry.deleteMany({ where: { transactionId: existing.id } });
        await tx.paymentAllocation.deleteMany({
          where: { paymentTransactionId: existing.id },
        });
        // Hard-remove the superseded row so its number is free to reuse.
        await tx.transaction.delete({ where: { id: existing.id } });

        return postTransaction(tx, postingCtx, {
          ...postingInput,
          number: keepNumber,
          convertedFromId: existing.convertedFromId ?? postingInput.convertedFromId,
        });
      }

      return postTransaction(tx, postingCtx, postingInput);
    });

    await writeAudit(ctx, {
      entity: "Transaction",
      entityId: result.id,
      action: input.id ? "UPDATE" : "CREATE",
      firmId: ctx.firmId,
      after: { type: input.type, number: result.number, total: result.total },
    });

    revalidatePath(listPathFor(input.type));
    revalidatePath("/dashboard");
    return result;
  });
}

/** Payment-In / Payment-Out, with allocation against open invoices. */
export async function savePaymentAction(
  raw: unknown,
): Promise<ActionResult<{ id: string; number: string }>> {
  return runAction(paymentSchema, raw, async (input) => {
    const ctx = await requireFirmPermission(permissionFor(input.type), input.firmId);
    const date = parseDateInput(input.date) ?? todayIST();

    const allocationTotal = input.allocations.reduce((acc, a) => acc + Number(a.amount), 0);
    if (allocationTotal > Number(input.amount) + 0.005) {
      throw new BusinessError(
        "The allocated amount is more than the payment. Reduce an allocation, or raise the payment.",
      );
    }

    const result = await prisma.$transaction(async (tx) => {
      const posted = await postTransaction(
        tx,
        {
          companyId: ctx.companyId,
          firmId: ctx.firmId,
          userId: ctx.user.id,
          fyStartMonth: ctx.fyStartMonth,
          stopSaleOnNegativeStock: false,
        },
        {
          type: input.type,
          date,
          partyId: input.partyId,
          bankAccountId: input.bankAccountId ?? null,
          number: input.number ?? null,
          isIgst: false,
          lines: [],
          paidAmount: input.amount,
          paymentMode: input.paymentMode,
          chequeNo: input.chequeNo ?? null,
          notes: input.notes ?? null,
        },
      );

      // Link the payment to the invoices it settles, and refresh their balances.
      for (const allocation of input.allocations) {
        if (Number(allocation.amount) <= 0) continue;

        const invoice = await tx.transaction.findFirst({
          where: { id: allocation.invoiceId, companyId: ctx.companyId, deletedAt: null },
          select: { id: true, total: true, paidAmount: true },
        });
        if (!invoice) continue;

        await tx.paymentAllocation.create({
          data: {
            companyId: ctx.companyId,
            paymentTransactionId: posted.id,
            invoiceTransactionId: invoice.id,
            amount: allocation.amount,
          },
        });

        const paid = Number(invoice.paidAmount) + Number(allocation.amount);
        const total = Number(invoice.total);

        await tx.transaction.update({
          where: { id: invoice.id },
          data: {
            paidAmount: paid.toFixed(2),
            balanceAmount: (total - paid).toFixed(2),
            status: paid >= total - 0.005 ? "PAID" : paid > 0 ? "PARTIAL" : "OPEN",
          },
        });
      }

      return posted;
    });

    await writeAudit(ctx, {
      entity: "Transaction",
      entityId: result.id,
      action: "CREATE",
      firmId: ctx.firmId,
      after: { type: input.type, amount: input.amount },
    });

    revalidatePath(listPathFor(input.type));
    revalidatePath("/dashboard");
    return { id: result.id, number: result.number };
  });
}

/** Soft-delete a transaction and reverse every posting it made. */
export async function deleteTransactionAction(
  raw: unknown,
): Promise<ActionResult<{ id: string }>> {
  return runAction(deleteTransactionSchema, raw, async ({ id }) => {
    const ctx = await requirePermission("transaction.delete");

    const existing = await ctx.db.transaction.findFirst({
      where: { id },
      select: { id: true, type: true, number: true },
    });
    if (!existing) throw new BusinessError("That transaction no longer exists");

    await prisma.$transaction(async (tx) => {
      // Restore the balance of any invoice this payment had settled.
      const allocations = await tx.paymentAllocation.findMany({
        where: { companyId: ctx.companyId, paymentTransactionId: id },
        select: { invoiceTransactionId: true, amount: true },
      });

      for (const allocation of allocations) {
        const invoice = await tx.transaction.findFirst({
          where: { id: allocation.invoiceTransactionId, companyId: ctx.companyId },
          select: { id: true, total: true, paidAmount: true },
        });
        if (!invoice) continue;

        const paid = Math.max(0, Number(invoice.paidAmount) - Number(allocation.amount));
        const total = Number(invoice.total);

        await tx.transaction.update({
          where: { id: invoice.id },
          data: {
            paidAmount: paid.toFixed(2),
            balanceAmount: (total - paid).toFixed(2),
            status: paid >= total - 0.005 ? "PAID" : paid > 0 ? "PARTIAL" : "OPEN",
          },
        });
      }

      await reverseTransaction(tx, ctx.companyId, id);
    });

    await writeAudit(ctx, {
      entity: "Transaction",
      entityId: id,
      action: "DELETE",
      before: { type: existing.type, number: existing.number },
    });

    revalidatePath(listPathFor(existing.type));
    revalidatePath("/dashboard");
    return { id };
  });
}

/**
 * Convert a document to the next stage.
 *
 * The source is stamped with `convertedToId` so it can never be converted
 * twice — the guard the brief asks for.
 */
export async function convertTransactionAction(
  raw: unknown,
): Promise<ActionResult<{ id: string; type: TransactionType }>> {
  return runAction(convertTransactionSchema, raw, async ({ id, toType }) => {
    const ctx = await requirePermission(permissionFor(toType));

    const source = await ctx.db.transaction.findFirst({
      where: { id },
      select: {
        id: true,
        type: true,
        firmId: true,
        partyId: true,
        stateOfSupply: true,
        isIgst: true,
        notes: true,
        terms: true,
        convertedToId: true,
        discountValue: true,
        discountIsPercent: true,
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

    if (!source) throw new BusinessError("That document no longer exists");

    if (source.convertedToId) {
      throw new BusinessError("This document has already been converted");
    }

    const allowed = CONVERSIONS[source.type] ?? [];
    if (!allowed.includes(toType)) {
      throw new BusinessError(`A ${source.type} cannot be converted to a ${toType}`);
    }

    const settingsRow = await ctx.db.settings.findFirst({
      where: { companyId: ctx.companyId },
      select: SETTINGS_SELECT,
    });
    const settings = parseSettings(settingsRow);

    const created = await prisma.$transaction(async (tx) => {
      const posted = await postTransaction(
        tx,
        {
          companyId: ctx.companyId,
          firmId: source.firmId,
          userId: ctx.user.id,
          fyStartMonth: ctx.fyStartMonth,
          stopSaleOnNegativeStock: settings.general.stopSaleOnNegativeStock,
        },
        {
          type: toType,
          date: todayIST(),
          partyId: source.partyId,
          stateOfSupply: source.stateOfSupply,
          isIgst: source.isIgst,
          notes: source.notes,
          terms: source.terms,
          billDiscountValue: source.discountValue.toFixed(2),
          billDiscountIsPercent: source.discountIsPercent,
          roundOffEnabled: settings.transaction.roundOffEnabled,
          roundOffMode: settings.transaction.roundOffMode,
          convertedFromId: source.id,
          lines: source.lines.map((l) => ({
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
        },
      );

      await tx.transaction.update({
        where: { id: source.id },
        data: { convertedToId: posted.id, status: "CLOSED" },
      });

      return posted;
    });

    revalidatePath(listPathFor(source.type));
    revalidatePath(listPathFor(toType));
    return { id: created.id, type: toType };
  });
}

/** Open invoices for a party, for the payment allocation table. */
export async function openInvoicesForPartyAction(partyId: string, forPayment: "IN" | "OUT") {
  const ctx = await requirePermission(forPayment === "IN" ? "sale.read" : "purchase.read");

  const rows = await ctx.db.transaction.findMany({
    where: {
      partyId,
      type: forPayment === "IN" ? TransactionType.SALE : TransactionType.PURCHASE,
      balanceAmount: { gt: 0 },
    },
    orderBy: { date: "asc" },
    select: {
      id: true,
      number: true,
      numberPrefix: true,
      date: true,
      total: true,
      balanceAmount: true,
    },
  });

  return rows.map((r) => ({
    id: r.id,
    displayNumber: `${r.numberPrefix}${r.number}`,
    date: r.date.toISOString(),
    total: r.total.toFixed(2),
    balance: r.balanceAmount.toFixed(2),
  }));
}
