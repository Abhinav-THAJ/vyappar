import { LedgerAccountType, TransactionType } from "@prisma/client";
import Decimal from "decimal.js";
import { prisma } from "@/lib/db/prisma";
import { d } from "@/lib/calc";
import { formatDocumentNumber } from "@/lib/numbering";
import { formatCurrency } from "@/lib/format/number";
import type { ReportContext, ReportDefinition, ReportFilters, ReportRow } from "./types";

/** Transactions matching the current filters. */
function txnWhere(ctx: ReportContext, f: ReportFilters, types: TransactionType[]) {
  return {
    companyId: ctx.companyId,
    deletedAt: null,
    type: { in: types },
    date: { gte: f.from, lte: f.to },
    ...(f.firmId ? { firmId: f.firmId } : {}),
    ...(f.partyId ? { partyId: f.partyId } : {}),
  };
}

async function documentRows(
  ctx: ReportContext,
  f: ReportFilters,
  types: TransactionType[],
): Promise<ReportRow[]> {
  const rows = await prisma.transaction.findMany({
    where: txnWhere(ctx, f, types),
    orderBy: [{ date: "asc" }, { number: "asc" }],
    select: {
      id: true,
      date: true,
      number: true,
      numberPrefix: true,
      type: true,
      taxableValue: true,
      cgst: true,
      sgst: true,
      igst: true,
      cess: true,
      total: true,
      paidAmount: true,
      balanceAmount: true,
      party: { select: { name: true } },
      firm: { select: { name: true } },
    },
  });

  return rows.map((r) => ({
    _id: r.id,
    date: r.date.toISOString(),
    number: formatDocumentNumber(r.numberPrefix, r.number),
    party: r.party?.name ?? "—",
    firm: r.firm.name,
    taxable: Number(r.taxableValue),
    gst: Number(r.cgst) + Number(r.sgst) + Number(r.igst) + Number(r.cess),
    total: Number(r.total),
    received: Number(r.paidAmount),
    balance: Number(r.balanceAmount),
  }));
}

function sumColumns(rows: ReportRow[], keys: string[]): Record<string, number> {
  const totals: Record<string, number> = {};
  for (const key of keys) {
    totals[key] = rows.reduce((acc, row) => acc + Number(row[key] ?? 0), 0);
  }
  return totals;
}

const DOC_COLUMNS = [
  { key: "date", label: "Date", format: "date" as const },
  { key: "number", label: "Number" },
  { key: "party", label: "Party" },
  { key: "taxable", label: "Taxable", format: "money" as const, align: "right" as const, total: true },
  { key: "gst", label: "GST", format: "money" as const, align: "right" as const, total: true },
  { key: "total", label: "Total", format: "money" as const, align: "right" as const, total: true },
  { key: "received", label: "Received", format: "money" as const, align: "right" as const, total: true },
  { key: "balance", label: "Balance", format: "money" as const, align: "right" as const, total: true },
];

const DOC_TOTAL_KEYS = ["taxable", "gst", "total", "received", "balance"];

export const saleReport: ReportDefinition = {
  slug: "sale",
  title: "Sale Report",
  description: "Every sale invoice in the period, with its tax and balance.",
  group: "Transaction",
  columns: DOC_COLUMNS,
  partyFilter: true,
  async run(ctx, f) {
    const rows = await documentRows(ctx, f, [TransactionType.SALE]);
    const totals = sumColumns(rows, DOC_TOTAL_KEYS);
    return {
      rows,
      totals,
      summary: [
        { label: "Invoices", value: String(rows.length) },
        { label: "Total", value: formatCurrency(totals.total ?? 0) },
        {
          label: "Outstanding",
          value: formatCurrency(totals.balance ?? 0),
          tone: (totals.balance ?? 0) > 0 ? "negative" : "positive",
        },
      ],
    };
  },
};

export const purchaseReport: ReportDefinition = {
  slug: "purchase",
  title: "Purchase Report",
  description: "Every purchase bill in the period.",
  group: "Transaction",
  columns: DOC_COLUMNS,
  partyFilter: true,
  async run(ctx, f) {
    const rows = await documentRows(ctx, f, [TransactionType.PURCHASE]);
    const totals = sumColumns(rows, DOC_TOTAL_KEYS);
    return {
      rows,
      totals,
      summary: [
        { label: "Bills", value: String(rows.length) },
        { label: "Total", value: formatCurrency(totals.total ?? 0) },
        { label: "Unpaid", value: formatCurrency(totals.balance ?? 0) },
      ],
    };
  },
};

