import {
  LedgerAccountType,
  StockReason,
  TransactionStatus,
  TransactionType,
  type Prisma,
} from "@prisma/client";
import Decimal from "decimal.js";
import { computeTransaction, d, type CalcInput } from "@/lib/calc";
import { BEHAVIOUR, type TypeBehaviour } from "@/lib/txn/behaviour";
import { allocateNumber, findNumberConflict, advanceSequencePast } from "@/lib/numbering";
import { financialYearOf } from "@/lib/fy";
import { BusinessError } from "@/server/guards/action";

/* -------------------------------------------------------------------------- */
/* Behaviour table                                                             */
/* -------------------------------------------------------------------------- */

export { BEHAVIOUR, type TypeBehaviour } from "@/lib/txn/behaviour";

const STOCK_REASON: Partial<Record<TransactionType, StockReason>> = {
  SALE: StockReason.SALE,
  SALE_RETURN: StockReason.SALE_RETURN,
  PURCHASE: StockReason.PURCHASE,
  PURCHASE_RETURN: StockReason.PURCHASE_RETURN,
  DELIVERY_CHALLAN: StockReason.DELIVERY_CHALLAN,
};

/* -------------------------------------------------------------------------- */
/* Input                                                                       */
/* -------------------------------------------------------------------------- */

export interface PostingLine {
  itemId?: string | null;
  description?: string | null;
  hsnSac?: string | null;
  qty: string;
  freeQty?: string;
  unitId?: string | null;
  rate: string;
  rateIsTaxInclusive: boolean;
  discountValue?: string;
  discountIsPercent?: boolean;
  taxRateId?: string | null;
  taxRateValue: string;
  cessRate?: string;
}

export interface PostingInput {
  type: TransactionType;
  date: Date;
  dueDate?: Date | null;
  partyId?: string | null;
  expenseCategoryId?: string | null;
  bankAccountId?: string | null;
  /** Leave blank to auto-allocate from the firm's sequence. */
  number?: string | null;
  stateOfSupply?: string | null;
  isIgst: boolean;
  lines: PostingLine[];
  billDiscountValue?: string;
  billDiscountIsPercent?: boolean;
  additionalCharges?: { name: string; amount: string; taxRate?: string | null }[];
  tcsRate?: string;
  roundOffEnabled?: boolean;
  roundOffMode?: "nearest" | "up" | "down";
  paidAmount?: string;
  paymentMode?: Prisma.TransactionCreateInput["paymentMode"];
  chequeNo?: string | null;
  notes?: string | null;
  terms?: string | null;
  convertedFromId?: string | null;
}

export interface PostingContext {
  companyId: string;
  firmId: string;
  userId: string;
  fyStartMonth: number;
  /** Refuse a sale that would drive stock negative. */
  stopSaleOnNegativeStock: boolean;
}

/* -------------------------------------------------------------------------- */
/* Posting                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * Create a transaction and every consequence of it — lines, tax breakup, stock
 * movements and ledger entries — inside the caller's `$transaction`.
 *
 * Totals are recomputed here from the line inputs; whatever the client sent is
 * ignored entirely (D-17).
 */
