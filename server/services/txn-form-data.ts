import { TransactionType } from "@prisma/client";
import { notFound } from "next/navigation";
import { requireFirm } from "@/lib/auth/session";
import { parseSettings } from "@/lib/validators/settings";
import { toDateInputValue } from "@/lib/format/date";
import type {
  TransactionFormDefaults,
  TransactionFormSettings,
} from "@/components/txn/transaction-form";

const SETTINGS_SELECT = {
  general: true,
  transaction: true,
  print: true,
  tax: true,
  party: true,
  item: true,
  message: true,
} as const;

/** Everything the transaction form needs besides the document itself. */
export async function loadTransactionFormData() {
  const ctx = await requireFirm();

  const [firms, units, taxRates, settingsRow] = await Promise.all([
    ctx.db.firm.findMany({
      where: { isActive: true },
      orderBy: [{ isDefault: "desc" }, { name: "asc" }],
      select: { id: true, name: true, stateCode: true, termsAndConditions: true },
    }),
    ctx.db.unit.findMany({
      orderBy: { shortName: "asc" },
      select: { id: true, shortName: true },
    }),
    ctx.db.taxRate.findMany({
      orderBy: { sortOrder: "asc" },
      select: { id: true, name: true, rate: true },
    }),
    ctx.db.settings.findFirst({ where: { companyId: ctx.companyId }, select: SETTINGS_SELECT }),
  ]);

  const parsed = parseSettings(settingsRow);
  const activeFirm = firms.find((f) => f.id === ctx.firmId) ?? firms[0];

  const settings: TransactionFormSettings = {
    showLineDiscount: parsed.transaction.showLineDiscount,
    showFreeQuantity: parsed.transaction.showFreeQuantity,
    showLineDescription: parsed.transaction.showLineDescription,
    showAdditionalCharges: parsed.transaction.showAdditionalCharges,
    showBillDiscount: parsed.transaction.showBillDiscount,
    roundOffEnabled: parsed.transaction.roundOffEnabled,
    roundOffMode: parsed.transaction.roundOffMode,
    defaultDueDays: parsed.transaction.defaultDueDays,
    gstEnabled: parsed.tax.enableGst && ctx.isGstEnabled,
    enableTcs: parsed.tax.enableTcs,
    defaultTerms: activeFirm?.termsAndConditions ?? null,
  };

  return {
    ctx,
    firms: firms.map((f) => ({ id: f.id, name: f.name, stateCode: f.stateCode })),
    units,
    taxRates: taxRates.map((t) => ({ id: t.id, name: t.name, rate: t.rate.toString() })),
    settings,
    firmStateCode: ctx.firmStateCode,
  };
}

/** Load an existing document into the shape the form expects. */
export async function loadTransactionDefaults(
  companyId: string,
  id: string,
  options: { asDuplicate?: boolean } = {},
): Promise<TransactionFormDefaults> {
  const { prisma } = await import("@/lib/db/prisma");

  const txn = await prisma.transaction.findFirst({
    where: { id, companyId, deletedAt: null },
    select: {
      id: true,
      number: true,
      date: true,
      dueDate: true,
      partyId: true,
      stateOfSupply: true,
      discountValue: true,
      discountIsPercent: true,
      additionalCharges: true,
      tcs: true,
      paidAmount: true,
      paymentMode: true,
      chequeNo: true,
      notes: true,
      terms: true,
      party: { select: { name: true } },
      lines: {
        orderBy: { sortOrder: "asc" },
        select: {
          itemId: true,
          description: true,
          hsnSac: true,
          qty: true,
          freeQty: true,
          unitId: true,
          rate: true,
          rateIsTaxInclusive: true,
          discountValue: true,
          discountIsPercent: true,
          taxRateId: true,
          taxRateValue: true,
          cessRate: true,
          item: { select: { name: true } },
        },
      },
    },
  });

  if (!txn) notFound();

  const charges = Array.isArray(txn.additionalCharges)
    ? (txn.additionalCharges as { name: string; amount: string; taxRate?: string | null }[])
    : [];

  return {
    // A duplicate keeps the content but takes a fresh number and today's date.
    id: options.asDuplicate ? undefined : txn.id,
    number: options.asDuplicate ? undefined : txn.number,
    date: options.asDuplicate ? toDateInputValue(new Date()) : toDateInputValue(txn.date),
    dueDate: txn.dueDate ? toDateInputValue(txn.dueDate) : undefined,
    partyId: txn.partyId ?? undefined,
    partyName: txn.party?.name,
    stateOfSupply: txn.stateOfSupply ?? undefined,
    lines: txn.lines.map((l, i) => ({
      key: `existing-${i}`,
      itemId: l.itemId ?? undefined,
      itemName: l.item?.name,
      description: l.description ?? undefined,
      hsnSac: l.hsnSac ?? undefined,
      qty: l.qty.toString(),
      freeQty: l.freeQty.toString(),
      unitId: l.unitId ?? undefined,
      rate: l.rate.toFixed(2),
      rateIsTaxInclusive: l.rateIsTaxInclusive,
      discountValue: l.discountValue.toFixed(2),
      discountIsPercent: l.discountIsPercent,
      taxRateId: l.taxRateId ?? undefined,
      taxRateValue: l.taxRateValue.toString(),
      cessRate: l.cessRate.toString(),
    })),
    billDiscountValue: txn.discountValue.toFixed(2),
    billDiscountIsPercent: txn.discountIsPercent,
    additionalCharges: charges,
    paidAmount: options.asDuplicate ? "0" : txn.paidAmount.toFixed(2),
    paymentMode: txn.paymentMode ?? undefined,
    chequeNo: txn.chequeNo ?? undefined,
    notes: txn.notes ?? undefined,
    terms: txn.terms ?? undefined,
  };
}

/** The document types that use the shared goods form. */
export const GOODS_TYPES = [
  TransactionType.SALE,
  TransactionType.SALE_RETURN,
  TransactionType.ESTIMATE,
  TransactionType.PROFORMA,
  TransactionType.SALE_ORDER,
  TransactionType.DELIVERY_CHALLAN,
  TransactionType.PURCHASE,
  TransactionType.PURCHASE_RETURN,
  TransactionType.PURCHASE_ORDER,
] as const;
