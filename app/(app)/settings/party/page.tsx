import type { Metadata } from "next";
import { loadSettings } from "../settings-data";
import { PartySettingsScreen } from "../tabs-screens";

export const metadata: Metadata = { title: "Party Settings" };

export default async function Page() {
  const { settings, canWrite } = await loadSettings();
  return <PartySettingsScreen initial={settings.party} canWrite={canWrite} />;
}
