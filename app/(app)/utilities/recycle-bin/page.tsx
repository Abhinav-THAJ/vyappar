import type { Metadata } from "next";
import { requireCompany } from "@/lib/auth/session";
import { can } from "@/lib/auth/permissions";
import { listRecycleBin } from "@/server/actions/utilities";
import { RecycleScreen } from "./recycle-screen";

export const metadata: Metadata = { title: "Recycle Bin" };

export default async function RecycleBinPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const ctx = await requireCompany();
  const { page } = await searchParams;

  const { rows } = await listRecycleBin(
    ctx.companyId,
    Math.max(1, Number.parseInt(page ?? "1", 10) || 1),
  );

  return <RecycleScreen rows={rows} canRestore={can(ctx.role, "transaction.delete")} />;
}
