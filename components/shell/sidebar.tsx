"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ChevronDown, ChevronLeft, ChevronRight, Plus, Search, X } from "lucide-react";
import { cn, initials } from "@/lib/utils";
import { Logo } from "@/components/brand/logo";
import { NAV, REPORT_GROUPS, type NavGroup, type NavLeaf } from "./nav-config";
import type { Permission } from "@/lib/auth/permissions";

export interface SidebarProps {
  companyName: string;
  permissions: readonly Permission[];
  /** "More Transactions" toggles from Settings, which show and hide nav items. */
  featureFlags: Record<string, boolean>;
  /** Mobile drawer state, owned by the shell. */
  mobileOpen: boolean;
  onMobileOpenChange: (open: boolean) => void;
  onOpenCommandPalette: () => void;
}

export function Sidebar({
  companyName,
  permissions,
  featureFlags,
  mobileOpen,
  onMobileOpenChange,
  onOpenCommandPalette,
}: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = React.useState(false);
  const [reportsOpen, setReportsOpen] = React.useState(false);

  const allowed = React.useCallback(
    (p?: Permission) => !p || permissions.includes(p),
    [permissions],
  );

  const visibleGroups = React.useMemo(
    () =>
      NAV.filter((g) => allowed(g.permission)).map((g) => ({
        ...g,
        children: g.children?.filter(
          (c) =>
            allowed(c.permission) &&
            (!c.requiresSetting || featureFlags[c.requiresSetting] !== false),
        ),
      })),
    [allowed, featureFlags],
  );

  // A group starts expanded when the current route lives inside it.
  const activeGroupLabel = React.useMemo(() => {
    for (const group of visibleGroups) {
      if (group.children?.some((c) => isActive(pathname, c.href))) return group.label;
    }
    return null;
  }, [pathname, visibleGroups]);

  const [expanded, setExpanded] = React.useState<string | null>(activeGroupLabel);
  React.useEffect(() => setExpanded(activeGroupLabel), [activeGroupLabel]);

  // Close the mobile drawer and the reports flyout whenever the route changes.
  React.useEffect(() => {
    onMobileOpenChange(false);
    setReportsOpen(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  return (
    <>
      {/* Mobile scrim */}
      {mobileOpen ? (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => onMobileOpenChange(false)}
          aria-hidden
        />
      ) : null}

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex flex-col transition-[width,transform] duration-200",
          "bg-[var(--sidebar-bg)] text-[var(--sidebar-text)]",
          collapsed ? "w-[68px]" : "w-[264px]",
          mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0",
        )}
        aria-label="Main navigation"
      >
        {/* Brand + close (mobile) */}
        <div className="flex h-14 shrink-0 items-center justify-between px-3">
          <Link href="/dashboard" className="flex items-center gap-2 overflow-hidden">
            <Logo showName={!collapsed} tone="light" />
          </Link>
          <button
            type="button"
            onClick={() => onMobileOpenChange(false)}
            className="rounded-md p-1.5 hover:bg-[var(--sidebar-bg-hover)] lg:hidden"
            aria-label="Close navigation"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Command palette launcher — "Open Anything (Ctrl+F)" */}
        <div className="px-3 pb-2">
          <button
            type="button"
            onClick={onOpenCommandPalette}
            className={cn(
              "flex h-10 w-full items-center gap-2 rounded-lg bg-[var(--sidebar-bg-hover)] px-3 text-[13px] text-[var(--sidebar-muted)] transition-colors hover:bg-[var(--sidebar-bg-active)]",
              collapsed && "justify-center px-0",
            )}
          >
            <Search className="size-4 shrink-0" />
            {!collapsed ? <span className="truncate">Open Anything (Ctrl+F)</span> : null}
          </button>
        </div>

        {/* Nav tree */}
        <nav className="min-h-0 flex-1 overflow-y-auto px-2 pb-2">
          {visibleGroups.map((group) => (
            <NavGroupRow
              key={group.label}
              group={group}
              collapsed={collapsed}
              pathname={pathname}
              expanded={expanded === group.label}
              onToggle={() =>
                setExpanded((cur) => (cur === group.label ? null : group.label))
              }
              reportsOpen={reportsOpen}
              onToggleReports={() => setReportsOpen((v) => !v)}
            />
          ))}
        </nav>

        {/* Company switcher — opens the Company List (ref-12) */}
        <div className="shrink-0 border-t border-white/10 p-2">
          <button
            type="button"
            onClick={() => router.push("/companies")}
            className={cn(
              "flex w-full items-center gap-2.5 rounded-lg bg-[var(--sidebar-bg-hover)] px-2.5 py-2.5 text-left transition-colors hover:bg-[var(--sidebar-bg-active)]",
              collapsed && "justify-center px-0",
            )}
            title={collapsed ? companyName : undefined}
          >
            <span className="grid size-7 shrink-0 place-items-center rounded-md bg-accent-500 text-[11px] font-bold text-white">
              {initials(companyName)}
            </span>
            {!collapsed ? (
              <>
                <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-white">
                  {companyName}
                </span>
                <ChevronRight className="size-4 shrink-0 opacity-70" />
              </>
            ) : null}
          </button>
        </div>

        {/* Collapse handle */}
        <button
          type="button"
          onClick={() => setCollapsed((v) => !v)}
          className="absolute -right-3 top-16 hidden size-6 place-items-center rounded-full border border-[var(--border-subtle)] bg-[var(--surface)] text-[var(--text-secondary)] shadow-md transition-colors hover:text-[var(--text-primary)] lg:grid"
          aria-label={collapsed ? "Expand navigation" : "Collapse navigation"}
        >
          {collapsed ? <ChevronRight className="size-3.5" /> : <ChevronLeft className="size-3.5" />}
        </button>
      </aside>

      {/* Reports flyout, rendered over the content area (ref-08) */}
      {reportsOpen ? (
        <ReportsFlyout
          collapsed={collapsed}
          pathname={pathname}
          permissions={permissions}
          onClose={() => setReportsOpen(false)}
        />
      ) : null}
    </>
  );
}