export async function postTransaction(
  tx: Prisma.TransactionClient,
  ctx: PostingContext,
  input: PostingInput,
): Promise<{ id: string; number: string; prefix: string; total: string }> {
  const behaviour = BEHAVIOUR[input.type];
  const financialYear = financialYearOf(input.date, ctx.fyStartMonth);

  if (input.lines.length === 0 && requiresLines(input.type)) {
    throw new BusinessError("Add at least one item");
  }

  // --- totals -------------------------------------------------------------
  const calcInput: CalcInput = {
    isIgst: input.isIgst,
    lines: input.lines.map((line, i) => ({
      key: String(i),
      qty: line.qty,
      rate: line.rate,
      rateIsTaxInclusive: line.rateIsTaxInclusive,
      discountValue: line.discountValue ?? 0,
      discountIsPercent: line.discountIsPercent ?? false,
      taxRate: line.taxRateValue,
      cessRate: line.cessRate ?? 0,
      hsnSac: line.hsnSac ?? null,
    })),
    billDiscountValue: input.billDiscountValue ?? 0,
    billDiscountIsPercent: input.billDiscountIsPercent ?? false,
    additionalCharges: input.additionalCharges,
    tcsRate: input.tcsRate ?? 0,
    roundOffEnabled: input.roundOffEnabled ?? false,
    roundOffMode: input.roundOffMode ?? "nearest",
  };

  const calc = computeTransaction(calcInput);

  // --- numbering ----------------------------------------------------------
  let number: string;
  let prefix: string;

  if (input.number && input.number.trim() !== "") {
    number = input.number.trim();
    const conflict = await findNumberConflict(tx, {
      firmId: ctx.firmId,
      type: input.type,
      financialYear,
      number,
    });
    if (conflict) {
      throw new BusinessError(
        `Number ${number} is already used for this document type in ${financialYear}`,
        { number: [`Number ${number} is already used in ${financialYear}`] },
      );
    }
    const seq = await tx.numberSequence.findFirst({
      where: { firmId: ctx.firmId, type: input.type, financialYear },
      select: { prefix: true },
    });
    prefix = seq?.prefix ?? "";
    await advanceSequencePast(tx, { firmId: ctx.firmId, type: input.type, financialYear, number });
  } else {
    const allocated = await allocateNumber(tx, {
      companyId: ctx.companyId,
      firmId: ctx.firmId,
      type: input.type,
      financialYear,
    });
    number = allocated.number;
    prefix = allocated.prefix;
  }

  // --- stock guard --------------------------------------------------------
  if (behaviour.stock === "out" && ctx.stopSaleOnNegativeStock) {
    await assertStockAvailable(tx, ctx.companyId, input.lines);
  }

  const total = d(calc.total);
  const paid = d(input.paidAmount ?? 0);
  const balance = total.minus(paid);

  // --- header -------------------------------------------------------------
  const created = await tx.transaction.create({
    data: {
      companyId: ctx.companyId,
      firmId: ctx.firmId,
      type: input.type,
      number,
      numberPrefix: prefix,
      financialYear,
      date: input.date,
      dueDate: input.dueDate ?? null,
      partyId: input.partyId ?? null,
      expenseCategoryId: input.expenseCategoryId ?? null,
      bankAccountId: input.bankAccountId ?? null,
      stateOfSupply: input.stateOfSupply ?? null,
      isIgst: input.isIgst,
      subTotal: calc.subTotal,
      discountValue: input.billDiscountValue ?? "0",
      discountIsPercent: input.billDiscountIsPercent ?? false,
      discountAmount: calc.billDiscountAmount,
      additionalCharges: (input.additionalCharges ?? []) as Prisma.InputJsonValue,
      taxableValue: calc.taxableValue,
      cgst: calc.cgst,
      sgst: calc.sgst,
      igst: calc.igst,
      cess: calc.cess,
      tcs: calc.tcs,
      roundOff: calc.roundOff,
      total: calc.total,
      paidAmount: paid.toFixed(2),
      balanceAmount: balance.toFixed(2),
      paymentMode: input.paymentMode ?? null,
      chequeNo: input.chequeNo ?? null,
      notes: input.notes ?? null,
      terms: input.terms ?? null,
      status: resolveStatus(input.type, total, paid),
      convertedFromId: input.convertedFromId ?? null,
      createdById: ctx.userId,
      lines: {
        create: input.lines.map((line, i) => {
          const r = calc.lines[i]!;
          return {
            companyId: ctx.companyId,
            itemId: line.itemId ?? null,
            description: line.description ?? null,
            hsnSac: line.hsnSac ?? null,
            qty: line.qty,
            freeQty: line.freeQty ?? "0",
            unitId: line.unitId ?? null,
            rate: line.rate,
            rateIsTaxInclusive: line.rateIsTaxInclusive,
            discountValue: line.discountValue ?? "0",
            discountIsPercent: line.discountIsPercent ?? false,
            discountAmount: r.lineDiscountAmount,
            taxRateId: line.taxRateId ?? null,
            taxRateValue: line.taxRateValue,
            cessRate: line.cessRate ?? "0",
            taxableValue: r.taxableValue,
            cgst: r.cgst,
            sgst: r.sgst,
            igst: r.igst,
            cessAmount: r.cessAmount,
            amount: r.amount,
            sortOrder: i,
          };
        }),
      },
      taxes: {
        create: calc.taxBreakup.map((t) => ({
          companyId: ctx.companyId,
          hsnSac: t.hsnSac || null,
          rate: t.rate,
          cessRate: t.cessRate,
          taxableValue: t.taxableValue,
          cgst: t.cgst,
          sgst: t.sgst,
          igst: t.igst,
          cessAmount: t.cessAmount,
        })),
      },
    },
    select: { id: true },
  });

  await writeStockMovements(tx, ctx, created.id, input, behaviour);
  await writeLedgerEntries(tx, ctx, created.id, input, behaviour, calc, paid);

  await tx.company.update({
    where: { id: ctx.companyId },
    data: { lastActivityAt: new Date() },
  });

  return { id: created.id, number, prefix, total: calc.total };
}

