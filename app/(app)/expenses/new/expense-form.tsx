"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Save } from "lucide-react";
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
import { formatCurrency } from "@/lib/format/number";
import { toDateInputValue } from "@/lib/format/date";
import {
  PAYMENT_MODES,
  PAYMENT_MODE_LABELS,
  expenseSchema,
  type ExpenseInput,
} from "@/lib/validators/transaction";
import { saveExpenseAction } from "@/server/actions/expenses";
import { searchPartiesAction } from "@/server/actions/parties";

/** Record an expense: a lump sum against a category, optionally with GST. */
export function ExpenseForm({
  firms,
  activeFirmId,
  categories,
  bankAccounts,
  taxRates,
  gstEnabled,
}: {
  firms: { id: string; name: string }[];
  activeFirmId: string;
  categories: { id: string; name: string }[];
  bankAccounts: { id: string; displayName: string }[];
  taxRates: { id: string; name: string; rate: string }[];
  gstEnabled: boolean;
}) {
  const router = useRouter();
  const [formError, setFormError] = React.useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string>>({});
  const [saving, setSaving] = React.useState(false);

  const [firmId, setFirmId] = React.useState(activeFirmId);
  const [number, setNumber] = React.useState("");
  const [date, setDate] = React.useState(toDateInputValue(new Date()));
  const [categoryId, setCategoryId] = React.useState(categories[0]?.id ?? "");
  const [party, setParty] = React.useState<ComboboxOption | null>(null);
  const [amount, setAmount] = React.useState("");
  const [taxRateValue, setTaxRateValue] = React.useState("0");
  const [paidAmount, setPaidAmount] = React.useState("");
  const [paymentMode, setPaymentMode] = React.useState<(typeof PAYMENT_MODES)[number]>("CASH");
  const [bankAccountId, setBankAccountId] = React.useState<string | undefined>();
  const [notes, setNotes] = React.useState("");

  const net = Number(amount || 0);
  const tax = (net * Number(taxRateValue || 0)) / 100;
  const total = net + tax;

  const searchParties = React.useCallback(async (query: string): Promise<ComboboxOption[]> => {
    const rows = await searchPartiesAction(query, "SUPPLIER");
    return rows.map((r) => ({ value: r.id, label: r.name, hint: r.phone ?? undefined }));
  }, []);

  async function save() {
    setFormError(null);
    setFieldErrors({});
    setSaving(true);

    try {
      const payload: ExpenseInput = expenseSchema.parse({
        firmId,
        number: number || undefined,
        date,
        expenseCategoryId: categoryId,
        partyId: party?.value,
        lines: [],
        amount: amount || "0",
        taxRateValue: gstEnabled ? taxRateValue : "0",
        isIgst: false,
        paidAmount: paidAmount || "0",
        paymentMode,
        bankAccountId,
        notes: notes || undefined,
      });

      const result = await saveExpenseAction(payload);

      if (!result.ok) {
        setFormError(result.error);
        const next: Record<string, string> = {};
        for (const [k, v] of Object.entries(result.fieldErrors ?? {})) next[k] = v[0]!;
        setFieldErrors(next);
        return;
      }

      toast.success(`Expense ${result.data.number} saved`);
      router.push("/expenses");
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

  return (
    <FormShell
      title="Add Expense"
      onCancel={() => router.push("/expenses")}
      width="md"
      footer={
        <>
          <Button type="button" variant="ghost" onClick={() => router.push("/expenses")}>
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
          <FormGrid>
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

            <Field id="number" label="Expense number" hint="Leave blank for the next number.">
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
              id="categoryId"
              label="Category"
              required
              error={fieldErrors.expenseCategoryId}
            >
              <Select value={categoryId} onValueChange={setCategoryId}>
                <SelectTrigger id="categoryId" invalid={!!fieldErrors.expenseCategoryId}>
                  <SelectValue placeholder="Choose a category" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field id="party" label="Paid to" hint="Optional — links the expense to a supplier.">
              <Combobox
                id="party"
                value={party}
                onChange={setParty}
                onSearch={searchParties}
                placeholder="Search supplier"
              />
            </Field>
          </FormGrid>
        </FormSection>

        <FormSection title="Amount">
          <FormGrid>
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

            {gstEnabled ? (
              <Field id="taxRateValue" label="GST">
                <Select value={taxRateValue} onValueChange={setTaxRateValue}>
                  <SelectTrigger id="taxRateValue">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0">No GST</SelectItem>
                    {taxRates
                      .filter((t) => Number(t.rate) > 0)
                      .map((t) => (
                        <SelectItem key={t.id} value={t.rate}>
                          {t.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </Field>
            ) : null}
          </FormGrid>

          <div className="mt-4 space-y-1.5 border-t border-[var(--border-subtle)] pt-4 text-[13px]">
            <div className="flex justify-between">
              <span className="text-[var(--text-secondary)]">Net</span>
              <span className="tnum">{formatCurrency(net)}</span>
            </div>
            {tax > 0 ? (
              <div className="flex justify-between">
                <span className="text-[var(--text-secondary)]">GST</span>
                <span className="tnum">{formatCurrency(tax)}</span>
              </div>
            ) : null}
            <div className="flex justify-between text-[15px] font-semibold">
              <span>Total</span>
              <span className="tnum">{formatCurrency(total)}</span>
            </div>
          </div>
        </FormSection>

        <FormSection title="Payment">
          <FormGrid>
            <Field id="paidAmount" label="Paid now">
              <div className="flex items-center gap-1">
                <Input
                  id="paidAmount"
                  value={paidAmount}
                  onChange={(e) => setPaidAmount(e.target.value)}
                  inputMode="decimal"
                  placeholder="0.00"
                />
                <button
                  type="button"
                  onClick={() => setPaidAmount(total.toFixed(2))}
                  className="h-9 shrink-0 rounded-lg border border-[var(--border-strong)] px-2 text-[12px] font-medium"
                >
                  Full
                </button>
              </div>
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
          </FormGrid>
        </FormSection>

        <FormSection title="Notes">
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
        </FormSection>
      </div>
    </FormShell>
  );
}
