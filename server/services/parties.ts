import type { PartyType } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { partyBalances } from "./balances";

export interface PartyListRow {
  id: string;
  name: string;
  type: PartyType;
  phone: string | null;
  gstin: string | null;
  groupName: string | null;
  /** Positive: they owe us. Negative: we owe them. */
  balance: string;
}

/** The party master list (ref-02), with ledger-derived balances. */
export async function listParties(
  companyId: string,
  options: { q?: string; type?: PartyType | null; groupId?: string | null } = {},
): Promise<PartyListRow[]> {
  const parties = await prisma.party.findMany({
    where: {
      companyId,
      deletedAt: null,
      ...(options.type ? { OR: [{ type: options.type }, { type: "BOTH" }] } : {}),
      ...(options.groupId ? { partyGroupId: options.groupId } : {}),
      ...(options.q
        ? {
            OR: [
              { name: { contains: options.q, mode: "insensitive" as const } },
              { phone: { contains: options.q } },
              { gstin: { contains: options.q, mode: "insensitive" as const } },
            ],
          }
        : {}),
    },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      type: true,
      phone: true,
      gstin: true,
      partyGroup: { select: { name: true } },
    },
  });

  const balances = await partyBalances(
    companyId,
    parties.map((p) => p.id),
  );

  return parties.map((p) => ({
    id: p.id,
    name: p.name,
    type: p.type,
    phone: p.phone,
    gstin: p.gstin,
    groupName: p.partyGroup?.name ?? null,
    balance: (balances.get(p.id) ?? null)?.toFixed(2) ?? "0.00",
  }));
}

/** Full detail for the right-hand pane. */
export async function getParty(companyId: string, partyId: string) {
  const party = await prisma.party.findFirst({
    where: { id: partyId, companyId, deletedAt: null },
    select: {
      id: true,
      name: true,
      type: true,
      gstType: true,
      gstin: true,
      stateCode: true,
      phone: true,
      email: true,
      billingAddress: true,
      shippingAddress: true,
      creditLimit: true,
      paymentTermDays: true,
      openingBalance: true,
      openingBalanceType: true,
      openingAsOf: true,
      partyGroupId: true,
      partyGroup: { select: { name: true } },
    },
  });

  if (!party) return null;

  const balances = await partyBalances(companyId, [partyId]);

  return {
    ...party,
    creditLimit: party.creditLimit?.toFixed(2) ?? null,
    openingBalance: party.openingBalance.toFixed(2),
    openingAsOf: party.openingAsOf?.toISOString() ?? null,
    balance: balances.get(partyId)?.toFixed(2) ?? "0.00",
  };
}

export type PartyDetail = NonNullable<Awaited<ReturnType<typeof getParty>>>;
