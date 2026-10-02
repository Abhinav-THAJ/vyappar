import { redirect } from "next/navigation";

/** Export lives on the Backup & Export screen; keep the sidebar link working. */
export default function ExportItemsPage() {
  redirect("/utilities/backup");
}
