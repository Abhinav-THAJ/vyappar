"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { LedgerAccountType, TransactionType } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { requirePermission, requireFirmPermission } from "@/lib/auth/session";
import {
  bankAccountSchema,
  transferSchema,
  cashAdjustSchema,
  chequeStatusSchema,
  loanAccountSchema,
  loanTransactionSchema,
} from "@/lib/validators/cashbank";
import { parseDateInput, todayIST } from "@/lib/format/date";
import { financialYearOf } from "@/lib/fy";
import { writeAudit } from "@/server/services/audit";
import { runAction, BusinessError, type ActionResult } from "@/server/guards/action";

export async function saveBankAccountAction(raw: unknown): Promise<ActionResult<{ id: string }>> {
  return runAction(bankAccountSchema, raw, async (input) => {
    const ctx = await requirePermission("cashbank.write");

    const duplicate = await ctx.db.bankAccount.findFirst({
      where: { displayName: input.displayName, ...(input.id ? { id: { not: input.id } } : {}) },
      select: { id: true },
    });
    if (duplicate) {
      throw new BusinessError("An account with that name already exists", {
        displayName: ["An account with that name already exists"],
      });
    }

    const data = {
      displayName: input.displayName,
      bankName: input.bankName ?? null,
      accountNumber: input.accountNumber ?? null,
      ifsc: input.ifsc?.toUpperCase() ?? null,
      upiId: input.upiId ?? null,
      openingBalance: input.openingBalance,
      openingAsOf: input.openingAsOf ? parseDateInput(input.openingAsOf) : null,
    };

    const id = input.id
      ? (await ctx.db.bankAccount.update({ where: { id: input.id }, data })).id
      : (
          await ctx.db.bankAccount.create({
            data: { ...data, companyId: ctx.companyId },
            select: { id: true },
          })
        ).id;

    await writeAudit(ctx, {
      entity: "BankAccount",
      entityId: id,
      action: input.id ? "UPDATE" : "CREATE",
      after: data,
    });

    revalidatePath("/cash-bank/banks");
    return { id };
  });
}

export async function deleteBankAccountAction(raw: unknown): Promise<ActionResult<{ id: string }>> {
  return runAction(z.object({ id: z.string().min(1) }), raw, async ({ id }) => {
    const ctx = await requirePermission("cashbank.write");

    const used = await prisma.ledgerEntry.count({
      where: { companyId: ctx.companyId, bankAccountId: id },
    });
    if (used > 0) {
      throw new BusinessError(
        `This account has ${used} ledger entr${used === 1 ? "y" : "ies"} and cannot be deleted.`,
      );
    }

    await ctx.db.bankAccount.update({ where: { id }, data: { deletedAt: new Date() } });
    revalidatePath("/cash-bank/banks");
    return { id };
  });
}

/**
 * Money moving between the firm's own accounts.
 *
 * Posted as a paired ledger entry with no party, so it changes where the money
 * sits without touching revenue, expenses or any party balance.
 */
export async function saveTransferAction(raw: unknown): Promise<ActionResult<{ id: string }>> {
  return runAction(transferSchema, raw, async (input) => {
    const ctx = await requireFirmPermission("cashbank.write");
    const date = parseDateInput(input.date) ?? todayIST();
    const financialYear = financialYearOf(date, ctx.fyStartMonth);

    const fromIsCash = input.kind === "CASH_TO_BANK";
    const toIsCash = input.kind === "BANK_TO_CASH";

    const id = await prisma.$transaction(async (tx) => {
      const count = await tx.transaction.count({
        where: {
          firmId: ctx.firmId,
          type: TransactionType.BANK_TRANSFER,
          financialYear,
        },
      });

      const txn = await tx.transaction.create({
        data: {
          companyId: ctx.companyId,
          firmId: ctx.firmId,
          type: TransactionType.BANK_TRANSFER,
          number: String(count + 1),
          numberPrefix: "TRF-",
          financialYear,
          date,
          bankAccountId: input.fromBankAccountId ?? null,
          toBankAccountId: input.toBankAccountId ?? null,
          isIgst: false,
          total: input.amount,
          paidAmount: input.amount,
          balanceAmount: "0",
          notes: [input.reference, input.notes].filter(Boolean).join(" — ") || null,
          status: "CLOSED",
          createdById: ctx.user.id,
        },
        select: { id: true },
      });

      // Debit where the money lands, credit where it left.
      await tx.ledgerEntry.createMany({
        data: [
          {
            companyId: ctx.companyId,
            transactionId: txn.id,
            accountType: toIsCash ? LedgerAccountType.CASH : LedgerAccountType.BANK,
            bankAccountId: toIsCash ? null : (input.toBankAccountId ?? null),
            date,
            debit: input.amount,
            credit: "0",
            narration: "Transfer in",
          },
          {
            companyId: ctx.companyId,
            transactionId: txn.id,
            accountType: fromIsCash ? LedgerAccountType.CASH : LedgerAccountType.BANK,
            bankAccountId: fromIsCash ? null : (input.fromBankAccountId ?? null),
            date,
            debit: "0",
            credit: input.amount,
            narration: "Transfer out",
          },
        ],
      });

      return txn.id;
    });

    revalidatePath("/cash-bank/transfers");
    revalidatePath("/cash-bank/banks");
    revalidatePath("/cash-bank/cash");
    return { id };
  });
}

