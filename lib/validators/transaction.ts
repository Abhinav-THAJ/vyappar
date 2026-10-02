import { z } from "zod";
import { TransactionType } from "@prisma/client";
import {
  zMoney,
  zQty,
  zPercent,
  zOptionalString,
  zHsnSac,
  zDateInput,
  zDateInputOptional,
  zCuidOptional,
  zStateCode,
} from "./common";

export const PAYMENT_MODES = ["CASH", "CHEQUE", "BANK", "UPI", "CARD", "NEFT", "OTHER"] as const;

export const PAYMENT_MODE_LABELS: Record<(typeof PAYMENT_MODES)[number], string> = {
  CASH: "Cash",
  CHEQUE: "Cheque",
  BANK: "Bank transfer",
  UPI: "UPI",
  CARD: "Card",
  NEFT: "NEFT / RTGS",
  OTHER: "Other",
};

export const transactionLineSchema = z.object({
  itemId: zCuidOptional,
  description: zOptionalString,
  hsnSac: zHsnSac,
  qty: zQty,
  freeQty: zQty.optional(),
  unitId: zCuidOptional,
  rate: zMoney,
  rateIsTaxInclusive: z.boolean().default(false),
  discountValue: zMoney.optional(),
  discountIsPercent: z.boolean().default(false),
  taxRateId: zCuidOptional,
  taxRateValue: zPercent.default("0"),
  cessRate: zPercent.optional(),
});

export const additionalChargeSchema = z.object({
  name: z.string().trim().min(1, "Name the charge"),
  amount: zMoney,
  taxRate: zPercent.nullable().optional(),
});

/** Money movements rather than goods documents: they carry no line items. */
const LINELESS_TYPES: ReadonlySet<TransactionType> = new Set([
  TransactionType.PAYMENT_IN,
  TransactionType.PAYMENT_OUT,
  TransactionType.EXPENSE,
]);

/** Every goods document — sale, purchase, estimate, challan and so on. */
export const transactionSchema = z
  .object({
    id: zCuidOptional,
    type: z.nativeEnum(TransactionType),
    firmId: z.string().min(1, "Choose a firm"),

    number: zOptionalString,
    date: zDateInput,
    dueDate: zDateInputOptional,

    partyId: zCuidOptional,
    expenseCategoryId: zCuidOptional,
    bankAccountId: zCuidOptional,

    stateOfSupply: zStateCode.optional(),

    lines: z.array(transactionLineSchema).default([]),

    billDiscountValue: zMoney.optional(),
    billDiscountIsPercent: z.boolean().default(false),
    additionalCharges: z.array(additionalChargeSchema).default([]),
    tcsRate: zPercent.optional(),
    roundOffEnabled: z.boolean().default(false),
    roundOffMode: z.enum(["nearest", "up", "down"]).default("nearest"),

    paidAmount: zMoney.optional(),
    paymentMode: z.enum(PAYMENT_MODES).optional(),
    chequeNo: zOptionalString,

    notes: zOptionalString,
    terms: zOptionalString,
    convertedFromId: zCuidOptional,
  })
  .superRefine((value, ctx) => {
    const needsLines = !LINELESS_TYPES.has(value.type);

    if (needsLines && value.lines.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["lines"],
        message: "Add at least one item",
      });
    }

    for (const [i, line] of value.lines.entries()) {
      if (!line.itemId && !line.description) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["lines", i, "itemId"],
          message: "Choose an item or type a description",
        });
      }
      if (Number(line.qty) === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["lines", i, "qty"],
          message: "Quantity cannot be zero",
        });
      }
      if (line.discountIsPercent && Number(line.discountValue ?? 0) > 100) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["lines", i, "discountValue"],
          message: "Discount cannot exceed 100%",
        });
      }
    }

    // A due date before the invoice date is always a mistake.
    if (value.dueDate && value.dueDate < value.date) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["dueDate"],
        message: "The due date cannot be before the invoice date",
      });
    }

    if (value.paymentMode === "CHEQUE" && !value.chequeNo) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["chequeNo"],
        message: "Enter the cheque number",
      });
    }
  });

