import { requireCompany } from "@/lib/auth/session";
import { PageHeader } from "@/components/patterns/page-header";
import { SettingsNav } from "./settings-nav";

export default async function SettingsLayout({ children }: { children: React.ReactNode }) {
  await requireCompany();

  return (
    <div className="flex min-h-full flex-col">
      <PageHeader title="Settings" description="Applies to this company" />

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <div className="shrink-0 bg-[var(--surface)] lg:w-56">
          <SettingsNav />
        </div>
        <div className="min-w-0 flex-1 p-4 sm:p-6">{children}</div>
      </div>
    </div>
  );
}
