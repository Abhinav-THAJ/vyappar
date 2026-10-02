import type { Metadata } from "next";
import { requireCompany } from "@/lib/auth/session";
import { can } from "@/lib/auth/permissions";
import { listParties, getParty } from "@/server/services/parties";
import { partyTransactions } from "@/server/services/transactions";
import { PartiesScreen } from "./parties-screen";

export const metadata: Metadata = { title: "Parties" };

export default async function PartiesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const ctx = await requireCompany();
  const params = await searchParams;
  const selectedId = typeof params.id === "string" ? params.id : undefined;

  const parties = await listParties(ctx.companyId);

  // Auto-select the first row, exactly as the reference does.
  const activeId = selectedId ?? parties[0]?.id;

  const [detail, transactions] = activeId
    ? await Promise.all([
        getParty(ctx.companyId, activeId),
        partyTransactions(ctx.companyId, activeId),
      ])
    : [null, []];

  return (
    <PartiesScreen
      parties={parties}
      detail={detail}
      transactions={transactions}
      canWrite={can(ctx.role, "party.write")}
      openNew={params.new === "1"}
    />
  );
}
