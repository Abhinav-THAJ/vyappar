"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  HelpCircle,
  LogOut,
  Menu,
  MoreVertical,
  Plus,
  Printer,
  Search,
  Settings,
  Upload,
  User as UserIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/menu";
import { QUICK_ADD_ITEMS } from "./nav-config";
import type { Permission } from "@/lib/auth/permissions";
import { initials } from "@/lib/utils";

export function TopBar({
  user,
  permissions,
  onOpenMobileNav,
  onOpenCommandPalette,
  onSignOut,
}: {
  user: { name: string; email: string };
  permissions: readonly Permission[];
  onOpenMobileNav: () => void;
  onOpenCommandPalette: () => void;
  onSignOut: () => void;
}) {
  const router = useRouter();
  const allowed = (p?: Permission) => !p || permissions.includes(p);
  const quickAdds = QUICK_ADD_ITEMS.filter((i) => allowed(i.permission));

  return (
    <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-2 border-b border-[var(--border-subtle)] bg-[var(--surface)] px-3 sm:px-4">
      <button
        type="button"
        onClick={onOpenMobileNav}
        className="rounded-md p-2 text-[var(--text-secondary)] hover:bg-[var(--surface-3)] lg:hidden"
        aria-label="Open navigation"
      >
        <Menu className="size-5" />
      </button>

      {/* Search Transactions */}
      <button
        type="button"
        onClick={onOpenCommandPalette}
        className="flex h-9 min-w-0 flex-1 items-center gap-2 rounded-lg px-3 text-left text-[13px] text-[var(--text-muted)] transition-colors hover:bg-[var(--surface-3)] sm:max-w-md"
      >
        <Search className="size-4 shrink-0" />
        <span className="truncate">Search Transactions</span>
      </button>

      <div className="flex-1" />

      <div className="flex items-center gap-2">
        {allowed("sale.write") ? (
          <Button asChild variant="primary" size="sm" className="hidden sm:inline-flex">
            <Link href="/sale/invoices/new">
              <Plus className="size-4" />
              Add Sale
            </Link>
          </Button>
        ) : null}

        {allowed("purchase.write") ? (
          <Button asChild variant="secondary" size="sm" className="hidden md:inline-flex">
            <Link href="/purchase/bills/new">
              <Plus className="size-4" />
              Add Purchase
            </Link>
          </Button>
        ) : null}

        {/* The circular "+" holding every remaining record type */}
        {quickAdds.length > 0 ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="grid size-9 place-items-center rounded-full bg-brand-50 text-brand-700 transition-colors hover:bg-brand-100 dark:bg-brand-950 dark:text-brand-200"
                aria-label="Add other record"
              >
                <Plus className="size-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>Add new</DropdownMenuLabel>
              {quickAdds.map((item) => {
                const Icon = item.icon;
                return (
                  <DropdownMenuItem key={item.label} onSelect={() => router.push(item.href)}>
                    <Icon />
                    {item.label}
                  </DropdownMenuItem>
                );
              })}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}

        <button
          type="button"
          onClick={() => window.print()}
          className="hidden size-9 place-items-center rounded-lg text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-3)] sm:grid"
          aria-label="Print this page"
        >
          <Printer className="size-[18px]" />
        </button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="grid size-9 place-items-center rounded-lg text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-3)]"
              aria-label="More options"
            >
              <MoreVertical className="size-[18px]" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>{user.name}</DropdownMenuLabel>
            <div className="px-2.5 pb-1.5 text-[12px] text-[var(--text-muted)]">{user.email}</div>
            <DropdownMenuSeparator />
            {allowed("data.import") ? (
              <DropdownMenuItem onSelect={() => router.push("/utilities/import-items")}>
                <Upload />
                Import data
              </DropdownMenuItem>
            ) : null}
            <DropdownMenuItem onSelect={() => router.push("/settings")}>
              <Settings />
              Settings
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => router.push("/companies")}>
              <UserIcon />
              Switch company
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => router.push("/help")}>
              <HelpCircle />
              Help &amp; shortcuts
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem destructive onSelect={onSignOut}>
              <LogOut />
              Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <span
          className="hidden size-8 place-items-center rounded-full bg-brand-600 text-[11px] font-bold text-white sm:grid"
          title={user.name}
          aria-hidden
        >
          {initials(user.name)}
        </span>
      </div>
    </header>
  );
}
