import type { Metadata } from "next";
import { CheckCircle2, AlertTriangle, XCircle } from "lucide-react";
import { requireCompany } from "@/lib/auth/session";
import { verifyCompanyData } from "@/server/services/verify";
import { PageHeader } from "@/components/patterns/page-header";
import { Badge } from "@/components/ui/display";
import { Table, THead, TBody, TR, TH, TD, TRMessage } from "@/components/ui/table";
import { EmptyState } from "@/components/ui/empty-state";
import { formatCurrency, formatNumber } from "@/lib/format/number";
import { formatDateTime } from "@/lib/format/date";

export const metadata: Metadata = { title: "Verify My Data" };

export default async function VerifyDataPage() {
  const ctx = await requireCompany();
  const report = await verifyCompanyData(ctx.companyId);

  const errors = report.findings.filter((f) => f.severity === "error");
  const warnings = report.findings.filter((f) => f.severity === "warning");

  return (
    <div className="flex min-h-full flex-col">
      <PageHeader
        title="Verify My Data"
        description="Recomputes every balance from the ledger and reports anything that disagrees."
      />

      <div className="space-y-4 p-4 sm:p-6">
        <div
          className={
            errors.length === 0
              ? "surface-card flex items-start gap-3 border-l-4 border-l-[var(--color-positive)] p-5"
              : "surface-card flex items-start gap-3 border-l-4 border-l-[var(--color-negative)] p-5"
          }
        >
          {errors.length === 0 ? (
            <CheckCircle2 className="size-6 shrink-0 text-[var(--color-positive)]" />
          ) : (
            <XCircle className="size-6 shrink-0 text-[var(--color-negative)]" />
          )}
          <div>
            <h2 className="text-[15px] font-semibold">
              {errors.length === 0
                ? "Your books check out"
                : `${errors.length} problem${errors.length === 1 ? "" : "s"} found`}
            </h2>
            <p className="mt-0.5 text-[13px] text-[var(--text-secondary)]">
              {errors.length === 0
                ? "Debits equal credits, and every stored total matches a fresh recomputation."
                : "Each problem below names the document it affects."}
              {warnings.length > 0
                ? ` ${warnings.length} thing${warnings.length === 1 ? "" : "s"} worth a look.`
                : ""}
            </p>
            <p className="mt-1 text-[12px] text-[var(--text-muted)]">
              Checked {formatDateTime(report.checkedAt)}
            </p>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <Stat label="Transactions" value={formatNumber(report.stats.transactions, { decimals: 0 })} />
          <Stat label="Ledger entries" value={formatNumber(report.stats.ledgerEntries, { decimals: 0 })} />
          <Stat label="Stock movements" value={formatNumber(report.stats.stockMovements, { decimals: 0 })} />
          <Stat label="Total debits" value={formatCurrency(report.stats.ledgerDebit)} />
          <Stat label="Total credits" value={formatCurrency(report.stats.ledgerCredit)} />
        </div>

        <div className="surface-card overflow-hidden">
          <Table>
            <THead>
              <TR className="hover:bg-transparent">
                <TH>Severity</TH>
                <TH>Area</TH>
                <TH>Document</TH>
                <TH>What we found</TH>
              </TR>
            </THead>
            <TBody>
              {report.findings.length === 0 ? (
                <TRMessage colSpan={4}>
                  <EmptyState
                    title="Nothing to fix"
                    description="Every check passed."
                  />
                </TRMessage>
              ) : (
                report.findings.map((finding, i) => (
                  <TR key={i}>
                    <TD>
                      <Badge variant={finding.severity === "error" ? "negative" : "warning"}>
                        {finding.severity === "error" ? (
                          <XCircle className="size-3" />
                        ) : (
                          <AlertTriangle className="size-3" />
                        )}
                        {finding.severity}
                      </Badge>
                    </TD>
                    <TD>{finding.area}</TD>
                    <TD className="font-medium">{finding.reference ?? "—"}</TD>
                    <TD>{finding.message}</TD>
                  </TR>
                ))
              )}
            </TBody>
          </Table>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="surface-card p-4">
      <div className="text-[12px] text-[var(--text-muted)]">{label}</div>
      <div className="tnum mt-0.5 text-[17px] font-semibold">{value}</div>
    </div>
  );
}
