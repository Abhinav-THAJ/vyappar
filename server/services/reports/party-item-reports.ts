import { TransactionType } from "@prisma/client";
import Decimal from "decimal.js";
import { prisma } from "@/lib/db/prisma";
import { d } from "@/lib/calc";
import { formatCurrency } from "@/lib/format/number";
import { formatDocumentNumber } from "@/lib/numbering";
import { partyBalances, stockLevels } from "../balances";
import type { ReportDefinition, ReportRow } from "./types";

/* ------------------------------ Party reports ------------------------------ */

export const partyStatementReport: ReportDefinition = {
  slug: "party-statement",
  title: "Party Statement",
  description: "A running ledger for one party.",
  group: "Party",
  partyFilter: true,
  columns: [
    { key: "date", label: "Date", format: "date" },
    { key: "type", label: "Type" },
    { key: "number", label: "Reference" },
    { key: "debit", label: "Debit", format: "money", align: "right", total: true },
    { key: "credit", label: "Credit", format: "money", align: "right", total: true },
    { key: "balance", label: "Balance", format: "money", align: "right" },
  ],
  async run(ctx, f) {
    if (!f.partyId) {
      return { rows: [], note: "Choose a party to see their statement." };
    }

    const [party, opening, entries] = await Promise.all([
      prisma.party.findFirst({
        where: { id: f.partyId, companyId: ctx.companyId },
        select: { name: true, openingBalance: true, openingBalanceType: true },
      }),
      prisma.ledgerEntry.aggregate({
        where: {
          companyId: ctx.companyId,
          accountType: "PARTY",
          partyId: f.partyId,
          date: { lt: f.from },
        },
        _sum: { debit: true, credit: true },
      }),
      prisma.ledgerEntry.findMany({
        where: {
          companyId: ctx.companyId,
          accountType: "PARTY",
          partyId: f.partyId,
          date: { gte: f.from, lte: f.to },
        },
        orderBy: [{ date: "asc" }, { createdAt: "asc" }],
        select: {
          id: true,
          date: true,
          debit: true,
          credit: true,
          narration: true,
          transaction: { select: { type: true, number: true, numberPrefix: true } },
        },
      }),
    ]);

    const openingAmount = party
      ? party.openingBalanceType === "TO_RECEIVE"
        ? d(party.openingBalance.toString())
        : d(party.openingBalance.toString()).negated()
      : new Decimal(0);

    let running = openingAmount
      .plus(d(opening._sum.debit?.toString() ?? 0))
      .minus(d(opening._sum.credit?.toString() ?? 0));

    const rows: ReportRow[] = [
      {
        date: f.from.toISOString(),
        type: "Opening balance",
        number: "—",
        debit: 0,
        credit: 0,
        balance: running.toNumber(),
      },
    ];

    for (const entry of entries) {
      running = running.plus(d(entry.debit.toString())).minus(d(entry.credit.toString()));
      rows.push({
        _id: entry.id,
        date: entry.date.toISOString(),
        type: entry.transaction?.type ?? entry.narration ?? "Entry",
        number: entry.transaction
          ? formatDocumentNumber(entry.transaction.numberPrefix, entry.transaction.number)
          : "—",
        debit: Number(entry.debit),
        credit: Number(entry.credit),
        balance: running.toNumber(),
      });
    }

    return {
      rows,
      summary: [
        { label: party?.name ?? "Party", value: "" },
        {
          label: running.greaterThanOrEqualTo(0) ? "To receive" : "To pay",
          value: formatCurrency(running.abs().toFixed(2)),
          tone: running.greaterThanOrEqualTo(0) ? "positive" : "negative",
        },
      ],
    };
  },
};

