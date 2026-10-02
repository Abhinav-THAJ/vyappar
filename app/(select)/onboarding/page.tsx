import type { Metadata } from "next";
import { requireUser, listUserCompanies } from "@/lib/auth/session";
import { OnboardingWizard } from "./onboarding-wizard";

export const metadata: Metadata = { title: "Set up your business" };

export default async function OnboardingPage() {
  const user = await requireUser();
  const companies = await listUserCompanies(user.id);

  return <OnboardingWizard userName={user.name} canCancel={companies.length > 0} />;
}
