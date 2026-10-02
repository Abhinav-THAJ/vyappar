import type { Metadata } from "next";
import { requirePermission } from "@/lib/auth/session";
import { ITEM_IMPORT } from "@/server/services/import";
import { ImportWizard } from "@/components/import/import-wizard";

export const metadata: Metadata = { title: "Import Items" };

export default async function ImportItemsPage() {
  await requirePermission("data.import");
  return <ImportWizard kind="items" title="Items" fields={ITEM_IMPORT.fields} />;
}
