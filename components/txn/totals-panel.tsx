"use client";

import * as React from "react";
import { Plus, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/controls";
import { formatCurrency } from "@/lib/format/number";
import { amountInWords } from "@/lib/format/words";
import type { CalcResult } from "@/lib/calc";
import type { TransactionInput } from "@/lib/validators/transaction";
import { cn } from "@/lib/utils";

type Charge = TransactionInput["additionalCharges"][number];

/**
 * The totals panel: discounts, charges, the GST split, TCS, round off and the
 * grand total, then how much was received and what is still due.
 */
export function TotalsPanel({
  calc,
  billDiscountValue,
  billDiscountIsPercent,
  charges,
  tcsRate,
  roundOffEnabled,
  paidAmount,
  gstEnabled,
  showBillDiscount,
  showCharges,
  showTcs,
  onChange,
}: {
  calc: CalcResult;
  billDiscountValue: string;
  billDiscountIsPercent: boolean;
  charges: Charge[];
  tcsRate: string;
  roundOffEnabled: boolean;
  paidAmount: string;
  gstEnabled: boolean;
  showBillDiscount: boolean;
  showCharges: boolean;
  showTcs: boolean;
  onChange: (patch: {
    billDiscountValue?: string;
    billDiscountIsPercent?: boolean;
    charges?: Charge[];
    tcsRate?: string;
    roundOffEnabled?: boolean;
    paidAmount?: string;
  }) => void;
}) {
  const total = Number(calc.total);
  const paid = Number(paidAmount || 0);
  const balance = total - paid;

  function updateCharge(index: number, patch: Partial<Charge>) {
    const next = charges.map((c, i) => (i === index ? { ...c, ...patch } : c));
    onChange({ charges: next });
  }

  return (
    <div className="surface-card divide-y divide-[var(--border-subtle)]">
      <div className="space-y-2.5 p-4">
        <Row label="Sub total" value={formatCurrency(calc.subTotal)} />

        {Number(calc.totalLineDiscount) > 0 ? (
          <Row
            label="Line discounts"
            value={`− ${formatCurrency(calc.totalLineDiscount)}`}
            tone="negative"
          />
        ) : null}

        {showBillDiscount ? (
          <div className="flex items-center justify-between gap-3">
            <span className="text-[13px] text-[var(--text-secondary)]">Discount on bill</span>
            <div className="flex items-center gap-1">
              <Input
                value={billDiscountValue}
                onChange={(e) => onChange({ billDiscountValue: e.target.value })}
                className="h-8 w-24 text-right"
                inputMode="decimal"
                placeholder="0"
                aria-label="Bill discount"
              />
              <button
                type="button"
                onClick={() => onChange({ billDiscountIsPercent: !billDiscountIsPercent })}
                className="h-8 w-8 shrink-0 rounded-lg border border-[var(--border-strong)] text-[12px] font-medium"
                aria-label={
                  billDiscountIsPercent ? "Discount is a percentage" : "Discount is an amount"
                }
              >
                {billDiscountIsPercent ? "%" : "₹"}
              </button>
            </div>
          </div>
        ) : null}

        {Number(calc.billDiscountAmount) > 0 ? (
          <Row
            label="Bill discount applied"
            value={`− ${formatCurrency(calc.billDiscountAmount)}`}
            tone="negative"
            muted
          />
        ) : null}
      </div>

      {showCharges ? (
        <div className="space-y-2 p-4">
          {charges.map((charge, i) => (
            <div key={i} className="flex items-center gap-2">
              <Input
                value={charge.name}
                onChange={(e) => updateCharge(i, { name: e.target.value })}
                placeholder="Shipping"
                className="h-8 flex-1"
                aria-label="Charge name"
              />
              <Input
                value={charge.amount}
                onChange={(e) => updateCharge(i, { amount: e.target.value })}
                className="h-8 w-24 text-right"
                inputMode="decimal"
                aria-label="Charge amount"
              />
              {gstEnabled ? (
                <label className="flex items-center gap-1 text-[11px] text-[var(--text-muted)]">
                  <Checkbox
                    checked={charge.taxRate !== null && charge.taxRate !== undefined}
                    onCheckedChange={(v) =>
                      updateCharge(i, { taxRate: v === true ? "18" : null })
                    }
                    className="size-4"
                  />
                  GST
                </label>
              ) : null}
              <button
                type="button"
                onClick={() => onChange({ charges: charges.filter((_, idx) => idx !== i) })}
                className="grid size-8 shrink-0 place-items-center rounded-md text-[var(--text-muted)] hover:text-[var(--color-negative)]"
                aria-label="Remove charge"
              >
                <X className="size-4" />
              </button>
            </div>
          ))}

          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() =>
              onChange({ charges: [...charges, { name: "", amount: "0", taxRate: null }] })
            }
          >
            <Plus className="size-4" />
            Add charge
          </Button>
        </div>
      ) : null}

      {gstEnabled ? (
        <div className="space-y-2.5 p-4">
          <Row label="Taxable value" value={formatCurrency(calc.taxableValue)} />
          {Number(calc.cgst) > 0 ? (
            <>
              <Row label="CGST" value={formatCurrency(calc.cgst)} muted />
              <Row label="SGST" value={formatCurrency(calc.sgst)} muted />
            </>
          ) : null}
          {Number(calc.igst) > 0 ? <Row label="IGST" value={formatCurrency(calc.igst)} muted /> : null}
          {Number(calc.cess) > 0 ? <Row label="Cess" value={formatCurrency(calc.cess)} muted /> : null}
        </div>
      ) : null}

      <div className="space-y-2.5 p-4">
        {showTcs ? (
          <div className="flex items-center justify-between gap-3">
            <span className="text-[13px] text-[var(--text-secondary)]">TCS %</span>
            <Input
              value={tcsRate}
              onChange={(e) => onChange({ tcsRate: e.target.value })}
              className="h-8 w-24 text-right"
              inputMode="decimal"
              placeholder="0"
              aria-label="TCS rate"
            />
          </div>
        ) : null}
        {Number(calc.tcs) > 0 ? <Row label="TCS" value={formatCurrency(calc.tcs)} muted /> : null}

        <label className="flex items-center justify-between gap-3">
          <span className="flex items-center gap-2 text-[13px] text-[var(--text-secondary)]">
            <Checkbox
              checked={roundOffEnabled}
              onCheckedChange={(v) => onChange({ roundOffEnabled: v === true })}
              className="size-4"
            />
            Round off
          </span>
          <span className="tnum text-[13px]">{formatCurrency(calc.roundOff)}</span>
        </label>
      </div>

      <div className="p-4">
        <div className="flex items-center justify-between gap-3">
          <span className="text-[15px] font-semibold">Total</span>
          <span className="tnum text-xl font-semibold">{formatCurrency(calc.total)}</span>
        </div>
        <p className="mt-1.5 text-[11px] leading-snug text-[var(--text-muted)]">
          {amountInWords(calc.total)}
        </p>
      </div>

      <div className="space-y-2.5 p-4">
        <div className="flex items-center justify-between gap-3">
          <span className="text-[13px] text-[var(--text-secondary)]">Received</span>
          <div className="flex items-center gap-1">
            <Input
              value={paidAmount}
              onChange={(e) => onChange({ paidAmount: e.target.value })}
              className="h-8 w-28 text-right"
              inputMode="decimal"
              placeholder="0"
              aria-label="Amount received"
            />
            <button
              type="button"
              onClick={() => onChange({ paidAmount: calc.total })}
              className="h-8 shrink-0 rounded-lg border border-[var(--border-strong)] px-2 text-[11px] font-medium"
            >
              Full
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-[var(--border-subtle)] pt-2.5">
          <span className="text-[13px] font-medium">Balance due</span>
          <span
            className={cn(
              "tnum text-[15px] font-semibold",
              balance > 0.005 ? "text-[var(--color-negative)]" : "text-[var(--color-positive)]",
            )}
          >
            {formatCurrency(balance)}
          </span>
        </div>
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  tone,
  muted,
}: {
  label: string;
  value: string;
  tone?: "negative";
  muted?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span
        className={cn(
          "text-[13px]",
          muted ? "text-[var(--text-muted)]" : "text-[var(--text-secondary)]",
        )}
      >
        {label}
      </span>
      <span
        className={cn(
          "tnum text-[13px]",
          tone === "negative" && "text-[var(--color-negative)]",
          muted && "text-[var(--text-muted)]",
        )}
      >
        {value}
      </span>
    </div>
  );
}
