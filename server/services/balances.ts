import { LedgerAccountType, Prisma } from "@prisma/client";
import Decimal from "decimal.js";
import { prisma } from "@/lib/db/prisma";
import { d } from "@/lib/calc";

/**
 * Every balance in the application is a SUM over LedgerEntry or StockMovement.
 * Nothing here reads a stored counter (D-06), which is what makes
 * "Verify My Data" meaningful rather than decorative.
 */

export interface PartyBalance {
  partyId: string;
  /** Positive means the party owes us; negative means we owe them. */
  balance: Decimal;
}

/** Closing balance per party, including each party's opening balance. */
export async function partyBalances(
  companyId: string,
  partyIds?: string[],
): Promise<Map<string, Decimal>> {
  const where: Prisma.LedgerEntryWhereInput = {
    companyId,
    accountType: LedgerAccountType.PARTY,
    ...(partyIds ? { partyId: { in: partyIds } } : {}),
  };

  const [entries, parties] = await Promise.all([
    prisma.ledgerEntry.groupBy({
      by: ["partyId"],
      where,
      _sum: { debit: true, credit: true },
    }),
    prisma.party.findMany({
      where: {
        companyId,
        deletedAt: null,
        ...(partyIds ? { id: { in: partyIds } } : {}),
      },
      select: { id: true, openingBalance: true, openingBalanceType: true },
    }),
  ]);

  const result = new Map<string, Decimal>();

  // Opening balance first: TO_RECEIVE is a debit, TO_PAY is a credit.
  for (const party of parties) {
    const opening = d(party.openingBalance.toString());
    result.set(
      party.id,
      party.openingBalanceType === "TO_RECEIVE" ? opening : opening.negated(),
    );
  }

  for (const row of entries) {
    if (!row.partyId) continue;
    const movement = d(row._sum.debit?.toString() ?? 0).minus(d(row._sum.credit?.toString() ?? 0));
    result.set(row.partyId, (result.get(row.partyId) ?? new Decimal(0)).plus(movement));
  }

  return result;
}

export interface ReceivablePayable {
  receivable: Decimal;
  payable: Decimal;
  receivableParties: number;
  payableParties: number;
}

/** The two dashboard KPI cards (ref-01). */
export async function receivablePayable(companyId: string): Promise<ReceivablePayable> {
  const balances = await partyBalances(companyId);

  let receivable = new Decimal(0);
  let payable = new Decimal(0);
  let receivableParties = 0;
  let payableParties = 0;

  for (const balance of balances.values()) {
    if (balance.greaterThan(0)) {
      receivable = receivable.plus(balance);
      receivableParties += 1;
    } else if (balance.lessThan(0)) {
      payable = payable.plus(balance.abs());
      payableParties += 1;
    }
  }

  return { receivable, payable, receivableParties, payableParties };
}

/** Stock on hand per item. */
export async function stockLevels(
  companyId: string,
  itemIds?: string[],
): Promise<Map<string, Decimal>> {
  const rows = await prisma.stockMovement.groupBy({
    by: ["itemId"],
    where: { companyId, ...(itemIds ? { itemId: { in: itemIds } } : {}) },
    _sum: { qtyIn: true, qtyOut: true },
  });

  const result = new Map<string, Decimal>();
  for (const row of rows) {
    result.set(
      row.itemId,
      d(row._sum.qtyIn?.toString() ?? 0).minus(d(row._sum.qtyOut?.toString() ?? 0)),
    );
  }
  return result;
}

/** Cash in hand, derived from the ledger. */
export async function cashBalance(companyId: string): Promise<Decimal> {
  const row = await prisma.ledgerEntry.aggregate({
    where: { companyId, accountType: LedgerAccountType.CASH },
    _sum: { debit: true, credit: true },
  });
  return d(row._sum.debit?.toString() ?? 0).minus(d(row._sum.credit?.toString() ?? 0));
}

/** Balance per bank account, including opening balances. */
export async function bankBalances(companyId: string): Promise<Map<string, Decimal>> {
  const [entries, accounts] = await Promise.all([
    prisma.ledgerEntry.groupBy({
      by: ["bankAccountId"],
      where: { companyId, accountType: LedgerAccountType.BANK },
      _sum: { debit: true, credit: true },
    }),
    prisma.bankAccount.findMany({
      where: { companyId, deletedAt: null },
      select: { id: true, openingBalance: true },
    }),
  ]);

  const result = new Map<string, Decimal>();
  for (const account of accounts) {
    result.set(account.id, d(account.openingBalance.toString()));
  }
  for (const row of entries) {
    if (!row.bankAccountId) continue;
    const movement = d(row._sum.debit?.toString() ?? 0).minus(d(row._sum.credit?.toString() ?? 0));
    result.set(row.bankAccountId, (result.get(row.bankAccountId) ?? new Decimal(0)).plus(movement));
  }
  return result;
}

/** Items at or below their minimum stock level — the low-stock widget. */
export async function lowStockItems(companyId: string, limit = 10) {
  const items = await prisma.item.findMany({
    where: { companyId, deletedAt: null, type: "PRODUCT", isActive: true },
    select: { id: true, name: true, minStockQty: true },
  });

  const levels = await stockLevels(
    companyId,
    items.map((i) => i.id),
  );

  return items
    .map((item) => ({
      id: item.id,
      name: item.name,
      onHand: levels.get(item.id) ?? new Decimal(0),
      minQty: d(item.minStockQty.toString()),
    }))
    .filter((i) => i.onHand.lessThanOrEqualTo(i.minQty))
    .sort((a, b) => a.onHand.minus(a.minQty).comparedTo(b.onHand.minus(b.minQty)))
    .slice(0, limit);
}

/**
 * Confirm the ledger balances. Used by "Verify My Data" and by the posting
 * tests: if total debits ever diverge from total credits, a posting path is
 * wrong and every financial report built on it is wrong too.
 */
export async function ledgerIsBalanced(
  companyId: string,
): Promise<{ balanced: boolean; debit: Decimal; credit: Decimal }> {
  const row = await prisma.ledgerEntry.aggregate({
    where: { companyId },
    _sum: { debit: true, credit: true },
  });

  const debit = d(row._sum.debit?.toString() ?? 0);
  const credit = d(row._sum.credit?.toString() ?? 0);

  return { balanced: debit.equals(credit), debit, credit };
}
