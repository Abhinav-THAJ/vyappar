"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
// Type-only: keeps the Prisma client out of the client bundle.
import type { TransactionType } from "@prisma/client";
import { Save, Printer } from "lucide-react";
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
import { Badge } from "@/components/ui/display";
import { LineItemGrid, type GridLine } from "./line-item-grid";
import { TotalsPanel } from "./totals-panel";
import { computeTransaction, type CalcInput, type CalcResult } from "@/lib/calc";
import { formatCurrency } from "@/lib/format/number";
import { toDateInputValue } from "@/lib/format/date";
import { INDIAN_STATES, stateName } from "@/lib/gst";
import {
  transactionSchema,
  PAYMENT_MODES,
  PAYMENT_MODE_LABELS,
  TYPE_LABELS,
  isPurchaseSide,
  type TransactionInput,
} from "@/lib/validators/transaction";
import { saveTransactionAction } from "@/server/actions/transactions";
import { searchPartiesAction, quickCreatePartyAction } from "@/server/actions/parties";
import { BEHAVIOUR } from "@/lib/txn/behaviour";

export interface TransactionFormSettings {
  showLineDiscount: boolean;
  showFreeQuantity: boolean;
  showLineDescription: boolean;
  showAdditionalCharges: boolean;
  showBillDiscount: boolean;
  roundOffEnabled: boolean;
  roundOffMode: "nearest" | "up" | "down";
  defaultDueDays: number;
  gstEnabled: boolean;
  enableTcs: boolean;
  defaultTerms: string | null;
}

export interface TransactionFormDefaults {
  id?: string;
  number?: string;
  date?: string;
  dueDate?: string;
  partyId?: string;
  partyName?: string;
  stateOfSupply?: string;
  lines?: GridLine[];
  billDiscountValue?: string;
  billDiscountIsPercent?: boolean;
  additionalCharges?: TransactionInput["additionalCharges"];
  tcsRate?: string;
  paidAmount?: string;
  paymentMode?: (typeof PAYMENT_MODES)[number];
  chequeNo?: string;
  notes?: string;
  terms?: string;
  convertedFromId?: string;
}

let keyCounter = 0;
function newKey() {
  keyCounter += 1;
  return `line-${keyCounter}`;
}

function blankLine(): GridLine {
  return {
    key: newKey(),
    qty: "1",
    rate: "0",
    rateIsTaxInclusive: false,
    discountIsPercent: false,
    taxRateValue: "0",
  };
}

/**
 * The transaction form behind every goods document.
 *
 * It computes totals on the client for instant feedback using exactly the same
 * pure function the server re-runs on save — the client's numbers are display
 * only and are discarded server-side (D-17).
 */
