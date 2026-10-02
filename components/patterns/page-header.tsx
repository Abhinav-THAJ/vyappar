"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ChevronDown, Settings2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/menu";
import { cn } from "@/lib/utils";

export interface SiblingScreen {
  label: string;
  href: string;
}

/**
 * The page header from the reference list screens: a title that is itself a
 * dropdown onto sibling screens, then right-aligned actions and a settings gear.
 */
export function PageHeader({
  title,
  siblings,
  actions,
  settingsHref,
  description,
  className,
}: {
  title: string;
  siblings?: SiblingScreen[];
  actions?: React.ReactNode;
  settingsHref?: string;
  description?: string;
  className?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const others = (siblings ?? []).filter((s) => s.href !== pathname);

  return (
    <div
      className={cn(
        "flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border-subtle)] bg-[var(--surface)] px-4 py-3 sm:px-6",
        className,
      )}
    >
      <div className="min-w-0">
        {others.length > 0 ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="group flex items-center gap-1.5 rounded-md text-xl font-semibold tracking-tight"
              >
                <span className="truncate">{title}</span>
                <ChevronDown className="size-5 shrink-0 text-[var(--text-muted)] transition-transform group-data-[state=open]:rotate-180" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-60">
              {others.map((s) => (
                <DropdownMenuItem key={s.href} onSelect={() => router.push(s.href)}>
                  {s.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <h1 className="truncate text-xl font-semibold tracking-tight">{title}</h1>
        )}

        {description ? (
          <p className="mt-0.5 text-[13px] text-[var(--text-muted)]">{description}</p>
        ) : null}
      </div>

      <div className="flex shrink-0 items-center gap-2">
        {actions}
        {settingsHref ? (
          <Link
            href={settingsHref}
            className="grid size-9 place-items-center rounded-lg text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-3)]"
            aria-label="Settings for this screen"
          >
            <Settings2 className="size-[18px]" />
          </Link>
        ) : null}
      </div>
    </div>
  );
}

/** Sibling groups, so each list screen offers the same jump menu as the reference. */
export const SALE_SIBLINGS: SiblingScreen[] = [
  { label: "Sale Invoices", href: "/sale/invoices" },
  { label: "Estimate/ Quotation", href: "/sale/estimates" },
  { label: "Proforma Invoice", href: "/sale/proforma" },
  { label: "Payment-In", href: "/sale/payments-in" },
  { label: "Sale Order", href: "/sale/orders" },
  { label: "Delivery Challan", href: "/sale/challans" },
  { label: "Sale Return/ Credit Note", href: "/sale/credit-notes" },
];

export const PURCHASE_SIBLINGS: SiblingScreen[] = [
  { label: "Purchase Bills", href: "/purchase/bills" },
  { label: "Payment-Out", href: "/purchase/payments-out" },
  { label: "Expenses", href: "/expenses" },
  { label: "Purchase Order", href: "/purchase/orders" },
  { label: "Purchase Return/ Dr. Note", href: "/purchase/debit-notes" },
];

export const PARTY_SIBLINGS: SiblingScreen[] = [
  { label: "Parties", href: "/parties" },
  { label: "Party Groups", href: "/parties/groups" },
];