export const allPartiesReport: ReportDefinition = {
  slug: "all-parties",
  title: "All Parties",
  description: "Every party with its receivable or payable balance.",
  group: "Party",
  pointInTime: true,
  columns: [
    { key: "name", label: "Party" },
    { key: "phone", label: "Phone", secondary: true },
    { key: "gstin", label: "GSTIN", secondary: true },
    { key: "receivable", label: "To receive", format: "money", align: "right", total: true },
    { key: "payable", label: "To pay", format: "money", align: "right", total: true },
  ],
  async run(ctx) {
    const [parties, balances] = await Promise.all([
      prisma.party.findMany({
        where: { companyId: ctx.companyId, deletedAt: null },
        orderBy: { name: "asc" },
        select: { id: true, name: true, phone: true, gstin: true },
      }),
      partyBalances(ctx.companyId),
    ]);

    const rows: ReportRow[] = parties.map((p) => {
      const balance = balances.get(p.id) ?? new Decimal(0);
      return {
        _id: p.id,
        name: p.name,
        phone: p.phone ?? "—",
        gstin: p.gstin ?? "—",
        receivable: balance.greaterThan(0) ? balance.toNumber() : 0,
        payable: balance.lessThan(0) ? balance.abs().toNumber() : 0,
      };
    });

    const receivable = rows.reduce((acc, r) => acc + Number(r.receivable ?? 0), 0);
    const payable = rows.reduce((acc, r) => acc + Number(r.payable ?? 0), 0);

    return {
      rows,
      totals: { receivable, payable },
      summary: [
        { label: "Total receivable", value: formatCurrency(receivable), tone: "positive" },
        { label: "Total payable", value: formatCurrency(payable), tone: "negative" },
      ],
    };
  },
};

export const salePurchaseByPartyReport: ReportDefinition = {
  slug: "sale-purchase-by-party",
  title: "Sale Purchase By Party",
  description: "How much you sold to and bought from each party.",
  group: "Party",
  columns: [
    { key: "name", label: "Party" },
    { key: "sale", label: "Sale", format: "money", align: "right", total: true },
    { key: "purchase", label: "Purchase", format: "money", align: "right", total: true },
    { key: "net", label: "Net", format: "money", align: "right", total: true },
  ],
  async run(ctx, f) {
    const grouped = await prisma.transaction.groupBy({
      by: ["partyId", "type"],
      where: {
        companyId: ctx.companyId,
        deletedAt: null,
        type: { in: [TransactionType.SALE, TransactionType.PURCHASE] },
        date: { gte: f.from, lte: f.to },
        ...(f.firmId ? { firmId: f.firmId } : {}),
        partyId: { not: null },
      },
      _sum: { total: true },
    });

    const partyIds = [...new Set(grouped.map((g) => g.partyId).filter((v): v is string => !!v))];
    const parties = await prisma.party.findMany({
      where: { id: { in: partyIds } },
      select: { id: true, name: true },
    });
    const nameMap = new Map(parties.map((p) => [p.id, p.name]));

    const byParty = new Map<string, { sale: number; purchase: number }>();
    for (const row of grouped) {
      if (!row.partyId) continue;
      const bucket = byParty.get(row.partyId) ?? { sale: 0, purchase: 0 };
      if (row.type === TransactionType.SALE) bucket.sale += Number(row._sum.total ?? 0);
      else bucket.purchase += Number(row._sum.total ?? 0);
      byParty.set(row.partyId, bucket);
    }

    const rows: ReportRow[] = [...byParty.entries()]
      .map(([id, bucket]) => ({
        _id: id,
        name: nameMap.get(id) ?? "Unknown",
        sale: bucket.sale,
        purchase: bucket.purchase,
        net: bucket.sale - bucket.purchase,
      }))
      .sort((a, b) => Number(b.sale) - Number(a.sale));

    return {
      rows,
      totals: {
        sale: rows.reduce((a, r) => a + Number(r.sale ?? 0), 0),
        purchase: rows.reduce((a, r) => a + Number(r.purchase ?? 0), 0),
        net: rows.reduce((a, r) => a + Number(r.net ?? 0), 0),
      },
    };
  },
};

