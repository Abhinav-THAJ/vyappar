import type { Metadata } from "next";
import { requirePermission } from "@/lib/auth/session";
import { PARTY_IMPORT } from "@/server/services/import";
import { ImportWizard } from "@/components/import/import-wizard";

export const metadata: Metadata = { title: "Import Parties" };

export default async function ImportPartiesPage() {
  await requirePermission("data.import");
  return <ImportWizard kind="parties" title="Parties" fields={PARTY_IMPORT.fields} />;
}
