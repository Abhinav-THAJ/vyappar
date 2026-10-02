import Decimal from "decimal.js";
import { prisma } from "@/lib/db/prisma";
import { d } from "@/lib/calc";
import { computeTransaction } from "@/lib/calc";
import { formatDocumentNumber } from "@/lib/numbering";

export interface VerifyFinding {
  severity: "error" | "warning";
  area: string;
  message: string;
  reference?: string;
}

export interface VerifyReport {
  checkedAt: string;
  findings: VerifyFinding[];
  stats: {
    transactions: number;
    ledgerEntries: number;
    stockMovements: number;
    ledgerDebit: string;
    ledgerCredit: string;
  };
}

/**
 * Verify My Data.
 *
 * Recomputes what should be true from first principles and reports anything
 * that disagrees. This is only meaningful because balances are derived rather
 * than stored (D-06) — there is a source of truth to check against.
 */
export async function verifyCompanyData(companyId: string): Promise<VerifyReport> {
  const findings: VerifyFinding[] = [];

  const [ledgerTotals, transactions, movementCount, ledgerCount] = await Promise.all([
    prisma.ledgerEntry.aggregate({
      where: { companyId },
      _sum: { debit: true, credit: true },
    }),
    prisma.transaction.findMany({
      where: { companyId, deletedAt: null },
      select: {
        id: true,
        type: true,
        number: true,
        numberPrefix: true,
        financialYear: true,
        firmId: true,
        isIgst: true,
        taxableValue: true,
        cgst: true,
        sgst: true,
        igst: true,
        cess: true,
        tcs: true,
        roundOff: true,
        total: true,
        paidAmount: true,
        balanceAmount: true,
        discountValue: true,
        discountIsPercent: true,
        lines: {
          select: {
            qty: true,
            rate: true,
            rateIsTaxInclusive: true,
            discountValue: true,
            discountIsPercent: true,
            taxRateValue: true,
            cessRate: true,
            hsnSac: true,
            taxableValue: true,
            amount: true,
          },
        },
      },
    }),
    prisma.stockMovement.count({ where: { companyId } }),
    prisma.ledgerEntry.count({ where: { companyId } }),
  ]);

  // --- 1. The ledger must balance -----------------------------------------
  const debit = d(ledgerTotals._sum.debit?.toString() ?? 0);
  const credit = d(ledgerTotals._sum.credit?.toString() ?? 0);

  if (!debit.minus(credit).abs().lessThan("0.005")) {
    findings.push({
      severity: "error",
      area: "Ledger",
      message: `Debits (${debit.toFixed(2)}) do not equal credits (${credit.toFixed(2)}). Difference: ${debit.minus(credit).toFixed(2)}.`,
    });
  }

  // --- 2. Stored totals must match a fresh recomputation -------------------
  for (const txn of transactions) {
    if (txn.lines.length === 0) continue;

    const recomputed = computeTransaction({
      isIgst: txn.isIgst,
      lines: txn.lines.map((line, i) => ({
        key: String(i),
        qty: line.qty.toString(),
        rate: line.rate.toFixed(2),
        rateIsTaxInclusive: line.rateIsTaxInclusive,
        discountValue: line.discountValue.toFixed(2),
        discountIsPercent: line.discountIsPercent,
        taxRate: line.taxRateValue.toString(),
        cessRate: line.cessRate.toString(),
        hsnSac: line.hsnSac,
      })),
      billDiscountValue: txn.discountValue.toFixed(2),
      billDiscountIsPercent: txn.discountIsPercent,
      tcsRate: "0",
      // Round-off is stored, so feed it back rather than guessing the setting.
      roundOffEnabled: false,
    });

    const expectedTotal = d(recomputed.total).plus(d(txn.roundOff.toString())).plus(d(txn.tcs.toString()));
    const storedTotal = d(txn.total.toString());

    if (!expectedTotal.minus(storedTotal).abs().lessThan("0.02")) {
      findings.push({
        severity: "error",
        area: "Totals",
        message: `Stored total ${storedTotal.toFixed(2)} does not match a recomputation (${expectedTotal.toFixed(2)}).`,
        reference: formatDocumentNumber(txn.numberPrefix, txn.number),
      });
    }

    // --- 3. Paid + balance must equal the total ---------------------------
    const paid = d(txn.paidAmount.toString());
    const balance = d(txn.balanceAmount.toString());

    if (!paid.plus(balance).minus(storedTotal).abs().lessThan("0.02")) {
      findings.push({
        severity: "error",
        area: "Payments",
        message: `Received (${paid.toFixed(2)}) plus balance (${balance.toFixed(2)}) does not equal the total (${storedTotal.toFixed(2)}).`,
        reference: formatDocumentNumber(txn.numberPrefix, txn.number),
      });
    }

    if (balance.lessThan("-0.01")) {
      findings.push({
        severity: "warning",
        area: "Payments",
        message: `Overpaid by ${balance.abs().toFixed(2)}.`,
        reference: formatDocumentNumber(txn.numberPrefix, txn.number),
      });
    }
  }

  // --- 4. Duplicate numbers within a firm, type and year -------------------
  const seen = new Map<string, string>();
  for (const txn of transactions) {
    const key = `${txn.firmId}|${txn.type}|${txn.financialYear}|${txn.number}`;
    const existing = seen.get(key);
    if (existing) {
      findings.push({
        severity: "error",
        area: "Numbering",
        message: `Number ${formatDocumentNumber(txn.numberPrefix, txn.number)} is used twice for this document type in ${txn.financialYear}.`,
        reference: formatDocumentNumber(txn.numberPrefix, txn.number),
      });
    }
    seen.set(key, txn.id);
  }

  // --- 5. Orphaned ledger entries and movements ---------------------------
  const [orphanLedger, orphanStock] = await Promise.all([
    prisma.ledgerEntry.count({
      where: { companyId, transactionId: { not: null }, transaction: { deletedAt: { not: null } } },
    }),
    prisma.stockMovement.count({
      where: { companyId, transactionId: { not: null }, transaction: { deletedAt: { not: null } } },
    }),
  ]);

  if (orphanLedger > 0) {
    findings.push({
      severity: "error",
      area: "Ledger",
      message: `${orphanLedger} ledger entr${orphanLedger === 1 ? "y belongs" : "ies belong"} to a deleted transaction.`,
    });
  }
  if (orphanStock > 0) {
    findings.push({
      severity: "error",
      area: "Stock",
      message: `${orphanStock} stock movement${orphanStock === 1 ? "" : "s"} belong to a deleted transaction.`,
    });
  }

  // --- 6. Negative stock, reported as information -------------------------
  const stockByItem = await prisma.stockMovement.groupBy({
    by: ["itemId"],
    where: { companyId },
    _sum: { qtyIn: true, qtyOut: true },
  });

  const negative = stockByItem.filter((row) =>
    d(row._sum.qtyIn?.toString() ?? 0).minus(d(row._sum.qtyOut?.toString() ?? 0)).lessThan(0),
  );

  if (negative.length > 0) {
    const items = await prisma.item.findMany({
      where: { id: { in: negative.slice(0, 10).map((n) => n.itemId) } },
      select: { name: true },
    });

    findings.push({
      severity: "warning",
      area: "Stock",
      message:
        `${negative.length} item${negative.length === 1 ? " is" : "s are"} at negative stock` +
        (items.length > 0 ? `: ${items.map((i) => i.name).join(", ")}` : "") +
        `. This is allowed unless "Stop Sale on Negative Stock" is on.`,
    });
  }

  return {
    checkedAt: new Date().toISOString(),
    findings,
    stats: {
      transactions: transactions.length,
      ledgerEntries: ledgerCount,
      stockMovements: movementCount,
      ledgerDebit: debit.toFixed(2),
      ledgerCredit: credit.toFixed(2),
    },
  };
}