export const salePurchaseByGroupReport: ReportDefinition = {
  slug: "sale-purchase-by-group",
  title: "Sale Purchase By Party Group",
  description: "The same totals, rolled up by party group.",
  group: "Party",
  columns: [
    { key: "name", label: "Group" },
    { key: "parties", label: "Parties", format: "number", align: "right" },
    { key: "sale", label: "Sale", format: "money", align: "right", total: true },
    { key: "purchase", label: "Purchase", format: "money", align: "right", total: true },
  ],
  async run(ctx, f) {
    const transactions = await prisma.transaction.findMany({
      where: {
        companyId: ctx.companyId,
        deletedAt: null,
        type: { in: [TransactionType.SALE, TransactionType.PURCHASE] },
        date: { gte: f.from, lte: f.to },
        ...(f.firmId ? { firmId: f.firmId } : {}),
      },
      select: {
        type: true,
        total: true,
        partyId: true,
        party: { select: { partyGroup: { select: { name: true } } } },
      },
    });

    const byGroup = new Map<string, { sale: number; purchase: number; parties: Set<string> }>();

    for (const txn of transactions) {
      const name = txn.party?.partyGroup?.name ?? "No group";
      const bucket = byGroup.get(name) ?? { sale: 0, purchase: 0, parties: new Set<string>() };
      if (txn.type === TransactionType.SALE) bucket.sale += Number(txn.total);
      else bucket.purchase += Number(txn.total);
      if (txn.partyId) bucket.parties.add(txn.partyId);
      byGroup.set(name, bucket);
    }

    const rows: ReportRow[] = [...byGroup.entries()]
      .map(([name, bucket]) => ({
        name,
        parties: bucket.parties.size,
        sale: bucket.sale,
        purchase: bucket.purchase,
      }))
      .sort((a, b) => Number(b.sale) - Number(a.sale));

    return {
      rows,
      totals: {
        sale: rows.reduce((a, r) => a + Number(r.sale ?? 0), 0),
        purchase: rows.reduce((a, r) => a + Number(r.purchase ?? 0), 0),
      },
    };
  },
};

export const partyProfitLossReport: ReportDefinition = {
  slug: "party-profit-loss",
  title: "Party wise Profit & Loss",
  description: "Profit earned on each party's sales.",
  group: "Party",
  columns: [
    { key: "name", label: "Party" },
    { key: "revenue", label: "Revenue", format: "money", align: "right", total: true },
    { key: "cost", label: "Cost", format: "money", align: "right", total: true },
    { key: "profit", label: "Profit", format: "money", align: "right", total: true },
  ],
  async run(ctx, f) {
    const invoices = await prisma.transaction.findMany({
      where: {
        companyId: ctx.companyId,
        deletedAt: null,
        type: TransactionType.SALE,
        date: { gte: f.from, lte: f.to },
        ...(f.firmId ? { firmId: f.firmId } : {}),
      },
      select: {
        partyId: true,
        party: { select: { name: true } },
        lines: {
          select: { qty: true, taxableValue: true, item: { select: { purchasePrice: true } } },
        },
      },
    });

    const byParty = new Map<string, { name: string; revenue: Decimal; cost: Decimal }>();

    for (const invoice of invoices) {
      const key = invoice.partyId ?? "cash";
      const bucket =
        byParty.get(key) ?? {
          name: invoice.party?.name ?? "Cash sale",
          revenue: new Decimal(0),
          cost: new Decimal(0),
        };

      for (const line of invoice.lines) {
        bucket.revenue = bucket.revenue.plus(d(line.taxableValue.toString()));
        bucket.cost = bucket.cost.plus(
          d(line.qty.toString()).times(d(line.item?.purchasePrice.toString() ?? 0)),
        );
      }

      byParty.set(key, bucket);
    }

    const rows: ReportRow[] = [...byParty.values()]
      .map((b) => ({
        name: b.name,
        revenue: b.revenue.toNumber(),
        cost: b.cost.toNumber(),
        profit: b.revenue.minus(b.cost).toNumber(),
      }))
      .sort((a, b) => Number(b.profit) - Number(a.profit));

    return {
      rows,
      totals: {
        revenue: rows.reduce((a, r) => a + Number(r.revenue ?? 0), 0),
        cost: rows.reduce((a, r) => a + Number(r.cost ?? 0), 0),
        profit: rows.reduce((a, r) => a + Number(r.profit ?? 0), 0),
      },
    };
  },
};