/** Document types that are money movements rather than goods documents. */
const LINELESS_TYPES: ReadonlySet<TransactionType> = new Set([
  TransactionType.PAYMENT_IN,
  TransactionType.PAYMENT_OUT,
  TransactionType.EXPENSE,
  TransactionType.BANK_TRANSFER,
  TransactionType.CASH_ADJUSTMENT,
]);

function requiresLines(type: TransactionType): boolean {
  return !LINELESS_TYPES.has(type);
}

function resolveStatus(type: TransactionType, total: Decimal, paid: Decimal): TransactionStatus {
  if (!BEHAVIOUR[type].ledger) return TransactionStatus.OPEN;
  if (paid.greaterThanOrEqualTo(total) && total.greaterThan(0)) return TransactionStatus.PAID;
  if (paid.greaterThan(0)) return TransactionStatus.PARTIAL;
  return TransactionStatus.OPEN;
}

/* -------------------------------------------------------------------------- */
/* Stock                                                                       */
/* -------------------------------------------------------------------------- */

async function assertStockAvailable(
  tx: Prisma.TransactionClient,
  companyId: string,
  lines: PostingLine[],
): Promise<void> {
  const itemIds = [...new Set(lines.map((l) => l.itemId).filter((v): v is string => !!v))];
  if (itemIds.length === 0) return;

  const items = await tx.item.findMany({
    where: { id: { in: itemIds }, companyId, type: "PRODUCT" },
    select: { id: true, name: true },
  });

  for (const item of items) {
    const onHand = await stockOnHand(tx, companyId, item.id);
    const wanted = lines
      .filter((l) => l.itemId === item.id)
      .reduce((acc, l) => acc.plus(d(l.qty)).plus(d(l.freeQty ?? 0)), new Decimal(0));

    if (onHand.lessThan(wanted)) {
      throw new BusinessError(
        `Not enough stock for "${item.name}": ${onHand.toFixed(3)} available, ${wanted.toFixed(3)} needed`,
      );
    }
  }
}

/** Stock on hand, summed from movements — never a stored counter (D-06). */
export async function stockOnHand(
  tx: Prisma.TransactionClient,
  companyId: string,
  itemId: string,
): Promise<Decimal> {
  const result = await tx.stockMovement.aggregate({
    where: { companyId, itemId },
    _sum: { qtyIn: true, qtyOut: true },
  });

  return d(result._sum.qtyIn?.toString() ?? 0).minus(d(result._sum.qtyOut?.toString() ?? 0));
}

