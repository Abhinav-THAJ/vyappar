"use client";

import * as React from "react";
import { Sidebar } from "./sidebar";
import { TopBar } from "./top-bar";
import { CommandPalette } from "./command-palette";
import { SystemBanner, type SystemBannerProps } from "./system-banner";
import { TooltipProvider } from "@/components/ui/display";
import type { Permission } from "@/lib/auth/permissions";

export interface AppShellProps {
  user: { name: string; email: string };
  companyName: string;
  permissions: readonly Permission[];
  featureFlags: Record<string, boolean>;
  banners?: SystemBannerProps[];
  signOutAction: () => Promise<void>;
  children: React.ReactNode;
}

export function AppShell({
  user,
  companyName,
  permissions,
  featureFlags,
  banners = [],
  signOutAction,
  children,
}: AppShellProps) {
  const [mobileNavOpen, setMobileNavOpen] = React.useState(false);
  const [paletteOpen, setPaletteOpen] = React.useState(false);

  return (
    <TooltipProvider delayDuration={300}>
      <div className="min-h-dvh">
        <Sidebar
          companyName={companyName}
          permissions={permissions}
          featureFlags={featureFlags}
          mobileOpen={mobileNavOpen}
          onMobileOpenChange={setMobileNavOpen}
          onOpenCommandPalette={() => setPaletteOpen(true)}
        />

        <div className="flex min-h-dvh flex-col lg:pl-[264px]">
          <TopBar
            user={user}
            permissions={permissions}
            onOpenMobileNav={() => setMobileNavOpen(true)}
            onOpenCommandPalette={() => setPaletteOpen(true)}
            onSignOut={() => void signOutAction()}
          />

          {banners.length > 0 ? (
            <div className="no-print shrink-0 space-y-px">
              {banners.map((banner) => (
                <SystemBanner key={banner.id} {...banner} />
              ))}
            </div>
          ) : null}

          <main className="min-h-0 flex-1">{children}</main>
        </div>

        <CommandPalette
          open={paletteOpen}
          onOpenChange={setPaletteOpen}
          permissions={permissions}
          featureFlags={featureFlags}
        />
      </div>
    </TooltipProvider>
  );
}
