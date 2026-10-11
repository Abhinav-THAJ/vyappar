import type { Metadata } from "next";
import Link from "next/link";
import {
  Download,
  FileSpreadsheet,
  Users,
  Package,
  Receipt,
  ArrowRight,
  Sparkles,
  CheckCircle2,
  ShieldCheck,
  RefreshCw,
} from "lucide-react";
import { requirePermission } from "@/lib/auth/session";
import { PageHeader } from "@/components/patterns/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/display";

export const metadata: Metadata = {
  title: "Migrate From Old Software | Bella Books",
};

export default async function MigrationHubPage() {
  await requirePermission("data.import");

  const steps = [
    {
      num: 1,
      badge: "Essential · Step 1",
      badgeVariant: "brand" as const,
      icon: Users,
      title: "Customers & Suppliers (Parties)",
      description:
        "Import your customer and vendor directory along with their current unpaid or to-receive balances.",
      highlights: [
        "Customer & Vendor contact info (Phone, Email)",
        "GSTIN and State Code auto-detection",
        "Opening Balances (To Receive / To Pay)",
      ],
      templateHref: "/api/import/template?kind=parties",
      importHref: "/utilities/import-parties",
      actionText: "Import Parties",
    },
    {
      num: 2,
      badge: "Essential · Step 2",
      badgeVariant: "brand" as const,
      icon: Package,
      title: "Products & Opening Stock (Items)",
      description:
        "Import inventory items, HSN/SAC codes, tax rates, sales & purchase prices, and physical opening stock.",
      highlights: [
        "Product & Service items with SKU / Barcode",
        "Sale & Purchase pricing with GST slab (0%, 5%, 12%, 18%, 28%)",
        "Opening Stock quantity automatically posted to inventory",
      ],
      templateHref: "/api/import/template?kind=items",
      importHref: "/utilities/import-items",
      actionText: "Import Items",
    },
    {
      num: 3,
      badge: "Optional History · Step 3",
      badgeVariant: "neutral" as const,
      icon: Receipt,
      title: "Past Invoices & Bills (Transactions)",
      description:
        "Bring over your historical Sales, Purchases, and Expenses. Supports multi-line bills grouped by invoice number.",
      highlights: [
        "Historical Sales Invoices & Purchase Bills",
        "Direct & Indirect Expense vouchers",
        "Automatically links or creates missing Parties & Items",
      ],
      templateHref: "/api/import/template?kind=transactions",
      importHref: "/utilities/import-transactions",
      actionText: "Import Transactions",
    },
  ];

  return (
    <div className="flex min-h-full flex-col">
      <PageHeader
        title="Migrate From Old Software"
        description="Transition your business data from Tally, Vyapar, Marg, Zoho Books, Busy, or Excel sheets."
        actions={
          <a href="/api/import/template?kind=all" download>
            <Button variant="primary">
              <Download className="size-4" />
              Download All-In-One Migration Template (.xlsx)
            </Button>
          </a>
        }
      />

      <div className="mx-auto w-full max-w-5xl space-y-8 p-4 sm:p-6">
        {/* Banner */}
        <div className="relative overflow-hidden rounded-2xl border border-[var(--border)] bg-gradient-to-r from-brand-500/10 via-brand-500/5 to-transparent p-6 sm:p-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Badge variant="brand">
                  <Sparkles className="mr-1 size-3" />
                  Smart Excel Migration
                </Badge>
                <span className="text-xs text-[var(--text-muted)]">
                  Works with any spreadsheet export
                </span>
              </div>
              <h2 className="text-xl font-bold tracking-tight text-[var(--text)] sm:text-2xl">
                Ready to bring all your data into Bella Books?
              </h2>
              <p className="max-w-2xl text-sm text-[var(--text-muted)]">
                You can download our pre-formatted Excel template with sample data, or simply upload your existing spreadsheet export. Our intelligent wizard automatically detects column headers regardless of formatting!
              </p>
            </div>
            <div className="shrink-0">
              <a href="/api/import/template?kind=all" download>
                <Button variant="outline" className="border-brand-500/30 text-brand-600 hover:bg-brand-50 dark:text-brand-400 dark:hover:bg-brand-950/50">
                  <FileSpreadsheet className="size-4" />
                  Master Excel Template (.xlsx)
                </Button>
              </a>
            </div>
          </div>
        </div>

        {/* 3 Steps Cards */}
        <div className="space-y-4">
          <h3 className="text-base font-semibold text-[var(--text)]">
            Step-by-step Migration Path
          </h3>
          <div className="grid gap-6 md:grid-cols-3">
            {steps.map((s) => {
              const Icon = s.icon;
              return (
                <div
                  key={s.num}
                  className="surface-card flex flex-col justify-between rounded-xl border border-[var(--border)] p-5 transition hover:shadow-md"
                >
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex size-10 items-center justify-center rounded-lg bg-brand-50 text-brand-600 dark:bg-brand-950/60 dark:text-brand-400">
                        <Icon className="size-5" />
                      </div>
                      <Badge variant={s.badgeVariant}>{s.badge}</Badge>
                    </div>

                    <div>
                      <h4 className="font-semibold text-[var(--text)]">{s.title}</h4>
                      <p className="mt-1 text-xs leading-relaxed text-[var(--text-muted)]">
                        {s.description}
                      </p>
                    </div>

                    <ul className="space-y-2 border-t border-[var(--border)] pt-3 text-xs text-[var(--text-muted)]">
                      {s.highlights.map((h, i) => (
                        <li key={i} className="flex items-start gap-2">
                          <CheckCircle2 className="size-3.5 shrink-0 text-emerald-500 mt-0.5" />
                          <span>{h}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="mt-6 space-y-2 border-t border-[var(--border)] pt-4">
                    <Link href={s.importHref} className="block w-full">
                      <Button variant="primary" className="w-full">
                        {s.actionText}
                        <ArrowRight className="size-3.5" />
                      </Button>
                    </Link>
                    <a href={s.templateHref} download className="block w-full">
                      <Button variant="ghost" className="w-full text-xs">
                        <Download className="size-3.5" />
                        Download Template Sheet
                      </Button>
                    </a>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Guarantee and Tips Section */}
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="surface-card rounded-xl border border-[var(--border)] p-4">
            <div className="flex items-center gap-3">
              <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50">
                <ShieldCheck className="size-4" />
              </div>
              <h5 className="text-sm font-semibold text-[var(--text)]">Atomic Safety</h5>
            </div>
            <p className="mt-2 text-xs leading-relaxed text-[var(--text-muted)]">
              Every import is validated first and committed in a single database transaction. If anything fails, nothing is half-written.
            </p>
          </div>

          <div className="surface-card rounded-xl border border-[var(--border)] p-4">
            <div className="flex items-center gap-3">
              <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-950/50">
                <RefreshCw className="size-4" />
              </div>
              <h5 className="text-sm font-semibold text-[var(--text)]">Smart Header Mapping</h5>
            </div>
            <p className="mt-2 text-xs leading-relaxed text-[var(--text-muted)]">
              Exports from Tally, Vyapar, Marg, Zoho, or Busy map themselves automatically. You can also map custom columns in step 3.
            </p>
          </div>

          <div className="surface-card rounded-xl border border-[var(--border)] p-4">
            <div className="flex items-center gap-3">
              <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-purple-50 text-purple-600 dark:bg-purple-950/50">
                <Sparkles className="size-4" />
              </div>
              <h5 className="text-sm font-semibold text-[var(--text)]">Auto-Create Masters</h5>
            </div>
            <p className="mt-2 text-xs leading-relaxed text-[var(--text-muted)]">
              When importing invoices, missing customers, vendors, or items are created on-the-fly, saving hours of manual setup.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
