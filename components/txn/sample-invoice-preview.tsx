import * as React from "react";
import { formatCurrency } from "@/lib/format/number";
import { amountInWords } from "@/lib/format/words";
import { stateName } from "@/lib/gst";
import { cn, initials } from "@/lib/utils";

export interface PreviewFirm {
  name: string;
  gstin?: string | null;
  stateCode?: string | null;
  addressLine1?: string | null;
  addressLine2?: string | null;
  city?: string | null;
  pincode?: string | null;
  phone?: string | null;
  email?: string | null;
}

/**
 * The live "Sample Tax Invoice" beside the setup wizard (ref-10).
 *
 * The block order here is the contract for the real print themes: firm header,
 * Bill To + Invoice Details, line table, tax summary, totals with amount in
 * words, terms, signature.
 */
export function SampleInvoicePreview({
  firm,
  className,
}: {
  firm: PreviewFirm;
  className?: string;
}) {
  const address = [firm.addressLine1, firm.addressLine2, firm.city, firm.pincode]
    .filter(Boolean)
    .join(", ");

  // One representative line, chosen so the arithmetic is easy to eyeball.
  const taxable = 3000;
  const rate = 18;
  const tax = (taxable * rate) / 100;
  const total = taxable + tax;

  return (
    <div
      className={cn(
        "mx-auto w-full max-w-[520px] rounded-lg border border-[var(--border-subtle)] bg-white p-4 text-[9px] leading-tight text-ink-900 shadow-sm",
        className,
      )}
      aria-label="Sample invoice preview"
    >
      {/* Firm header */}
      <div className="flex gap-3 rounded border border-brand-200 bg-brand-50/60 p-3">
        <div className="grid size-12 shrink-0 place-items-center rounded bg-accent-500 text-[13px] font-bold text-white">
          {initials(firm.name || "My Company")}
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[13px] font-bold uppercase tracking-tight">
            {firm.name || "My Company"}
          </div>
          {address ? <div className="mt-0.5 truncate text-ink-600">{address}</div> : null}
          <div className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-ink-600">
            {firm.phone ? <span>Phone: {firm.phone}</span> : null}
            {firm.email ? <span>Email: {firm.email}</span> : null}
          </div>
          <div className="mt-0.5 flex flex-wrap gap-x-4 gap-y-0.5 text-ink-600">
            {firm.gstin ? <span className="font-semibold">GSTIN: {firm.gstin}</span> : null}
            {firm.stateCode ? <span>State: {stateName(firm.stateCode)}</span> : null}
          </div>
        </div>
      </div>

      {/* Bill To + Invoice Details */}
      <div className="mt-2 grid grid-cols-2 border border-ink-200">
        <div className="border-r border-ink-200 p-2">
          <div className="mb-1 font-semibold uppercase text-ink-500">Bill To</div>
          <div className="font-medium">Sample Party</div>
          <div className="text-ink-600">Sample Address, Thrissur</div>
          <div className="text-ink-600">Contact No.: 98XX XXX XXX</div>
        </div>
        <div className="p-2">
          <div className="mb-1 font-semibold uppercase text-ink-500">Invoice Details</div>
          <div>
            No: <span className="font-medium">1</span>
          </div>
          <div>
            Date: <span className="font-medium">01/04/2026</span>
          </div>
        </div>
      </div>

      {/* Lines */}
      <table className="mt-2 w-full border-collapse border border-ink-200">
        <thead>
          <tr className="bg-ink-100 text-left">
            <th className="border border-ink-200 px-1.5 py-1 font-semibold">#</th>
            <th className="border border-ink-200 px-1.5 py-1 font-semibold">Item name</th>
            <th className="border border-ink-200 px-1.5 py-1 font-semibold">HSN/SAC</th>
            <th className="border border-ink-200 px-1.5 py-1 text-right font-semibold">Qty</th>
            <th className="border border-ink-200 px-1.5 py-1 font-semibold">Unit</th>
            <th className="border border-ink-200 px-1.5 py-1 text-right font-semibold">
              Price/Unit
            </th>
            <th className="border border-ink-200 px-1.5 py-1 text-right font-semibold">GST</th>
            <th className="border border-ink-200 px-1.5 py-1 text-right font-semibold">Amount</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td className="border border-ink-200 px-1.5 py-1">1</td>
            <td className="border border-ink-200 px-1.5 py-1">Sample Item</td>
            <td className="border border-ink-200 px-1.5 py-1">998596</td>
            <td className="border border-ink-200 px-1.5 py-1 text-right tabular-nums">1</td>
            <td className="border border-ink-200 px-1.5 py-1">NOS</td>
            <td className="border border-ink-200 px-1.5 py-1 text-right tabular-nums">
              {formatCurrency(taxable)}
            </td>
            <td className="border border-ink-200 px-1.5 py-1 text-right tabular-nums">
              {formatCurrency(tax)}
            </td>
            <td className="border border-ink-200 px-1.5 py-1 text-right tabular-nums">
              {formatCurrency(total)}
            </td>
          </tr>
          <tr className="bg-ink-50 font-semibold">
            <td className="border border-ink-200 px-1.5 py-1" colSpan={3}>
              Total
            </td>
            <td className="border border-ink-200 px-1.5 py-1 text-right tabular-nums">1</td>
            <td className="border border-ink-200 px-1.5 py-1" colSpan={2} />
            <td className="border border-ink-200 px-1.5 py-1 text-right tabular-nums">
              {formatCurrency(tax)}
            </td>
            <td className="border border-ink-200 px-1.5 py-1 text-right tabular-nums">
              {formatCurrency(total)}
            </td>
          </tr>
        </tbody>
      </table>

      {/* Tax summary + totals */}
      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        <table className="w-full border-collapse border border-ink-200">
          <thead>
            <tr className="bg-ink-100">
              <th className="border border-ink-200 px-1.5 py-1 text-left font-semibold">HSN/SAC</th>
              <th className="border border-ink-200 px-1.5 py-1 text-right font-semibold">
                Taxable
              </th>
              <th className="border border-ink-200 px-1.5 py-1 text-right font-semibold" colSpan={2}>
                CGST
              </th>
              <th className="border border-ink-200 px-1.5 py-1 text-right font-semibold" colSpan={2}>
                SGST
              </th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="border border-ink-200 px-1.5 py-1">998596</td>
              <td className="border border-ink-200 px-1.5 py-1 text-right tabular-nums">
                {formatCurrency(taxable)}
              </td>
              <td className="border border-ink-200 px-1.5 py-1 text-right">9%</td>
              <td className="border border-ink-200 px-1.5 py-1 text-right tabular-nums">
                {formatCurrency(tax / 2)}
              </td>
              <td className="border border-ink-200 px-1.5 py-1 text-right">9%</td>
              <td className="border border-ink-200 px-1.5 py-1 text-right tabular-nums">
                {formatCurrency(tax / 2)}
              </td>
            </tr>
          </tbody>
        </table>

        <div className="space-y-0.5 border border-ink-200 p-2">
          <Row label="Sub Total" value={formatCurrency(taxable)} />
          <Row label="Total" value={formatCurrency(total)} bold />
          <div className="border-t border-ink-200 pt-1">
            <div className="text-ink-500">Invoice Amount in Words</div>
            <div className="font-medium">{amountInWords(total)}</div>
          </div>
          <Row label="Received" value={formatCurrency(0)} />
          <Row label="Balance" value={formatCurrency(total)} bold />
        </div>
      </div>

      {/* Terms + signature */}
      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        <div className="border border-ink-200 p-2">
          <div className="font-semibold uppercase text-ink-500">Terms &amp; Conditions</div>
          <div className="mt-0.5 text-ink-600">Thanks for doing business with us.</div>
        </div>
        <div className="flex flex-col justify-between border border-ink-200 p-2">
          <div className="text-right font-medium">For {firm.name || "My Company"}</div>
          <div className="mt-6 border-t border-ink-300 pt-1 text-right text-ink-500">
            Authorised Signatory
          </div>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className={cn("flex items-center justify-between gap-3", bold && "font-semibold")}>
      <span className={cn(!bold && "text-ink-600")}>{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  );
}
