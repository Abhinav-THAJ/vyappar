"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Building2,
  LogOut,
  MoreVertical,
  Plus,
  RotateCw,
  Search,
  Upload,
  Users,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/display";
import { EmptyState } from "@/components/ui/empty-state";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/menu";
import { LogoMark, APP_NAME } from "@/components/brand/logo";
import { formatActivity } from "@/lib/format/date";
import { ROLE_LABELS } from "@/lib/auth/permissions";
import { switchCompanyAction, signOutAction } from "@/server/actions/session";
import { deleteCompanyAction } from "@/server/actions/company";

import { cn, initials } from "@/lib/utils";
import type { Role } from "@prisma/client";

export interface CompanyRow {
  id: string;
  name: string;
  isOwner: boolean;
  role: Role;
  lastActivityAt: string | null;
  createdAt: string;
  firmCount: number;
}

/**
 * The company picker shown after login (ref-12).
 *
 * Deviations from the reference, all deliberate (D-21): no `.vyp` file browser
 * and no SYNC ON/OFF indicator, because a web company is server-side and always
 * current. Search, both tabs, the activity line, Restore backup, New Company
 * and Log out all survive.
 */
export function CompanyList({
  user,
  companies,
}: {
  user: { name: string; email: string };
  companies: CompanyRow[];
}) {
  const router = useRouter();
  const [query, setQuery] = React.useState("");
  const [opening, setOpening] = React.useState<string | null>(null);

  const mine = companies.filter((c) => c.isOwner);
  const shared = companies.filter((c) => !c.isOwner);

  const filter = React.useCallback(
    (rows: CompanyRow[]) => {
      const q = query.trim().toLowerCase();
      if (!q) return rows;
      return rows.filter((c) => c.name.toLowerCase().includes(q));
    },
    [query],
  );

  async function open(companyId: string) {
    setOpening(companyId);
    const result = await switchCompanyAction({ companyId });

    if (!result.ok) {
      setOpening(null);
      toast.error(result.error);
      router.refresh();
      return;
    }

    router.push("/dashboard");
    router.refresh();
  }

  async function openAndManageAccess(companyId: string) {
    setOpening(companyId);
    const result = await switchCompanyAction({ companyId });

    if (!result.ok) {
      setOpening(null);
      toast.error(result.error);
      router.refresh();
      return;
    }

    router.push("/settings/users");
    router.refresh();
  }

  return (
    <div className="relative min-h-dvh overflow-hidden bg-[var(--surface-2)]">
      {/* Tiled watermark, drawn from our own mark */}
      <div className="pointer-events-none absolute inset-0 opacity-[0.04]" aria-hidden>
        <div className="grid h-full grid-cols-[repeat(auto-fill,minmax(90px,1fr))] content-start gap-6 p-6">
          {Array.from({ length: 200 }).map((_, i) => (
            <LogoMark key={i} className="size-9" />
          ))}
        </div>
      </div>

      <div className="relative mx-auto flex min-h-dvh max-w-4xl flex-col justify-center px-4 py-10">
        <div className="surface-card overflow-hidden shadow-xl">
          {/* Dark header */}
          <div className="bg-[var(--sidebar-bg)] px-6 pt-5 text-white">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <h1 className="text-xl font-semibold tracking-tight">Company List</h1>
              <div className="relative w-full sm:w-72">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-white/50" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search Company"
                  aria-label="Search Company"
                  className="h-10 w-full rounded-full bg-white/10 pl-9 pr-3 text-[13px] text-white outline-none placeholder:text-white/50 focus:bg-white/15"
                />
              </div>
            </div>

            <Tabs defaultValue="mine" className="mt-4">
              <TabsList className="w-full justify-start border-0 bg-transparent">
                <TabsTrigger
                  value="shared"
                  className="max-w-max flex-none px-0 pr-8 text-white/60 data-[state=active]:text-white data-[state=active]:after:bg-white"
                >
                  Companies Shared with Me
                </TabsTrigger>
                <TabsTrigger
                  value="mine"
                  className="max-w-max flex-none px-0 text-white/60 data-[state=active]:text-white data-[state=active]:after:bg-white"
                >
                  My Companies
                </TabsTrigger>
              </TabsList>

              <TabsContent value="mine" className="bg-[var(--surface)] text-[var(--text-primary)]">
                <CompanyPane
                  caption="Below are the companies created by you"
                  rows={filter(mine)}
                  query={query}
                  opening={opening}
                  onOpen={open}
                  onManageAccess={openAndManageAccess}
                  onRefresh={() => router.refresh()}
                  emptyTitle="No companies yet"
                  emptyDescription="Create your first company to start invoicing."
                  onCreate={() => router.push("/onboarding")}
                />
              </TabsContent>

              <TabsContent value="shared" className="bg-[var(--surface)] text-[var(--text-primary)]">
                <CompanyPane
                  caption="Companies other people have shared with you"
                  rows={filter(shared)}
                  query={query}
                  opening={opening}
                  onOpen={open}
                  onManageAccess={openAndManageAccess}
                  onRefresh={() => router.refresh()}
                  emptyTitle="Nothing shared with you yet"
                  emptyDescription="When someone invites you to their company, it appears here."
                />
              </TabsContent>
            </Tabs>
          </div>

          {/* Footer */}
          <div className="flex flex-wrap items-center justify-between gap-4 border-t border-[var(--border-subtle)] bg-[var(--surface)] px-6 py-4">
            <div className="min-w-0">
              <div className="text-[12px] text-[var(--text-muted)]">Currently logged in as</div>
              <div className="truncate text-[15px] font-semibold">{user.email}</div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button variant="outline" onClick={() => router.push("/utilities/backup")}>
                <Upload className="size-4" />
                Restore backup
              </Button>
              <Button onClick={() => router.push("/onboarding")}>
                <Plus className="size-4" />
                New Company
              </Button>
            </div>
          </div>
        </div>

        <div className="mt-5 text-right">
          <button
            type="button"
            onClick={() => void signOutAction()}
            className="inline-flex items-center gap-1.5 text-[13px] font-medium text-brand-600 hover:underline"
          >
            <LogOut className="size-4" />
            Log out
          </button>
          <p className="mt-0.5 text-[12px] text-[var(--text-muted)]">
            You will need to log in again to reach your companies.
          </p>
        </div>

        <p className="mt-6 text-center text-[12px] text-[var(--text-muted)]">{APP_NAME}</p>
      </div>
    </div>
  );
}

