import type { Prisma, TransactionType } from "@prisma/client";
import { DEFAULT_PREFIXES } from "@/server/services/provisioning";

export interface AllocatedNumber {
  number: string;
  prefix: string;
  financialYear: string;
}

/**
 * Allocate the next document number for a firm, type and financial year.
 *
 * Keyed on **firm**, not company: two firms in one company each run their own
 * series, because each issues invoices under its own GSTIN (D-20).
 *
 * The row is locked FOR UPDATE inside the caller's transaction, so two
 * concurrent saves cannot take the same number. The unique constraint on
 * (firmId, type, financialYear, number) is the backstop.
 */
export async function allocateNumber(
  tx: Prisma.TransactionClient,
  params: {
    companyId: string;
    firmId: string;
    type: TransactionType;
    financialYear: string;
  },
): Promise<AllocatedNumber> {
  const { companyId, firmId, type, financialYear } = params;

  // Lock the sequence row for the life of this transaction.
  const locked = await tx.$queryRaw<{ id: string; prefix: string; nextNumber: number }[]>`
    SELECT id, prefix, "nextNumber"
      FROM "NumberSequence"
     WHERE "firmId" = ${firmId}
       AND "type" = ${type}::"TransactionType"
       AND "financialYear" = ${financialYear}
     FOR UPDATE
  `;

  const row = locked[0];

  if (!row) {
    // First document of this type in a new financial year.
    const prefix = DEFAULT_PREFIXES[type] ?? "";
    const created = await tx.numberSequence.create({
      data: {
        companyId,
        firmId,
        type,
        financialYear,
        prefix,
        nextNumber: 2,
        resetYearly: true,
      },
      select: { prefix: true },
    });
    return { number: "1", prefix: created.prefix, financialYear };
  }

  await tx.numberSequence.update({
    where: { id: row.id },
    data: { nextNumber: row.nextNumber + 1 },
  });

  return { number: String(row.nextNumber), prefix: row.prefix, financialYear };
}

/**
 * Check a user-typed number is free before saving.
 * Returns the conflicting transaction id, or null when the number is available.
 */
export async function findNumberConflict(
  tx: Prisma.TransactionClient,
  params: {
    firmId: string;
    type: TransactionType;
    financialYear: string;
    number: string;
    excludeTransactionId?: string | null;
  },
): Promise<string | null> {
  const existing = await tx.transaction.findFirst({
    where: {
      firmId: params.firmId,
      type: params.type,
      financialYear: params.financialYear,
      number: params.number,
      deletedAt: null,
      ...(params.excludeTransactionId ? { id: { not: params.excludeTransactionId } } : {}),
    },
    select: { id: true },
  });

  return existing?.id ?? null;
}

/**
 * Keep the sequence ahead of a manually entered number, so the next
 * auto-allocated document does not immediately collide with it.
 */
export async function advanceSequencePast(
  tx: Prisma.TransactionClient,
  params: {
    firmId: string;
    type: TransactionType;
    financialYear: string;
    number: string;
  },
): Promise<void> {
  const numeric = Number.parseInt(params.number, 10);
  if (!Number.isFinite(numeric)) return; // a non-numeric number does not move the series

  await tx.numberSequence.updateMany({
    where: {
      firmId: params.firmId,
      type: params.type,
      financialYear: params.financialYear,
      nextNumber: { lte: numeric },
    },
    data: { nextNumber: numeric + 1 },
  });
}

/** The number as it is displayed and printed. */
export function formatDocumentNumber(prefix: string, number: string): string {
  return `${prefix}${number}`;
}
