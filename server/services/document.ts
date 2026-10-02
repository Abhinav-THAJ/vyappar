import { notFound } from "next/navigation";
import { prisma } from "@/lib/db/prisma";
import { parseSettings, type PrintSettings } from "@/lib/validators/settings";
import { formatDocumentNumber } from "@/lib/numbering";
import { stateName } from "@/lib/gst";
import { TYPE_LABELS } from "@/lib/validators/transaction";
import type { TransactionType } from "@prisma/client";

const SETTINGS_SELECT = {
  general: true,
  transaction: true,
  print: true,
  tax: true,
  party: true,
  item: true,
  message: true,
} as const;

export interface DocumentLine {
  index: number;
  name: string;
  description: string | null;
  hsnSac: string | null;
  qty: string;
  freeQty: string;
  unit: string | null;
  rate: string;
  discount: string;
  taxRate: string;
  taxAmount: string;
  amount: string;
}

export interface DocumentTaxRow {
  hsnSac: string;
  taxableValue: string;
  rate: string;
  cgst: string;
  sgst: string;
  igst: string;
  cess: string;
  total: string;
}

export interface InvoiceDocument {
  id: string;
  type: TransactionType;
  typeLabel: string;
  displayNumber: string;
  date: string;
  dueDate: string | null;

  firm: {
    name: string;
    gstin: string | null;
    stateName: string;
    address: string;
    phone: string | null;
    email: string | null;
    logoUrl: string | null;
    signatureUrl: string | null;
    bankName: string | null;
    bankAccountNo: string | null;
    bankIfsc: string | null;
    upiId: string | null;
  };

  party: {
    name: string;
    gstin: string | null;
    stateName: string | null;
    billingAddress: string | null;
    shippingAddress: string | null;
    phone: string | null;
  } | null;

  lines: DocumentLine[];
  taxRows: DocumentTaxRow[];

  subTotal: string;
  discountAmount: string;
  additionalCharges: { name: string; amount: string }[];
  taxableValue: string;
  cgst: string;
  sgst: string;
  igst: string;
  cess: string;
  tcs: string;
  roundOff: string;
  total: string;
  paidAmount: string;
  balanceAmount: string;

  isIgst: boolean;
  notes: string | null;
  terms: string | null;
  print: PrintSettings;
  gstEnabled: boolean;
}

/**
 * Assemble everything an invoice needs to print, in one query.
 *
 * The block list here is the contract the reference preview sets: firm header,
 * Bill To plus invoice details, lines, HSN tax summary, totals with amount in
 * words, terms, signature.
 */