export const allTransactionsReport: ReportDefinition = {
  slug: "all-transactions",
  title: "All Transactions",
  description: "Every document of every type, in date order.",
  group: "Transaction",
  partyFilter: true,
  columns: [
    { key: "date", label: "Date", format: "date" },
    { key: "type", label: "Type" },
    { key: "number", label: "Number" },
    { key: "party", label: "Party" },
    { key: "total", label: "Total", format: "money", align: "right", total: true },
    { key: "received", label: "Received", format: "money", align: "right", total: true },
    { key: "balance", label: "Balance", format: "money", align: "right", total: true },
  ],
  async run(ctx, f) {
    const rows = await prisma.transaction.findMany({
      where: {
        companyId: ctx.companyId,
        deletedAt: null,
        date: { gte: f.from, lte: f.to },
        ...(f.firmId ? { firmId: f.firmId } : {}),
        ...(f.partyId ? { partyId: f.partyId } : {}),
      },
      orderBy: [{ date: "asc" }, { createdAt: "asc" }],
      select: {
        id: true,
        date: true,
        type: true,
        number: true,
        numberPrefix: true,
        total: true,
        paidAmount: true,
        balanceAmount: true,
        party: { select: { name: true } },
      },
    });

    const mapped: ReportRow[] = rows.map((r) => ({
      _id: r.id,
      date: r.date.toISOString(),
      type: TYPE_LABEL[r.type] ?? r.type,
      number: formatDocumentNumber(r.numberPrefix, r.number),
      party: r.party?.name ?? "—",
      total: Number(r.total),
      received: Number(r.paidAmount),
      balance: Number(r.balanceAmount),
    }));

    return {
      rows: mapped,
      totals: sumColumns(mapped, ["total", "received", "balance"]),
      summary: [{ label: "Documents", value: String(mapped.length) }],
    };
  },
};

const TYPE_LABEL: Record<string, string> = {
  SALE: "Sale",
  SALE_RETURN: "Credit Note",
  ESTIMATE: "Estimate",
  PROFORMA: "Proforma",
  SALE_ORDER: "Sale Order",
  DELIVERY_CHALLAN: "Delivery Challan",
  PAYMENT_IN: "Payment-In",
  PURCHASE: "Purchase",
  PURCHASE_RETURN: "Debit Note",
  PURCHASE_ORDER: "Purchase Order",
  PAYMENT_OUT: "Payment-Out",
  EXPENSE: "Expense",
  BANK_TRANSFER: "Transfer",
  CASH_ADJUSTMENT: "Cash Adjustment",
  STOCK_ADJUSTMENT: "Stock Adjustment",
};

export const dayBookReport: ReportDefinition = {
  slug: "day-book",
  title: "Day Book",
  description: "Money in and money out, day by day.",
  group: "Transaction",
  columns: [
    { key: "date", label: "Date", format: "date" },
    { key: "type", label: "Type" },
    { key: "number", label: "Reference" },
    { key: "party", label: "Party" },
    { key: "moneyIn", label: "Money in", format: "money", align: "right", total: true },
    { key: "moneyOut", label: "Money out", format: "money", align: "right", total: true },
  ],
  async run(ctx, f) {
    const entries = await prisma.ledgerEntry.findMany({
      where: {
        companyId: ctx.companyId,
        accountType: { in: [LedgerAccountType.CASH, LedgerAccountType.BANK] },
        date: { gte: f.from, lte: f.to },
      },
      orderBy: [{ date: "asc" }, { createdAt: "asc" }],
      select: {
        id: true,
        date: true,
        debit: true,
        credit: true,
        narration: true,
        party: { select: { name: true } },
        transaction: { select: { type: true, number: true, numberPrefix: true, firmId: true } },
      },
    });

    const filtered = f.firmId
      ? entries.filter((e) => e.transaction?.firmId === f.firmId)
      : entries;

    const rows: ReportRow[] = filtered.map((e) => ({
      _id: e.id,
      date: e.date.toISOString(),
      type: e.transaction ? (TYPE_LABEL[e.transaction.type] ?? e.transaction.type) : "Entry",
      number: e.transaction
        ? formatDocumentNumber(e.transaction.numberPrefix, e.transaction.number)
        : (e.narration ?? "—"),
      party: e.party?.name ?? "—",
      moneyIn: Number(e.debit),
      moneyOut: Number(e.credit),
    }));

    const totals = sumColumns(rows, ["moneyIn", "moneyOut"]);

    return {
      rows,
      totals,
      summary: [
        { label: "Money in", value: formatCurrency(totals.moneyIn ?? 0), tone: "positive" },
        { label: "Money out", value: formatCurrency(totals.moneyOut ?? 0), tone: "negative" },
        {
          label: "Net",
          value: formatCurrency((totals.moneyIn ?? 0) - (totals.moneyOut ?? 0)),
        },
      ],
      note: "Cash and bank movements only. Credit sales appear when they are paid.",
    };
  },
};