async function writeStockMovements(
  tx: Prisma.TransactionClient,
  ctx: PostingContext,
  transactionId: string,
  input: PostingInput,
  behaviour: TypeBehaviour,
): Promise<void> {
  if (!behaviour.stock) return;

  const reason = STOCK_REASON[input.type];
  if (!reason) return;

  // Services carry no stock, so only products produce a movement.
  const productIds = new Set(
    (
      await tx.item.findMany({
        where: {
          companyId: ctx.companyId,
          type: "PRODUCT",
          id: { in: input.lines.map((l) => l.itemId).filter((v): v is string => !!v) },
        },
        select: { id: true },
      })
    ).map((i) => i.id),
  );

  const rows = input.lines
    .filter((line) => line.itemId && productIds.has(line.itemId))
    .map((line) => {
      const qty = d(line.qty).plus(d(line.freeQty ?? 0));
      return {
        companyId: ctx.companyId,
        itemId: line.itemId!,
        transactionId,
        date: input.date,
        qtyIn: behaviour.stock === "in" ? qty.toFixed(3) : "0",
        qtyOut: behaviour.stock === "out" ? qty.toFixed(3) : "0",
        rate: line.rate,
        reason,
      };
    });

  if (rows.length > 0) await tx.stockMovement.createMany({ data: rows });
}

/* -------------------------------------------------------------------------- */
/* Ledger                                                                      */
/* -------------------------------------------------------------------------- */

/**
 * Double-entry postings for the transaction.
 *
 * A credit sale debits the party and credits sales plus each tax account. Money
 * received at the same time is a second pair: debit cash or bank, credit party.
 * Every party, cash and bank balance in the application is a SUM over these
 * rows, so they have to balance.
 */
async function writeLedgerEntries(
  tx: Prisma.TransactionClient,
  ctx: PostingContext,
  transactionId: string,
  input: PostingInput,
  behaviour: TypeBehaviour,
  calc: ReturnType<typeof computeTransaction>,
  paid: Decimal,
): Promise<void> {
  if (!behaviour.ledger) return;

  const rows: Prisma.LedgerEntryCreateManyInput[] = [];
  const base = {
    companyId: ctx.companyId,
    transactionId,
    date: input.date,
  };

  const total = d(calc.total);
  const isSaleSide =
    input.type === TransactionType.SALE ||
    input.type === TransactionType.SALE_RETURN ||
    input.type === TransactionType.PAYMENT_IN;

  if (input.type === TransactionType.PAYMENT_IN || input.type === TransactionType.PAYMENT_OUT) {
    const amount = paid.greaterThan(0) ? paid : total;
    const intoBank = !!input.bankAccountId;

    if (input.type === TransactionType.PAYMENT_IN) {
      rows.push({
        ...base,
        accountType: intoBank ? LedgerAccountType.BANK : LedgerAccountType.CASH,
        bankAccountId: input.bankAccountId ?? null,
        debit: amount.toFixed(2),
        credit: "0",
        narration: "Payment received",
      });
      rows.push({
        ...base,
        accountType: LedgerAccountType.PARTY,
        partyId: input.partyId ?? null,
        debit: "0",
        credit: amount.toFixed(2),
        narration: "Payment received",
      });
    } else {
      rows.push({
        ...base,
        accountType: LedgerAccountType.PARTY,
        partyId: input.partyId ?? null,
        debit: amount.toFixed(2),
        credit: "0",
        narration: "Payment made",
      });
      rows.push({
        ...base,
        accountType: intoBank ? LedgerAccountType.BANK : LedgerAccountType.CASH,
        bankAccountId: input.bankAccountId ?? null,
        debit: "0",
        credit: amount.toFixed(2),
        narration: "Payment made",
      });
    }

    await tx.ledgerEntry.createMany({ data: rows });
    return;
  }

  if (input.type === TransactionType.EXPENSE) {
    rows.push({
      ...base,
      accountType: LedgerAccountType.EXPENSE,
      expenseCategoryId: input.expenseCategoryId ?? null,
      debit: total.toFixed(2),
      credit: "0",
      narration: "Expense",
    });
    rows.push({
      ...base,
      accountType: input.partyId
        ? LedgerAccountType.PARTY
        : input.bankAccountId
          ? LedgerAccountType.BANK
          : LedgerAccountType.CASH,
      partyId: input.partyId ?? null,
      bankAccountId: input.bankAccountId ?? null,
      debit: "0",
      credit: total.toFixed(2),
      narration: "Expense",
    });

    await tx.ledgerEntry.createMany({ data: rows });
    return;
  }

  // --- goods documents ----------------------------------------------------
  const partyDebit = behaviour.partySign === 1;
  const revenueAccount = isSaleSide ? LedgerAccountType.SALES : LedgerAccountType.PURCHASE;

  rows.push({
    ...base,
    accountType: LedgerAccountType.PARTY,
    partyId: input.partyId ?? null,
    debit: partyDebit ? total.toFixed(2) : "0",
    credit: partyDebit ? "0" : total.toFixed(2),
    narration: `${input.type} ${calc.total}`,
  });

  const net = d(calc.taxableValue);
  rows.push({
    ...base,
    accountType: revenueAccount,
    accountKey: revenueAccount,
    debit: partyDebit ? "0" : net.toFixed(2),
    credit: partyDebit ? net.toFixed(2) : "0",
  });

  const taxes: [string, Decimal][] = [
    ["CGST", d(calc.cgst)],
    ["SGST", d(calc.sgst)],
    ["IGST", d(calc.igst)],
    ["CESS", d(calc.cess)],
    ["TCS", d(calc.tcs)],
  ];

  for (const [key, amount] of taxes) {
    if (amount.isZero()) continue;
    rows.push({
      ...base,
      accountType: key === "TCS" ? LedgerAccountType.TCS : LedgerAccountType.TAX,
      accountKey: `${key}_${isSaleSide ? "OUTPUT" : "INPUT"}`,
      debit: partyDebit ? "0" : amount.toFixed(2),
      credit: partyDebit ? amount.toFixed(2) : "0",
    });
  }

  const roundOff = d(calc.roundOff);
  if (!roundOff.isZero()) {
    rows.push({
      ...base,
      accountType: LedgerAccountType.ROUND_OFF,
      accountKey: "ROUND_OFF",
      debit: partyDebit ? "0" : roundOff.toFixed(2),
      credit: partyDebit ? roundOff.toFixed(2) : "0",
    });
  }

  // Money settled at the same time as the document.
  if (paid.greaterThan(0)) {
    const intoBank = !!input.bankAccountId;
    rows.push({
      ...base,
      accountType: intoBank ? LedgerAccountType.BANK : LedgerAccountType.CASH,
      bankAccountId: input.bankAccountId ?? null,
      debit: isSaleSide ? paid.toFixed(2) : "0",
      credit: isSaleSide ? "0" : paid.toFixed(2),
      narration: "Settled with document",
    });
    rows.push({
      ...base,
      accountType: LedgerAccountType.PARTY,
      partyId: input.partyId ?? null,
      debit: isSaleSide ? "0" : paid.toFixed(2),
      credit: isSaleSide ? paid.toFixed(2) : "0",
      narration: "Settled with document",
    });
  }

  await tx.ledgerEntry.createMany({ data: rows });
}

