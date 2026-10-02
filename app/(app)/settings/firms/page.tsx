import type { Metadata } from "next";
import { requireCompany } from "@/lib/auth/session";
import { can } from "@/lib/auth/permissions";
import { FirmsScreen } from "./firms-screen";

export const metadata: Metadata = { title: "Firms" };

export default async function FirmsPage() {
  const ctx = await requireCompany();

  const firms = await ctx.db.firm.findMany({
    where: { isActive: true },
    orderBy: [{ isDefault: "desc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      gstin: true,
      stateCode: true,
      addressLine1: true,
      addressLine2: true,
      city: true,
      pincode: true,
      phone: true,
      email: true,
      bankName: true,
      bankAccountNo: true,
      bankIfsc: true,
      upiId: true,
      termsAndConditions: true,
      isDefault: true,
    },
  });

  return (
    <FirmsScreen
      firms={firms}
      canWrite={can(ctx.role, "firm.manage")}
      isMultiFirm={ctx.isMultiFirm}
    />
  );
}