export const partyByItemReport: ReportDefinition = {
  slug: "party-by-item",
  title: "Party Report By Item",
  description: "Which parties bought a given item, and how much.",
  group: "Party",
  itemFilter: true,
  columns: [
    { key: "party", label: "Party" },
    { key: "qty", label: "Quantity", format: "qty", align: "right", total: true },
    { key: "amount", label: "Amount", format: "money", align: "right", total: true },
  ],
  async run(ctx, f) {
    if (!f.itemId) return { rows: [], note: "Choose an item to see who bought it." };

    const lines = await prisma.transactionLine.findMany({
      where: {
        companyId: ctx.companyId,
        itemId: f.itemId,
        transaction: {
          deletedAt: null,
          type: TransactionType.SALE,
          date: { gte: f.from, lte: f.to },
          ...(f.firmId ? { firmId: f.firmId } : {}),
        },
      },
      select: {
        qty: true,
        amount: true,
        transaction: { select: { party: { select: { name: true } } } },
      },
    });

    const byParty = new Map<string, { qty: Decimal; amount: Decimal }>();

    for (const line of lines) {
      const name = line.transaction.party?.name ?? "Cash sale";
      const bucket = byParty.get(name) ?? { qty: new Decimal(0), amount: new Decimal(0) };
      bucket.qty = bucket.qty.plus(d(line.qty.toString()));
      bucket.amount = bucket.amount.plus(d(line.amount.toString()));
      byParty.set(name, bucket);
    }

    const rows: ReportRow[] = [...byParty.entries()]
      .map(([party, b]) => ({ party, qty: b.qty.toNumber(), amount: b.amount.toNumber() }))
      .sort((a, b) => Number(b.amount) - Number(a.amount));

    return {
      rows,
      totals: {
        qty: rows.reduce((a, r) => a + Number(r.qty ?? 0), 0),
        amount: rows.reduce((a, r) => a + Number(r.amount ?? 0), 0),
      },
    };
  },
};

/* ------------------------------ Stock reports ------------------------------ */

export const stockSummaryReport: ReportDefinition = {
  slug: "stock-summary",
  title: "Stock Summary",
  description: "Quantity and value on hand for every product.",
  group: "Stock",
  pointInTime: true,
  columns: [
    { key: "name", label: "Item" },
    { key: "sku", label: "Code", secondary: true },
    { key: "qty", label: "Quantity", format: "qty", align: "right", total: true },
    { key: "purchasePrice", label: "Purchase price", format: "money", align: "right" },
    { key: "value", label: "Stock value", format: "money", align: "right", total: true },
  ],
  async run(ctx) {
    const items = await prisma.item.findMany({
      where: { companyId: ctx.companyId, deletedAt: null, type: "PRODUCT" },
      orderBy: { name: "asc" },
      select: { id: true, name: true, sku: true, purchasePrice: true },
    });

    const levels = await stockLevels(
      ctx.companyId,
      items.map((i) => i.id),
    );

    const rows: ReportRow[] = items.map((item) => {
      const qty = levels.get(item.id) ?? new Decimal(0);
      const price = d(item.purchasePrice.toString());
      return {
        _id: item.id,
        name: item.name,
        sku: item.sku ?? "—",
        qty: qty.toNumber(),
        purchasePrice: price.toNumber(),
        value: qty.times(price).toNumber(),
      };
    });

    const value = rows.reduce((a, r) => a + Number(r.value ?? 0), 0);

    return {
      rows,
      totals: {
        qty: rows.reduce((a, r) => a + Number(r.qty ?? 0), 0),
        value,
      },
      summary: [{ label: "Total stock value", value: formatCurrency(value) }],
    };
  },
};

export const lowStockReport: ReportDefinition = {
  slug: "low-stock",
  title: "Low Stock Summary",
  description: "Products at or below their minimum level.",
  group: "Stock",
  pointInTime: true,
  columns: [
    { key: "name", label: "Item" },
    { key: "qty", label: "On hand", format: "qty", align: "right" },
    { key: "minQty", label: "Minimum", format: "qty", align: "right" },
    { key: "shortfall", label: "Shortfall", format: "qty", align: "right", total: true },
  ],
  async run(ctx) {
    const items = await prisma.item.findMany({
      where: { companyId: ctx.companyId, deletedAt: null, type: "PRODUCT", isActive: true },
      select: { id: true, name: true, minStockQty: true },
    });

    const levels = await stockLevels(
      ctx.companyId,
      items.map((i) => i.id),
    );

    const rows: ReportRow[] = items
      .map((item) => {
        const qty = levels.get(item.id) ?? new Decimal(0);
        const min = d(item.minStockQty.toString());
        return {
          _id: item.id,
          name: item.name,
          qty: qty.toNumber(),
          minQty: min.toNumber(),
          shortfall: min.minus(qty).toNumber(),
        };
      })
      .filter((r) => Number(r.shortfall) > 0)
      .sort((a, b) => Number(b.shortfall) - Number(a.shortfall));

    return {
      rows,
      summary: [
        {
          label: "Items to reorder",
          value: String(rows.length),
          tone: rows.length > 0 ? "negative" : "positive",
        },
      ],
    };
  },
};