/** Everything in the company, for the JSON backup. */
export async function exportCompanyData(companyId: string) {
  const [company, firms, settings, parties, partyGroups, items, categories, units, taxRates, expenseCategories, transactions, bankAccounts, stockMovements, ledgerEntries] =
    await Promise.all([
      prisma.company.findUnique({ where: { id: companyId } }),
      prisma.firm.findMany({ where: { companyId } }),
      prisma.settings.findUnique({ where: { companyId } }),
      prisma.party.findMany({ where: { companyId } }),
      prisma.partyGroup.findMany({ where: { companyId } }),
      prisma.item.findMany({ where: { companyId } }),
      prisma.itemCategory.findMany({ where: { companyId } }),
      prisma.unit.findMany({ where: { companyId } }),
      prisma.taxRate.findMany({ where: { companyId } }),
      prisma.expenseCategory.findMany({ where: { companyId } }),
      prisma.transaction.findMany({
        where: { companyId },
        include: { lines: true, taxes: true },
      }),
      prisma.bankAccount.findMany({ where: { companyId } }),
      prisma.stockMovement.findMany({ where: { companyId } }),
      prisma.ledgerEntry.findMany({ where: { companyId } }),
    ]);

  return {
    format: "bella-books-backup",
    version: 1,
    exportedAt: new Date().toISOString(),
    company,
    firms,
    settings,
    partyGroups,
    parties,
    units,
    categories,
    taxRates,
    items,
    expenseCategories,
    bankAccounts,
    transactions,
    stockMovements,
    ledgerEntries,
  };
}

