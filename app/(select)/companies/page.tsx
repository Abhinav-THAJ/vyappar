import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireUser, listUserCompanies } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { CompanyList } from "./company-list";

export const metadata: Metadata = { title: "Company List" };

export default async function CompaniesPage() {
  const user = await requireUser();
  const companies = await listUserCompanies(user.id);

  // Nothing to pick from yet: send them straight into the wizard.
  if (companies.length === 0) redirect("/onboarding");

  // Firm counts drive the "N firms" sub-line on a multi-firm company.
  const firmCounts = await prisma.firm.groupBy({
    by: ["companyId"],
    where: { companyId: { in: companies.map((c) => c.id) }, deletedAt: null, isActive: true },
    _count: { _all: true },
  });

  const firmCountMap = new Map(firmCounts.map((f) => [f.companyId, f._count._all]));

  return (
    <CompanyList
      user={{ name: user.name, email: user.email }}
      companies={companies.map((c) => ({
        id: c.id,
        name: c.name,
        isOwner: c.isOwner,
        role: c.role,
        lastActivityAt: c.lastActivityAt?.toISOString() ?? null,
        createdAt: c.createdAt.toISOString(),
        firmCount: firmCountMap.get(c.id) ?? 0,
      }))}
    />
  );
}