export async function getInvoiceDocument(
  companyId: string,
  transactionId: string,
): Promise<InvoiceDocument> {
  const [txn, settingsRow, company] = await Promise.all([
    prisma.transaction.findFirst({
      where: { id: transactionId, companyId, deletedAt: null },
      select: {
        id: true,
        type: true,
        number: true,
        numberPrefix: true,
        date: true,
        dueDate: true,
        isIgst: true,
        subTotal: true,
        discountAmount: true,
        additionalCharges: true,
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
        notes: true,
        terms: true,
        firm: {
          select: {
            name: true,
            gstin: true,
            stateCode: true,
            addressLine1: true,
            addressLine2: true,
            city: true,
            pincode: true,
            phone: true,
            email: true,
            logoUrl: true,
            signatureUrl: true,
            bankName: true,
            bankAccountNo: true,
            bankIfsc: true,
            upiId: true,
          },
        },
        party: {
          select: {
            name: true,
            gstin: true,
            stateCode: true,
            billingAddress: true,
            shippingAddress: true,
            phone: true,
          },
        },
        lines: {
          orderBy: { sortOrder: "asc" },
          select: {
            description: true,
            hsnSac: true,
            qty: true,
            freeQty: true,
            rate: true,
            discountAmount: true,
            taxRateValue: true,
            cgst: true,
            sgst: true,
            igst: true,
            cessAmount: true,
            amount: true,
            item: { select: { name: true } },
            unit: { select: { shortName: true } },
          },
        },
        taxes: {
          select: {
            hsnSac: true,
            rate: true,
            taxableValue: true,
            cgst: true,
            sgst: true,
            igst: true,
            cessAmount: true,
          },
        },
      },
    }),
    prisma.settings.findUnique({ where: { companyId }, select: SETTINGS_SELECT }),
    prisma.company.findUnique({ where: { id: companyId }, select: { isGstEnabled: true } }),
  ]);

  if (!txn) notFound();

  const settings = parseSettings(settingsRow);
  const firm = txn.firm;

  const charges = Array.isArray(txn.additionalCharges)
    ? (txn.additionalCharges as { name: string; amount: string }[])
    : [];

  return {
    id: txn.id,
    type: txn.type,
    typeLabel: TYPE_LABELS[txn.type],
    displayNumber: formatDocumentNumber(txn.numberPrefix, txn.number),
    date: txn.date.toISOString(),
    dueDate: txn.dueDate?.toISOString() ?? null,

    firm: {
      name: firm.name,
      gstin: firm.gstin,
      stateName: stateName(firm.stateCode),
      address: [firm.addressLine1, firm.addressLine2, firm.city, firm.pincode]
        .filter(Boolean)
        .join(", "),
      phone: firm.phone,
      email: firm.email,
      logoUrl: firm.logoUrl,
      signatureUrl: firm.signatureUrl,
      bankName: firm.bankName,
      bankAccountNo: firm.bankAccountNo,
      bankIfsc: firm.bankIfsc,
      upiId: firm.upiId,
    },

    party: txn.party
      ? {
          name: txn.party.name,
          gstin: txn.party.gstin,
          stateName: txn.party.stateCode ? stateName(txn.party.stateCode) : null,
          billingAddress: txn.party.billingAddress,
          shippingAddress: txn.party.shippingAddress,
          phone: txn.party.phone,
        }
      : null,

    lines: txn.lines.map((l, i) => ({
      index: i + 1,
      name: l.item?.name ?? l.description ?? "Item",
      description: l.item?.name ? l.description : null,
      hsnSac: l.hsnSac,
      qty: l.qty.toString(),
      freeQty: l.freeQty.toString(),
      unit: l.unit?.shortName ?? null,
      rate: l.rate.toFixed(2),
      discount: l.discountAmount.toFixed(2),
      taxRate: l.taxRateValue.toString(),
      taxAmount: (
        Number(l.cgst) +
        Number(l.sgst) +
        Number(l.igst) +
        Number(l.cessAmount)
      ).toFixed(2),
      amount: l.amount.toFixed(2),
    })),

    taxRows: txn.taxes.map((t) => ({
      hsnSac: t.hsnSac ?? "—",
      taxableValue: t.taxableValue.toFixed(2),
      rate: t.rate.toString(),
      cgst: t.cgst.toFixed(2),
      sgst: t.sgst.toFixed(2),
      igst: t.igst.toFixed(2),
      cess: t.cessAmount.toFixed(2),
      total: (
        Number(t.cgst) +
        Number(t.sgst) +
        Number(t.igst) +
        Number(t.cessAmount)
      ).toFixed(2),
    })),

    subTotal: txn.subTotal.toFixed(2),
    discountAmount: txn.discountAmount.toFixed(2),
    additionalCharges: charges,
    taxableValue: txn.taxableValue.toFixed(2),
    cgst: txn.cgst.toFixed(2),
    sgst: txn.sgst.toFixed(2),
    igst: txn.igst.toFixed(2),
    cess: txn.cess.toFixed(2),
    tcs: txn.tcs.toFixed(2),
    roundOff: txn.roundOff.toFixed(2),
    total: txn.total.toFixed(2),
    paidAmount: txn.paidAmount.toFixed(2),
    balanceAmount: txn.balanceAmount.toFixed(2),

    isIgst: txn.isIgst,
    notes: txn.notes,
    terms: txn.terms,
    print: settings.print,
    gstEnabled: settings.tax.enableGst && (company?.isGstEnabled ?? true),
  };
}

/** The UPI deep link encoded into the payment QR. */
export function upiPaymentUri(doc: InvoiceDocument): string | null {
  if (!doc.firm.upiId) return null;
  const params = new URLSearchParams({
    pa: doc.firm.upiId,
    pn: doc.firm.name,
    am: doc.balanceAmount,
    cu: "INR",
    tn: `Invoice ${doc.displayNumber}`,
  });
  return `upi://pay?${params.toString()}`;
}

/** The wa.me share link, with a link back to the printable document. */
export function whatsappShareUrl(doc: InvoiceDocument, appUrl: string): string | null {
  const phone = doc.party?.phone?.replace(/\D/g, "").slice(-10);
  const message = [
    `Hi ${doc.party?.name ?? "there"},`,
    ``,
    `${doc.typeLabel} ${doc.displayNumber} for Rs ${doc.total} is ready.`,
    Number(doc.balanceAmount) > 0 ? `Balance due: Rs ${doc.balanceAmount}.` : `Paid in full. Thank you.`,
    ``,
    `View it here: ${appUrl}/print/${doc.id}`,
    ``,
    `— ${doc.firm.name}`,
  ].join("\n");

  return phone
    ? `https://wa.me/91${phone}?text=${encodeURIComponent(message)}`
    : `https://wa.me/?text=${encodeURIComponent(message)}`;
}