/** Closing balances to carry into the next financial year. */
export async function financialYearClosing(companyId: string, asOf: Date) {
  const [partyRows, cash, bank, stock] = await Promise.all([
    prisma.ledgerEntry.groupBy({
      by: ["partyId"],
      where: { companyId, accountType: "PARTY", date: { lte: asOf } },
      _sum: { debit: true, credit: true },
    }),
    prisma.ledgerEntry.aggregate({
      where: { companyId, accountType: "CASH", date: { lte: asOf } },
      _sum: { debit: true, credit: true },
    }),
    prisma.ledgerEntry.groupBy({
      by: ["bankAccountId"],
      where: { companyId, accountType: "BANK", date: { lte: asOf } },
      _sum: { debit: true, credit: true },
    }),
    prisma.stockMovement.groupBy({
      by: ["itemId"],
      where: { companyId, date: { lte: asOf } },
      _sum: { qtyIn: true, qtyOut: true },
    }),
  ]);

  const parties = partyRows
    .filter((row) => !!row.partyId)
    .map((row) => ({
      partyId: row.partyId!,
      balance: d(row._sum.debit?.toString() ?? 0)
        .minus(d(row._sum.credit?.toString() ?? 0))
        .toFixed(2),
    }))
    .filter((row) => !new Decimal(row.balance).isZero());

  return {
    asOf: asOf.toISOString(),
    parties,
    cash: d(cash._sum.debit?.toString() ?? 0)
      .minus(d(cash._sum.credit?.toString() ?? 0))
      .toFixed(2),
    banks: bank
      .filter((b) => !!b.bankAccountId)
      .map((b) => ({
        bankAccountId: b.bankAccountId!,
        balance: d(b._sum.debit?.toString() ?? 0)
          .minus(d(b._sum.credit?.toString() ?? 0))
          .toFixed(2),
      })),
    stock: stock
      .map((s) => ({
        itemId: s.itemId,
        qty: d(s._sum.qtyIn?.toString() ?? 0)
          .minus(d(s._sum.qtyOut?.toString() ?? 0))
          .toFixed(3),
      }))
      .filter((s) => !new Decimal(s.qty).isZero()),
  };
}
