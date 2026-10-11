import { z } from "zod";
import type { SheetColumn } from "@/lib/xlsx";
import { parseIndianDate } from "@/lib/format/date";

export type ImportKind = "parties" | "items" | "transactions";

export interface ImportField {
  key: string;
  label: string;
  required?: boolean;
  hint?: string;
  /** Header names that map to this field automatically. */
  aliases: string[];
  example: string;
}

export interface ImportSpec {
  kind: ImportKind;
  title: string;
  fields: ImportField[];
}

export const PARTY_IMPORT: ImportSpec = {
  kind: "parties",
  title: "Parties",
  fields: [
    { key: "name", label: "Party name", required: true, aliases: ["name", "party", "party name", "customer", "customer name", "supplier name"], example: "Banerji Memorial Club" },
    { key: "type", label: "Type", hint: "CUSTOMER, SUPPLIER or BOTH", aliases: ["type", "party type"], example: "CUSTOMER" },
    { key: "phone", label: "Phone", aliases: ["phone", "mobile", "contact", "contact no"], example: "9847012345" },
    { key: "email", label: "Email", aliases: ["email", "e-mail"], example: "club@example.in" },
    { key: "gstin", label: "GSTIN", aliases: ["gstin", "gst no", "gst number"], example: "32FNWPS9685D1Z1" },
    { key: "stateCode", label: "State code", hint: "Two digits, e.g. 32 for Kerala", aliases: ["state", "state code"], example: "32" },
    { key: "billingAddress", label: "Billing address", aliases: ["address", "billing address"], example: "Thrissur, Kerala" },
    { key: "openingBalance", label: "Opening balance", aliases: ["opening balance", "balance", "opening"], example: "0" },
    { key: "openingBalanceType", label: "Balance type", hint: "TO_RECEIVE or TO_PAY", aliases: ["balance type", "opening type"], example: "TO_RECEIVE" },
  ],
};

export const ITEM_IMPORT: ImportSpec = {
  kind: "items",
  title: "Items",
  fields: [
    { key: "name", label: "Item name", required: true, aliases: ["name", "item", "item name", "product"], example: "10x10 Tent" },
    { key: "type", label: "Type", hint: "PRODUCT or SERVICE", aliases: ["type", "item type"], example: "PRODUCT" },
    { key: "sku", label: "Item code", aliases: ["sku", "code", "item code"], example: "TENT-1010" },
    { key: "hsnSac", label: "HSN/SAC", aliases: ["hsn", "sac", "hsn/sac", "hsn code"], example: "9403" },
    { key: "unit", label: "Unit", hint: "Short name, e.g. NOS", aliases: ["unit", "uom"], example: "NOS" },
    { key: "salePrice", label: "Sale price", aliases: ["sale price", "price", "selling price", "mrp"], example: "4500" },
    { key: "purchasePrice", label: "Purchase price", aliases: ["purchase price", "cost", "cost price"], example: "3000" },
    { key: "taxRate", label: "GST rate %", hint: "0, 5, 12, 18 or 28", aliases: ["gst", "tax", "tax rate", "gst rate"], example: "18" },
    { key: "openingQty", label: "Opening stock", aliases: ["opening stock", "stock", "quantity", "qty"], example: "10" },
    { key: "minStockQty", label: "Minimum stock", aliases: ["min stock", "minimum stock", "reorder level"], example: "2" },
  ],
};

export const TRANSACTION_IMPORT: ImportSpec = {
  kind: "transactions",
  title: "Transactions",
  fields: [
    { key: "date", label: "Date", required: true, hint: "YYYY-MM-DD or DD/MM/YYYY", aliases: ["date", "txn date", "invoice date", "bill date"], example: "2024-03-15" },
    { key: "type", label: "Type", required: true, hint: "SALE, PURCHASE, or EXPENSE", aliases: ["type", "txn type", "transaction type", "voucher type"], example: "SALE" },
    { key: "number", label: "Invoice / Bill No", hint: "Optional invoice number", aliases: ["number", "invoice no", "inv no", "bill no", "voucher no"], example: "INV-1001" },
    { key: "partyName", label: "Party name", aliases: ["party", "party name", "customer", "customer name", "supplier", "vendor"], example: "Banerji Memorial Club" },
    { key: "itemName", label: "Item / Category", aliases: ["item", "item name", "product", "particulars", "category", "expense category"], example: "10x10 Tent" },
    { key: "qty", label: "Quantity", aliases: ["qty", "quantity", "count"], example: "1" },
    { key: "unit", label: "Unit", hint: "e.g. NOS, PCS, KG", aliases: ["unit", "uom"], example: "NOS" },
    { key: "rate", label: "Rate / Price", required: true, aliases: ["rate", "price", "unit price", "amount"], example: "4500" },
    { key: "taxRate", label: "GST rate %", hint: "0, 5, 12, 18 or 28", aliases: ["gst", "tax", "gst rate", "tax rate"], example: "18" },
    { key: "discount", label: "Discount", aliases: ["discount", "disc", "discount amount"], example: "0" },
    { key: "paidAmount", label: "Paid amount", hint: "Amount paid so far", aliases: ["paid", "paid amount", "received", "received amount"], example: "4500" },
    { key: "paymentMode", label: "Payment mode", hint: "CASH, BANK, UPI, CHEQUE", aliases: ["mode", "payment mode", "payment type"], example: "CASH" },
    { key: "notes", label: "Notes", aliases: ["notes", "narration", "description", "remarks"], example: "Migrated from previous software" },
  ],
};

