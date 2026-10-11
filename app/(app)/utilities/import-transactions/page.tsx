import type { Metadata } from "next";
import { requirePermission } from "@/lib/auth/session";
import { TRANSACTION_IMPORT } from "@/server/services/import";
import { ImportWizard } from "@/components/import/import-wizard";

export const metadata: Metadata = { title: "Import Transactions & Invoices" };

export default async function ImportTransactionsPage() {
  await requirePermission("data.import");
  return (
    <ImportWizard
      kind="transactions"
      title="Past Transactions & Invoices"
      fields={TRANSACTION_IMPORT.fields}
    />
  );
}
