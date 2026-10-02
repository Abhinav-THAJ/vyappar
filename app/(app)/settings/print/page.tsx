import type { Metadata } from "next";
import { loadSettings } from "../settings-data";
import { PrintSettingsScreen } from "../tabs-screens";

export const metadata: Metadata = { title: "Print Settings" };

export default async function Page() {
  const { settings, canWrite } = await loadSettings();
  return <PrintSettingsScreen initial={settings.print} canWrite={canWrite} />;
}
