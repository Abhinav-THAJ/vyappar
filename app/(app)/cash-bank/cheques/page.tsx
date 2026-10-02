import type { Metadata } from "next";
import { requireCompany } from "@/lib/auth/session";
import { can } from "@/lib/auth/permissions";
import { listCheques } from "@/server/services/cashbank";
import { ChequesScreen } from "./cheques-screen";

export const metadata: Metadata = { title: "Cheques" };

export default async function ChequesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const ctx = await requireCompany();
  const { status } = await searchParams;

  const cheques = await listCheques(ctx.companyId, status);

  return (
    <ChequesScreen
      cheques={cheques}
      status={status ?? "all"}
      canWrite={can(ctx.role, "cashbank.write")}
    />
  );
}
