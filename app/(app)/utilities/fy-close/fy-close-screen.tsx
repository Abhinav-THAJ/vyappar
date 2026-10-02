"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CalendarCheck, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/controls";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PageHeader } from "@/components/patterns/page-header";
import { Field } from "@/components/forms/form-field";
import { formatCurrency } from "@/lib/format/number";
import { closeFinancialYearAction, type FyCloseOutcome } from "@/server/actions/utilities";

/**
 * Financial-year close.
 *
 * Carries closing balances forward as opening figures. It is additive: the
 * closed year's documents are untouched, so its reports keep producing exactly
 * the same numbers afterwards.
 */
export function FyCloseScreen({
  years,
  currentYear,
  canClose,
}: {
  years: string[];
  currentYear: string;
  canClose: boolean;
}) {
  const router = useRouter();
  const closable = years.filter((y) => y !== currentYear);

  const [year, setYear] = React.useState(closable[0] ?? "");
  const [confirm, setConfirm] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [outcome, setOutcome] = React.useState<FyCloseOutcome | null>(null);

  async function close() {
    setBusy(true);
    setError(null);

    const result = await closeFinancialYearAction({ financialYear: year, confirm });
    setBusy(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    setOutcome(result.data);
    toast.success(`${year} closed`);
    router.refresh();
  }

  return (
    <div className="flex min-h-full flex-col">
      <PageHeader
        title="Close Financial Year"
        description="Carry closing balances into the next year as opening figures."
      />

      <div className="mx-auto w-full max-w-2xl p-4 sm:p-6">
        {outcome ? (
          <div className="surface-card p-6">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="size-6 shrink-0 text-[var(--color-positive)]" />
              <div>
                <h2 className="text-[15px] font-semibold">
                  {outcome.financialYear} closed
                </h2>
                <p className="mt-1 text-[13px] text-[var(--text-secondary)]">
                  {outcome.partiesCarried} party balance
                  {outcome.partiesCarried === 1 ? "" : "s"} and {outcome.itemsCarried} item
                  stock level{outcome.itemsCarried === 1 ? "" : "s"} carried forward. Closing
                  cash was {formatCurrency(outcome.cash)}.
                </p>
                <p className="mt-2 text-[12px] text-[var(--text-muted)]">
                  Nothing in {outcome.financialYear} was changed or deleted — its reports
                  still produce the same figures.
                </p>
              </div>
            </div>

            <div className="mt-5 flex gap-2">
              <Button variant="outline" onClick={() => setOutcome(null)}>
                Close another year
              </Button>
              <Button onClick={() => router.push("/dashboard")}>Back to dashboard</Button>
            </div>
          </div>
        ) : (
          <div className="surface-card p-6">
            <div className="flex items-start gap-3">
              <CalendarCheck className="size-6 shrink-0 text-brand-600" />
              <div>
                <h2 className="text-[15px] font-semibold">What this does</h2>
                <ul className="mt-2 space-y-1.5 text-[13px] text-[var(--text-secondary)]">
                  <li>Sets each party&apos;s opening balance to its closing balance.</li>
                  <li>Sets each item&apos;s opening stock to its closing quantity.</li>
                  <li>Records closing cash and bank balances.</li>
                  <li>Leaves every document in the closed year exactly as it is.</li>
                </ul>
              </div>
            </div>

            {error ? (
              <p className="mt-4 rounded-lg bg-[var(--color-negative-soft)] px-3 py-2 text-[13px] text-[var(--color-negative)]">
                {error}
              </p>
            ) : null}

            {closable.length === 0 ? (
              <p className="mt-5 rounded-lg bg-[var(--surface-3)] px-3 py-2.5 text-[13px] text-[var(--text-secondary)]">
                There is no completed financial year to close yet. The current year,{" "}
                {currentYear}, can be closed once it ends.
              </p>
            ) : (
              <>
                <div className="mt-5">
                  <Field
                    id="financialYear"
                    label="Financial year to close"
                    hint={`The current year (${currentYear}) cannot be closed while it is running.`}
                  >
                    <Select value={year} onValueChange={setYear}>
                      <SelectTrigger id="financialYear">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {closable.map((y) => (
                          <SelectItem key={y} value={y}>
                            {y}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                </div>

                <label className="mt-4 flex items-start gap-2.5">
                  <Checkbox
                    checked={confirm}
                    onCheckedChange={(v) => setConfirm(v === true)}
                    className="mt-0.5"
                  />
                  <span className="text-[13px]">
                    I have taken a backup and want to carry {year} balances forward.
                    <span className="mt-0.5 block text-[12px] text-[var(--text-muted)]">
                      Opening balances on parties and items will be overwritten.
                    </span>
                  </span>
                </label>

                <div className="mt-5 flex justify-end gap-2">
                  <Button variant="outline" asChild>
                    <a href="/api/export/backup" download>
                      Download backup first
                    </a>
                  </Button>
                  <Button
                    onClick={() => void close()}
                    disabled={!canClose || !confirm || !year}
                    loading={busy}
                  >
                    Close {year}
                  </Button>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
