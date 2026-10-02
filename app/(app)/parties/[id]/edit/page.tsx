import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requirePermission } from "@/lib/auth/session";
import { parseSettings } from "@/lib/validators/settings";
import { getParty } from "@/server/services/parties";
import { toDateInputValue } from "@/lib/format/date";
import { PartyForm } from "../../party-form";

export const metadata: Metadata = { title: "Edit Party" };

export default async function EditPartyPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ctx = await requirePermission("party.write");

  const [party, groups, settingsRow] = await Promise.all([
    getParty(ctx.companyId, id),
    ctx.db.partyGroup.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    ctx.db.settings.findFirst({
      where: { companyId: ctx.companyId },
      select: {
        general: true,
        transaction: true,
        print: true,
        tax: true,
        party: true,
        item: true,
        message: true,
      },
    }),
  ]);

  if (!party) notFound();

  const settings = parseSettings(settingsRow);

  return (
    <PartyForm
      groups={groups}
      enableCreditLimit={settings.party.enableCreditLimit}
      enableShippingAddress={settings.party.enableShippingAddress}
      enableGroups={settings.party.enablePartyGroups}
      defaults={{
        id: party.id,
        name: party.name,
        type: party.type,
        gstType: party.gstType,
        gstin: party.gstin ?? undefined,
        stateCode: party.stateCode ?? undefined,
        phone: party.phone ?? undefined,
        email: party.email ?? undefined,
        billingAddress: party.billingAddress ?? undefined,
        shippingAddress: party.shippingAddress ?? undefined,
        partyGroupId: party.partyGroupId ?? undefined,
        openingBalance: party.openingBalance,
        openingBalanceType: party.openingBalanceType,
        openingAsOf: party.openingAsOf ? toDateInputValue(party.openingAsOf) : undefined,
        creditLimit: party.creditLimit ?? undefined,
        paymentTermDays: party.paymentTermDays ?? undefined,
      }}
    />
  );
}