function CompanyPane({
  caption,
  rows,
  query,
  opening,
  onOpen,
  onManageAccess,
  onRefresh,
  emptyTitle,
  emptyDescription,
  onCreate,
}: {
  caption: string;
  rows: CompanyRow[];
  query: string;
  opening: string | null;
  onOpen: (id: string) => void;
  onManageAccess: (id: string) => void;
  onRefresh: () => void;
  emptyTitle: string;
  emptyDescription: string;
  onCreate?: () => void;
}) {
  return (
    <div className="px-6 py-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <p className="text-[13px] text-[var(--text-secondary)]">{caption}</p>
        <button
          type="button"
          onClick={onRefresh}
          className="grid size-9 shrink-0 place-items-center rounded-full bg-brand-50 text-brand-600 transition-colors hover:bg-brand-100 dark:bg-brand-950 dark:text-brand-300"
          aria-label="Refresh list"
        >
          <RotateCw className="size-4" />
        </button>
      </div>

      {rows.length === 0 ? (
        <EmptyState
          compact
          tone={query ? "search" : "empty"}
          title={query ? "No company matches that" : emptyTitle}
          description={query ? undefined : emptyDescription}
          action={
            !query && onCreate ? (
              <Button onClick={onCreate}>
                <Plus className="size-4" />
                New Company
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="max-h-[46vh] space-y-2.5 overflow-y-auto pr-1">
          {rows.map((company) => (
            <CompanyCard
              key={company.id}
              company={company}
              opening={opening === company.id}
              disabled={opening !== null && opening !== company.id}
              onOpen={() => onOpen(company.id)}
              onManageAccess={() => onManageAccess(company.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function CompanyCard({
  company,
  opening,
  disabled,
  onOpen,
  onManageAccess,
}: {
  company: CompanyRow;
  opening: boolean;
  disabled: boolean;
  onOpen: () => void;
  onManageAccess: () => void;
}) {
  const activity = company.lastActivityAt
    ? `Last activity: ${formatActivity(company.lastActivityAt)}`
    : `Created ${formatActivity(company.createdAt)}`;

  const [deleting, setDeleting] = React.useState(false);

  async function handleDelete() {
    if (!window.confirm(`Are you sure you want to delete ${company.name}? This action cannot be undone.`)) {
      return;
    }
    setDeleting(true);
    const result = await deleteCompanyAction(company.id);
    if (!result.ok) {
      toast.error(result.error);
      setDeleting(false);
    } else {
      toast.success("Company deleted");
    }
  }

  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-3 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface)] p-4 transition-colors",
        !disabled && !deleting && "hover:border-[var(--border-strong)]",
        deleting && "opacity-50 pointer-events-none"
      )}
    >
      <span
        className="grid size-10 shrink-0 place-items-center rounded-lg bg-brand-600 text-[13px] font-bold text-white"
        aria-hidden
      >
        {initials(company.name)}
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="truncate text-[15px] font-semibold">{company.name}</span>
          {!company.isOwner ? (
            <Badge variant="brand">{ROLE_LABELS[company.role]}</Badge>
          ) : null}
          {company.firmCount > 1 ? (
            <Badge variant="neutral">
              <Building2 className="size-3" />
              {company.firmCount} firms
            </Badge>
          ) : null}
        </div>
        <div className="mt-0.5 truncate text-[12px] text-[var(--text-muted)]">{activity}</div>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <Button variant="outline" onClick={onOpen} loading={opening} disabled={disabled || deleting}>
          {opening ? "Opening…" : "Open"}
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="grid size-9 place-items-center rounded-lg text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-3)]"
              aria-label={`More options for ${company.name}`}
              disabled={deleting}
            >
              <MoreVertical className="size-[18px]" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem onSelect={onOpen}>Open</DropdownMenuItem>
            <DropdownMenuItem disabled={!company.isOwner} onSelect={onManageAccess}>
              <Users />
              Manage access
            </DropdownMenuItem>
            <DropdownMenuItem disabled>Download backup</DropdownMenuItem>
            {company.isOwner ? (
              <DropdownMenuItem onSelect={handleDelete} className="text-[var(--color-negative)]">
                <Trash2 className="text-[var(--color-negative)]" />
                Delete company
              </DropdownMenuItem>
            ) : null}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
