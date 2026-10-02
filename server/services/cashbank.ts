import { LedgerAccountType } from "@prisma/client";
import Decimal from "decimal.js";
import { prisma } from "@/lib/db/prisma";
import { d } from "@/lib/calc";
import { formatDocumentNumber } from "@/lib/numbering";
import { bankBalances, cashBalance } from "./balances";

export interface LedgerRow {
  id: string;
  date: string;
  narration: string;
  reference: string | null;
  partyName: string | null;
  debit: string;
  credit: string;
  /** Running balance after this row. */
  balance: string;
}

/**
 * A running-balance statement for one account.
 *
 * The opening balance is applied first, then each entry in date order, so the
 * closing figure always matches the summary card above it.
 */
export async function accountStatement(
  companyId: string,
  account: { type: LedgerAccountType; bankAccountId?: string | null },
  range: { from: Date; to: Date },
): Promise<{ opening: string; rows: LedgerRow[]; closing: string }> {
  const where = {
    companyId,
    accountType: account.type,
    ...(account.bankAccountId ? { bankAccountId: account.bankAccountId } : {}),
  };

  const [before, entries, bankOpening] = await Promise.all([
    prisma.ledgerEntry.aggregate({
      where: { ...where, date: { lt: range.from } },
      _sum: { debit: true, credit: true },
    }),
    prisma.ledgerEntry.findMany({
      where: { ...where, date: { gte: range.from, lte: range.to } },
      orderBy: [{ date: "asc" }, { createdAt: "asc" }],
      select: {
        id: true,
        date: true,
        debit: true,
        credit: true,
        narration: true,
        party: { select: { name: true } },
        transaction: {
          select: { number: true, numberPrefix: true, type: true },
        },
      },
    }),
    account.bankAccountId
      ? prisma.bankAccount.findUnique({
          where: { id: account.bankAccountId },
          select: { openingBalance: true },
        })
      : Promise.resolve(null),
  ]);

  let running = d(before._sum.debit?.toString() ?? 0)
    .minus(d(before._sum.credit?.toString() ?? 0))
    .plus(d(bankOpening?.openingBalance.toString() ?? 0));

  const opening = running;

  const rows: LedgerRow[] = entries.map((entry) => {
    running = running.plus(d(entry.debit.toString())).minus(d(entry.credit.toString()));

    return {
      id: entry.id,
      date: entry.date.toISOString(),
      narration: entry.narration ?? entry.transaction?.type ?? "Entry",
      reference: entry.transaction
        ? formatDocumentNumber(entry.transaction.numberPrefix, entry.transaction.number)
        : null,
      partyName: entry.party?.name ?? null,
      debit: entry.debit.toFixed(2),
      credit: entry.credit.toFixed(2),
      balance: running.toFixed(2),
    };
  });

  return { opening: opening.toFixed(2), rows, closing: running.toFixed(2) };
}

/** Bank accounts with their derived balances. */
export async function listBankAccounts(companyId: string) {
  const [accounts, balances] = await Promise.all([
    prisma.bankAccount.findMany({
      where: { companyId, deletedAt: null },
      orderBy: { displayName: "asc" },
      select: {
        id: true,
        displayName: true,
        bankName: true,
        accountNumber: true,
        ifsc: true,
        upiId: true,
        openingBalance: true,
        openingAsOf: true,
        isActive: true,
      },
    }),
    bankBalances(companyId),
  ]);

  return accounts.map((a) => ({
    id: a.id,
    displayName: a.displayName,
    bankName: a.bankName,
    accountNumber: a.accountNumber,
    ifsc: a.ifsc,
    upiId: a.upiId,
    openingBalance: a.openingBalance.toFixed(2),
    openingAsOf: a.openingAsOf?.toISOString() ?? null,
    isActive: a.isActive,
    balance: (balances.get(a.id) ?? new Decimal(0)).toFixed(2),
  }));
}

