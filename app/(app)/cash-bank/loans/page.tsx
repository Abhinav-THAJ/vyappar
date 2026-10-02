import type { Metadata } from "next";
import { requireCompany } from "@/lib/auth/session";
import { can } from "@/lib/auth/permissions";
import { listLoanAccounts } from "@/server/services/cashbank";
import { LoansScreen } from "./loans-screen";

export const metadata: Metadata = { title: "Loan Accounts" };

export default async function LoansPage() {
  const ctx = await requireCompany();
  const loans = await listLoanAccounts(ctx.companyId);

  return <LoansScreen loans={loans} canWrite={can(ctx.role, "cashbank.write")} />;
}
