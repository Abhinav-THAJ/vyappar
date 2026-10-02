import type { TransactionType } from "@prisma/client";

export interface TypeBehaviour {
  /** Moves stock, and in which direction. */
  stock: "out" | "in" | null;
  /** Posts to the party ledger. */
  ledger: boolean;
  /** Effect on the party ledger: +1 increases receivable, -1 decreases. */
  partySign: 1 | -1 | 0;
  /** Counts toward sales or purchase reporting. */
  revenue: "sale" | "purchase" | null;
}

/**
 * What each document type does to the books.
 *
 * Estimates, proforma invoices and orders deliberately post nothing: they are
 * intentions, not events. A delivery challan moves stock but posts no ledger
 * entry, because nothing is owed until it is invoiced.
 *
 * This module is deliberately free of Prisma imports beyond the enum's *type*,
 * so the transaction form can read it on the client without pulling the whole
 * database client into the bundle.
 */
export const BEHAVIOUR: Record<TransactionType, TypeBehaviour> = {
  SALE: { stock: "out", ledger: true, partySign: 1, revenue: "sale" },
  SALE_RETURN: { stock: "in", ledger: true, partySign: -1, revenue: "sale" },
  ESTIMATE: { stock: null, ledger: false, partySign: 0, revenue: null },
  PROFORMA: { stock: null, ledger: false, partySign: 0, revenue: null },
  SALE_ORDER: { stock: null, ledger: false, partySign: 0, revenue: null },
  DELIVERY_CHALLAN: { stock: "out", ledger: false, partySign: 0, revenue: null },
  PAYMENT_IN: { stock: null, ledger: true, partySign: -1, revenue: null },
  PURCHASE: { stock: "in", ledger: true, partySign: -1, revenue: "purchase" },
  PURCHASE_RETURN: { stock: "out", ledger: true, partySign: 1, revenue: "purchase" },
  PURCHASE_ORDER: { stock: null, ledger: false, partySign: 0, revenue: null },
  PAYMENT_OUT: { stock: null, ledger: true, partySign: 1, revenue: null },
  EXPENSE: { stock: null, ledger: true, partySign: -1, revenue: null },
  STOCK_ADJUSTMENT: { stock: null, ledger: false, partySign: 0, revenue: null },
  BANK_TRANSFER: { stock: null, ledger: true, partySign: 0, revenue: null },
  CASH_ADJUSTMENT: { stock: null, ledger: true, partySign: 0, revenue: null },
};
