import type { Metadata } from "next";
import { requireCompany } from "@/lib/auth/session";
import { can } from "@/lib/auth/permissions";
import { listBankAccounts } from "@/server/services/cashbank";
import { BanksScreen } from "./banks-screen";

export const metadata: Metadata = { title: "Bank Accounts" };

export default async function BanksPage() {
  const ctx = await requireCompany();
  const accounts = await listBankAccounts(ctx.companyId);

  return <BanksScreen accounts={accounts} canWrite={can(ctx.role, "cashbank.write")} />;
}
