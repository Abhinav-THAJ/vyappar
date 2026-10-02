import type { Metadata } from "next";
import { can } from "@/lib/auth/permissions";
import { prisma } from "@/lib/db/prisma";
import { loadSettings } from "./settings-data";
import { GeneralSettingsScreen } from "./general-screen";

export const metadata: Metadata = { title: "Settings" };

export default async function GeneralSettingsPage() {
  const { ctx, settings, canWrite } = await loadSettings();

  const [company, firms] = await Promise.all([
    prisma.company.findUnique({
      where: { id: ctx.companyId },
      select: { name: true, fyStartMonth: true, isGstEnabled: true, isMultiFirm: true },
    }),
    ctx.db.firm.findMany({
      where: { isActive: true },
      orderBy: [{ isDefault: "desc" }, { name: "asc" }],
      select: { id: true, name: true, isDefault: true, gstin: true },
    }),
  ]);

  return (
    <GeneralSettingsScreen
      initial={settings.general}
      company={
        company ?? {
          name: ctx.companyName,
          fyStartMonth: ctx.fyStartMonth,
          isGstEnabled: ctx.isGstEnabled,
          isMultiFirm: ctx.isMultiFirm,
        }
      }
      firms={firms}
      lastBackupAt={null}
      canWrite={canWrite}
      canManageCompany={can(ctx.role, "company.manage")}
    />
  );
}
