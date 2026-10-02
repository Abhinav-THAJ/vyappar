import type { Metadata } from "next";
import { currentFinancialYear } from "@/lib/fy";
import { loadSettings } from "../settings-data";
import { TransactionSettingsScreen } from "../tabs-screens";
import { NumberSequences } from "./number-sequences";

export const metadata: Metadata = { title: "Transaction Settings" };

export default async function TransactionSettingsPage() {
  const { ctx, settings, canWrite } = await loadSettings();
  const fy = currentFinancialYear(ctx.fyStartMonth);

  const [firms, sequences] = await Promise.all([
    ctx.db.firm.findMany({
      where: { isActive: true },
      orderBy: [{ isDefault: "desc" }, { name: "asc" }],
      select: { id: true, name: true },
    }),
    ctx.db.numberSequence.findMany({
      where: { financialYear: fy },
      orderBy: { type: "asc" },
      select: {
        id: true,
        firmId: true,
        type: true,
        financialYear: true,
        prefix: true,
        nextNumber: true,
        resetYearly: true,
        firm: { select: { name: true } },
      },
    }),
  ]);

  return (
    <TransactionSettingsScreen
      initial={settings.transaction}
      canWrite={canWrite}
      sequences={
        <NumberSequences
          firms={firms}
          canWrite={canWrite}
          sequences={sequences.map((s) => ({
            id: s.id,
            firmId: s.firmId,
            firmName: s.firm.name,
            type: s.type,
            financialYear: s.financialYear,
            prefix: s.prefix,
            nextNumber: s.nextNumber,
            resetYearly: s.resetYearly,
          }))}
        />
      }
    />
  );
}