export function TransactionForm({
  type,
  firms,
  activeFirmId,
  units,
  taxRates,
  settings,
  defaults,
  firmStateCode,
}: {
  type: TransactionType;
  firms: { id: string; name: string; stateCode: string }[];
  activeFirmId: string;
  units: { id: string; shortName: string }[];
  taxRates: { id: string; name: string; rate: string }[];
  settings: TransactionFormSettings;
  defaults?: TransactionFormDefaults;
  firmStateCode: string;
}) {
  const router = useRouter();
  const isEdit = !!defaults?.id;
  const isPurchase = isPurchaseSide(type);
  const behaviour = BEHAVIOUR[type];

  const [formError, setFormError] = React.useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string>>({});
  const [lineErrors, setLineErrors] = React.useState<Record<number, Record<string, string>>>({});
  const [saving, setSaving] = React.useState(false);

  const [firmId, setFirmId] = React.useState(activeFirmId);
  const [number, setNumber] = React.useState(defaults?.number ?? "");
  const [date, setDate] = React.useState(defaults?.date ?? toDateInputValue(new Date()));
  const [dueDate, setDueDate] = React.useState(defaults?.dueDate ?? "");
  const [party, setParty] = React.useState<ComboboxOption | null>(
    defaults?.partyId ? { value: defaults.partyId, label: defaults.partyName ?? "Party" } : null,
  );
  const [partyState, setPartyState] = React.useState<string | null>(
    defaults?.stateOfSupply ?? null,
  );
  const [lines, setLines] = React.useState<GridLine[]>(
    defaults?.lines?.length ? defaults.lines : [blankLine()],
  );
  const [billDiscountValue, setBillDiscountValue] = React.useState(
    defaults?.billDiscountValue ?? "",
  );
  const [billDiscountIsPercent, setBillDiscountIsPercent] = React.useState(
    defaults?.billDiscountIsPercent ?? false,
  );
  const [charges, setCharges] = React.useState<TransactionInput["additionalCharges"]>(
    defaults?.additionalCharges ?? [],
  );
  const [tcsRate, setTcsRate] = React.useState(defaults?.tcsRate ?? "");
  const [roundOffEnabled, setRoundOffEnabled] = React.useState(
    defaults?.id ? Boolean(defaults.tcsRate) || settings.roundOffEnabled : settings.roundOffEnabled,
  );
  const [paidAmount, setPaidAmount] = React.useState(defaults?.paidAmount ?? "");
  const [paymentMode, setPaymentMode] = React.useState<(typeof PAYMENT_MODES)[number]>(
    defaults?.paymentMode ?? "CASH",
  );
  const [chequeNo, setChequeNo] = React.useState(defaults?.chequeNo ?? "");
  const [notes, setNotes] = React.useState(defaults?.notes ?? "");
  const [terms, setTerms] = React.useState(defaults?.terms ?? settings.defaultTerms ?? "");

  const selectedFirm = firms.find((f) => f.id === firmId);
  const effectiveFirmState = selectedFirm?.stateCode ?? firmStateCode;
  const supplyState = partyState ?? effectiveFirmState;
  const isIgst = supplyState !== effectiveFirmState;

  // Totals, recomputed on every keystroke by the same engine the server uses.
  const calc: CalcResult = React.useMemo(() => {
    const input: CalcInput = {
      isIgst,
      lines: lines.map((line) => ({
        key: line.key,
        qty: line.qty || "0",
        rate: line.rate || "0",
        rateIsTaxInclusive: line.rateIsTaxInclusive,
        discountValue: line.discountValue || "0",
        discountIsPercent: line.discountIsPercent,
        taxRate: settings.gstEnabled ? line.taxRateValue || "0" : "0",
        cessRate: line.cessRate || "0",
        hsnSac: line.hsnSac ?? null,
      })),
      billDiscountValue: billDiscountValue || "0",
      billDiscountIsPercent,
      additionalCharges: charges.map((c) => ({
        name: c.name,
        amount: c.amount || "0",
        taxRate: c.taxRate ?? null,
      })),
      tcsRate: tcsRate || "0",
      roundOffEnabled,
      roundOffMode: settings.roundOffMode,
    };
    return computeTransaction(input);
  }, [
    lines,
    billDiscountValue,
    billDiscountIsPercent,
    charges,
    tcsRate,
    roundOffEnabled,
    isIgst,
    settings.gstEnabled,
    settings.roundOffMode,
  ]);

  // Due date follows the settings default once a date is chosen.
  React.useEffect(() => {
    if (!behaviour.ledger || dueDate || !date || settings.defaultDueDays <= 0) return;
    const base = new Date(date);
    if (Number.isNaN(base.getTime())) return;
    base.setDate(base.getDate() + settings.defaultDueDays);
    setDueDate(toDateInputValue(base));
  }, [date, dueDate, behaviour.ledger, settings.defaultDueDays]);

  const searchParties = React.useCallback(
    async (query: string): Promise<ComboboxOption[]> => {
      const rows = await searchPartiesAction(query, isPurchase ? "SUPPLIER" : "CUSTOMER");
      partyCache.current = new Map(rows.map((r) => [r.id, r]));
      return rows.map((r) => ({
        value: r.id,
        label: r.name,
        hint: [r.phone, r.gstin].filter(Boolean).join(" · ") || undefined,
        trailing: Number(r.balance) !== 0 ? formatCurrency(r.balance) : undefined,
      }));
    },
    [isPurchase],
  );

  const partyCache = React.useRef<
    Map<string, { id: string; name: string; stateCode: string | null }>
  >(new Map());

  function pickParty(option: ComboboxOption) {
    setParty(option);
    const cached = partyCache.current.get(option.value);
    setPartyState(cached?.stateCode ?? null);
  }

  async function createPartyInline(name: string) {
    const result = await quickCreatePartyAction({
      name,
      type: isPurchase ? "SUPPLIER" : "CUSTOMER",
      gstType: "UNREGISTERED",
      openingBalance: "0",
      openingBalanceType: "TO_RECEIVE",
      customFields: {},
    });

    if (!result.ok) {
      toast.error(result.error);
      return;
    }

    setParty({ value: result.data.id, label: result.data.name });
    setPartyState(null);
    toast.success(`${result.data.name} added`);
  }

  function updateLine(key: string, patch: Partial<GridLine>) {
    setLines((current) => {
      const next = current.map((l) => (l.key === key ? { ...l, ...patch } : l));
      // Typing into the last row extends the grid, so entry never stalls.
      const last = next[next.length - 1];
      if (last && (last.itemId || last.description)) next.push(blankLine());
      return next;
    });
  }

  function addLine() {
    setLines((current) => [...current, blankLine()]);
  }

  function removeLine(key: string) {
    setLines((current) => {
      const next = current.filter((l) => l.key !== key);
      return next.length === 0 ? [blankLine()] : next;
    });
  }

  function buildPayload(): TransactionInput {
    // Drop the trailing blank row that the auto-extend leaves behind.
    const realLines = lines.filter((l) => l.itemId || l.description);

    return transactionSchema.parse({
      id: defaults?.id,
      type,
      firmId,
      number: number || undefined,
      date,
      dueDate: dueDate || undefined,
      partyId: party?.value,
      stateOfSupply: partyState ?? undefined,
      lines: realLines.map((l) => ({
        itemId: l.itemId,
        description: l.description,
        hsnSac: l.hsnSac,
        qty: l.qty || "0",
        freeQty: l.freeQty || "0",
        unitId: l.unitId,
        rate: l.rate || "0",
        rateIsTaxInclusive: l.rateIsTaxInclusive,
        discountValue: l.discountValue || "0",
        discountIsPercent: l.discountIsPercent,
        taxRateId: l.taxRateId,
        taxRateValue: l.taxRateValue || "0",
        cessRate: l.cessRate || "0",
      })),
      billDiscountValue: billDiscountValue || "0",
      billDiscountIsPercent,
      additionalCharges: charges.filter((c) => c.name.trim() !== ""),
      tcsRate: tcsRate || "0",
      roundOffEnabled,
      roundOffMode: settings.roundOffMode,
      paidAmount: paidAmount || "0",
      paymentMode: behaviour.ledger ? paymentMode : undefined,
      chequeNo: chequeNo || undefined,
      notes: notes || undefined,
      terms: terms || undefined,
      convertedFromId: defaults?.convertedFromId,
    });
  }

  async function save(andPrint: boolean) {
    setFormError(null);
    setFieldErrors({});
    setLineErrors({});
    setSaving(true);

    try {
      const payload = buildPayload();
      const result = await saveTransactionAction(payload);

      if (!result.ok) {
        setFormError(result.error);
        const nextFieldErrors: Record<string, string> = {};
        const nextLineErrors: Record<number, Record<string, string>> = {};

        for (const [path, messages] of Object.entries(result.fieldErrors ?? {})) {
          const match = /^lines\.(\d+)\.(.+)$/.exec(path);
          if (match) {
            const index = Number(match[1]);
            nextLineErrors[index] = { ...(nextLineErrors[index] ?? {}), [match[2]!]: messages[0]! };
          } else {
            nextFieldErrors[path] = messages[0]!;
          }
        }

        setFieldErrors(nextFieldErrors);
        setLineErrors(nextLineErrors);
        return;
      }

      toast.success(`${TYPE_LABELS[type]} ${result.data.prefix}${result.data.number} saved`);

      if (andPrint) router.push(`/print/${result.data.id}`);
      else router.push(listPath(type));
      router.refresh();
    } catch (error) {
      // A Zod parse failure here means the local form state is invalid.
      if (error instanceof Error && "issues" in error) {
        const issues = (error as unknown as { issues: { path: (string | number)[]; message: string }[] })
          .issues;
        const nextFieldErrors: Record<string, string> = {};
        const nextLineErrors: Record<number, Record<string, string>> = {};

        for (const issue of issues) {
          if (issue.path[0] === "lines" && typeof issue.path[1] === "number") {
            const index = issue.path[1];
            const field = String(issue.path[2] ?? "itemId");
            nextLineErrors[index] = { ...(nextLineErrors[index] ?? {}), [field]: issue.message };
          } else {
            nextFieldErrors[String(issue.path[0] ?? "_form")] = issue.message;
          }
        }

        setFieldErrors(nextFieldErrors);
        setLineErrors(nextLineErrors);
        setFormError("Please correct the highlighted fields");
      } else {
        setFormError("Something went wrong. Please try again.");
      }
    } finally {
      setSaving(false);
    }
  }

  // Ctrl+S saves, as the brief requires.
  React.useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();
        void save(false);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  return (
    <FormShell
      title={isEdit ? `Edit ${TYPE_LABELS[type]}` : TYPE_LABELS[type]}
      description={
        settings.gstEnabled
          ? isIgst
            ? `Inter-state supply to ${stateName(supplyState)} — IGST applies`
            : `Intra-state supply — CGST and SGST apply`
          : undefined
      }
      width="xl"
      onCancel={() => router.push(listPath(type))}
      footer={
        <>
          <Button type="button" variant="ghost" onClick={() => router.push(listPath(type))}>
            Cancel
          </Button>
          <Button type="button" variant="outline" onClick={() => void save(true)} disabled={saving}>
            <Printer className="size-4" />
            Save &amp; Print
          </Button>
          <Button type="button" onClick={() => void save(false)} loading={saving}>
            <Save className="size-4" />
            Save
            <kbd className="ml-1 hidden rounded border border-white/30 px-1 text-[10px] sm:inline">
              Ctrl+S
            </kbd>
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <FormError message={formError} />

        {/* Header */}
        <FormSection>
          <FormGrid cols={3}>
            {firms.length > 1 ? (
              <Field id="firmId" label="Firm" required error={fieldErrors.firmId}>
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

            <Field
              id="number"
              label="Number"
              hint={isEdit ? undefined : "Leave blank to use the next number."}
              error={fieldErrors.number}
            >
              <Input
                id="number"
                value={number}
                onChange={(e) => setNumber(e.target.value)}
                placeholder="Auto"
                invalid={!!fieldErrors.number}
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

            {behaviour.ledger ? (
              <Field id="dueDate" label="Due date" error={fieldErrors.dueDate}>
                <Input
                  id="dueDate"
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  invalid={!!fieldErrors.dueDate}
                />
              </Field>
            ) : null}
          </FormGrid>
        </FormSection>

        {/* Party */}
        <FormSection>
          <FormGrid>
            <Field
              id="party"
              label={isPurchase ? "Supplier" : "Customer"}
              required={behaviour.ledger}
              error={fieldErrors.partyId}
            >
              <Combobox
                id="party"
                value={party}
                onChange={pickParty}
                onSearch={searchParties}
                placeholder={isPurchase ? "Search supplier" : "Search customer"}
                emptyLabel="No party matches"
                createLabel={(q) => `Add "${q}" as a new party`}
                onCreate={createPartyInline}
                invalid={!!fieldErrors.partyId}
              />
            </Field>

            {settings.gstEnabled ? (
              <Field
                id="stateOfSupply"
                label="Place of supply"
                hint="Decides CGST+SGST versus IGST."
              >
                <Select
                  value={partyState ?? effectiveFirmState}
                  onValueChange={(v) => setPartyState(v)}
                >
                  <SelectTrigger id="stateOfSupply">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {INDIAN_STATES.map((s) => (
                      <SelectItem key={s.code} value={s.code}>
                        {s.code} — {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            ) : null}
          </FormGrid>

          {settings.gstEnabled ? (
            <div className="mt-3">
              <Badge variant={isIgst ? "warning" : "brand"}>
                {isIgst ? "IGST" : "CGST + SGST"}
              </Badge>
            </div>
          ) : null}
        </FormSection>

        {/* Lines */}
        {fieldErrors.lines ? (
          <p className="text-[13px] text-[var(--color-negative)]" role="alert">
            {fieldErrors.lines}
          </p>
        ) : null}

        <LineItemGrid
          lines={lines}
          results={calc.lines}
          options={{
            showDiscount: settings.showLineDiscount,
            showFreeQty: settings.showFreeQuantity,
            showDescription: settings.showLineDescription,
            isPurchase,
            gstEnabled: settings.gstEnabled,
          }}
          taxRates={taxRates}
          units={units}
          onChange={updateLine}
          onAddLine={addLine}
          onRemoveLine={removeLine}
          errors={lineErrors}
        />

        {/* Footer: notes beside totals */}
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]">
          <div className="space-y-4">
            <FormSection title="Notes">
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                placeholder="Anything you want on this document"
              />
            </FormSection>

            <FormSection title="Terms &amp; conditions">
              <Textarea value={terms} onChange={(e) => setTerms(e.target.value)} rows={3} />
            </FormSection>

            {behaviour.ledger ? (
              <FormSection title="Payment">
                <FormGrid>
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

                  {paymentMode === "CHEQUE" ? (
                    <Field
                      id="chequeNo"
                      label="Cheque number"
                      required
                      error={fieldErrors.chequeNo}
                    >
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
            ) : null}
          </div>

          <TotalsPanel
            calc={calc}
            billDiscountValue={billDiscountValue}
            billDiscountIsPercent={billDiscountIsPercent}
            charges={charges}
            tcsRate={tcsRate}
            roundOffEnabled={roundOffEnabled}
            paidAmount={paidAmount}
            gstEnabled={settings.gstEnabled}
            showBillDiscount={settings.showBillDiscount}
            showCharges={settings.showAdditionalCharges}
            showTcs={settings.enableTcs}
            onChange={(patch) => {
              if (patch.billDiscountValue !== undefined) setBillDiscountValue(patch.billDiscountValue);
              if (patch.billDiscountIsPercent !== undefined)
                setBillDiscountIsPercent(patch.billDiscountIsPercent);
              if (patch.charges !== undefined) setCharges(patch.charges);
              if (patch.tcsRate !== undefined) setTcsRate(patch.tcsRate);
              if (patch.roundOffEnabled !== undefined) setRoundOffEnabled(patch.roundOffEnabled);
              if (patch.paidAmount !== undefined) setPaidAmount(patch.paidAmount);
            }}
          />
        </div>
      </div>
    </FormShell>
  );
}

function listPath(type: TransactionType): string {
  const map: Partial<Record<TransactionType, string>> = {
    SALE: "/sale/invoices",
    SALE_RETURN: "/sale/credit-notes",
    ESTIMATE: "/sale/estimates",
    PROFORMA: "/sale/proforma",
    SALE_ORDER: "/sale/orders",
    DELIVERY_CHALLAN: "/sale/challans",
    PURCHASE: "/purchase/bills",
    PURCHASE_RETURN: "/purchase/debit-notes",
    PURCHASE_ORDER: "/purchase/orders",
  };
  return map[type] ?? "/dashboard";
}