export const profitLossReport: ReportDefinition = {
  slug: "profit-loss",
  title: "Profit & Loss",
  description: "Income less direct and indirect costs for the period.",
  group: "Transaction",
  columns: [
    { key: "particulars", label: "Particulars" },
    { key: "amount", label: "Amount", format: "money", align: "right" },
  ],
  async run(ctx, f) {
    const firmFilter = f.firmId ? { firmId: f.firmId } : {};

    const [sales, salesReturns, purchases, purchaseReturns, expenses] = await Promise.all([
      prisma.transaction.aggregate({
        where: { companyId: ctx.companyId, deletedAt: null, type: "SALE", date: { gte: f.from, lte: f.to }, ...firmFilter },
        _sum: { taxableValue: true },
      }),
      prisma.transaction.aggregate({
        where: { companyId: ctx.companyId, deletedAt: null, type: "SALE_RETURN", date: { gte: f.from, lte: f.to }, ...firmFilter },
        _sum: { taxableValue: true },
      }),
      prisma.transaction.aggregate({
        where: { companyId: ctx.companyId, deletedAt: null, type: "PURCHASE", date: { gte: f.from, lte: f.to }, ...firmFilter },
        _sum: { taxableValue: true },
      }),
      prisma.transaction.aggregate({
        where: { companyId: ctx.companyId, deletedAt: null, type: "PURCHASE_RETURN", date: { gte: f.from, lte: f.to }, ...firmFilter },
        _sum: { taxableValue: true },
      }),
      prisma.transaction.findMany({
        where: { companyId: ctx.companyId, deletedAt: null, type: "EXPENSE", date: { gte: f.from, lte: f.to }, ...firmFilter },
        select: {
          taxableValue: true,
          expenseCategory: { select: { name: true, expenseType: true } },
        },
      }),
    ]);

    const netSales = d(sales._sum.taxableValue?.toString() ?? 0).minus(
      d(salesReturns._sum.taxableValue?.toString() ?? 0),
    );
    const netPurchases = d(purchases._sum.taxableValue?.toString() ?? 0).minus(
      d(purchaseReturns._sum.taxableValue?.toString() ?? 0),
    );

    // Direct expenses sit above the gross-profit line (D-11).
    let directExpense = new Decimal(0);
    const indirectByCategory = new Map<string, Decimal>();

    for (const expense of expenses) {
      const amount = d(expense.taxableValue.toString());
      if (expense.expenseCategory?.expenseType === "DIRECT") {
        directExpense = directExpense.plus(amount);
      } else {
        const name = expense.expenseCategory?.name ?? "Uncategorised";
        indirectByCategory.set(name, (indirectByCategory.get(name) ?? new Decimal(0)).plus(amount));
      }
    }

    const grossProfit = netSales.minus(netPurchases).minus(directExpense);
    const indirectTotal = [...indirectByCategory.values()].reduce(
      (acc, v) => acc.plus(v),
      new Decimal(0),
    );
    const netProfit = grossProfit.minus(indirectTotal);

    const rows: ReportRow[] = [
      { _group: "Income", particulars: "Sales", amount: netSales.toNumber() },
      { _group: "Income", particulars: "Less: purchases", amount: netPurchases.negated().toNumber() },
      { _group: "Income", particulars: "Less: direct expenses", amount: directExpense.negated().toNumber() },
      { _group: "Income", particulars: "Gross profit", amount: grossProfit.toNumber() },
    ];

    for (const [name, amount] of indirectByCategory) {
      rows.push({ _group: "Indirect expenses", particulars: name, amount: amount.negated().toNumber() });
    }

    rows.push({ _group: "Result", particulars: "Net profit", amount: netProfit.toNumber() });

    return {
      rows,
      summary: [
        { label: "Gross profit", value: formatCurrency(grossProfit.toFixed(2)), tone: grossProfit.greaterThanOrEqualTo(0) ? "positive" : "negative" },
        { label: "Net profit", value: formatCurrency(netProfit.toFixed(2)), tone: netProfit.greaterThanOrEqualTo(0) ? "positive" : "negative" },
      ],
      note: "Figures exclude GST, which is collected on behalf of the government rather than earned.",
    };
  },
};