/** Adjust cash in hand — a correction after a physical count. */
export async function adjustCashAction(raw: unknown): Promise<ActionResult<{ id: string }>> {
  return runAction(cashAdjustSchema, raw, async (input) => {
    const ctx = await requireFirmPermission("cashbank.write");
    const date = parseDateInput(input.date) ?? todayIST();
    const financialYear = financialYearOf(date, ctx.fyStartMonth);
    const isAdd = input.direction === "ADD";

    const id = await prisma.$transaction(async (tx) => {
      const count = await tx.transaction.count({
        where: { firmId: ctx.firmId, type: TransactionType.CASH_ADJUSTMENT, financialYear },
      });

      const txn = await tx.transaction.create({
        data: {
          companyId: ctx.companyId,
          firmId: ctx.firmId,
          type: TransactionType.CASH_ADJUSTMENT,
          number: String(count + 1),
          numberPrefix: "CADJ-",
          financialYear,
          date,
          isIgst: false,
          total: input.amount,
          paidAmount: input.amount,
          balanceAmount: "0",
          notes: input.notes ?? null,
          status: "CLOSED",
          createdById: ctx.user.id,
        },
        select: { id: true },
      });

      // The balancing side is capital: an adjustment is not income or expense.
      await tx.ledgerEntry.createMany({
        data: [
          {
            companyId: ctx.companyId,
            transactionId: txn.id,
            accountType: LedgerAccountType.CASH,
            date,
            debit: isAdd ? input.amount : "0",
            credit: isAdd ? "0" : input.amount,
            narration: "Cash adjustment",
          },
          {
            companyId: ctx.companyId,
            transactionId: txn.id,
            accountType: LedgerAccountType.CAPITAL,
            accountKey: "CASH_ADJUSTMENT",
            date,
            debit: isAdd ? "0" : input.amount,
            credit: isAdd ? input.amount : "0",
            narration: "Cash adjustment",
          },
        ],
      });

      return txn.id;
    });

    revalidatePath("/cash-bank/cash");
    return { id };
  });
}

/** Move a cheque through open -> deposited/withdrawn, or mark it bounced. */
export async function updateChequeStatusAction(
  raw: unknown,
): Promise<ActionResult<{ id: string }>> {
  return runAction(chequeStatusSchema, raw, async (input) => {
    const ctx = await requirePermission("cashbank.write");

    const cheque = await ctx.db.cheque.findFirst({
      where: { id: input.id },
      select: { id: true, status: true },
    });
    if (!cheque) throw new BusinessError("That cheque no longer exists");

    await ctx.db.cheque.update({
      where: { id: input.id },
      data: {
        status: input.status,
        closedOn:
          input.status === "OPEN"
            ? null
            : input.closedOn
              ? parseDateInput(input.closedOn)
              : todayIST(),
      },
    });

    await writeAudit(ctx, {
      entity: "Cheque",
      entityId: input.id,
      action: "UPDATE",
      before: { status: cheque.status },
      after: { status: input.status },
    });

    revalidatePath("/cash-bank/cheques");
    return { id: input.id };
  });
}

export async function saveLoanAccountAction(raw: unknown): Promise<ActionResult<{ id: string }>> {
  return runAction(loanAccountSchema, raw, async (input) => {
    const ctx = await requirePermission("cashbank.write");

    const data = {
      lenderName: input.lenderName,
      accountNumber: input.accountNumber ?? null,
      openingBalance: input.openingBalance,
      openingAsOf: input.openingAsOf ? parseDateInput(input.openingAsOf) : null,
      interestRate: input.interestRate ?? null,
      termMonths: input.termMonths ?? null,
      description: input.description ?? null,
    };

    const id = input.id
      ? (await ctx.db.loanAccount.update({ where: { id: input.id }, data })).id
      : (
          await ctx.db.loanAccount.create({
            data: { ...data, companyId: ctx.companyId },
            select: { id: true },
          })
        ).id;

    revalidatePath("/cash-bank/loans");
    return { id };
  });
}

export async function saveLoanTransactionAction(
  raw: unknown,
): Promise<ActionResult<{ id: string }>> {
  return runAction(loanTransactionSchema, raw, async (input) => {
    const ctx = await requirePermission("cashbank.write");

    const loan = await ctx.db.loanAccount.findFirst({
      where: { id: input.loanAccountId },
      select: { id: true },
    });
    if (!loan) throw new BusinessError("That loan account no longer exists");

    const created = await ctx.db.loanTransaction.create({
      data: {
        companyId: ctx.companyId,
        loanAccountId: input.loanAccountId,
        date: parseDateInput(input.date) ?? todayIST(),
        principal: input.principal,
        interest: input.interest,
        charges: input.charges,
        note: input.note ?? null,
      },
      select: { id: true },
    });

    revalidatePath("/cash-bank/loans");
    return { id: created.id };
  });
}