export async function cashInHand(companyId: string): Promise<string> {
  return (await cashBalance(companyId)).toFixed(2);
}

/** The cheque register. */
export async function listCheques(companyId: string, status?: string) {
  const cheques = await prisma.cheque.findMany({
    where: {
      companyId,
      ...(status && status !== "all"
        ? { status: status as "OPEN" | "DEPOSITED" | "WITHDRAWN" | "BOUNCED" }
        : {}),
    },
    orderBy: [{ status: "asc" }, { dueDate: "asc" }],
    select: {
      id: true,
      chequeNumber: true,
      amount: true,
      dueDate: true,
      status: true,
      closedOn: true,
      party: { select: { name: true } },
      bankAccount: { select: { displayName: true } },
      transaction: {
        select: { id: true, number: true, numberPrefix: true, type: true, date: true },
      },
    },
  });

  return cheques.map((c) => ({
    id: c.id,
    chequeNumber: c.chequeNumber,
    amount: c.amount.toFixed(2),
    dueDate: c.dueDate?.toISOString() ?? null,
    status: c.status,
    closedOn: c.closedOn?.toISOString() ?? null,
    partyName: c.party?.name ?? null,
    bankName: c.bankAccount?.displayName ?? null,
    transactionId: c.transaction.id,
    displayNumber: formatDocumentNumber(
      c.transaction.numberPrefix,
      c.transaction.number,
    ),
    transactionDate: c.transaction.date.toISOString(),
  }));
}

/** Loan accounts with outstanding balances derived from their repayments. */
export async function listLoanAccounts(companyId: string) {
  const [loans, repayments] = await Promise.all([
    prisma.loanAccount.findMany({
      where: { companyId, deletedAt: null },
      orderBy: { lenderName: "asc" },
      select: {
        id: true,
        lenderName: true,
        accountNumber: true,
        openingBalance: true,
        openingAsOf: true,
        interestRate: true,
        termMonths: true,
        description: true,
      },
    }),
    prisma.loanTransaction.groupBy({
      by: ["loanAccountId"],
      where: { companyId },
      _sum: { principal: true, interest: true, charges: true },
    }),
  ]);

  const paid = new Map(
    repayments.map((r) => [r.loanAccountId, d(r._sum.principal?.toString() ?? 0)]),
  );

  return loans.map((l) => ({
    id: l.id,
    lenderName: l.lenderName,
    accountNumber: l.accountNumber,
    openingBalance: l.openingBalance.toFixed(2),
    openingAsOf: l.openingAsOf?.toISOString() ?? null,
    interestRate: l.interestRate?.toString() ?? null,
    termMonths: l.termMonths,
    description: l.description,
    outstanding: d(l.openingBalance.toString())
      .minus(paid.get(l.id) ?? new Decimal(0))
      .toFixed(2),
  }));
}

/** Transfers between the firm's own accounts. */
export async function listTransfers(companyId: string, range: { from: Date; to: Date }) {
  const rows = await prisma.transaction.findMany({
    where: {
      companyId,
      type: { in: ["BANK_TRANSFER", "CASH_ADJUSTMENT"] },
      deletedAt: null,
      date: { gte: range.from, lte: range.to },
    },
    orderBy: { date: "desc" },
    select: {
      id: true,
      type: true,
      number: true,
      numberPrefix: true,
      date: true,
      total: true,
      notes: true,
      bankAccount: { select: { displayName: true } },
      toBankAccount: { select: { displayName: true } },
    },
  });

  return rows.map((r) => ({
    id: r.id,
    type: r.type,
    displayNumber: formatDocumentNumber(r.numberPrefix, r.number),
    date: r.date.toISOString(),
    amount: r.total.toFixed(2),
    from: r.bankAccount?.displayName ?? "Cash",
    to: r.toBankAccount?.displayName ?? "Cash",
    notes: r.notes,
  }));
}
