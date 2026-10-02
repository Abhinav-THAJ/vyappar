"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import { requirePermission } from "@/lib/auth/session";
import { partySchema, partyGroupSchema, deletePartySchema } from "@/lib/validators/party";
import { normalizeName } from "@/lib/utils";
import { parseDateInput } from "@/lib/format/date";
import { stateCodeFromGstin } from "@/lib/gst";
import { writeAudit } from "@/server/services/audit";
import { runAction, BusinessError, type ActionResult } from "@/server/guards/action";

/** Create or update a party. */
export async function savePartyAction(raw: unknown): Promise<ActionResult<{ id: string }>> {
  return runAction(partySchema, raw, async (input) => {
    const ctx = await requirePermission("party.write");
    const nameNormalized = normalizeName(input.name);

    // The GSTIN is authoritative for the state when one is present.
    const stateCode = stateCodeFromGstin(input.gstin) ?? input.stateCode ?? null;

    const data = {
      name: input.name,
      nameNormalized,
      type: input.type,
      gstType: input.gstType,
      gstin: input.gstin ?? null,
      stateCode,
      phone: input.phone ?? null,
      email: input.email ?? null,
      billingAddress: input.billingAddress ?? null,
      shippingAddress: input.shippingAddress ?? null,
      partyGroupId: input.partyGroupId ?? null,
      openingBalance: input.openingBalance,
      openingBalanceType: input.openingBalanceType,
      openingAsOf: input.openingAsOf ? parseDateInput(input.openingAsOf) : null,
      creditLimit: input.creditLimit ?? null,
      paymentTermDays: input.paymentTermDays ?? null,
      customFields: input.customFields,
    };

    const duplicate = await ctx.db.party.findFirst({
      where: { nameNormalized, ...(input.id ? { id: { not: input.id } } : {}) },
      select: { id: true },
    });
    if (duplicate) {
      throw new BusinessError("A party with that name already exists", {
        name: ["A party with that name already exists"],
      });
    }

    let id: string;

    if (input.id) {
      const existing = await ctx.db.party.findFirst({
        where: { id: input.id },
        select: { id: true, name: true },
      });
      if (!existing) throw new BusinessError("That party no longer exists");

      await ctx.db.party.update({ where: { id: existing.id }, data });
      id = existing.id;
      await writeAudit(ctx, { entity: "Party", entityId: id, action: "UPDATE", after: data });
    } else {
      const created = await ctx.db.party.create({
        // companyId is also injected by the tenancy extension; passing it here
        // satisfies Prisma's types, and the extension overwrites it regardless.
        data: { ...data, companyId: ctx.companyId, createdById: ctx.user.id },
        select: { id: true },
      });
      id = created.id;
      await writeAudit(ctx, { entity: "Party", entityId: id, action: "CREATE", after: data });
    }

    revalidatePath("/parties");
    return { id };
  });
}

/** Soft-delete a party, unless it has transactions. */
export async function deletePartyAction(raw: unknown): Promise<ActionResult<{ id: string }>> {
  return runAction(deletePartySchema, raw, async ({ id }) => {
    const ctx = await requirePermission("party.write");

    const txnCount = await ctx.db.transaction.count({ where: { partyId: id } });
    if (txnCount > 0) {
      throw new BusinessError(
        `This party has ${txnCount} transaction${txnCount === 1 ? "" : "s"} and cannot be deleted. ` +
          `Delete or reassign them first.`,
      );
    }

    const party = await ctx.db.party.findFirst({ where: { id }, select: { id: true } });
    if (!party) throw new BusinessError("That party no longer exists");

    await ctx.db.party.update({ where: { id }, data: { deletedAt: new Date() } });
    await writeAudit(ctx, { entity: "Party", entityId: id, action: "DELETE" });

    revalidatePath("/parties");
    return { id };
  });
}

/** Create or rename a party group. */
export async function savePartyGroupAction(raw: unknown): Promise<ActionResult<{ id: string }>> {
  return runAction(partyGroupSchema, raw, async (input) => {
    const ctx = await requirePermission("party.write");

    const id = input.id
      ? (await ctx.db.partyGroup.update({ where: { id: input.id }, data: { name: input.name } })).id
      : (await ctx.db.partyGroup.create({ data: { companyId: ctx.companyId, name: input.name }, select: { id: true } })).id;

    revalidatePath("/parties/groups");
    return { id };
  });
}

export async function deletePartyGroupAction(raw: unknown): Promise<ActionResult<{ id: string }>> {
  return runAction(deletePartySchema, raw, async ({ id }) => {
    const ctx = await requirePermission("party.write");
    // Parties keep existing; they simply lose the group (onDelete: SetNull).
    await ctx.db.partyGroup.update({ where: { id }, data: { deletedAt: new Date() } });
    revalidatePath("/parties/groups");
    return { id };
  });
}

/** Party picker search, used by the transaction forms. */
export async function searchPartiesAction(
  query: string,
  type?: "CUSTOMER" | "SUPPLIER",
): Promise<{ id: string; name: string; phone: string | null; gstin: string | null; stateCode: string | null; balance: string }[]> {
  const ctx = await requirePermission("party.read");

  const parties = await ctx.db.party.findMany({
    where: {
      ...(type ? { OR: [{ type }, { type: "BOTH" }] } : {}),
      ...(query
        ? {
            OR: [
              { name: { contains: query, mode: "insensitive" as const } },
              { phone: { contains: query } },
            ],
          }
        : {}),
    },
    orderBy: { name: "asc" },
    take: 25,
    select: { id: true, name: true, phone: true, gstin: true, stateCode: true },
  });

  if (parties.length === 0) return [];

  const balances = await prisma.ledgerEntry.groupBy({
    by: ["partyId"],
    where: { companyId: ctx.companyId, accountType: "PARTY", partyId: { in: parties.map((p) => p.id) } },
    _sum: { debit: true, credit: true },
  });

  const balanceMap = new Map(
    balances.map((b) => [
      b.partyId,
      Number(b._sum.debit ?? 0) - Number(b._sum.credit ?? 0),
    ]),
  );

  return parties.map((p) => ({
    ...p,
    balance: (balanceMap.get(p.id) ?? 0).toFixed(2),
  }));
}

/**
 * Create a party inline from a transaction form, with only the fields the
 * picker collects. Everything else takes its default.
 */
export async function quickCreatePartyAction(
  raw: unknown,
): Promise<ActionResult<{ id: string; name: string }>> {
  const schema = partySchema;
  return runAction(schema, raw, async (input) => {
    const ctx = await requirePermission("party.write");
    const nameNormalized = normalizeName(input.name);

    const duplicate = await ctx.db.party.findFirst({
      where: { nameNormalized },
      select: { id: true, name: true },
    });
    if (duplicate) return duplicate;

    const created = await ctx.db.party.create({
      data: {
        companyId: ctx.companyId,
        name: input.name,
        nameNormalized,
        type: input.type,
        gstType: input.gstType,
        gstin: input.gstin ?? null,
        stateCode: stateCodeFromGstin(input.gstin) ?? input.stateCode ?? null,
        phone: input.phone ?? null,
        email: input.email ?? null,
        billingAddress: input.billingAddress ?? null,
        openingBalance: "0",
        createdById: ctx.user.id,
      },
      select: { id: true, name: true },
    });

    revalidatePath("/parties");
    return created;
  });
}