export type TransactionInput = z.infer<typeof transactionSchema>;
export type TransactionLineInput = z.infer<typeof transactionLineSchema>;

/** Payment-In / Payment-Out, with allocation against open invoices. */
export const paymentSchema = z.object({
  id: zCuidOptional,
  type: z.enum([TransactionType.PAYMENT_IN, TransactionType.PAYMENT_OUT]),
  firmId: z.string().min(1, "Choose a firm"),
  number: zOptionalString,
  date: zDateInput,
  partyId: z.string().min(1, "Choose a party"),
  amount: zMoney.refine((v) => Number(v) > 0, "Enter an amount"),
  paymentMode: z.enum(PAYMENT_MODES).default("CASH"),
  bankAccountId: zCuidOptional,
  chequeNo: zOptionalString,
  notes: zOptionalString,
  allocations: z
    .array(z.object({ invoiceId: z.string().min(1), amount: zMoney }))
    .default([]),
});

export type PaymentInput = z.infer<typeof paymentSchema>;

/** Expense entry, which may be a lump sum or itemised. */
export const expenseSchema = z.object({
  id: zCuidOptional,
  firmId: z.string().min(1, "Choose a firm"),
  number: zOptionalString,
  date: zDateInput,
  expenseCategoryId: z.string().min(1, "Choose a category"),
  partyId: zCuidOptional,
  lines: z.array(transactionLineSchema).default([]),
  amount: zMoney.optional(),
  taxRateValue: zPercent.optional(),
  isIgst: z.boolean().default(false),
  paidAmount: zMoney.optional(),
  paymentMode: z.enum(PAYMENT_MODES).default("CASH"),
  bankAccountId: zCuidOptional,
  notes: zOptionalString,
});

export type ExpenseInput = z.infer<typeof expenseSchema>;

export const deleteTransactionSchema = z.object({ id: z.string().min(1) });

export const convertTransactionSchema = z.object({
  id: z.string().min(1),
  toType: z.nativeEnum(TransactionType),
});

/** Which document types each type may be converted into. */
export const CONVERSIONS: Partial<Record<TransactionType, TransactionType[]>> = {
  [TransactionType.ESTIMATE]: [TransactionType.SALE_ORDER, TransactionType.SALE],
  [TransactionType.PROFORMA]: [TransactionType.SALE],
  [TransactionType.SALE_ORDER]: [TransactionType.DELIVERY_CHALLAN, TransactionType.SALE],
  [TransactionType.DELIVERY_CHALLAN]: [TransactionType.SALE],
  [TransactionType.PURCHASE_ORDER]: [TransactionType.PURCHASE],
};

export const TYPE_LABELS: Record<TransactionType, string> = {
  SALE: "Sale Invoice",
  SALE_RETURN: "Credit Note",
  ESTIMATE: "Estimate",
  PROFORMA: "Proforma Invoice",
  SALE_ORDER: "Sale Order",
  DELIVERY_CHALLAN: "Delivery Challan",
  PAYMENT_IN: "Payment-In",
  PURCHASE: "Purchase Bill",
  PURCHASE_RETURN: "Debit Note",
  PURCHASE_ORDER: "Purchase Order",
  PAYMENT_OUT: "Payment-Out",
  EXPENSE: "Expense",
  STOCK_ADJUSTMENT: "Stock Adjustment",
  BANK_TRANSFER: "Bank Transfer",
  CASH_ADJUSTMENT: "Cash Adjustment",
};

const PURCHASE_SIDE_TYPES: ReadonlySet<TransactionType> = new Set([
  TransactionType.PURCHASE,
  TransactionType.PURCHASE_RETURN,
  TransactionType.PURCHASE_ORDER,
  TransactionType.PAYMENT_OUT,
  TransactionType.EXPENSE,
]);

/** Which side of the books a type sits on, for picking customers vs suppliers. */
export function isPurchaseSide(type: TransactionType): boolean {
  return PURCHASE_SIDE_TYPES.has(type);
}
