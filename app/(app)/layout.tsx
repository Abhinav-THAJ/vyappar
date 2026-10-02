import { requireCompany } from "@/lib/auth/session";
import { permissionsFor } from "@/lib/auth/permissions";
import { parseSettings, navFeatureFlags } from "@/lib/validators/settings";
import { AppShell } from "@/components/shell/app-shell";
import { signOutAction } from "@/server/actions/session";
import type { SystemBannerProps } from "@/components/shell/system-banner";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const ctx = await requireCompany();

  const [settingsRow, firmCount] = await Promise.all([
    ctx.db.settings.findFirst({
      where: { companyId: ctx.companyId },
      select: {
        general: true,
        transaction: true,
        print: true,
        tax: true,
        party: true,
        item: true,
        message: true,
      },
    }),
    ctx.db.firm.count({ where: { isActive: true } }),
  ]);

  const settings = parseSettings(settingsRow);

  const banners: SystemBannerProps[] = [];

  // A company with no firm cannot issue an invoice, so say so rather than
  // failing later inside the transaction form.
  if (firmCount === 0) {
    banners.push({
      id: "no-firm",
      tone: "warning",
      message: "This company has no firm yet. Add one before creating invoices.",
      action: { label: "Set up firm", href: "/settings/firms" },
      dismissible: false,
    });
  }

  return (
    <AppShell
      user={{ name: ctx.user.name, email: ctx.user.email }}
      companyName={ctx.companyName}
      permissions={permissionsFor(ctx.role)}
      featureFlags={navFeatureFlags(settings)}
      banners={banners}
      signOutAction={signOutAction}
    >
      {children}
    </AppShell>
  );
}
