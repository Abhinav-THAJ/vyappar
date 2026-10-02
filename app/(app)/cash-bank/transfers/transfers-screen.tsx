"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowRight, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EmptyState } from "@/components/ui/empty-state";
import { Table, THead, TBody, TR, TH, TD, TRMessage } from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogBody,
  DialogFooter,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field } from "@/components/forms/form-field";
import { FormGrid } from "@/components/forms/form-shell";
import { formatCurrency } from "@/lib/format/number";
import { formatDate, toDateInputValue } from "@/lib/format/date";
import { TRANSFER_KINDS, TRANSFER_LABELS } from "@/lib/validators/cashbank";
import { saveTransferAction } from "@/server/actions/cashbank";

interface TransferRow {
  id: string;
  type: string;
  displayNumber: string;
  date: string;
  amount: string;
  from: string;
  to: string;
  notes: string | null;
}

export function TransfersScreen({
  transfers,
  accounts,
  canWrite,
}: {
  transfers: TransferRow[];
  accounts: { id: string; displayName: string }[];
  canWrite: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);

  return (
    <div className="p-4 sm:p-6">
      {canWrite ? (
        <div className="mb-4 flex justify-end">
          <Button onClick={() => setOpen(true)}>
            <Plus className="size-4" />
            New Transfer
          </Button>
        </div>
      ) : null}

      <div className="surface-card overflow-hidden">
        <Table>
          <THead>
            <TR className="hover:bg-transparent">
              <TH>Date</TH>
              <TH>Reference</TH>
              <TH>From</TH>
              <TH>To</TH>
              <TH align="right">Amount</TH>
              <TH>Notes</TH>
            </TR>
          </THead>
          <TBody>
            {transfers.length === 0 ? (
              <TRMessage colSpan={6}>
                <EmptyState
                  title="No transfers in this period"
                  description="Deposits, withdrawals and bank-to-bank moves appear here."
                  action={
                    canWrite ? (
                      <Button onClick={() => setOpen(true)}>
                        <Plus className="size-4" />
                        New Transfer
                      </Button>
                    ) : undefined
                  }
                />
              </TRMessage>
            ) : (
              transfers.map((t) => (
                <TR key={t.id}>
                  <TD className="whitespace-nowrap">{formatDate(t.date)}</TD>
                  <TD className="font-medium">{t.displayNumber}</TD>
                  <TD>{t.type === "CASH_ADJUSTMENT" ? "Adjustment" : t.from}</TD>
                  <TD>
                    <span className="inline-flex items-center gap-1.5">
                      <ArrowRight className="size-3.5 text-[var(--text-muted)]" />
                      {t.type === "CASH_ADJUSTMENT" ? "Cash" : t.to}
                    </span>
                  </TD>
                  <TD align="right" numeric>
                    {formatCurrency(t.amount)}
                  </TD>
                  <TD className="max-w-[220px]">
                    <span className="block truncate text-[var(--text-secondary)]">
                      {t.notes ?? "—"}
                    </span>
                  </TD>
                </TR>
              ))
            )}
          </TBody>
        </Table>
      </div>

      <TransferDialog
        open={open}
        accounts={accounts}
        onClose={() => setOpen(false)}
        onSaved={() => {
          setOpen(false);
          router.refresh();
        }}
      />
    </div>
  );
}

function TransferDialog({
  open,
  accounts,
  onClose,
  onSaved,
}: {
  open: boolean;
  accounts: { id: string; displayName: string }[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [kind, setKind] = React.useState<(typeof TRANSFER_KINDS)[number]>("CASH_TO_BANK");
  const [date, setDate] = React.useState(toDateInputValue(new Date()));
  const [amount, setAmount] = React.useState("");
  const [fromId, setFromId] = React.useState<string | undefined>();
  const [toId, setToId] = React.useState<string | undefined>();
  const [reference, setReference] = React.useState("");
  const [notes, setNotes] = React.useState("");
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [formError, setFormError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (!open) return;
    setKind("CASH_TO_BANK");
    setDate(toDateInputValue(new Date()));
    setAmount("");
    setFromId(undefined);
    setToId(accounts[0]?.id);
    setReference("");
    setNotes("");
    setErrors({});
    setFormError(null);
  }, [open, accounts]);

  const needsFrom = kind === "BANK_TO_BANK" || kind === "BANK_TO_CASH";
  const needsTo = kind === "BANK_TO_BANK" || kind === "CASH_TO_BANK";

  async function save() {
    setSaving(true);
    setErrors({});
    setFormError(null);

    const result = await saveTransferAction({
      kind,
      date,
      amount,
      fromBankAccountId: needsFrom ? fromId : undefined,
      toBankAccountId: needsTo ? toId : undefined,
      reference: reference || undefined,
      notes: notes || undefined,
    });

    setSaving(false);

    if (!result.ok) {
      setFormError(result.error);
      const next: Record<string, string> = {};
      for (const [k, v] of Object.entries(result.fieldErrors ?? {})) next[k] = v[0]!;
      setErrors(next);
      return;
    }

    toast.success("Transfer recorded");
    onSaved();
  }

  return (
    <Dialog open={open} onOpenChange={(v) => (v ? null : onClose())}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New transfer</DialogTitle>
        </DialogHeader>

        <DialogBody className="space-y-4">
          {formError ? (
            <p className="rounded-lg bg-[var(--color-negative-soft)] px-3 py-2 text-[13px] text-[var(--color-negative)]">
              {formError}
            </p>
          ) : null}

          <Field id="kind" label="Type" required>
            <Select
              value={kind}
              onValueChange={(v) => setKind(v as (typeof TRANSFER_KINDS)[number])}
            >
              <SelectTrigger id="kind">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TRANSFER_KINDS.map((k) => (
                  <SelectItem key={k} value={k}>
                    {TRANSFER_LABELS[k]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <FormGrid>
            {needsFrom ? (
              <Field
                id="fromId"
                label="From account"
                required
                error={errors.fromBankAccountId}
              >
                <Select value={fromId ?? ""} onValueChange={setFromId}>
                  <SelectTrigger id="fromId" invalid={!!errors.fromBankAccountId}>
                    <SelectValue placeholder="Select" />
                  </SelectTrigger>
                  <SelectContent>
                    {accounts.map((a) => (
                      <SelectItem key={a.id} value={a.id}>
                        {a.displayName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            ) : null}

            {needsTo ? (
              <Field id="toId" label="To account" required error={errors.toBankAccountId}>
                <Select value={toId ?? ""} onValueChange={setToId}>
                  <SelectTrigger id="toId" invalid={!!errors.toBankAccountId}>
                    <SelectValue placeholder="Select" />
                  </SelectTrigger>
                  <SelectContent>
                    {accounts.map((a) => (
                      <SelectItem key={a.id} value={a.id}>
                        {a.displayName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            ) : null}

            <Field id="amount" label="Amount" required error={errors.amount}>
              <Input
                id="amount"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                inputMode="decimal"
                invalid={!!errors.amount}
              />
            </Field>

            <Field id="date" label="Date" required error={errors.date}>
              <Input
                id="date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </Field>

            <Field id="reference" label="Reference" className="sm:col-span-2">
              <Input
                id="reference"
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                placeholder="UTR / cheque number"
              />
            </Field>

            <Field id="notes" label="Notes" className="sm:col-span-2">
              <Textarea
                id="notes"
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
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