export const cashFlowReport: ReportDefinition = {
  slug: "cash-flow",
  title: "Cash Flow",
  description: "Where cash and bank money came from and went, month by month.",
  group: "Transaction",
  columns: [
    { key: "month", label: "Month" },
    { key: "moneyIn", label: "Money in", format: "money", align: "right", total: true },
    { key: "moneyOut", label: "Money out", format: "money", align: "right", total: true },
    { key: "net", label: "Net", format: "money", align: "right", total: true },
  ],
  async run(ctx, f) {
    const entries = await prisma.ledgerEntry.findMany({
      where: {
        companyId: ctx.companyId,
        accountType: { in: [LedgerAccountType.CASH, LedgerAccountType.BANK] },
        date: { gte: f.from, lte: f.to },
      },
      select: { date: true, debit: true, credit: true },
    });

    const byMonth = new Map<string, { in: Decimal; out: Decimal }>();

    for (const entry of entries) {
      const key = entry.date.toISOString().slice(0, 7);
      const bucket = byMonth.get(key) ?? { in: new Decimal(0), out: new Decimal(0) };
      bucket.in = bucket.in.plus(d(entry.debit.toString()));
      bucket.out = bucket.out.plus(d(entry.credit.toString()));
      byMonth.set(key, bucket);
    }

    const rows: ReportRow[] = [...byMonth.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, bucket]) => ({
        month,
        moneyIn: bucket.in.toNumber(),
        moneyOut: bucket.out.toNumber(),
        net: bucket.in.minus(bucket.out).toNumber(),
      }));

    return { rows, totals: sumColumns(rows, ["moneyIn", "moneyOut", "net"]) };
  },
};

export const billWiseProfitReport: ReportDefinition = {
  slug: "bill-wise-profit",
  title: "Bill Wise Profit",
  description: "Profit on each sale invoice, valued at item purchase price.",
  group: "Transaction",
  partyFilter: true,
  columns: [
    { key: "date", label: "Date", format: "date" },
    { key: "number", label: "Invoice" },
    { key: "party", label: "Party" },
    { key: "revenue", label: "Revenue", format: "money", align: "right", total: true },
    { key: "cost", label: "Cost", format: "money", align: "right", total: true },
    { key: "profit", label: "Profit", format: "money", align: "right", total: true },
    { key: "margin", label: "Margin", format: "percent", align: "right" },
  ],
  async run(ctx, f) {
    const invoices = await prisma.transaction.findMany({
      where: txnWhere(ctx, f, [TransactionType.SALE]),
      orderBy: { date: "asc" },
      select: {
        id: true,
        date: true,
        number: true,
        numberPrefix: true,
        party: { select: { name: true } },
        lines: {
          select: {
            qty: true,
            taxableValue: true,
            item: { select: { purchasePrice: true } },
          },
        },
      },
    });

    const rows: ReportRow[] = invoices.map((invoice) => {
      let revenue = new Decimal(0);
      let cost = new Decimal(0);

      for (const line of invoice.lines) {
        revenue = revenue.plus(d(line.taxableValue.toString()));
        cost = cost.plus(
          d(line.qty.toString()).times(d(line.item?.purchasePrice.toString() ?? 0)),
        );
      }

      const profit = revenue.minus(cost);

      return {
        _id: invoice.id,
        date: invoice.date.toISOString(),
        number: formatDocumentNumber(invoice.numberPrefix, invoice.number),
        party: invoice.party?.name ?? "—",
        revenue: revenue.toNumber(),
        cost: cost.toNumber(),
        profit: profit.toNumber(),
        margin: revenue.isZero() ? 0 : profit.dividedBy(revenue).times(100).toNumber(),
      };
    });

    return {
      rows,
      totals: sumColumns(rows, ["revenue", "cost", "profit"]),
      note: "Cost uses each item's current purchase price, not a historical cost layer.",
    };
  },
};

export const trialBalanceReport: ReportDefinition = {
  slug: "trial-balance",
  title: "Trial Balance",
  description: "Every ledger account, with debits and credits that must agree.",
  group: "Transaction",
  columns: [
    { key: "account", label: "Account" },
    { key: "debit", label: "Debit", format: "money", align: "right", total: true },
    { key: "credit", label: "Credit", format: "money", align: "right", total: true },
  ],
  async run(ctx, f) {
    const grouped = await prisma.ledgerEntry.groupBy({
      by: ["accountType"],
      where: { companyId: ctx.companyId, date: { gte: f.from, lte: f.to } },
      _sum: { debit: true, credit: true },
    });

    const rows: ReportRow[] = grouped
      .map((g) => ({
        account: ACCOUNT_LABEL[g.accountType] ?? g.accountType,
        debit: Number(g._sum.debit ?? 0),
        credit: Number(g._sum.credit ?? 0),
      }))
      .sort((a, b) => a.account.localeCompare(b.account));

    const totals = sumColumns(rows, ["debit", "credit"]);
    const balanced = Math.abs((totals.debit ?? 0) - (totals.credit ?? 0)) < 0.005;

    return {
      rows,
      totals,
      summary: [
        {
          label: balanced ? "Balanced" : "OUT OF BALANCE",
          value: formatCurrency(Math.abs((totals.debit ?? 0) - (totals.credit ?? 0))),
          tone: balanced ? "positive" : "negative",
        },
      ],
      note: balanced
        ? undefined
        : "Debits and credits do not agree. Run Verify My Data to find the cause.",
    };
  },
};

