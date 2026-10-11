"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { StockReason, TransactionType, PaymentMode } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { requirePermission } from "@/lib/auth/session";
import { normalizeName } from "@/lib/utils";
import { todayIST } from "@/lib/format/date";
import { stateCodeFromGstin } from "@/lib/gst";
import { readWorkbook } from "@/lib/xlsx";
import {
  specFor,
  guessMapping,
  validateRows,
  partyRowSchema,
  itemRowSchema,
  transactionRowSchema,
  parseExcelDate,
  type ImportKind,
  type RowIssue,
  type TransactionRow,
} from "@/server/services/import";
import {
  postTransaction,
  type PostingContext,
  type PostingInput,
  type PostingLine,
} from "@/server/services/posting";
import { runAction, BusinessError, type ActionResult } from "@/server/guards/action";

export interface ParsedUpload {
  headers: string[];
  rows: Record<string, string>[];
  mapping: Record<string, string>;
  totalRows: number;
}

/** Step 2 → 3: read the uploaded sheet and guess the column mapping. */
export async function parseUploadAction(
  kind: ImportKind,
  formData: FormData,
): Promise<ActionResult<ParsedUpload>> {
  return runAction(z.object({}), {}, async () => {
    await requirePermission("data.import");

    const file = formData.get("file");
    if (!(file instanceof File)) throw new BusinessError("Choose a file to upload");

    if (file.size > 8 * 1024 * 1024) {
      throw new BusinessError("That file is larger than 8 MB. Split it and import in batches.");
    }

    const buffer = await file.arrayBuffer();

    let parsed: { headers: string[]; rows: Record<string, string>[] };
    try {
      parsed = readWorkbook(buffer);
    } catch {
      throw new BusinessError("That file could not be read as a spreadsheet");
    }

    if (parsed.headers.length === 0) {
      throw new BusinessError("The first sheet has no header row");
    }
    if (parsed.rows.length === 0) {
      throw new BusinessError("The sheet has headers but no data rows");
    }

    const spec = specFor(kind);

    return {
      headers: parsed.headers,
      // Cap what travels to the browser; the import itself re-reads everything.
      rows: parsed.rows.slice(0, 2000),
      mapping: guessMapping(spec, parsed.headers),
      totalRows: parsed.rows.length,
    };
  });
}

const commitSchema = z.object({
  kind: z.enum(["parties", "items", "transactions"]),
  mapping: z.record(z.string()),
  rows: z.array(z.record(z.string())),
  /** Update a record that already has that name instead of skipping it. */
  updateExisting: z.boolean().default(false),
});

export interface ImportOutcome {
  created: number;
  updated: number;
  skipped: number;
  issues: RowIssue[];
}

/**
 * Step 5: validate and write.
 *
 * Every row is validated first; only then does anything get written, and the
 * whole batch runs in one database transaction — so an import either lands
 * completely or not at all, never half a row.
 */
