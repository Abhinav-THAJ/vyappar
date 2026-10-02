import type { Metadata } from "next";
import { requirePermission } from "@/lib/auth/session";
import { parseSettings } from "@/lib/validators/settings";
import { PartyForm } from "../party-form";

export const metadata: Metadata = { title: "Add Party" };

export default async function NewPartyPage() {
  const ctx = await requirePermission("party.write");

  const [groups, settingsRow] = await Promise.all([
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

  const settings = parseSettings(settingsRow);

  return (
    <PartyForm
      groups={groups}
      enableCreditLimit={settings.party.enableCreditLimit}
      enableShippingAddress={settings.party.enableShippingAddress}
      enableGroups={settings.party.enablePartyGroups}
    />
  );
}
