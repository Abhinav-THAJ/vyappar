import type { Metadata } from "next";
import { requireCompany } from "@/lib/auth/session";
import { can } from "@/lib/auth/permissions";
import { GroupsScreen } from "./groups-screen";

export const metadata: Metadata = { title: "Party Groups" };

export default async function PartyGroupsPage() {
  const ctx = await requireCompany();

  const groups = await ctx.db.partyGroup.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true, _count: { select: { parties: true } } },
  });

  return (
    <GroupsScreen
      groups={groups.map((g) => ({
        id: g.id,
        name: g.name,
        partyCount: g._count.parties,
      }))}
      canWrite={can(ctx.role, "party.write")}
    />
  );
}
