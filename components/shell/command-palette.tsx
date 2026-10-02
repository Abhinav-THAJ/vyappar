"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Command } from "cmdk";
import { ArrowRight, Search } from "lucide-react";
import { Dialog, DialogPortal, DialogOverlay } from "@/components/ui/dialog";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { NAV, ALL_REPORTS, QUICK_ADD_ITEMS } from "./nav-config";
import type { Permission } from "@/lib/auth/permissions";
import { cn } from "@/lib/utils";

interface PaletteEntry {
  id: string;
  label: string;
  group: string;
  href: string;
  keywords?: string;
}

/**
 * "Open Anything (Ctrl+F)". Navigates the whole application by name; a future
 * phase extends it to search live transactions and parties.
 */
export function CommandPalette({
  open,
  onOpenChange,
  permissions,
  featureFlags,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  permissions: readonly Permission[];
  featureFlags: Record<string, boolean>;
}) {
  const router = useRouter();
  const allowed = React.useCallback(
    (p?: Permission) => !p || permissions.includes(p),
    [permissions],
  );

  const entries = React.useMemo<PaletteEntry[]>(() => {
    const out: PaletteEntry[] = [];

    for (const group of NAV) {
      if (!allowed(group.permission)) continue;

      if (group.href) {
        out.push({ id: group.href, label: group.label, group: "Navigate", href: group.href });
        continue;
      }

      for (const leaf of group.children ?? []) {
        if (!allowed(leaf.permission)) continue;
        if (leaf.requiresSetting && featureFlags[leaf.requiresSetting] === false) continue;
        out.push({
          id: `${group.label}-${leaf.href}`,
          label: leaf.label,
          group: group.label,
          href: leaf.href,
        });
      }
    }

    for (const report of ALL_REPORTS) {
      if (!allowed(report.permission)) continue;
      out.push({
        id: `report-${report.href}`,
        label: report.label,
        group: "Reports",
        href: report.href,
        keywords: "report",
      });
    }

    for (const item of QUICK_ADD_ITEMS) {
      if (!allowed(item.permission)) continue;
      out.push({
        id: `new-${item.href}`,
        label: `New ${item.label}`,
        group: "Create",
        href: item.href,
        keywords: "add create new",
      });
    }

    return out;
  }, [allowed, featureFlags]);

  const grouped = React.useMemo(() => {
    const map = new Map<string, PaletteEntry[]>();
    for (const entry of entries) {
      const list = map.get(entry.group) ?? [];
      list.push(entry);
      map.set(entry.group, list);
    }
    return [...map.entries()];
  }, [entries]);

  // Ctrl+F / Cmd+K opens the palette from anywhere.
  React.useEffect(() => {
    function onKey(event: KeyboardEvent) {
      const isPaletteKey =
        (event.key === "f" && (event.ctrlKey || event.metaKey)) ||
        (event.key === "k" && (event.ctrlKey || event.metaKey));
      if (isPaletteKey) {
        event.preventDefault();
        onOpenChange(true);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onOpenChange]);

  function go(href: string) {
    onOpenChange(false);
    router.push(href);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPortal>
        <DialogOverlay />
        <DialogPrimitive.Content
          className="fixed left-1/2 top-[12vh] z-50 w-[calc(100vw-2rem)] max-w-xl -translate-x-1/2 overflow-hidden rounded-xl border border-[var(--border-subtle)] bg-[var(--surface)] shadow-2xl"
          aria-label="Command palette"
        >
          <DialogPrimitive.Title className="sr-only">Open anything</DialogPrimitive.Title>
          <Command label="Open anything" loop>
            <div className="flex items-center gap-2.5 border-b border-[var(--border-subtle)] px-4">
              <Search className="size-4 shrink-0 text-[var(--text-muted)]" />
              <Command.Input
                autoFocus
                placeholder="Search screens, reports and actions…"
                className="h-12 flex-1 bg-transparent text-sm outline-none placeholder:text-[var(--text-muted)]"
              />
              <kbd className="hidden rounded border border-[var(--border-strong)] px-1.5 py-0.5 text-[10px] text-[var(--text-muted)] sm:block">
                Esc
              </kbd>
            </div>

            <Command.List className="max-h-[52vh] overflow-y-auto p-2">
              <Command.Empty className="py-10 text-center text-[13px] text-[var(--text-muted)]">
                Nothing matches that.
              </Command.Empty>

              {grouped.map(([groupName, items]) => (
                <Command.Group
                  key={groupName}
                  heading={groupName}
                  className="mb-1 [&_[cmdk-group-heading]]:px-2.5 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wide [&_[cmdk-group-heading]]:text-[var(--text-muted)]"
                >
                  {items.map((entry) => (
                    <Command.Item
                      key={entry.id}
                      value={`${entry.label} ${entry.group} ${entry.keywords ?? ""}`}
                      onSelect={() => go(entry.href)}
                      className={cn(
                        "flex cursor-pointer items-center gap-2.5 rounded-md px-2.5 py-2 text-[13px]",
                        "data-[selected=true]:bg-[var(--surface-3)]",
                      )}
                    >
                      <ArrowRight className="size-3.5 text-[var(--text-muted)]" />
                      <span className="flex-1 truncate">{entry.label}</span>
                      <span className="text-[11px] text-[var(--text-muted)]">{entry.group}</span>
                    </Command.Item>
                  ))}
                </Command.Group>
              ))}
            </Command.List>
          </Command>
        </DialogPrimitive.Content>
      </DialogPortal>
    </Dialog>
  );
}