export function specFor(kind: ImportKind): ImportSpec {
  if (kind === "parties") return PARTY_IMPORT;
  if (kind === "items") return ITEM_IMPORT;
  return TRANSACTION_IMPORT;
}

export function templateColumns(spec: ImportSpec): SheetColumn[] {
  return spec.fields.map((f) => ({ key: f.key, label: f.label, width: 22 }));
}

export function templateExample(spec: ImportSpec): Record<string, string> {
  return Object.fromEntries(spec.fields.map((f) => [f.key, f.example]));
}

/** Parse various date representations found in Excel spreadsheets. */
export function parseExcelDate(val: string): Date | null {
  if (!val || !val.trim()) return null;
  const s = val.trim();
  // Check if numeric serial (Excel date serial e.g. 45366)
  if (/^\d{4,5}(\.\d+)?$/.test(s)) {
    const serial = Number(s);
    // Excel base date: Dec 30, 1899
    const utcDays = serial - 25569;
    const d = new Date(utcDays * 86400 * 1000);
    if (!isNaN(d.getTime())) return d;
  }
  // Try ISO YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
    const d = new Date(s);
    if (!isNaN(d.getTime())) return d;
  }
  // Try DD/MM/YYYY or DD-MM-YYYY
  const parts = s.split(/[\/\-]/);
  if (parts.length === 3) {
    const p0 = parts[0];
    const p1 = parts[1];
    const p2 = parts[2];
    if (p0 && p1 && p2 && p0.length <= 2 && p1.length <= 2 && p2.length === 4) {
      const d = parseIndianDate(`${p0.padStart(2, "0")}/${p1.padStart(2, "0")}/${p2}`);
      if (d) return d;
    }
  }
  const fallback = new Date(s);
  return isNaN(fallback.getTime()) ? null : fallback;
}

/**
 * Guess a column mapping from the uploaded headers.
 *
 * Matching is case- and punctuation-insensitive against each field's aliases,
 * so a sheet exported from another tool usually maps itself.
 */
export function guessMapping(spec: ImportSpec, headers: string[]): Record<string, string> {
  const mapping: Record<string, string> = {};
  const used = new Set<string>();

  const normalise = (value: string) =>
    value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

  for (const field of spec.fields) {
    const candidates = [field.label, field.key, ...field.aliases].map(normalise);

    const match = headers.find(
      (header) => !used.has(header) && candidates.includes(normalise(header)),
    );

    if (match) {
      mapping[field.key] = match;
      used.add(match);
    }
  }

  return mapping;
}

export interface RowIssue {
  row: number;
  field: string;
  message: string;
}

export interface ValidationOutcome<T> {
  valid: { row: number; data: T }[];
  issues: RowIssue[];
}

/**
 * Validate every row, collecting problems rather than stopping at the first.
 * The wizard shows the whole list so a user can fix the sheet in one pass.
 */
export function validateRows<S extends z.ZodTypeAny>(
  schema: S,
  rows: Record<string, string>[],
  mapping: Record<string, string>,
): ValidationOutcome<z.output<S>> {
  const valid: { row: number; data: z.output<S> }[] = [];
  const issues: RowIssue[] = [];

  rows.forEach((raw, index) => {
    const rowNumber = index + 2; // +1 for the header, +1 for 1-based rows

    const mapped: Record<string, string> = {};
    for (const [field, header] of Object.entries(mapping)) {
      if (header) mapped[field] = raw[header] ?? "";
    }

    const result = schema.safeParse(mapped);

    if (result.success) {
      valid.push({ row: rowNumber, data: result.data });
    } else {
      for (const issue of result.error.issues) {
        issues.push({
          row: rowNumber,
          field: String(issue.path[0] ?? "row"),
          message: issue.message,
        });
      }
    }
  });

  return { valid, issues };
}

