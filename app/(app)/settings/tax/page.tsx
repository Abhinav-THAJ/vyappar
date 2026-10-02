import type { Metadata } from "next";
import { loadSettings } from "../settings-data";
import { TaxSettingsScreen } from "../tabs-screens";

export const metadata: Metadata = { title: "Taxes & GST" };

export default async function Page() {
  const { settings, canWrite } = await loadSettings();
  return <TaxSettingsScreen initial={settings.tax} canWrite={canWrite} />;
}
