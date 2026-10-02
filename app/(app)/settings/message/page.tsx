import type { Metadata } from "next";
import { loadSettings } from "../settings-data";
import { MessageSettingsScreen } from "../tabs-screens";

export const metadata: Metadata = { title: "Transaction Message" };

export default async function Page() {
  const { settings, canWrite } = await loadSettings();
  return <MessageSettingsScreen initial={settings.message} canWrite={canWrite} />;
}