/* ----------------------------- Row schemas ------------------------------- */

const optional = z
  .string()
  .trim()
  .optional()
  .transform((v) => (v === "" ? undefined : v));

const numeric = z
  .string()
  .trim()
  .optional()
  .transform((v) => (v === "" || v === undefined ? "0" : v.replace(/[₹,\s]/g, "")))
  .refine((v) => !Number.isNaN(Number(v)), "Not a number");

export const partyRowSchema = z.object({
  name: z.string().trim().min(1, "Party name is required").max(200),
  type: optional
    .transform((v) => (v ? v.toUpperCase() : "CUSTOMER"))
    .refine(
      (v) => ["CUSTOMER", "SUPPLIER", "BOTH"].includes(v),
      "Type must be CUSTOMER, SUPPLIER or BOTH",
    ),
  phone: optional,
  email: optional.refine(
    (v) => v === undefined || z.string().email().safeParse(v).success,
    "Not a valid email",
  ),
  gstin: optional.transform((v) => v?.toUpperCase()),
  stateCode: optional.transform((v) => (v ? v.padStart(2, "0").slice(0, 2) : undefined)),
  billingAddress: optional,
  openingBalance: numeric,
  openingBalanceType: optional
    .transform((v) => (v ? v.toUpperCase().replace(/\s+/g, "_") : "TO_RECEIVE"))
    .refine(
      (v) => ["TO_RECEIVE", "TO_PAY"].includes(v),
      "Balance type must be TO_RECEIVE or TO_PAY",
    ),
});

export type PartyRow = z.output<typeof partyRowSchema>;

export const itemRowSchema = z.object({
  name: z.string().trim().min(1, "Item name is required").max(200),
  type: optional
    .transform((v) => (v ? v.toUpperCase() : "PRODUCT"))
    .refine((v) => ["PRODUCT", "SERVICE"].includes(v), "Type must be PRODUCT or SERVICE"),
  sku: optional,
  hsnSac: optional.refine(
    (v) => v === undefined || /^\d{4}$|^\d{6}$|^\d{8}$/.test(v),
    "HSN/SAC must be 4, 6 or 8 digits",
  ),
  unit: optional.transform((v) => v?.toUpperCase()),
  salePrice: numeric,
  purchasePrice: numeric,
  taxRate: numeric.refine(
    (v) => [0, 0.25, 3, 5, 12, 18, 28].includes(Number(v)),
    "GST rate must be 0, 0.25, 3, 5, 12, 18 or 28",
  ),
  openingQty: numeric,
  minStockQty: numeric,
});

export type ItemRow = z.output<typeof itemRowSchema>;

export const transactionRowSchema = z.object({
  date: z
    .string()
    .trim()
    .min(1, "Date is required")
    .refine((v) => parseExcelDate(v) !== null, "Invalid date (use YYYY-MM-DD or DD/MM/YYYY)"),
  type: z
    .string()
    .trim()
    .transform((v) => v.toUpperCase().replace(/\s+/g, "_"))
    .refine(
      (v) => ["SALE", "PURCHASE", "EXPENSE", "PAYMENT_IN", "PAYMENT_OUT"].includes(v),
      "Type must be SALE, PURCHASE, EXPENSE, PAYMENT_IN, or PAYMENT_OUT",
    ),
  number: optional,
  partyName: optional,
  itemName: optional,
  qty: numeric.refine((v) => Number(v) > 0, "Quantity must be greater than 0"),
  unit: optional.transform((v) => v?.toUpperCase()),
  rate: numeric,
  taxRate: numeric.refine(
    (v) => [0, 0.25, 3, 5, 12, 18, 28].includes(Number(v)),
    "GST rate must be 0, 0.25, 3, 5, 12, 18 or 28",
  ),
  discount: numeric,
  paidAmount: numeric,
  paymentMode: optional
    .transform((v) => (v ? v.toUpperCase() : "CASH"))
    .refine(
      (v) => ["CASH", "BANK", "UPI", "CARD", "CHEQUE", "NEFT", "OTHER"].includes(v),
      "Invalid payment mode",
    ),
  notes: optional,
});

export type TransactionRow = z.output<typeof transactionRowSchema>;
