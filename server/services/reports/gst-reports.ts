import { TransactionType } from "@prisma/client";
import Decimal from "decimal.js";
import { prisma } from "@/lib/db/prisma";
import { d } from "@/lib/calc";
import { formatCurrency } from "@/lib/format/number";
import { formatDocumentNumber } from "@/lib/numbering";
import type { ReportDefinition, ReportRow, ReportFilters, ReportContext } from "./types";

/**
 * GST returns are filed per GSTIN, so every report here requires a single firm
 * (`requiresFirm`). Running them across "All Firms" would merge two registrations
 * into one return, which is exactly the mistake that gets a filing rejected.
 */

async function gstDocuments(
  ctx: ReportContext,
  f: ReportFilters,
  types: TransactionType[],
) {
  return prisma.transaction.findMany({
    where: {
      companyId: ctx.companyId,
      deletedAt: null,
      type: { in: types },
      date: { gte: f.from, lte: f.to },
      ...(f.firmId ? { firmId: f.firmId } : {}),
    },
    orderBy: [{ date: "asc" }, { number: "asc" }],
    select: {
      id: true,
      date: true,
      number: true,
      numberPrefix: true,
      type: true,
      isIgst: true,
      stateOfSupply: true,
      taxableValue: true,
      cgst: true,
      sgst: true,
      igst: true,
      cess: true,
      total: true,
      party: { select: { name: true, gstin: true, gstType: true, stateCode: true } },
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
  });
}

const GST_DOC_COLUMNS = [
  { key: "date", label: "Date", format: "date" as const },
  { key: "number", label: "Invoice" },
  { key: "party", label: "Party" },
  { key: "gstin", label: "GSTIN" },
  { key: "supplyType", label: "Supply" },
  { key: "rate", label: "Rate", format: "percent" as const, align: "right" as const },
  { key: "taxable", label: "Taxable", format: "money" as const, align: "right" as const, total: true },
  { key: "cgst", label: "CGST", format: "money" as const, align: "right" as const, total: true },
  { key: "sgst", label: "SGST", format: "money" as const, align: "right" as const, total: true },
  { key: "igst", label: "IGST", format: "money" as const, align: "right" as const, total: true },
  { key: "cess", label: "Cess", format: "money" as const, align: "right" as const, total: true },
  { key: "total", label: "Invoice total", format: "money" as const, align: "right" as const, total: true },
];

function sumRows(rows: ReportRow[], keys: string[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const key of keys) out[key] = rows.reduce((a, r) => a + Number(r[key] ?? 0), 0);
  return out;
}

const GST_TOTAL_KEYS = ["taxable", "cgst", "sgst", "igst", "cess", "total"];

/** One row per tax rate within each invoice, which is the shape GSTR-1 expects. */
function toRateRows(
  documents: Awaited<ReturnType<typeof gstDocuments>>,
): ReportRow[] {
  const rows: ReportRow[] = [];

  for (const doc of documents) {
    const breakup = doc.taxes.length > 0 ? doc.taxes : [null];

    for (const tax of breakup) {
      rows.push({
        _id: `${doc.id}-${tax?.rate.toString() ?? "0"}`,
        date: doc.date.toISOString(),
        number: formatDocumentNumber(doc.numberPrefix, doc.number),
        party: doc.party?.name ?? "Cash sale",
        gstin: doc.party?.gstin ?? "—",
        supplyType: doc.isIgst ? "Inter-state" : "Intra-state",
        rate: tax ? Number(tax.rate) : 0,
        taxable: tax ? Number(tax.taxableValue) : Number(doc.taxableValue),
        cgst: tax ? Number(tax.cgst) : Number(doc.cgst),
        sgst: tax ? Number(tax.sgst) : Number(doc.sgst),
        igst: tax ? Number(tax.igst) : Number(doc.igst),
        cess: tax ? Number(tax.cessAmount) : Number(doc.cess),
        // Only the first rate row carries the invoice total, so it is not counted twice.
        total: tax === breakup[0] ? Number(doc.total) : 0,
      });
    }
  }

  return rows;
}

export const gstr1Report: ReportDefinition = {
  slug: "gst/gstr-1",
  title: "GSTR-1",
  description: "Outward supplies, rate by rate, ready to file.",
  group: "GST",
  permission: "report.gst",
  requiresFirm: true,
  columns: GST_DOC_COLUMNS,
  async run(ctx, f) {
    const documents = await gstDocuments(ctx, f, [
      TransactionType.SALE,
      TransactionType.SALE_RETURN,
    ]);

    const rows = toRateRows(documents);
    const totals = sumRows(rows, GST_TOTAL_KEYS);

    const b2b = documents.filter((doc) => !!doc.party?.gstin).length;
    const b2c = documents.length - b2b;

    return {
      rows,
      totals,
      summary: [
        { label: "B2B invoices", value: String(b2b) },
        { label: "B2C invoices", value: String(b2c) },
        { label: "Taxable value", value: formatCurrency(totals.taxable ?? 0) },
        {
          label: "Tax payable",
          value: formatCurrency(
            (totals.cgst ?? 0) + (totals.sgst ?? 0) + (totals.igst ?? 0) + (totals.cess ?? 0),
          ),
        },
      ],
      note: "Use Export to download the JSON for the government offline tool.",
    };
  },
};

export const gstr2Report: ReportDefinition = {
  slug: "gst/gstr-2",
  title: "GSTR-2",
  description: "Inward supplies and the input tax credit available on them.",
  group: "GST",
  permission: "report.gst",
  requiresFirm: true,
  columns: GST_DOC_COLUMNS,
  async run(ctx, f) {
    const documents = await gstDocuments(ctx, f, [
      TransactionType.PURCHASE,
      TransactionType.PURCHASE_RETURN,
    ]);

    const rows = toRateRows(documents);
    const totals = sumRows(rows, GST_TOTAL_KEYS);

    return {
      rows,
      totals,
      summary: [
        { label: "Bills", value: String(documents.length) },
        { label: "Taxable value", value: formatCurrency(totals.taxable ?? 0) },
        {
          label: "Input tax credit",
          value: formatCurrency(
            (totals.cgst ?? 0) + (totals.sgst ?? 0) + (totals.igst ?? 0) + (totals.cess ?? 0),
          ),
          tone: "positive",
        },
      ],
    };
  },
};

export const gstr3bReport: ReportDefinition = {
  slug: "gst/gstr-3b",
  title: "GSTR-3B",
  description: "Output tax less input credit — the net GST payable.",
  group: "GST",
  permission: "report.gst",
  requiresFirm: true,
  columns: [
    { key: "particulars", label: "Particulars" },
    { key: "taxable", label: "Taxable value", format: "money", align: "right" },
    { key: "cgst", label: "CGST", format: "money", align: "right" },
    { key: "sgst", label: "SGST", format: "money", align: "right" },
    { key: "igst", label: "IGST", format: "money", align: "right" },
    { key: "cess", label: "Cess", format: "money", align: "right" },
  ],
  async run(ctx, f) {
    const firmFilter = f.firmId ? { firmId: f.firmId } : {};
    const dateFilter = { gte: f.from, lte: f.to };

    const [sales, salesReturn, purchases, purchaseReturn] = await Promise.all([
      prisma.transaction.aggregate({
        where: { companyId: ctx.companyId, deletedAt: null, type: "SALE", date: dateFilter, ...firmFilter },
        _sum: { taxableValue: true, cgst: true, sgst: true, igst: true, cess: true },
      }),
      prisma.transaction.aggregate({
        where: { companyId: ctx.companyId, deletedAt: null, type: "SALE_RETURN", date: dateFilter, ...firmFilter },
        _sum: { taxableValue: true, cgst: true, sgst: true, igst: true, cess: true },
      }),
      prisma.transaction.aggregate({
        where: { companyId: ctx.companyId, deletedAt: null, type: "PURCHASE", date: dateFilter, ...firmFilter },
        _sum: { taxableValue: true, cgst: true, sgst: true, igst: true, cess: true },
      }),
      prisma.transaction.aggregate({
        where: { companyId: ctx.companyId, deletedAt: null, type: "PURCHASE_RETURN", date: dateFilter, ...firmFilter },
        _sum: { taxableValue: true, cgst: true, sgst: true, igst: true, cess: true },
      }),
    ]);

    const net = (
      a: typeof sales,
      b: typeof salesReturn,
      key: "taxableValue" | "cgst" | "sgst" | "igst" | "cess",
    ) => d(a._sum[key]?.toString() ?? 0).minus(d(b._sum[key]?.toString() ?? 0));

    const outward = {
      taxable: net(sales, salesReturn, "taxableValue"),
      cgst: net(sales, salesReturn, "cgst"),
      sgst: net(sales, salesReturn, "sgst"),
      igst: net(sales, salesReturn, "igst"),
      cess: net(sales, salesReturn, "cess"),
    };

    const inward = {
      taxable: net(purchases, purchaseReturn, "taxableValue"),
      cgst: net(purchases, purchaseReturn, "cgst"),
      sgst: net(purchases, purchaseReturn, "sgst"),
      igst: net(purchases, purchaseReturn, "igst"),
      cess: net(purchases, purchaseReturn, "cess"),
    };

    const payable = {
      cgst: Decimal.max(outward.cgst.minus(inward.cgst), 0),
      sgst: Decimal.max(outward.sgst.minus(inward.sgst), 0),
      igst: Decimal.max(outward.igst.minus(inward.igst), 0),
      cess: Decimal.max(outward.cess.minus(inward.cess), 0),
    };

    const totalPayable = payable.cgst.plus(payable.sgst).plus(payable.igst).plus(payable.cess);

    return {
      rows: [
        {
          particulars: "3.1 Outward taxable supplies",
          taxable: outward.taxable.toNumber(),
          cgst: outward.cgst.toNumber(),
          sgst: outward.sgst.toNumber(),
          igst: outward.igst.toNumber(),
          cess: outward.cess.toNumber(),
        },
        {
          particulars: "4. Eligible input tax credit",
          taxable: inward.taxable.toNumber(),
          cgst: inward.cgst.toNumber(),
          sgst: inward.sgst.toNumber(),
          igst: inward.igst.toNumber(),
          cess: inward.cess.toNumber(),
        },
        {
          particulars: "5.1 Net tax payable",
          taxable: null,
          cgst: payable.cgst.toNumber(),
          sgst: payable.sgst.toNumber(),
          igst: payable.igst.toNumber(),
          cess: payable.cess.toNumber(),
        },
      ],
      summary: [
        { label: "Output tax", value: formatCurrency(outward.cgst.plus(outward.sgst).plus(outward.igst).plus(outward.cess).toFixed(2)) },
        { label: "Input credit", value: formatCurrency(inward.cgst.plus(inward.sgst).plus(inward.igst).plus(inward.cess).toFixed(2)), tone: "positive" },
        { label: "Net payable", value: formatCurrency(totalPayable.toFixed(2)), tone: "negative" },
      ],
      note: "Credit is set off head by head; a surplus in one head does not offset another here.",
    };
  },
};

export const gstRateReport: ReportDefinition = {
  slug: "gst/rate-report",
  title: "GST Rate Report",
  description: "Taxable value and tax collected at each rate.",
  group: "GST",
  permission: "report.gst",
  columns: [
    { key: "rate", label: "Rate", format: "percent", align: "right" },
    { key: "invoices", label: "Invoices", format: "number", align: "right" },
    { key: "taxable", label: "Taxable", format: "money", align: "right", total: true },
    { key: "cgst", label: "CGST", format: "money", align: "right", total: true },
    { key: "sgst", label: "SGST", format: "money", align: "right", total: true },
    { key: "igst", label: "IGST", format: "money", align: "right", total: true },
    { key: "tax", label: "Total tax", format: "money", align: "right", total: true },
  ],
  async run(ctx, f) {
    const taxes = await prisma.transactionTax.findMany({
      where: {
        companyId: ctx.companyId,
        transaction: {
          deletedAt: null,
          type: { in: [TransactionType.SALE, TransactionType.SALE_RETURN] },
          date: { gte: f.from, lte: f.to },
          ...(f.firmId ? { firmId: f.firmId } : {}),
        },
      },
      select: {
        rate: true,
        taxableValue: true,
        cgst: true,
        sgst: true,
        igst: true,
        cessAmount: true,
        transactionId: true,
      },
    });

    const byRate = new Map<
      string,
      { invoices: Set<string>; taxable: Decimal; cgst: Decimal; sgst: Decimal; igst: Decimal; cess: Decimal }
    >();

    for (const tax of taxes) {
      const key = tax.rate.toString();
      const bucket =
        byRate.get(key) ?? {
          invoices: new Set<string>(),
          taxable: new Decimal(0),
          cgst: new Decimal(0),
          sgst: new Decimal(0),
          igst: new Decimal(0),
          cess: new Decimal(0),
        };

      bucket.invoices.add(tax.transactionId);
      bucket.taxable = bucket.taxable.plus(d(tax.taxableValue.toString()));
      bucket.cgst = bucket.cgst.plus(d(tax.cgst.toString()));
      bucket.sgst = bucket.sgst.plus(d(tax.sgst.toString()));
      bucket.igst = bucket.igst.plus(d(tax.igst.toString()));
      bucket.cess = bucket.cess.plus(d(tax.cessAmount.toString()));
      byRate.set(key, bucket);
    }

    const rows: ReportRow[] = [...byRate.entries()]
      .map(([rate, b]) => ({
        rate: Number(rate),
        invoices: b.invoices.size,
        taxable: b.taxable.toNumber(),
        cgst: b.cgst.toNumber(),
        sgst: b.sgst.toNumber(),
        igst: b.igst.toNumber(),
        tax: b.cgst.plus(b.sgst).plus(b.igst).plus(b.cess).toNumber(),
      }))
      .sort((a, b) => Number(a.rate) - Number(b.rate));

    return {
      rows,
      totals: sumRows(rows, ["taxable", "cgst", "sgst", "igst", "tax"]),
    };
  },
};

export const hsnSummaryReport: ReportDefinition = {
  slug: "gst/hsn-summary",
  title: "HSN Summary",
  description: "Outward supplies grouped by HSN or SAC code.",
  group: "GST",
  permission: "report.gst",
  columns: [
    { key: "hsn", label: "HSN/SAC" },
    { key: "rate", label: "Rate", format: "percent", align: "right" },
    { key: "qty", label: "Quantity", format: "qty", align: "right", total: true },
    { key: "taxable", label: "Taxable", format: "money", align: "right", total: true },
    { key: "cgst", label: "CGST", format: "money", align: "right", total: true },
    { key: "sgst", label: "SGST", format: "money", align: "right", total: true },
    { key: "igst", label: "IGST", format: "money", align: "right", total: true },
  ],
  async run(ctx, f) {
    const [taxes, lines] = await Promise.all([
      prisma.transactionTax.findMany({
        where: {
          companyId: ctx.companyId,
          transaction: {
            deletedAt: null,
            type: TransactionType.SALE,
            date: { gte: f.from, lte: f.to },
            ...(f.firmId ? { firmId: f.firmId } : {}),
          },
        },
        select: {
          hsnSac: true,
          rate: true,
          taxableValue: true,
          cgst: true,
          sgst: true,
          igst: true,
        },
      }),
      prisma.transactionLine.findMany({
        where: {
          companyId: ctx.companyId,
          transaction: {
            deletedAt: null,
            type: TransactionType.SALE,
            date: { gte: f.from, lte: f.to },
            ...(f.firmId ? { firmId: f.firmId } : {}),
          },
        },
        select: { hsnSac: true, qty: true },
      }),
    ]);

    const qtyByHsn = new Map<string, Decimal>();
    for (const line of lines) {
      const key = line.hsnSac ?? "—";
      qtyByHsn.set(key, (qtyByHsn.get(key) ?? new Decimal(0)).plus(d(line.qty.toString())));
    }

    const byKey = new Map<
      string,
      { hsn: string; rate: number; taxable: Decimal; cgst: Decimal; sgst: Decimal; igst: Decimal }
    >();

    for (const tax of taxes) {
      const hsn = tax.hsnSac ?? "—";
      const key = `${hsn}|${tax.rate.toString()}`;
      const bucket =
        byKey.get(key) ?? {
          hsn,
          rate: Number(tax.rate),
          taxable: new Decimal(0),
          cgst: new Decimal(0),
          sgst: new Decimal(0),
          igst: new Decimal(0),
        };

      bucket.taxable = bucket.taxable.plus(d(tax.taxableValue.toString()));
      bucket.cgst = bucket.cgst.plus(d(tax.cgst.toString()));
      bucket.sgst = bucket.sgst.plus(d(tax.sgst.toString()));
      bucket.igst = bucket.igst.plus(d(tax.igst.toString()));
      byKey.set(key, bucket);
    }

    const rows: ReportRow[] = [...byKey.values()]
      .map((b) => ({
        hsn: b.hsn,
        rate: b.rate,
        qty: (qtyByHsn.get(b.hsn) ?? new Decimal(0)).toNumber(),
        taxable: b.taxable.toNumber(),
        cgst: b.cgst.toNumber(),
        sgst: b.sgst.toNumber(),
        igst: b.igst.toNumber(),
      }))
      .sort((a, b) => a.hsn.localeCompare(b.hsn) || a.rate - b.rate);

    return {
      rows,
      totals: sumRows(rows, ["qty", "taxable", "cgst", "sgst", "igst"]),
    };
  },
};

/* -------------------------------------------------------------------------- */
/* GSTR-1 JSON export                                                          */
/* -------------------------------------------------------------------------- */

export interface Gstr1Json {
  gstin: string;
  fp: string;
  b2b: unknown[];
  b2cs: unknown[];
  hsn: { data: unknown[] };
}

/**
 * GSTR-1 in the shape the government offline tool accepts.
 *
 * B2B is grouped by the buyer's GSTIN with an invoice array; B2C small is
 * summarised by place of supply and rate; the HSN block carries quantities.
 */
export async function buildGstr1Json(
  companyId: string,
  firmId: string,
  from: Date,
  to: Date,
): Promise<Gstr1Json> {
  const firm = await prisma.firm.findFirst({
    where: { id: firmId, companyId },
    select: { gstin: true, stateCode: true },
  });

  const documents = await prisma.transaction.findMany({
    where: {
      companyId,
      firmId,
      deletedAt: null,
      type: TransactionType.SALE,
      date: { gte: from, lte: to },
    },
    orderBy: { date: "asc" },
    select: {
      number: true,
      numberPrefix: true,
      date: true,
      total: true,
      isIgst: true,
      stateOfSupply: true,
      party: { select: { gstin: true, stateCode: true } },
      taxes: {
        select: {
          rate: true,
          taxableValue: true,
          cgst: true,
          sgst: true,
          igst: true,
          cessAmount: true,
          hsnSac: true,
        },
      },
      lines: { select: { hsnSac: true, qty: true, taxableValue: true } },
    },
  });

  // --- B2B: grouped by counterparty GSTIN -----------------------------------
  const b2bMap = new Map<string, { ctin: string; inv: unknown[] }>();

  for (const doc of documents) {
    const ctin = doc.party?.gstin;
    if (!ctin) continue;

    const entry = b2bMap.get(ctin) ?? { ctin, inv: [] };

    entry.inv.push({
      inum: `${doc.numberPrefix}${doc.number}`,
      idt: formatGstDate(doc.date),
      val: Number(doc.total),
      pos: doc.stateOfSupply ?? doc.party?.stateCode ?? firm?.stateCode ?? "",
      rchrg: "N",
      inv_typ: "R",
      itms: doc.taxes.map((tax, index) => ({
        num: index + 1,
        itm_det: {
          rt: Number(tax.rate),
          txval: Number(tax.taxableValue),
          iamt: Number(tax.igst),
          camt: Number(tax.cgst),
          samt: Number(tax.sgst),
          csamt: Number(tax.cessAmount),
        },
      })),
    });

    b2bMap.set(ctin, entry);
  }

  // --- B2CS: summarised by place of supply and rate -------------------------
  const b2csMap = new Map<
    string,
    { sply_ty: string; pos: string; typ: string; rt: number; txval: number; iamt: number; camt: number; samt: number; csamt: number }
  >();

  for (const doc of documents) {
    if (doc.party?.gstin) continue;

    const pos = doc.stateOfSupply ?? firm?.stateCode ?? "";

    for (const tax of doc.taxes) {
      const key = `${pos}|${tax.rate.toString()}`;
      const entry =
        b2csMap.get(key) ?? {
          sply_ty: doc.isIgst ? "INTER" : "INTRA",
          pos,
          typ: "OE",
          rt: Number(tax.rate),
          txval: 0,
          iamt: 0,
          camt: 0,
          samt: 0,
          csamt: 0,
        };

      entry.txval += Number(tax.taxableValue);
      entry.iamt += Number(tax.igst);
      entry.camt += Number(tax.cgst);
      entry.samt += Number(tax.sgst);
      entry.csamt += Number(tax.cessAmount);
      b2csMap.set(key, entry);
    }
  }

  // --- HSN block ------------------------------------------------------------
  const hsnMap = new Map<
    string,
    { hsn_sc: string; qty: number; txval: number; iamt: number; camt: number; samt: number; csamt: number }
  >();

  for (const doc of documents) {
    for (const tax of doc.taxes) {
      const hsn = tax.hsnSac ?? "";
      const entry =
        hsnMap.get(hsn) ?? {
          hsn_sc: hsn,
          qty: 0,
          txval: 0,
          iamt: 0,
          camt: 0,
          samt: 0,
          csamt: 0,
        };

      entry.txval += Number(tax.taxableValue);
      entry.iamt += Number(tax.igst);
      entry.camt += Number(tax.cgst);
      entry.samt += Number(tax.sgst);
      entry.csamt += Number(tax.cessAmount);
      hsnMap.set(hsn, entry);
    }

    for (const line of doc.lines) {
      const hsn = line.hsnSac ?? "";
      const entry = hsnMap.get(hsn);
      if (entry) entry.qty += Number(line.qty);
    }
  }

  return {
    gstin: firm?.gstin ?? "",
    // Filing period is MMYYYY of the range start.
    fp: `${String(from.getMonth() + 1).padStart(2, "0")}${from.getFullYear()}`,
    b2b: [...b2bMap.values()],
    b2cs: [...b2csMap.values()],
    hsn: {
      data: [...hsnMap.values()].map((h, i) => ({ num: i + 1, ...h })),
    },
  };
}

/** GST dates are DD-MM-YYYY. */
function formatGstDate(date: Date): string {
  const dd = String(date.getDate()).padStart(2, "0");
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  return `${dd}-${mm}-${date.getFullYear()}`;
}
