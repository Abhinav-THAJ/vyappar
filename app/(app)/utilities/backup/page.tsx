import type { Metadata } from "next";
import { Database, Download, FileSpreadsheet, Upload } from "lucide-react";
import { requireCompany } from "@/lib/auth/session";
import { can } from "@/lib/auth/permissions";
import { PageHeader } from "@/components/patterns/page-header";
import { Button } from "@/components/ui/button";
import { utilitiesOverview } from "@/server/actions/utilities";
import { formatNumber } from "@/lib/format/number";

export const metadata: Metadata = { title: "Backup & Export" };

export default async function BackupPage() {
  const ctx = await requireCompany();
  const counts = await utilitiesOverview();
  const canExport = can(ctx.role, "data.export");

  return (
    <div className="flex min-h-full flex-col">
      <PageHeader
        title="Backup & Export"
        description="Take a copy of everything in this company, or export a master list."
      />

      <div className="mx-auto w-full max-w-3xl space-y-4 p-4 sm:p-6">
        <div className="grid gap-3 sm:grid-cols-4">
          <Stat label="Parties" value={counts.parties} />
          <Stat label="Items" value={counts.items} />
          <Stat label="Transactions" value={counts.transactions} />
          <Stat label="In recycle bin" value={counts.deleted} />
        </div>

        <Card
          icon={<Database className="size-5" />}
          title="Full backup"
          description="Everything in this company as one JSON file: firms, masters, every document, and the ledger behind them."
          action={
            canExport ? (
              <Button asChild>
                <a href="/api/export/backup" download>
                  <Download className="size-4" />
                  Download backup
                </a>
              </Button>
            ) : null
          }
        />

        <Card
          icon={<FileSpreadsheet className="size-5" />}
          title="Export masters to Excel"
          description="Your item and party lists, ready to open in a spreadsheet."
          action={
            canExport ? (
              <div className="flex flex-wrap gap-2">
                <Button asChild variant="outline">
                  <a href="/api/export/items?what=items" download>
                    <Download className="size-4" />
                    Items
                  </a>
                </Button>
                <Button asChild variant="outline">
                  <a href="/api/export/items?what=parties" download>
                    <Download className="size-4" />
                    Parties
                  </a>
                </Button>
              </div>
            ) : null
          }
        />

        <Card
          icon={<Upload className="size-5" />}
          title="Restore"
          description="Restoring from a backup replaces this company's data. To avoid overwriting anything by accident, restore into a new company rather than an existing one."
          action={
            <Button variant="outline" disabled>
              Restore from backup
            </Button>
          }
          note="Restore is not enabled yet — take backups now so they are there when it is."
        />
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="surface-card p-4">
      <div className="text-[12px] text-[var(--text-muted)]">{label}</div>
      <div className="tnum mt-0.5 text-[17px] font-semibold">
        {formatNumber(value, { decimals: 0 })}
      </div>
    </div>
  );
}

function Card({
  icon,
  title,
  description,
  action,
  note,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  action: React.ReactNode;
  note?: string;
}) {
  return (
    <div className="surface-card p-5">
      <div className="flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-brand-50 text-brand-700 dark:bg-brand-950 dark:text-brand-300">
          {icon}
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-[15px] font-semibold">{title}</h2>
          <p className="mt-1 text-[13px] leading-relaxed text-[var(--text-secondary)]">
            {description}
          </p>
          {note ? (
            <p className="mt-2 text-[12px] text-[var(--text-muted)]">{note}</p>
          ) : null}
          {action ? <div className="mt-4">{action}</div> : null}
        </div>
      </div>
    </div>
  );
}
