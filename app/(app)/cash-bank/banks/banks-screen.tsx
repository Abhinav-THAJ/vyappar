"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { Building2, MoreVertical, Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Money } from "@/components/ui/display";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/menu";
import { PageHeader } from "@/components/patterns/page-header";
import { Field } from "@/components/forms/form-field";
import { FormGrid } from "@/components/forms/form-shell";
import { formatCurrency } from "@/lib/format/number";
import { saveBankAccountAction, deleteBankAccountAction } from "@/server/actions/cashbank";

export interface BankAccountRow {
  id: string;
  displayName: string;
  bankName: string | null;
  accountNumber: string | null;
  ifsc: string | null;
  upiId: string | null;
  openingBalance: string;
  openingAsOf: string | null;
  balance: string;
}

export const CASH_BANK_SIBLINGS = [
  { label: "Bank Accounts", href: "/cash-bank/banks" },
  { label: "Cash In Hand", href: "/cash-bank/cash" },
  { label: "Transfers", href: "/cash-bank/transfers" },
  { label: "Cheques", href: "/cash-bank/cheques" },
  { label: "Loan Accounts", href: "/cash-bank/loans" },
];

export function BanksScreen({
  accounts,
  canWrite,
}: {
  accounts: BankAccountRow[];
  canWrite: boolean;
}) {
  const router = useRouter();
  const [editing, setEditing] = React.useState<BankAccountRow | null>(null);
  const [creating, setCreating] = React.useState(false);

  const total = accounts.reduce((acc, a) => acc + Number(a.balance), 0);

  async function remove(account: BankAccountRow) {
    const result = await deleteBankAccountAction({ id: account.id });
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success(`${account.displayName} removed`);
    router.refresh();
  }

  return (
    <div className="flex min-h-full flex-col">
      <PageHeader
        title="Bank Accounts"
        siblings={CASH_BANK_SIBLINGS}
        actions={
          canWrite ? (
            <Button onClick={() => setCreating(true)}>
              <Plus className="size-4" />
              Add Account
            </Button>
          ) : null
        }
      />

      <div className="p-4 sm:p-6">
        <div className="surface-card mb-4 p-5">
          <div className="text-[13px] text-[var(--text-secondary)]">Total across all accounts</div>
          <Money value={total} className="mt-1 text-2xl font-semibold">
            {formatCurrency(total)}
          </Money>
        </div>

        {accounts.length === 0 ? (
          <div className="surface-card">
            <EmptyState
              title="No bank accounts yet"
              description="Add an account so payments can be recorded against it."
              action={
                canWrite ? (
                  <Button onClick={() => setCreating(true)}>
                    <Plus className="size-4" />
                    Add Account
                  </Button>
                ) : undefined
              }
            />
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {accounts.map((account) => (
              <div key={account.id} className="surface-card flex flex-col p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-brand-50 text-brand-700 dark:bg-brand-950 dark:text-brand-300">
                      <Building2 className="size-[18px]" />
                    </span>
                    <div className="min-w-0">
                      <div className="truncate text-[15px] font-semibold">
                        {account.displayName}
                      </div>
                      {account.bankName ? (
                        <div className="truncate text-[12px] text-[var(--text-muted)]">
                          {account.bankName}
                        </div>
                      ) : null}
                    </div>
                  </div>

                  {canWrite ? (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button
                          type="button"
                          className="grid size-8 place-items-center rounded-md text-[var(--text-muted)] hover:bg-[var(--surface-3)]"
                          aria-label={`Options for ${account.displayName}`}
                        >
                          <MoreVertical className="size-4" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onSelect={() => setEditing(account)}>
                          <Pencil />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem destructive onSelect={() => void remove(account)}>
                          <Trash2 />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  ) : null}
                </div>

                <div className="mt-4">
                  <div className="text-[12px] text-[var(--text-muted)]">Balance</div>
                  <Money value={Number(account.balance)} className="text-xl font-semibold">
                    {formatCurrency(account.balance)}
                  </Money>
                </div>

                <dl className="mt-3 space-y-1 text-[12px] text-[var(--text-muted)]">
                  {account.accountNumber ? (
                    <div className="flex justify-between gap-2">
                      <dt>A/c</dt>
                      <dd className="tnum truncate">{account.accountNumber}</dd>
                    </div>
                  ) : null}
                  {account.ifsc ? (
                    <div className="flex justify-between gap-2">
                      <dt>IFSC</dt>
                      <dd className="truncate">{account.ifsc}</dd>
                    </div>
                  ) : null}
                  {account.upiId ? (
                    <div className="flex justify-between gap-2">
                      <dt>UPI</dt>
                      <dd className="truncate">{account.upiId}</dd>
                    </div>
                  ) : null}
                </dl>

                <Link
                  href={`/cash-bank/banks/${account.id}`}
                  className="mt-4 text-[13px] font-medium text-brand-600 hover:underline"
                >
                  View statement
                </Link>
              </div>
            ))}
          </div>
        )}
      </div>

      <AccountDialog
        open={creating || !!editing}
        account={editing}
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
    </div>
  );
}