export async function commitImportAction(
  raw: unknown,
): Promise<ActionResult<ImportOutcome>> {
  return runAction(commitSchema, raw, async (input) => {
    const ctx = await requirePermission("data.import");

    if (input.kind === "parties") {
      const { valid, issues } = validateRows(partyRowSchema, input.rows, input.mapping);
      if (valid.length === 0) {
        throw new BusinessError("No row passed validation. Fix the sheet and try again.");
      }

      const existing = await ctx.db.party.findMany({
        select: { id: true, nameNormalized: true },
      });
      const existingMap = new Map(existing.map((p) => [p.nameNormalized, p.id]));

      let created = 0;
      let updated = 0;
      let skipped = 0;

      await prisma.$transaction(async (tx) => {
        for (const { data } of valid) {
          const nameNormalized = normalizeName(data.name);
          const existingId = existingMap.get(nameNormalized);

          const payload = {
            name: data.name,
            nameNormalized,
            type: data.type as "CUSTOMER" | "SUPPLIER" | "BOTH",
            gstType: data.gstin ? ("REGISTERED" as const) : ("UNREGISTERED" as const),
            gstin: data.gstin ?? null,
            stateCode: stateCodeFromGstin(data.gstin) ?? data.stateCode ?? null,
            phone: data.phone ?? null,
            email: data.email ?? null,
            billingAddress: data.billingAddress ?? null,
            openingBalance: data.openingBalance,
            openingBalanceType: data.openingBalanceType as "TO_RECEIVE" | "TO_PAY",
            openingAsOf: Number(data.openingBalance) !== 0 ? todayIST() : null,
          };

          if (existingId) {
            if (!input.updateExisting) {
              skipped += 1;
              continue;
            }
            await tx.party.update({ where: { id: existingId }, data: payload });
            updated += 1;
          } else {
            await tx.party.create({
              data: { ...payload, companyId: ctx.companyId, createdById: ctx.user.id },
            });
            created += 1;
          }
        }
      });

      revalidatePath("/parties");
      return { created, updated, skipped, issues };
    }

    if (input.kind === "items") {
      const { valid, issues } = validateRows(itemRowSchema, input.rows, input.mapping);
      if (valid.length === 0) {
        throw new BusinessError("No row passed validation. Fix the sheet and try again.");
      }

      const [existing, units, taxRates] = await Promise.all([
        ctx.db.item.findMany({ select: { id: true, nameNormalized: true } }),
        ctx.db.unit.findMany({ select: { id: true, shortName: true } }),
        ctx.db.taxRate.findMany({
          where: { isExempt: false, isNilRated: false },
          select: { id: true, rate: true },
        }),
      ]);

      const existingMap = new Map(existing.map((i) => [i.nameNormalized, i.id]));
      const unitMap = new Map(units.map((u) => [u.shortName.toUpperCase(), u.id]));
      const rateMap = new Map(taxRates.map((t) => [Number(t.rate), t.id]));

      let created = 0;
      let updated = 0;
      let skipped = 0;

      await prisma.$transaction(async (tx) => {
        for (const { data } of valid) {
          const nameNormalized = normalizeName(data.name);
          const existingId = existingMap.get(nameNormalized);
          const isProduct = data.type === "PRODUCT";

          const payload = {
            name: data.name,
            nameNormalized,
            type: data.type as "PRODUCT" | "SERVICE",
            sku: data.sku ?? null,
            hsnSac: data.hsnSac ?? null,
            unitId: data.unit ? (unitMap.get(data.unit) ?? null) : null,
            salePrice: data.salePrice,
            purchasePrice: data.purchasePrice,
            taxRateId: rateMap.get(Number(data.taxRate)) ?? null,
            openingQty: isProduct ? data.openingQty : "0",
            minStockQty: data.minStockQty,
          };

          let itemId: string;

          if (existingId) {
            if (!input.updateExisting) {
              skipped += 1;
              continue;
            }
            await tx.item.update({ where: { id: existingId }, data: payload });
            itemId = existingId;
            updated += 1;

            await tx.stockMovement.deleteMany({
              where: { companyId: ctx.companyId, itemId, reason: StockReason.OPENING },
            });
          } else {
            const row = await tx.item.create({
              data: { ...payload, companyId: ctx.companyId, createdById: ctx.user.id },
              select: { id: true },
            });
            itemId = row.id;
            created += 1;
          }

          if (isProduct && Number(data.openingQty) !== 0) {
            await tx.stockMovement.create({
              data: {
                companyId: ctx.companyId,
                itemId,
                date: todayIST(),
                qtyIn: Number(data.openingQty) > 0 ? data.openingQty : "0",
                qtyOut: Number(data.openingQty) < 0 ? String(Math.abs(Number(data.openingQty))) : "0",
                rate: data.purchasePrice,
                reason: StockReason.OPENING,
                note: "Imported opening stock",
              },
            });
          }
        }
      });

      revalidatePath("/items");
      return { created, updated, skipped, issues };
    }

    // --- transactions -------------------------------------------------------
    const { valid, issues } = validateRows(transactionRowSchema, input.rows, input.mapping);
    if (valid.length === 0) {
      throw new BusinessError("No row passed validation. Fix the sheet and try again.");
    }

    const [firm, company, existingParties, existingItems, existingUnits, taxRates, existingExpenseCategories] =
      await Promise.all([
        ctx.db.firm.findFirst({
          where: { companyId: ctx.companyId, isActive: true },
          orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
        }),
        ctx.db.company.findUnique({
          where: { id: ctx.companyId },
          select: { fyStartMonth: true },
        }),
        ctx.db.party.findMany({
          where: { companyId: ctx.companyId },
          select: { id: true, name: true, nameNormalized: true, stateCode: true },
        }),
        ctx.db.item.findMany({
          where: { companyId: ctx.companyId },
          select: { id: true, name: true, nameNormalized: true, hsnSac: true, taxRateId: true, unitId: true },
        }),
        ctx.db.unit.findMany({
          where: { companyId: ctx.companyId },
          select: { id: true, shortName: true },
        }),
        ctx.db.taxRate.findMany({
          where: { companyId: ctx.companyId },
          select: { id: true, rate: true },
        }),
        ctx.db.expenseCategory.findMany({
          where: { companyId: ctx.companyId },
          select: { id: true, name: true },
        }),
      ]);

    if (!firm) {
      throw new BusinessError("No active business firm found. Please configure a firm in Settings first.");
    }

    const partyMap = new Map(existingParties.map((p) => [p.nameNormalized, p]));
    const itemMap = new Map(existingItems.map((i) => [i.nameNormalized, i]));
    const unitMap = new Map(existingUnits.map((u) => [u.shortName.toUpperCase(), u.id]));
    const rateMap = new Map(taxRates.map((t) => [Number(t.rate), t.id]));
    const expenseCatMap = new Map(existingExpenseCategories.map((e) => [e.name.toLowerCase().trim(), e.id]));

    // Group rows into transactions by document number & type, or row index if no number
    interface TxnGroup {
      header: TransactionRow;
      rows: TransactionRow[];
      startRow: number;
    }
    const groups = new Map<string, TxnGroup>();

    valid.forEach(({ data, row }, idx) => {
      const key = data.number && data.number.trim()
        ? `${data.type}__${data.number.trim().toUpperCase()}`
        : `${data.type}__row_${idx}`;
      const existing = groups.get(key);
      if (existing) {
        existing.rows.push(data);
      } else {
        groups.set(key, { header: data, rows: [data], startRow: row });
      }
    });

    let created = 0;
    let skipped = 0;
    const allIssues = [...issues];

    await prisma.$transaction(async (tx) => {
      for (const [, group] of groups) {
        const { header, rows, startRow } = group;
        const parsedDate = parseExcelDate(header.date) ?? new Date();
        const txnType = header.type as TransactionType;

        // 1. Resolve or auto-create Party
        let partyId: string | null = null;
        let partyStateCode: string | null = null;

        if (header.partyName && header.partyName.trim()) {
          const normParty = normalizeName(header.partyName);
          const foundParty = partyMap.get(normParty);
          if (foundParty) {
            partyId = foundParty.id;
            partyStateCode = foundParty.stateCode;
          } else {
            const newPartyType =
              txnType === "PURCHASE" || txnType === "PAYMENT_OUT" ? "SUPPLIER" : "CUSTOMER";
            const createdParty = await tx.party.create({
              data: {
                companyId: ctx.companyId,
                name: header.partyName.trim(),
                nameNormalized: normParty,
                type: newPartyType,
                gstType: "UNREGISTERED",
                createdById: ctx.user.id,
              },
              select: { id: true, name: true, nameNormalized: true, stateCode: true },
            });
            partyMap.set(normParty, createdParty);
            partyId = createdParty.id;
          }
        }

        // 2. Resolve or auto-create Expense Category if EXPENSE
        let expenseCategoryId: string | null = null;
        if (txnType === "EXPENSE") {
          const catName = header.itemName?.trim() || "General Expense";
          const normCat = catName.toLowerCase();
          const foundCatId = expenseCatMap.get(normCat);
          if (foundCatId) {
            expenseCategoryId = foundCatId;
          } else {
            const createdCat = await tx.expenseCategory.create({
              data: {
                companyId: ctx.companyId,
                name: catName,
              },
              select: { id: true },
            });
            expenseCatMap.set(normCat, createdCat.id);
            expenseCategoryId = createdCat.id;
          }
        }

        // 3. Build lines
        const lines: PostingLine[] = [];
        for (const row of rows) {
          let itemId: string | null = null;
          let hsnSac: string | null = null;
          let taxRateId: string | null = null;

          if (txnType !== "EXPENSE" && row.itemName && row.itemName.trim()) {
            const normItem = normalizeName(row.itemName);
            const foundItem = itemMap.get(normItem);
            if (foundItem) {
              itemId = foundItem.id;
              hsnSac = foundItem.hsnSac;
              taxRateId = foundItem.taxRateId;
            } else {
              const rateNum = Number(row.taxRate);
              const trId = rateMap.get(rateNum) ?? null;
              const uId = row.unit ? unitMap.get(row.unit) ?? null : null;
              const createdItem = await tx.item.create({
                data: {
                  companyId: ctx.companyId,
                  name: row.itemName.trim(),
                  nameNormalized: normItem,
                  type: "PRODUCT",
                  unitId: uId,
                  salePrice: row.rate,
                  purchasePrice: row.rate,
                  taxRateId: trId,
                  createdById: ctx.user.id,
                },
                select: { id: true, name: true, nameNormalized: true, hsnSac: true, taxRateId: true, unitId: true },
              });
              itemMap.set(normItem, createdItem);
              itemId = createdItem.id;
              taxRateId = trId;
            }
          }

          const trRate = Number(row.taxRate);
          if (!taxRateId && rateMap.has(trRate)) {
            taxRateId = rateMap.get(trRate) ?? null;
          }

          lines.push({
            itemId,
            description: row.itemName ?? (txnType === "EXPENSE" ? "Expense" : "Item"),
            hsnSac,
            qty: row.qty || "1",
            rate: row.rate,
            rateIsTaxInclusive: false,
            discountValue: row.discount || "0",
            taxRateId,
            taxRateValue: row.taxRate || "0",
            cessRate: "0",
          });
        }

        const isIgst = Boolean(partyStateCode && firm.stateCode && partyStateCode !== firm.stateCode);

        const postingCtx: PostingContext = {
          companyId: ctx.companyId,
          firmId: firm.id,
          userId: ctx.user.id,
          fyStartMonth: company?.fyStartMonth ?? 4,
          stopSaleOnNegativeStock: false,
        };

        const postingInput: PostingInput = {
          type: txnType,
          date: parsedDate,
          partyId,
          expenseCategoryId,
          number: header.number ?? null,
          isIgst,
          lines,
          paidAmount: header.paidAmount || "0",
          paymentMode: (header.paymentMode as PaymentMode) ?? "CASH",
          notes: header.notes ?? "Imported from Excel",
        };

        try {
          await postTransaction(tx, postingCtx, postingInput);
          created += 1;
        } catch (e: any) {
          allIssues.push({
            row: startRow,
            field: "number",
            message: e.message || "Failed to post transaction",
          });
          skipped += 1;
        }
      }
    });

    revalidatePath("/sale/invoices");
    revalidatePath("/purchase/bills");
    revalidatePath("/expenses");
    revalidatePath("/dashboard");
    return { created, updated: 0, skipped, issues: allIssues };
  });
}

/** Preview validation without writing anything (step 4). */
export async function validateImportAction(
  raw: unknown,
): Promise<ActionResult<{ validCount: number; issues: RowIssue[] }>> {
  return runAction(commitSchema.omit({ updateExisting: true }), raw, async (input) => {
    await requirePermission("data.import");

    const { valid, issues } =
      input.kind === "parties"
        ? validateRows(partyRowSchema, input.rows, input.mapping)
        : input.kind === "items"
          ? validateRows(itemRowSchema, input.rows, input.mapping)
          : validateRows(transactionRowSchema, input.rows, input.mapping);

    return { validCount: valid.length, issues };
  });
}