const ACCOUNT_LABEL: Record<string, string> = {
  PARTY: "Parties",
  CASH: "Cash in hand",
  BANK: "Bank accounts",
  SALES: "Sales",
  PURCHASE: "Purchases",
  EXPENSE: "Expenses",
  TAX: "Tax payable / receivable",
  ROUND_OFF: "Round off",
  DISCOUNT: "Discounts",
  CAPITAL: "Capital",
  TCS: "TCS",
};

export const balanceSheetReport: ReportDefinition = {
  slug: "balance-sheet",
  title: "Balance Sheet",
  description: "What the business owns and owes, as at the end of the period.",
  group: "Transaction",
  columns: [
    { key: "particulars", label: "Particulars" },
    { key: "amount", label: "Amount", format: "money", align: "right" },
  ],
  async run(ctx, f) {
    const [partyBalances, cash, bank, stock] = await Promise.all([
      prisma.ledgerEntry.groupBy({
        by: ["partyId"],
        where: { companyId: ctx.companyId, accountType: "PARTY", date: { lte: f.to } },
        _sum: { debit: true, credit: true },
      }),
      prisma.ledgerEntry.aggregate({
        where: { companyId: ctx.companyId, accountType: "CASH", date: { lte: f.to } },
        _sum: { debit: true, credit: true },
      }),
      prisma.ledgerEntry.aggregate({
        where: { companyId: ctx.companyId, accountType: "BANK", date: { lte: f.to } },
        _sum: { debit: true, credit: true },
      }),
      prisma.stockMovement.findMany({
        where: { companyId: ctx.companyId, date: { lte: f.to } },
        select: { qtyIn: true, qtyOut: true, rate: true },
      }),
    ]);

    let receivable = new Decimal(0);
    let payable = new Decimal(0);

    for (const row of partyBalances) {
      const balance = d(row._sum.debit?.toString() ?? 0).minus(d(row._sum.credit?.toString() ?? 0));
      if (balance.greaterThan(0)) receivable = receivable.plus(balance);
      else payable = payable.plus(balance.abs());
    }

    const cashBalance = d(cash._sum.debit?.toString() ?? 0).minus(
      d(cash._sum.credit?.toString() ?? 0),
    );
    const bankBalance = d(bank._sum.debit?.toString() ?? 0).minus(
      d(bank._sum.credit?.toString() ?? 0),
    );

    const stockValue = stock.reduce(
      (acc, m) =>
        acc.plus(
          d(m.qtyIn.toString()).minus(d(m.qtyOut.toString())).times(d(m.rate.toString())),
        ),
      new Decimal(0),
    );

    const assets = receivable.plus(cashBalance).plus(bankBalance).plus(stockValue);
    const liabilities = payable;
    const equity = assets.minus(liabilities);

    return {
      rows: [
        { _group: "Assets", particulars: "Accounts receivable", amount: receivable.toNumber() },
        { _group: "Assets", particulars: "Cash in hand", amount: cashBalance.toNumber() },
        { _group: "Assets", particulars: "Bank accounts", amount: bankBalance.toNumber() },
        { _group: "Assets", particulars: "Closing stock", amount: stockValue.toNumber() },
        { _group: "Assets", particulars: "Total assets", amount: assets.toNumber() },
        { _group: "Liabilities", particulars: "Accounts payable", amount: liabilities.toNumber() },
        { _group: "Liabilities", particulars: "Owner's equity", amount: equity.toNumber() },
      ],
      summary: [
        { label: "Total assets", value: formatCurrency(assets.toFixed(2)) },
        { label: "Liabilities", value: formatCurrency(liabilities.toFixed(2)) },
        { label: "Equity", value: formatCurrency(equity.toFixed(2)) },
      ],
      note: "Stock is valued at the rate recorded on each movement.",
    };
  },
};
