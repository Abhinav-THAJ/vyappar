import type { Metadata } from "next";
import { loadSettings } from "../settings-data";
import { ItemSettingsScreen } from "../tabs-screens";

export const metadata: Metadata = { title: "Item Settings" };

export default async function Page() {
  const { settings, canWrite } = await loadSettings();
  return <ItemSettingsScreen initial={settings.item} canWrite={canWrite} />;
}
