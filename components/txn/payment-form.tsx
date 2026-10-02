"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { TransactionType } from "@prisma/client";
import { Save, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Field, FormError } from "@/components/forms/form-field";
import { FormShell, FormSection, FormGrid } from "@/components/forms/form-shell";
import { Combobox, type ComboboxOption } from "@/components/forms/combobox";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { EmptyState } from "@/components/ui/empty-state";
import { formatCurrency } from "@/lib/format/number";
import { formatDate, toDateInputValue } from "@/lib/format/date";
import {
  PAYMENT_MODES,
  PAYMENT_MODE_LABELS,
  paymentSchema,
  type PaymentInput,
} from "@/lib/validators/transaction";
import { savePaymentAction, openInvoicesForPartyAction } from "@/server/actions/transactions";
import { searchPartiesAction } from "@/server/actions/parties";
import { cn } from "@/lib/utils";

interface OpenInvoice {
  id: string;
  displayNumber: string;
  date: string;
  total: string;
  balance: string;
}

/**
 * Payment-In / Payment-Out.
 *
 * The allocation table settles specific invoices; anything left over stays on
 * the party's account as a credit, which is what "auto allocate" leaves behind
 * when the payment exceeds the open balance.
 */
export function PaymentForm({
  type,
  firms,
  activeFirmId,
  bankAccounts,
}: {
  type: typeof TransactionType.PAYMENT_IN | typeof TransactionType.PAYMENT_OUT;
  firms: { id: string; name: string }[];
  activeFirmId: string;
  bankAccounts: { id: string; displayName: string }[];
}) {
  const router = useRouter();
  const isIn = type === TransactionType.PAYMENT_IN;

  const [formError, setFormError] = React.useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string>>({});
  const [saving, setSaving] = React.useState(false);

  const [firmId, setFirmId] = React.useState(activeFirmId);
  const [number, setNumber] = React.useState("");
  const [date, setDate] = React.useState(toDateInputValue(new Date()));
  const [party, setParty] = React.useState<ComboboxOption | null>(null);
  const [amount, setAmount] = React.useState("");
  const [paymentMode, setPaymentMode] = React.useState<(typeof PAYMENT_MODES)[number]>("CASH");
  const [bankAccountId, setBankAccountId] = React.useState<string | undefined>();
  const [chequeNo, setChequeNo] = React.useState("");
  const [notes, setNotes] = React.useState("");

  const [invoices, setInvoices] = React.useState<OpenInvoice[]>([]);
  const [allocations, setAllocations] = React.useState<Record<string, string>>({});
  const [loadingInvoices, setLoadingInvoices] = React.useState(false);

  const searchParties = React.useCallback(
    async (query: string): Promise<ComboboxOption[]> => {
      const rows = await searchPartiesAction(query, isIn ? "CUSTOMER" : "SUPPLIER");
      return rows.map((r) => ({
        value: r.id,
        label: r.name,
        hint: r.phone ?? undefined,
        trailing: Number(r.balance) !== 0 ? formatCurrency(r.balance) : undefined,
      }));
    },
    [isIn],
  );

  React.useEffect(() => {
    if (!party) {
      setInvoices([]);
      setAllocations({});
      return;
    }

    let cancelled = false;
    setLoadingInvoices(true);

    openInvoicesForPartyAction(party.value, isIn ? "IN" : "OUT")
      .then((rows) => {
        if (cancelled) return;
        setInvoices(rows);
        setAllocations({});
      })
      .catch(() => {
        if (!cancelled) setInvoices([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingInvoices(false);
      });

    return () => {
      cancelled = true;
    };
  }, [party, isIn]);

  const allocated = Object.values(allocations).reduce((acc, v) => acc + Number(v || 0), 0);
  const unallocated = Number(amount || 0) - allocated;

  /** Oldest first, until the payment runs out. */
  function autoAllocate() {
    let remaining = Number(amount || 0);
    const next: Record<string, string> = {};

    for (const invoice of invoices) {
      if (remaining <= 0) break;
      const take = Math.min(remaining, Number(invoice.balance));
      if (take > 0) {
        next[invoice.id] = take.toFixed(2);
        remaining -= take;
      }
    }

    setAllocations(next);
  }

  async function save() {
    setFormError(null);
    setFieldErrors({});
    setSaving(true);

    try {
      const payload: PaymentInput = paymentSchema.parse({
        type,
        firmId,
        number: number || undefined,
        date,
        partyId: party?.value ?? "",
        amount: amount || "0",
        paymentMode,
        bankAccountId,
        chequeNo: chequeNo || undefined,
        notes: notes || undefined,
        allocations: Object.entries(allocations)
          .filter(([, v]) => Number(v) > 0)
          .map(([invoiceId, v]) => ({ invoiceId, amount: v })),
      });

      const result = await savePaymentAction(payload);

      if (!result.ok) {
        setFormError(result.error);
        const next: Record<string, string> = {};
        for (const [k, v] of Object.entries(result.fieldErrors ?? {})) next[k] = v[0]!;
        setFieldErrors(next);
        return;
      }

      toast.success(`${isIn ? "Payment-In" : "Payment-Out"} ${result.data.number} saved`);
      router.push(isIn ? "/sale/payments-in" : "/purchase/payments-out");
      router.refresh();
    } catch (error) {
      if (error instanceof Error && "issues" in error) {
        const issues = (error as unknown as { issues: { path: (string | number)[]; message: string }[] })
          .issues;
        const next: Record<string, string> = {};
        for (const issue of issues) next[String(issue.path[0] ?? "_form")] = issue.message;
        setFieldErrors(next);
        setFormError("Please correct the highlighted fields");
      } else {
        setFormError("Something went wrong. Please try again.");
      }
    } finally {
      setSaving(false);
    }
  }

  const listHref = isIn ? "/sale/payments-in" : "/purchase/payments-out";

  return (
    <FormShell
      title={isIn ? "Payment-In" : "Payment-Out"}
      description={isIn ? "Money received from a customer" : "Money paid to a supplier"}
      onCancel={() => router.push(listHref)}
      footer={
        <>
          <Button type="button" variant="ghost" onClick={() => router.push(listHref)}>
            Cancel
          </Button>
          <Button type="button" onClick={() => void save()} loading={saving}>
            <Save className="size-4" />
            Save
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <FormError message={formError} />

        <FormSection>
          <FormGrid cols={3}>
            {firms.length > 1 ? (
              <Field id="firmId" label="Firm" required>
                <Select value={firmId} onValueChange={setFirmId}>
                  <SelectTrigger id="firmId">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {firms.map((f) => (
                      <SelectItem key={f.id} value={f.id}>
                        {f.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            ) : null}

            <Field id="number" label="Receipt number" hint="Leave blank for the next number.">
              <Input
                id="number"
                value={number}
                onChange={(e) => setNumber(e.target.value)}
                placeholder="Auto"
              />
            </Field>

            <Field id="date" label="Date" required error={fieldErrors.date}>
              <Input
                id="date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                invalid={!!fieldErrors.date}
              />
            </Field>

            <Field
              id="party"
              label={isIn ? "Received from" : "Paid to"}
              required
              error={fieldErrors.partyId}
            >
              <Combobox
                id="party"
                value={party}
                onChange={setParty}
                onSearch={searchParties}
                placeholder="Search party"
                invalid={!!fieldErrors.partyId}
              />
            </Field>

            <Field id="amount" label="Amount" required error={fieldErrors.amount}>
              <Input
                id="amount"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                inputMode="decimal"
                placeholder="0.00"
                invalid={!!fieldErrors.amount}
              />
            </Field>

            <Field id="paymentMode" label="Payment mode">
              <Select
                value={paymentMode}
                onValueChange={(v) => setPaymentMode(v as (typeof PAYMENT_MODES)[number])}
              >
                <SelectTrigger id="paymentMode">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PAYMENT_MODES.map((m) => (
                    <SelectItem key={m} value={m}>
                      {PAYMENT_MODE_LABELS[m]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            {paymentMode !== "CASH" && bankAccounts.length > 0 ? (
              <Field id="bankAccountId" label="Bank account">
                <Select
                  value={bankAccountId ?? "none"}
                  onValueChange={(v) => setBankAccountId(v === "none" ? undefined : v)}
                >
                  <SelectTrigger id="bankAccountId">
                    <SelectValue placeholder="Select" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Not specified</SelectItem>
                    {bankAccounts.map((b) => (
                      <SelectItem key={b.id} value={b.id}>
                        {b.displayName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            ) : null}

            {paymentMode === "CHEQUE" ? (
              <Field id="chequeNo" label="Cheque number" required error={fieldErrors.chequeNo}>
                <Input
                  id="chequeNo"
                  value={chequeNo}
                  onChange={(e) => setChequeNo(e.target.value)}
                  invalid={!!fieldErrors.chequeNo}
                />
              </Field>
            ) : null}
          </FormGrid>
        </FormSection>

        {/* Allocation */}
        <div className="surface-card overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border-subtle)] p-4">
            <div>
              <h2 className="text-[15px] font-semibold">Settle invoices</h2>
              <p className="mt-0.5 text-[13px] text-[var(--text-muted)]">
                Anything you leave unallocated stays on the party&apos;s account as credit.
              </p>
            </div>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={autoAllocate}
              disabled={invoices.length === 0 || Number(amount || 0) <= 0}
            >
              <Wand2 className="size-4" />
              Auto allocate
            </Button>
          </div>

          {!party ? (
            <EmptyState compact title="Choose a party first" />
          ) : loadingInvoices ? (
            <EmptyState compact title="Loading open invoices…" />
          ) : invoices.length === 0 ? (
            <EmptyState
              compact
              title="Nothing outstanding"
              description="This party has no unpaid invoices. The payment will sit as an on-account credit."
            />
          ) : (
            <Table>
              <THead>
                <TR className="hover:bg-transparent">
                  <TH>Invoice</TH>
                  <TH>Date</TH>
                  <TH align="right">Total</TH>
                  <TH align="right">Due</TH>
                  <TH align="right">This payment</TH>
                </TR>
              </THead>
              <TBody>
                {invoices.map((invoice) => (
                  <TR key={invoice.id}>
                    <TD className="font-medium">{invoice.displayNumber}</TD>
                    <TD>{formatDate(invoice.date)}</TD>
                    <TD align="right" numeric>
                      {formatCurrency(invoice.total)}
                    </TD>
                    <TD align="right" numeric className="text-[var(--color-negative)]">
                      {formatCurrency(invoice.balance)}
                    </TD>
                    <TD align="right">
                      <Input
                        value={allocations[invoice.id] ?? ""}
                        onChange={(e) =>
                          setAllocations((cur) => ({ ...cur, [invoice.id]: e.target.value }))
                        }
                        className="ml-auto h-8 w-28 text-right"
                        inputMode="decimal"
                        placeholder="0.00"
                        aria-label={`Amount for ${invoice.displayNumber}`}
                      />
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          )}

          <div className="flex flex-wrap items-center justify-end gap-6 border-t border-[var(--border-subtle)] p-4 text-[13px]">
            <span>
              Allocated: <span className="tnum font-medium">{formatCurrency(allocated)}</span>
            </span>
            <span>
              Unallocated:{" "}
              <span
                className={cn(
                  "tnum font-medium",
                  unallocated < -0.005 && "text-[var(--color-negative)]",
                  unallocated > 0.005 && "text-[var(--color-warning)]",
                )}
              >
                {formatCurrency(unallocated)}
              </span>
            </span>
          </div>
        </div>

        <FormSection title="Notes">
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
        </FormSection>
      </div>
    </FormShell>
  );
}