/* -------------------------------------------------------------------------- */
/* Reversal                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Soft-delete a transaction and reverse everything it posted.
 *
 * Movements, ledger entries and allocations are removed rather than negated:
 * they cascade from the transaction, and the row itself survives with a
 * `deletedAt` so the Recycle Bin can restore it.
 */
export async function reverseTransaction(
  tx: Prisma.TransactionClient,
  companyId: string,
  transactionId: string,
): Promise<void> {
  const existing = await tx.transaction.findFirst({
    where: { id: transactionId, companyId, deletedAt: null },
    select: { id: true, convertedFromId: true },
  });

  if (!existing) throw new BusinessError("That transaction no longer exists");

  await tx.stockMovement.deleteMany({ where: { transactionId, companyId } });
  await tx.ledgerEntry.deleteMany({ where: { transactionId, companyId } });
  await tx.paymentAllocation.deleteMany({
    where: { companyId, OR: [{ paymentTransactionId: transactionId }, { invoiceTransactionId: transactionId }] },
  });

  // Free the source document so it can be converted again.
  if (existing.convertedFromId) {
    await tx.transaction.updateMany({
      where: { id: existing.convertedFromId, companyId },
      data: { convertedToId: null },
    });
  }

  await tx.transaction.update({
    where: { id: transactionId },
    data: { deletedAt: new Date(), status: TransactionStatus.CANCELLED },
  });
}