function isActive(pathname: string, href: string): boolean {
  if (href === "/dashboard") return pathname === "/dashboard";
  return pathname === href || pathname.startsWith(`${href}/`);
}

function NavGroupRow({
  group,
  collapsed,
  pathname,
  expanded,
  onToggle,
  reportsOpen,
  onToggleReports,
}: {
  group: NavGroup;
  collapsed: boolean;
  pathname: string;
  expanded: boolean;
  onToggle: () => void;
  reportsOpen: boolean;
  onToggleReports: () => void;
}) {
  const Icon = group.icon;

  // A plain link: Home, Settings.
  if (group.href) {
    const active = isActive(pathname, group.href);
    return (
      <Link
        href={group.href}
        className={cn(rowClasses(active), collapsed && "justify-center px-0")}
        title={collapsed ? group.label : undefined}
      >
        <Icon className="size-[18px] shrink-0" />
        {!collapsed ? <span className="truncate">{group.label}</span> : null}
      </Link>
    );
  }

  // The reports flyout.
  if (group.flyout) {
    const active = pathname.startsWith("/reports");
    return (
      <button
        type="button"
        onClick={onToggleReports}
        className={cn(rowClasses(active || reportsOpen), "w-full", collapsed && "justify-center px-0")}
        title={collapsed ? group.label : undefined}
        aria-expanded={reportsOpen}
      >
        <Icon className="size-[18px] shrink-0" />
        {!collapsed ? (
          <>
            <span className="flex-1 truncate text-left">{group.label}</span>
            <ChevronRight className={cn("size-4 transition-transform", reportsOpen && "rotate-90")} />
          </>
        ) : null}
      </button>
    );
  }

  const children = group.children ?? [];
  if (children.length === 0) return null;
  const groupActive = children.some((c) => isActive(pathname, c.href));

  return (
    <div>
      <button
        type="button"
        onClick={onToggle}
        className={cn(rowClasses(groupActive && !expanded), "w-full", collapsed && "justify-center px-0")}
        title={collapsed ? group.label : undefined}
        aria-expanded={expanded}
      >
        <Icon className="size-[18px] shrink-0" />
        {!collapsed ? (
          <>
            <span className="flex-1 truncate text-left">{group.label}</span>
            <ChevronDown className={cn("size-4 transition-transform", expanded && "rotate-180")} />
          </>
        ) : null}
      </button>

      {expanded && !collapsed ? (
        <div className="mb-1 mt-0.5">
          {children.map((leaf) => (
            <NavLeafRow key={leaf.href + leaf.label} leaf={leaf} pathname={pathname} />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function NavLeafRow({ leaf, pathname }: { leaf: NavLeaf; pathname: string }) {
  const active = isActive(pathname, leaf.href);
  return (
    <div
      className={cn(
        "group/leaf relative flex items-center rounded-lg transition-colors",
        active ? "bg-[var(--sidebar-bg-active)]" : "hover:bg-[var(--sidebar-bg-hover)]",
      )}
    >
      {active ? (
        <span className="absolute inset-y-1 left-0 w-[3px] rounded-r bg-accent-400" aria-hidden />
      ) : null}
      <Link
        href={leaf.href}
        className={cn(
          "min-w-0 flex-1 truncate py-2 pl-7 pr-2 text-[13px]",
          active ? "font-medium text-white" : "text-[var(--sidebar-text)]",
        )}
      >
        {leaf.label}
        {leaf.badge === "new" ? (
          <span className="ml-2 rounded bg-accent-500 px-1.5 py-0.5 text-[9px] font-bold uppercase text-white">
            New
          </span>
        ) : null}
      </Link>
      {leaf.quickAdd ? (
        <Link
          href={leaf.quickAdd}
          className="mr-1.5 hidden rounded p-1 text-[var(--sidebar-muted)] transition-colors hover:bg-white/10 hover:text-white group-hover/leaf:block"
          aria-label={`Add ${leaf.label}`}
        >
          <Plus className="size-4" />
        </Link>
      ) : null}
    </div>
  );
}

function rowClasses(active: boolean) {
  return cn(
    "flex items-center gap-2.5 rounded-lg px-2.5 py-2.5 text-[13.5px] font-medium transition-colors",
    active
      ? "bg-[var(--sidebar-bg-active)] text-white"
      : "text-[var(--sidebar-text)] hover:bg-[var(--sidebar-bg-hover)] hover:text-white",
  );
}

function ReportsFlyout({
  collapsed,
  pathname,
  permissions,
  onClose,
}: {
  collapsed: boolean;
  pathname: string;
  permissions: readonly Permission[];
  onClose: () => void;
}) {
  return (
    <>
      <div className="fixed inset-0 z-30" onClick={onClose} aria-hidden />
      <div
        className={cn(
          "fixed inset-y-0 z-40 flex w-[268px] flex-col border-r border-[var(--border-subtle)] bg-[var(--surface)] shadow-xl",
          collapsed ? "left-[68px]" : "left-[264px]",
        )}
        role="menu"
        aria-label="Reports"
      >
        <div className="flex h-14 shrink-0 items-center justify-between border-b border-[var(--border-subtle)] px-4">
          <span className="text-sm font-semibold">Reports</span>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-[var(--text-muted)] hover:bg-[var(--surface-3)]"
            aria-label="Close reports menu"
          >
            <ChevronLeft className="size-4" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto py-2">
          {REPORT_GROUPS.map((group) => {
            const items = group.items.filter(
              (i) => !i.permission || permissions.includes(i.permission),
            );
            if (items.length === 0) return null;

            return (
              <div key={group.label} className="mb-1">
                <div className="bg-[var(--surface-2)] px-4 py-2 text-[12px] font-medium text-[var(--text-muted)]">
                  {group.label}
                </div>
                {items.map((item) => {
                  const active = pathname === item.href;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={cn(
                        "block px-4 py-2.5 text-[13px] transition-colors",
                        active
                          ? "bg-brand-50 font-medium text-brand-700 dark:bg-brand-950 dark:text-brand-200"
                          : "hover:bg-[var(--surface-3)]",
                      )}
                    >
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}
