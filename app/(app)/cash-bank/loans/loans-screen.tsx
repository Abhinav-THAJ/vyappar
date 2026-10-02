"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Landmark, Pencil, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogBody,
  DialogFooter,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { PageHeader } from "@/components/patterns/page-header";
import { Field } from "@/components/forms/form-field";
import { FormGrid } from "@/components/forms/form-shell";
import { formatCurrency } from "@/lib/format/number";
import { formatDate, toDateInputValue } from "@/lib/format/date";
import { saveLoanAccountAction, saveLoanTransactionAction } from "@/server/actions/cashbank";
import { CASH_BANK_SIBLINGS } from "../banks/banks-screen";

export interface LoanRow {
  id: string;
  lenderName: string;
  accountNumber: string | null;
  openingBalance: string;
  openingAsOf: string | null;
  interestRate: string | null;
  termMonths: number | null;
  description: string | null;
  outstanding: string;
}

export function LoansScreen({ loans, canWrite }: { loans: LoanRow[]; canWrite: boolean }) {
  const router = useRouter();
  const [editing, setEditing] = React.useState<LoanRow | null>(null);
  const [creating, setCreating] = React.useState(false);
  const [repaying, setRepaying] = React.useState<LoanRow | null>(null);

  const total = loans.reduce((acc, l) => acc + Number(l.outstanding), 0);

  return (
    <div className="flex min-h-full flex-col">
      <PageHeader
        title="Loan Accounts"
        siblings={CASH_BANK_SIBLINGS}
        actions={
          canWrite ? (
            <Button onClick={() => setCreating(true)}>
              <Plus className="size-4" />
              Add Loan
            </Button>
          ) : null
        }
      />

      <div className="p-4 sm:p-6">
        <div className="surface-card mb-4 p-5">
          <div className="text-[13px] text-[var(--text-secondary)]">Total outstanding</div>
          <div className="tnum mt-1 text-2xl font-semibold text-[var(--color-negative)]">
            {formatCurrency(total)}
          </div>
        </div>

        {loans.length === 0 ? (
          <div className="surface-card">
            <EmptyState
              title="No loan accounts"
              description="Track a business loan and its repayments here."
              action={
                canWrite ? (
                  <Button onClick={() => setCreating(true)}>
                    <Plus className="size-4" />
                    Add Loan
                  </Button>
                ) : undefined
              }
            />
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {loans.map((loan) => (
              <div key={loan.id} className="surface-card p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-[var(--color-warning-soft)] text-[var(--color-warning)]">
                      <Landmark className="size-[18px]" />
                    </span>
                    <div className="min-w-0">
                      <div className="truncate text-[15px] font-semibold">{loan.lenderName}</div>
                      {loan.accountNumber ? (
                        <div className="truncate text-[12px] text-[var(--text-muted)]">
                          {loan.accountNumber}
                        </div>
                      ) : null}
                    </div>
                  </div>

                  {canWrite ? (
                    <button
                      type="button"
                      onClick={() => setEditing(loan)}
                      className="grid size-8 place-items-center rounded-md text-[var(--text-muted)] hover:bg-[var(--surface-3)]"
                      aria-label={`Edit ${loan.lenderName}`}
                    >
                      <Pencil className="size-4" />
                    </button>
                  ) : null}
                </div>

                <div className="mt-4">
                  <div className="text-[12px] text-[var(--text-muted)]">Outstanding</div>
                  <div className="tnum text-xl font-semibold">
                    {formatCurrency(loan.outstanding)}
                  </div>
                </div>

                <dl className="mt-3 space-y-1 text-[12px] text-[var(--text-muted)]">
                  <div className="flex justify-between gap-2">
                    <dt>Borrowed</dt>
                    <dd className="tnum">{formatCurrency(loan.openingBalance)}</dd>
                  </div>
                  {loan.interestRate ? (
                    <div className="flex justify-between gap-2">
                      <dt>Interest</dt>
                      <dd className="tnum">{loan.interestRate}%</dd>
                    </div>
                  ) : null}
                  {loan.termMonths ? (
                    <div className="flex justify-between gap-2">
                      <dt>Term</dt>
                      <dd>{loan.termMonths} months</dd>
                    </div>
                  ) : null}
                  {loan.openingAsOf ? (
                    <div className="flex justify-between gap-2">
                      <dt>From</dt>
                      <dd>{formatDate(loan.openingAsOf)}</dd>
                    </div>
                  ) : null}
                </dl>

                {canWrite ? (
                  <Button
                    variant="secondary"
                    size="sm"
                    className="mt-4 w-full"
                    onClick={() => setRepaying(loan)}
                  >
                    Record repayment
                  </Button>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </div>

      <LoanDialog
        open={creating || !!editing}
        loan={editing}
        onClose={() => {
          setCreating(false);
          setEditing(null);
        }}
        onSaved={() => {
          setCreating(false);
          setEditing(null);
          router.refresh();
        }}
      />

      <RepaymentDialog
        loan={repaying}
        onClose={() => setRepaying(null)}
        onSaved={() => {
          setRepaying(null);
          router.refresh();
        }}
      />
    </div>
  );
}

function LoanDialog({
  open,
  loan,
  onClose,
  onSaved,
}: {
  open: boolean;
  loan: LoanRow | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [values, setValues] = React.useState({
    lenderName: "",
    accountNumber: "",
    openingBalance: "0",
    openingAsOf: "",
    interestRate: "",
    termMonths: "",
    description: "",
  });
  const [error, setError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (!open) return;
    setValues({
      lenderName: loan?.lenderName ?? "",
      accountNumber: loan?.accountNumber ?? "",
      openingBalance: loan?.openingBalance ?? "0",
      openingAsOf: loan?.openingAsOf ? loan.openingAsOf.slice(0, 10) : "",
      interestRate: loan?.interestRate ?? "",
      termMonths: loan?.termMonths ? String(loan.termMonths) : "",
      description: loan?.description ?? "",
    });
    setError(null);
  }, [open, loan]);

  async function save() {
    setSaving(true);
    setError(null);

    const result = await saveLoanAccountAction({
      id: loan?.id,
      lenderName: values.lenderName,
      accountNumber: values.accountNumber || undefined,
      openingBalance: values.openingBalance,
      openingAsOf: values.openingAsOf || undefined,
      interestRate: values.interestRate || undefined,
      termMonths: values.termMonths || undefined,
      description: values.description || undefined,
    });

    setSaving(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }

    toast.success(loan ? "Loan updated" : `${values.lenderName} added`);
    onSaved();
  }

  return (
    <Dialog open={open} onOpenChange={(v) => (v ? null : onClose())}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{loan ? "Edit loan" : "Add loan account"}</DialogTitle>
        </DialogHeader>

        <DialogBody className="space-y-4">
          {error ? (
            <p className="rounded-lg bg-[var(--color-negative-soft)] px-3 py-2 text-[13px] text-[var(--color-negative)]">
              {error}
            </p>
          ) : null}

          <FormGrid>
            <Field id="lenderName" label="Lender" required className="sm:col-span-2">
              <Input
                id="lenderName"
                value={values.lenderName}
                onChange={(e) => setValues((v) => ({ ...v, lenderName: e.target.value }))}
                autoFocus
              />
            </Field>
            <Field id="accountNumber" label="Account number">
              <Input
                id="accountNumber"
                value={values.accountNumber}
                onChange={(e) => setValues((v) => ({ ...v, accountNumber: e.target.value }))}
              />
            </Field>
            <Field id="openingBalance" label="Amount borrowed">
              <Input
                id="openingBalance"
                value={values.openingBalance}
                onChange={(e) => setValues((v) => ({ ...v, openingBalance: e.target.value }))}
                inputMode="decimal"
              />
            </Field>
            <Field id="openingAsOf" label="Taken on">
              <Input
                id="openingAsOf"
                type="date"
                value={values.openingAsOf}
                onChange={(e) => setValues((v) => ({ ...v, openingAsOf: e.target.value }))}
              />
            </Field>
            <Field id="interestRate" label="Interest rate %">
              <Input
                id="interestRate"
                value={values.interestRate}
                onChange={(e) => setValues((v) => ({ ...v, interestRate: e.target.value }))}
                inputMode="decimal"
              />
            </Field>
            <Field id="termMonths" label="Term (months)">
              <Input
                id="termMonths"
                type="number"
                value={values.termMonths}
                onChange={(e) => setValues((v) => ({ ...v, termMonths: e.target.value }))}
              />
            </Field>
            <Field id="description" label="Notes" className="sm:col-span-2">
              <Textarea
                id="description"
                rows={2}
                value={values.description}
                onChange={(e) => setValues((v) => ({ ...v, description: e.target.value }))}
              />
            </Field>
          </FormGrid>
        </DialogBody>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={() => void save()} loading={saving}>
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RepaymentDialog({
  loan,
  onClose,
  onSaved,
}: {
  loan: LoanRow | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [principal, setPrincipal] = React.useState("");
  const [interest, setInterest] = React.useState("");
  const [charges, setCharges] = React.useState("");
  const [date, setDate] = React.useState(toDateInputValue(new Date()));
  const [note, setNote] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (!loan) return;
    setPrincipal("");
    setInterest("");
    setCharges("");
    setDate(toDateInputValue(new Date()));
    setNote("");
    setError(null);
  }, [loan]);

  async function save() {
    if (!loan) return;
    setSaving(true);
    setError(null);

    const result = await saveLoanTransactionAction({
      loanAccountId: loan.id,
      date,
      principal: principal || "0",
      interest: interest || "0",
      charges: charges || "0",
      note: note || undefined,
    });

    setSaving(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }

    toast.success("Repayment recorded");
    onSaved();
  }

  return (
    <Dialog open={!!loan} onOpenChange={(v) => (v ? null : onClose())}>
      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle>Record repayment</DialogTitle>
          <DialogDescription>
            {loan ? `${loan.lenderName} — ${formatCurrency(loan.outstanding)} outstanding` : ""}
          </DialogDescription>
        </DialogHeader>

        <DialogBody className="space-y-4">
          {error ? (
            <p className="rounded-lg bg-[var(--color-negative-soft)] px-3 py-2 text-[13px] text-[var(--color-negative)]">
              {error}
            </p>
          ) : null}

          <FormGrid>
            <Field id="principal" label="Principal">
              <Input
                id="principal"
                value={principal}
                onChange={(e) => setPrincipal(e.target.value)}
                inputMode="decimal"
                autoFocus
              />
            </Field>
            <Field id="interest" label="Interest">
              <Input
                id="interest"
                value={interest}
                onChange={(e) => setInterest(e.target.value)}
                inputMode="decimal"
              />
            </Field>
            <Field id="charges" label="Charges">
              <Input
                id="charges"
                value={charges}
                onChange={(e) => setCharges(e.target.value)}
                inputMode="decimal"
              />
            </Field>
            <Field id="date" label="Date">
              <Input
                id="date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </Field>
            <Field id="note" label="Note" className="sm:col-span-2">
              <Input id="note" value={note} onChange={(e) => setNote(e.target.value)} />
            </Field>
          </FormGrid>
        </DialogBody>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={() => void save()} loading={saving}>
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
