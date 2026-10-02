import { Prisma, TransactionType } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { formatDocumentNumber } from "@/lib/numbering";

export interface TransactionListParams {
  type: TransactionType | TransactionType[];
  from: Date;
  to: Date;
  firmId?: string | null;
  partyId?: string | null;
  q?: string;
  page: number;
  pageSize: number;
  sort?: string | null;
  dir?: "asc" | "desc";
}

export interface TransactionRow {
  id: string;
  type: TransactionType;
  number: string;
  displayNumber: string;
  date: string;
  dueDate: string | null;
  partyName: string | null;
  firmName: string;
  paymentMode: string | null;
  total: string;
  paidAmount: string;
  balanceAmount: string;
  status: string;
  isOverdue: boolean;
}

const SORTABLE: Record<string, string> = {
  date: "date",
  number: "number",
  total: "total",
  balance: "balanceAmount",
};

function buildWhere(
  companyId: string,
  params: TransactionListParams,
): Prisma.TransactionWhereInput {
  const types = Array.isArray(params.type) ? params.type : [params.type];

  return {
    companyId,
    deletedAt: null,
    type: { in: types },
    date: { gte: params.from, lte: params.to },
    ...(params.firmId ? { firmId: params.firmId } : {}),
    ...(params.partyId ? { partyId: params.partyId } : {}),
    ...(params.q
      ? {
          OR: [
            { number: { contains: params.q, mode: "insensitive" as const } },
            { notes: { contains: params.q, mode: "insensitive" as const } },
            { party: { name: { contains: params.q, mode: "insensitive" as const } } },
          ],
        }
      : {}),
  };
}

/** Server-paginated transaction list — the table on every list screen. */
export async function listTransactions(
  companyId: string,
  params: TransactionListParams,
): Promise<{ rows: TransactionRow[]; total: number }> {
  const where = buildWhere(companyId, params);
  const orderField = SORTABLE[params.sort ?? "date"] ?? "date";
  const dir = params.dir ?? "desc";

  const [total, records] = await Promise.all([
    prisma.transaction.count({ where }),
    prisma.transaction.findMany({
      where,
      orderBy: [{ [orderField]: dir }, { createdAt: "desc" }],
      skip: (params.page - 1) * params.pageSize,
      take: params.pageSize,
      select: {
        id: true,
        type: true,
        number: true,
        numberPrefix: true,
        date: true,
        dueDate: true,
        paymentMode: true,
        total: true,
        paidAmount: true,
        balanceAmount: true,
        status: true,
        party: { select: { name: true } },
        firm: { select: { name: true } },
      },
    }),
  ]);

  const now = new Date();

  return {
    total,
    rows: records.map((r) => ({
      id: r.id,
      type: r.type,
      number: r.number,
      displayNumber: formatDocumentNumber(r.numberPrefix, r.number),
      date: r.date.toISOString(),
      dueDate: r.dueDate?.toISOString() ?? null,
      partyName: r.party?.name ?? null,
      firmName: r.firm.name,
      paymentMode: r.paymentMode,
      total: r.total.toFixed(2),
      paidAmount: r.paidAmount.toFixed(2),
      balanceAmount: r.balanceAmount.toFixed(2),
      status: r.status,
      isOverdue:
        !!r.dueDate && r.dueDate < now && Number(r.balanceAmount.toFixed(2)) > 0,
    })),
  };
}

export interface TransactionTotals {
  total: string;
  received: string;
  balance: string;
  count: number;
}

/** The summary card above each list. */
export async function transactionTotals(
  companyId: string,
  params: {
    type: TransactionType | TransactionType[];
    from: Date;
    to: Date;
    firmId?: string | null;
    partyId?: string | null;
  },
): Promise<TransactionTotals> {
  const where = buildWhere(companyId, {
    ...params,
    page: 1,
    pageSize: 1,
  });

  const result = await prisma.transaction.aggregate({
    where,
    _sum: { total: true, paidAmount: true, balanceAmount: true },
    _count: { _all: true },
  });

  return {
    total: result._sum.total?.toFixed(2) ?? "0.00",
    received: result._sum.paidAmount?.toFixed(2) ?? "0.00",
    balance: result._sum.balanceAmount?.toFixed(2) ?? "0.00",
    count: result._count._all,
  };
}

/** Transactions for one party, for the party detail pane (ref-02). */
export async function partyTransactions(
  companyId: string,
  partyId: string,
  limit = 100,
): Promise<TransactionRow[]> {
  const records = await prisma.transaction.findMany({
    where: { companyId, partyId, deletedAt: null },
    orderBy: { date: "desc" },
    take: limit,
    select: {
      id: true,
      type: true,
      number: true,
      numberPrefix: true,
      date: true,
      dueDate: true,
      paymentMode: true,
      total: true,
      paidAmount: true,
      balanceAmount: true,
      status: true,
      firm: { select: { name: true } },
    },
  });

  return records.map((r) => ({
    id: r.id,
    type: r.type,
    number: r.number,
    displayNumber: formatDocumentNumber(r.numberPrefix, r.number),
    date: r.date.toISOString(),
    dueDate: r.dueDate?.toISOString() ?? null,
    partyName: null,
    firmName: r.firm.name,
    paymentMode: r.paymentMode,
    total: r.total.toFixed(2),
    paidAmount: r.paidAmount.toFixed(2),
    balanceAmount: r.balanceAmount.toFixed(2),
    status: r.status,
    isOverdue: false,
  }));
}

/** Transactions touching one item, for the item detail pane (ref-03). */
export async function itemTransactions(companyId: string, itemId: string, limit = 100) {
  const lines = await prisma.transactionLine.findMany({
    where: { companyId, itemId, transaction: { deletedAt: null } },
    orderBy: { transaction: { date: "desc" } },
    take: limit,
    select: {
      id: true,
      qty: true,
      rate: true,
      amount: true,
      transaction: {
        select: {
          id: true,
          type: true,
          number: true,
          numberPrefix: true,
          date: true,
          status: true,
          party: { select: { name: true } },
        },
      },
    },
  });

  return lines.map((l) => ({
    id: l.id,
    transactionId: l.transaction.id,
    type: l.transaction.type,
    displayNumber: formatDocumentNumber(l.transaction.numberPrefix, l.transaction.number),
    date: l.transaction.date.toISOString(),
    partyName: l.transaction.party?.name ?? null,
    qty: l.qty.toString(),
    rate: l.rate.toFixed(2),
    amount: l.amount.toFixed(2),
    status: l.transaction.status,
  }));
}

/** Daily totals for the dashboard chart. */
export async function salesByDay(
  companyId: string,
  from: Date,
  to: Date,
  firmId?: string | null,
): Promise<{ date: string; total: number }[]> {
  const rows = await prisma.$queryRaw<{ day: Date; total: Prisma.Decimal }[]>`
    SELECT date_trunc('day', "date" AT TIME ZONE 'Asia/Kolkata') AS day,
           SUM("total") AS total
      FROM "Transaction"
     WHERE "companyId" = ${companyId}
       AND "type" = 'SALE'
       AND "deletedAt" IS NULL
       AND "date" >= ${from}
       AND "date" <= ${to}
       ${firmId ? Prisma.sql`AND "firmId" = ${firmId}` : Prisma.empty}
     GROUP BY 1
     ORDER BY 1
  `;

  return rows.map((r) => ({
    date: r.day.toISOString(),
    total: Number(r.total.toFixed(2)),
  }));
}