export const stockDetailReport: ReportDefinition = {
  slug: "stock-detail",
  title: "Stock Detail",
  description: "Every movement for one item, in date order.",
  group: "Stock",
  itemFilter: true,
  columns: [
    { key: "date", label: "Date", format: "date" },
    { key: "reason", label: "Reason" },
    { key: "reference", label: "Reference" },
    { key: "qtyIn", label: "In", format: "qty", align: "right", total: true },
    { key: "qtyOut", label: "Out", format: "qty", align: "right", total: true },
    { key: "balance", label: "Balance", format: "qty", align: "right" },
  ],
  async run(ctx, f) {
    if (!f.itemId) return { rows: [], note: "Choose an item to see its movements." };

    const movements = await prisma.stockMovement.findMany({
      where: {
        companyId: ctx.companyId,
        itemId: f.itemId,
        date: { gte: f.from, lte: f.to },
      },
      orderBy: [{ date: "asc" }, { createdAt: "asc" }],
      select: {
        id: true,
        date: true,
        qtyIn: true,
        qtyOut: true,
        reason: true,
        note: true,
        transaction: { select: { number: true, numberPrefix: true } },
      },
    });

    let running = new Decimal(0);
    const rows: ReportRow[] = movements.map((m) => {
      running = running.plus(d(m.qtyIn.toString())).minus(d(m.qtyOut.toString()));
      return {
        _id: m.id,
        date: m.date.toISOString(),
        reason: m.reason.replace(/_/g, " ").toLowerCase(),
        reference: m.transaction
          ? formatDocumentNumber(m.transaction.numberPrefix, m.transaction.number)
          : (m.note ?? "—"),
        qtyIn: Number(m.qtyIn),
        qtyOut: Number(m.qtyOut),
        balance: running.toNumber(),
      };
    });

    return {
      rows,
      totals: {
        qtyIn: rows.reduce((a, r) => a + Number(r.qtyIn ?? 0), 0),
        qtyOut: rows.reduce((a, r) => a + Number(r.qtyOut ?? 0), 0),
      },
    };
  },
};

export const itemProfitReport: ReportDefinition = {
  slug: "item-profit",
  title: "Item wise Profit",
  description: "Revenue, cost and margin per item.",
  group: "Stock",
  columns: [
    { key: "name", label: "Item" },
    { key: "qty", label: "Sold", format: "qty", align: "right", total: true },
    { key: "revenue", label: "Revenue", format: "money", align: "right", total: true },
    { key: "cost", label: "Cost", format: "money", align: "right", total: true },
    { key: "profit", label: "Profit", format: "money", align: "right", total: true },
    { key: "margin", label: "Margin", format: "percent", align: "right" },
  ],
  async run(ctx, f) {
    const lines = await prisma.transactionLine.findMany({
      where: {
        companyId: ctx.companyId,
        itemId: { not: null },
        transaction: {
          deletedAt: null,
          type: TransactionType.SALE,
          date: { gte: f.from, lte: f.to },
          ...(f.firmId ? { firmId: f.firmId } : {}),
        },
      },
      select: {
        qty: true,
        taxableValue: true,
        item: { select: { id: true, name: true, purchasePrice: true } },
      },
    });

    const byItem = new Map<string, { name: string; qty: Decimal; revenue: Decimal; cost: Decimal }>();

    for (const line of lines) {
      if (!line.item) continue;
      const bucket =
        byItem.get(line.item.id) ?? {
          name: line.item.name,
          qty: new Decimal(0),
          revenue: new Decimal(0),
          cost: new Decimal(0),
        };

      const qty = d(line.qty.toString());
      bucket.qty = bucket.qty.plus(qty);
      bucket.revenue = bucket.revenue.plus(d(line.taxableValue.toString()));
      bucket.cost = bucket.cost.plus(qty.times(d(line.item.purchasePrice.toString())));
      byItem.set(line.item.id, bucket);
    }

    const rows: ReportRow[] = [...byItem.values()]
      .map((b) => {
        const profit = b.revenue.minus(b.cost);
        return {
          name: b.name,
          qty: b.qty.toNumber(),
          revenue: b.revenue.toNumber(),
          cost: b.cost.toNumber(),
          profit: profit.toNumber(),
          margin: b.revenue.isZero() ? 0 : profit.dividedBy(b.revenue).times(100).toNumber(),
        };
      })
      .sort((a, b) => Number(b.profit) - Number(a.profit));

    return {
      rows,
      totals: {
        qty: rows.reduce((a, r) => a + Number(r.qty ?? 0), 0),
        revenue: rows.reduce((a, r) => a + Number(r.revenue ?? 0), 0),
        cost: rows.reduce((a, r) => a + Number(r.cost ?? 0), 0),
        profit: rows.reduce((a, r) => a + Number(r.profit ?? 0), 0),
      },
    };
  },
};

