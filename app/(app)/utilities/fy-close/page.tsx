import type { Metadata } from "next";
import { requireCompany } from "@/lib/auth/session";
import { can } from "@/lib/auth/permissions";
import { currentFinancialYear, recentFinancialYears } from "@/lib/fy";
import { FyCloseScreen } from "./fy-close-screen";

export const metadata: Metadata = { title: "Close Financial Year" };

export default async function FyClosePage() {
  const ctx = await requireCompany();

  return (
    <FyCloseScreen
      years={recentFinancialYears(5, ctx.fyStartMonth)}
      currentYear={currentFinancialYear(ctx.fyStartMonth)}
      canClose={can(ctx.role, "settings.write")}
    />
  );
}
