"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

/** The left tab rail of the Settings overlay (ref-11). */
export const SETTINGS_NAV = [
  { label: "General", href: "/settings" },
  { label: "Transaction", href: "/settings/transaction" },
  { label: "Print", href: "/settings/print" },
  { label: "Taxes & GST", href: "/settings/tax" },
  { label: "Transaction Message", href: "/settings/message" },
  { label: "Party", href: "/settings/party" },
  { label: "Item", href: "/settings/item" },
  { label: "Firms", href: "/settings/firms" },
  { label: "Users & Roles", href: "/settings/users" },
];

export function SettingsNav() {
  const pathname = usePathname();

  return (
    <nav
      className="flex gap-1 overflow-x-auto border-b border-[var(--border-subtle)] px-2 py-2 lg:flex-col lg:border-b-0 lg:border-r lg:px-3 lg:py-4"
      aria-label="Settings sections"
    >
      {SETTINGS_NAV.map((item) => {
        const active =
          item.href === "/settings" ? pathname === "/settings" : pathname.startsWith(item.href);

        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "whitespace-nowrap rounded-lg px-3.5 py-2.5 text-[13px] font-medium uppercase tracking-wide transition-colors lg:normal-case lg:tracking-normal",
              active
                ? "bg-brand-50 text-brand-700 dark:bg-brand-950 dark:text-brand-200"
                : "text-[var(--text-secondary)] hover:bg-[var(--surface-3)]",
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