/* ------------------------------ Other reports ------------------------------ */

export const expenseReport: ReportDefinition = {
  slug: "expenses",
  title: "Expense Report",
  description: "Spending by category for the period.",
  group: "Other",
  columns: [
    { key: "category", label: "Category" },
    { key: "type", label: "Type" },
    { key: "count", label: "Entries", format: "number", align: "right" },
    { key: "amount", label: "Amount", format: "money", align: "right", total: true },
  ],
  async run(ctx, f) {
    const expenses = await prisma.transaction.findMany({
      where: {
        companyId: ctx.companyId,
        deletedAt: null,
        type: TransactionType.EXPENSE,
        date: { gte: f.from, lte: f.to },
        ...(f.firmId ? { firmId: f.firmId } : {}),
      },
      select: {
        total: true,
        expenseCategory: { select: { name: true, expenseType: true } },
      },
    });

    const byCategory = new Map<string, { type: string; count: number; amount: Decimal }>();

    for (const expense of expenses) {
      const name = expense.expenseCategory?.name ?? "Uncategorised";
      const bucket =
        byCategory.get(name) ?? {
          type: expense.expenseCategory?.expenseType === "DIRECT" ? "Direct" : "Indirect",
          count: 0,
          amount: new Decimal(0),
        };
      bucket.count += 1;
      bucket.amount = bucket.amount.plus(d(expense.total.toString()));
      byCategory.set(name, bucket);
    }

    const rows: ReportRow[] = [...byCategory.entries()]
      .map(([category, b]) => ({
        category,
        type: b.type,
        count: b.count,
        amount: b.amount.toNumber(),
      }))
      .sort((a, b) => Number(b.amount) - Number(a.amount));

    const total = rows.reduce((a, r) => a + Number(r.amount ?? 0), 0);

    return {
      rows,
      totals: { amount: total },
      summary: [{ label: "Total spend", value: formatCurrency(total), tone: "negative" }],
    };
  },
};

export const bankStatementReport: ReportDefinition = {
  slug: "bank-statement",
  title: "Bank Statement",
  description: "Every bank movement across all accounts.",
  group: "Other",
  columns: [
    { key: "date", label: "Date", format: "date" },
    { key: "account", label: "Account" },
    { key: "narration", label: "Particulars" },
    { key: "party", label: "Party", secondary: true },
    { key: "debit", label: "In", format: "money", align: "right", total: true },
    { key: "credit", label: "Out", format: "money", align: "right", total: true },
  ],
  async run(ctx, f) {
    const entries = await prisma.ledgerEntry.findMany({
      where: {
        companyId: ctx.companyId,
        accountType: "BANK",
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
        bankAccount: { select: { displayName: true } },
      },
    });

    const rows: ReportRow[] = entries.map((e) => ({
      _id: e.id,
      date: e.date.toISOString(),
      account: e.bankAccount?.displayName ?? "—",
      narration: e.narration ?? "Entry",
      party: e.party?.name ?? "—",
      debit: Number(e.debit),
      credit: Number(e.credit),
    }));

    return {
      rows,
      totals: {
        debit: rows.reduce((a, r) => a + Number(r.debit ?? 0), 0),
        credit: rows.reduce((a, r) => a + Number(r.credit ?? 0), 0),
      },
    };
  },
};
