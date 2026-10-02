"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { StockReason } from "@prisma/client";
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
  type ImportKind,
  type RowIssue,
} from "@/server/services/import";
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
  kind: z.enum(["parties", "items"]),
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

    // --- items --------------------------------------------------------------
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
        : validateRows(itemRowSchema, input.rows, input.mapping);

    return { validCount: valid.length, issues };
  });
}