function AccountDialog({
  open,
  account,
  onClose,
  onSaved,
}: {
  open: boolean;
  account: BankAccountRow | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [values, setValues] = React.useState({
    displayName: "",
    bankName: "",
    accountNumber: "",
    ifsc: "",
    upiId: "",
    openingBalance: "0",
    openingAsOf: "",
  });
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [formError, setFormError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (!open) return;
    setValues({
      displayName: account?.displayName ?? "",
      bankName: account?.bankName ?? "",
      accountNumber: account?.accountNumber ?? "",
      ifsc: account?.ifsc ?? "",
      upiId: account?.upiId ?? "",
      openingBalance: account?.openingBalance ?? "0",
      openingAsOf: account?.openingAsOf ? account.openingAsOf.slice(0, 10) : "",
    });
    setErrors({});
    setFormError(null);
  }, [open, account]);

  function set(key: keyof typeof values, value: string) {
    setValues((v) => ({ ...v, [key]: value }));
  }

  async function save() {
    setSaving(true);
    setFormError(null);
    setErrors({});

    const result = await saveBankAccountAction({ id: account?.id, ...values });
    setSaving(false);

    if (!result.ok) {
      setFormError(result.error);
      const next: Record<string, string> = {};
      for (const [k, v] of Object.entries(result.fieldErrors ?? {})) next[k] = v[0]!;
      setErrors(next);
      return;
    }

    toast.success(account ? "Account updated" : `${values.displayName} added`);
    onSaved();
  }

  return (
    <Dialog open={open} onOpenChange={(v) => (v ? null : onClose())}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{account ? "Edit account" : "Add bank account"}</DialogTitle>
          <DialogDescription>
            The UPI ID here is what the invoice payment QR encodes.
          </DialogDescription>
        </DialogHeader>

        <DialogBody className="space-y-4">
          {formError ? (
            <p className="rounded-lg bg-[var(--color-negative-soft)] px-3 py-2 text-[13px] text-[var(--color-negative)]">
              {formError}
            </p>
          ) : null}

          <FormGrid>
            <Field
              id="displayName"
              label="Account name"
              required
              error={errors.displayName}
              className="sm:col-span-2"
            >
              <Input
                id="displayName"
                value={values.displayName}
                onChange={(e) => set("displayName", e.target.value)}
                autoFocus
                placeholder="Current Account"
                invalid={!!errors.displayName}
              />
            </Field>

            <Field id="bankName" label="Bank">
              <Input
                id="bankName"
                value={values.bankName}
                onChange={(e) => set("bankName", e.target.value)}
                placeholder="State Bank of India"
              />
            </Field>

            <Field id="accountNumber" label="Account number">
              <Input
                id="accountNumber"
                value={values.accountNumber}
                onChange={(e) => set("accountNumber", e.target.value)}
              />
            </Field>

            <Field id="ifsc" label="IFSC" error={errors.ifsc}>
              <Input
                id="ifsc"
                value={values.ifsc}
                onChange={(e) => set("ifsc", e.target.value.toUpperCase())}
                placeholder="SBIN0070234"
                maxLength={11}
                invalid={!!errors.ifsc}
              />
            </Field>

            <Field id="upiId" label="UPI ID">
              <Input
                id="upiId"
                value={values.upiId}
                onChange={(e) => set("upiId", e.target.value)}
                placeholder="business@sbi"
              />
            </Field>

            <Field id="openingBalance" label="Opening balance" error={errors.openingBalance}>
              <Input
                id="openingBalance"
                value={values.openingBalance}
                onChange={(e) => set("openingBalance", e.target.value)}
                inputMode="decimal"
              />
            </Field>

            <Field id="openingAsOf" label="As of">
              <Input
                id="openingAsOf"
                type="date"
                value={values.openingAsOf}
                onChange={(e) => set("openingAsOf", e.target.value)}
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
